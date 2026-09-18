package com.cuciin.laundryops.data

import android.app.Application
import android.util.Log
import com.cuciin.laundryops.BuildConfig
import kotlinx.serialization.json.Json
import java.io.File
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption

object LocalJson {
    private const val TAG = "CuciinDisk"
    val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        prettyPrint = false
    }
    private lateinit var file: File
    private lateinit var backup: File
    private var latestSavedAt = Long.MIN_VALUE

    fun init(app: Application) {
        file = File(app.filesDir, "cuciin-data.json")
        backup = File(app.filesDir, "cuciin-data.backup.json")
        val environment = File(app.filesDir, "cuciin-cloud-environment.txt")
        val priorEndpoint = environment.takeIf { it.isFile }?.readText()?.trim()
        val currentEndpoint = BuildConfig.CUCIIN_CLOUD_URL.trim()
        val needsIsolationReset = (priorEndpoint?.isNotBlank() == true && priorEndpoint != currentEndpoint) ||
            (BuildConfig.DEBUG && priorEndpoint.isNullOrBlank())
        if (needsIsolationReset) {
            listOf(
                file,
                backup,
                File(app.filesDir, "cuciin-data.json.tmp"),
                File(app.filesDir, "cuciin-sync-state.json"),
                File(app.filesDir, "cuciin-sync-state.backup.json"),
                File(app.filesDir, "cuciin-sync-state.json.tmp"),
            ).forEach { it.delete() }
            File(app.filesDir, "attendance").deleteRecursively()
            File(app.filesDir, "proofs").deleteRecursively()
            Log.i(TAG, "Data lokal dihapus karena endpoint cloud berubah")
        }
        environment.writeText(currentEndpoint)
        latestSavedAt = Long.MIN_VALUE
    }

    fun load(): Snapshot? {
        if (!::file.isInitialized) return null
        fun decode(candidate: File): Snapshot? {
            if (!candidate.exists()) return null
            return try {
                json.decodeFromString<Snapshot>(candidate.readText()).takeIf { it.staff.isNotEmpty() && it.branches.isNotEmpty() }
            } catch (e: Exception) {
                Log.e(TAG, "load ${candidate.name} gagal", e)
                null
            }
        }
        decode(file)?.let {
            latestSavedAt = it.updatedAt
            return it
        }
        val recovered = decode(backup) ?: return null
        try { backup.copyTo(file, overwrite = true) } catch (e: Exception) { Log.w(TAG, "pemulihan file utama gagal", e) }
        Log.w(TAG, "database lokal dipulihkan dari salinan cadangan")
        latestSavedAt = recovered.updatedAt
        return recovered
    }

    @Synchronized
    fun save(snap: Snapshot) {
        if (!::file.isInitialized) return
        if (latestSavedAt > snap.updatedAt) return
        val text = json.encodeToString(Snapshot.serializer(), snap)
        val tmp = File(file.parentFile, "cuciin-data.json.tmp")
        tmp.writeText(text)
        if (file.exists()) {
            try {
                val current = json.decodeFromString<Snapshot>(file.readText())
                if (current.staff.isNotEmpty() && current.branches.isNotEmpty()) file.copyTo(backup, overwrite = true)
            } catch (e: Exception) {
                Log.w(TAG, "file utama lama tidak layak dijadikan cadangan", e)
            }
        }
        try {
            Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } catch (_: AtomicMoveNotSupportedException) {
            Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING)
        } catch (e: Exception) {
            Log.w(TAG, "penggantian file atomik gagal", e)
            file.writeText(text)
            tmp.delete()
        }
        if (!backup.exists()) {
            try {
                file.copyTo(backup, overwrite = true)
            } catch (e: Exception) {
                Log.w(TAG, "pembuatan salinan cadangan gagal", e)
            }
        }
        latestSavedAt = maxOf(latestSavedAt, snap.updatedAt)
    }
}
