package com.tiftazani.laundryops.data

import android.app.Application
import android.util.Log
import kotlinx.serialization.json.Json
import java.io.File
import java.util.concurrent.Executors

object LocalJson {
    private const val TAG = "CuciinDisk"
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        prettyPrint = true
    }
    private val io = Executors.newSingleThreadExecutor()
    private lateinit var file: File

    fun init(app: Application) {
        file = File(app.filesDir, "cuciin-data.json")
    }

    fun load(): Snapshot? {
        if (!::file.isInitialized || !file.exists()) return null
        return try {
            json.decodeFromString<Snapshot>(file.readText())
        } catch (e: Exception) {
            Log.e(TAG, "load gagal", e)
            null
        }
    }

    fun save(snap: Snapshot) {
        if (!::file.isInitialized) return
        val text = json.encodeToString(Snapshot.serializer(), snap)
        io.execute {
            synchronized(this) {
                val tmp = File(file.parentFile, "cuciin-data.json.tmp")
                tmp.writeText(text)
                if (!tmp.renameTo(file)) {
                    file.writeText(text)
                    tmp.delete()
                }
            }
        }
    }
}
