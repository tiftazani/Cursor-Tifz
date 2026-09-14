package com.tiftazani.laundryops.data

import android.app.Application
import android.util.Log
import java.io.File
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption

internal class SyncPersistence(app: Application) {
    private val file = File(app.filesDir, "cuciin-sync-state.json")
    private val backup = File(app.filesDir, "cuciin-sync-state.backup.json")

    fun load(): SyncClientState {
        fun decode(candidate: File): SyncClientState? = try {
            if (!candidate.isFile) null
            else LocalJson.json.decodeFromString(SyncClientState.serializer(), candidate.readText())
        } catch (error: Exception) {
            Log.w(TAG, "Antrean ${candidate.name} tidak dapat dibaca", error)
            null
        }
        return decode(file) ?: decode(backup) ?: SyncClientState()
    }

    /** Antrean ditulis sinkron dan atomik agar command tidak hilang saat proses aplikasi dihentikan. */
    @Synchronized
    fun save(state: SyncClientState) {
        val text = LocalJson.json.encodeToString(SyncClientState.serializer(), state)
        val temp = File(file.parentFile, "${file.name}.tmp")
        temp.writeText(text)
        if (file.isFile) try {
            file.copyTo(backup, overwrite = true)
        } catch (error: Exception) {
            Log.w(TAG, "Salinan antrean lama gagal dibuat", error)
        }
        try {
            Files.move(temp.toPath(), file.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } catch (_: AtomicMoveNotSupportedException) {
            Files.move(temp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING)
        } catch (error: Exception) {
            Log.w(TAG, "Penggantian antrean atomik gagal", error)
            file.writeText(text)
            temp.delete()
        }
        if (!backup.isFile) try {
            file.copyTo(backup, overwrite = true)
        } catch (error: Exception) {
            Log.w(TAG, "Salinan antrean awal gagal dibuat", error)
        }
    }

    private companion object {
        const val TAG = "CuciinSyncDisk"
    }
}
