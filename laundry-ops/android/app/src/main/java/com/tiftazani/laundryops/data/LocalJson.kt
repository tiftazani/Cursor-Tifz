package com.tiftazani.laundryops.data

import android.app.Application
import android.util.Log
import kotlinx.serialization.json.Json
import java.io.File
import java.util.concurrent.Executors

object LocalJson {
    private const val TAG = "CuciinDisk"
    val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        prettyPrint = false
    }
    private val io = Executors.newSingleThreadExecutor()
    private lateinit var file: File
    private lateinit var backup: File

    fun init(app: Application) {
        file = File(app.filesDir, "cuciin-data.json")
        backup = File(app.filesDir, "cuciin-data.backup.json")
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
        decode(file)?.let { return it }
        val recovered = decode(backup) ?: return null
        try { backup.copyTo(file, overwrite = true) } catch (e: Exception) { Log.w(TAG, "pemulihan file utama gagal", e) }
        Log.w(TAG, "database lokal dipulihkan dari salinan cadangan")
        return recovered
    }

    fun save(snap: Snapshot) {
        if (!::file.isInitialized) return
        val text = json.encodeToString(Snapshot.serializer(), snap)
        io.execute {
            synchronized(this) {
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
                if (!tmp.renameTo(file)) {
                    file.writeText(text)
                    tmp.delete()
                }
                if (!backup.exists()) file.copyTo(backup, overwrite = true)
            }
        }
    }
}
