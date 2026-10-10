package com.cuciin.laundryops.data

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import java.io.File
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption

internal class AccessPersistence(directory: File) {
    private val file = File(directory, "cuciin-access.json")
    private val temp = File(directory, "${file.name}.tmp")

    // Sisa penulisan berarti izin lama belum aman dipakai setelah restart.
    private fun entries(): Map<String, Snapshot> =
        if (file.isFile) LocalJson.json.decodeFromString(file.readText()) else emptyMap()

    @Synchronized fun load(email: String): Snapshot? =
        if (temp.exists()) Snapshot()
        else if (file.exists()) {
            check(file.isFile) { "Berkas izin tidak dapat dibaca" }
            entries()[email.trim().lowercase()] ?: Snapshot()
        } else null

    @Synchronized fun save(email: String, access: Snapshot) {
        val previous = if (temp.exists()) emptyMap() else try { entries() } catch (_: kotlinx.serialization.SerializationException) { emptyMap() }
        val values = previous + (email.trim().lowercase() to access)
        temp.writeText(LocalJson.json.encodeToString(values))
        try {
            Files.move(temp.toPath(), file.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } catch (_: AtomicMoveNotSupportedException) {
            Files.move(temp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING)
        }
    }
}
