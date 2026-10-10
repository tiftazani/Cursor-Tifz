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
        check(!environment.exists() || environment.isFile) { "Penanda server tidak dapat dibaca" }
        val hasLocalData = app.filesDir.listFiles()?.any {
            it.name.startsWith("cuciin-") && it != environment || it.name in setOf("attendance", "proofs")
        } ?: error("Folder data tidak dapat dibaca")
        check(priorEndpoint == currentEndpoint || (!hasLocalData && priorEndpoint.isNullOrBlank())) {
            "Alamat server tidak cocok dengan data lokal. Data tetap tersimpan; gunakan aplikasi dengan server asal."
        }
        if (priorEndpoint != currentEndpoint) environment.writeText(currentEndpoint)
        latestSavedAt = Long.MIN_VALUE
    }

    fun load(): Snapshot? {
        if (!::file.isInitialized) return null
        fun decode(candidate: File): Snapshot? = runCatching {
            if (!candidate.isFile) null
            else json.decodeFromString<Snapshot>(candidate.readText()).takeIf { it.staff.isNotEmpty() && it.branches.isNotEmpty() }
        }.getOrNull()
        decode(file)?.let {
            latestSavedAt = it.updatedAt
            return it
        }
        val recovered = decode(backup)
        check(recovered != null || (!file.exists() && !backup.exists())) { "Berkas data lokal dan cadangannya tidak dapat dibaca" }
        if (recovered == null) return null
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
            val current = runCatching { json.decodeFromString<Snapshot>(file.readText()) }.getOrNull()
            if (current != null && current.staff.isNotEmpty() && current.branches.isNotEmpty()) file.copyTo(backup, overwrite = true)
        }
        try {
            Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } catch (_: AtomicMoveNotSupportedException) {
            Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING)
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
