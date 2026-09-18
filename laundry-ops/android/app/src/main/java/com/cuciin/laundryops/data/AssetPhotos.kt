package com.cuciin.laundryops.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.core.content.FileProvider
import com.cuciin.laundryops.BuildConfig
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/**
 * Foto aset disimpan hanya di ruang privat perangkat ini.
 *
 * Server tidak menyimpan foto aset karena R2 belum aktif dan blob besar akan membengkak
 * pada snapshot yang dikirim ke seluruh cabang. Path foto karena itu tidak ikut dikirim;
 * perangkat lain hanya menerima metadata aset.
 */
object AssetPhotos {
    private const val MAX_WIDTH = 1280

    fun createTarget(context: Context): Pair<File, Uri> {
        val dir = File(context.filesDir, "assets").apply { mkdirs() }
        val file = File(dir, "aset-${Clock.nowMs()}-${UUID.randomUUID().toString().take(8)}.jpg")
        val uri = FileProvider.getUriForFile(context, "${BuildConfig.APPLICATION_ID}.files", file)
        return file to uri
    }

    /** Menyalin foto dari galeri ke ruang privat aplikasi, lalu mengompresnya. */
    fun importFromUri(context: Context, uri: Uri): String? = runCatching {
        val dir = File(context.filesDir, "assets").apply { mkdirs() }
        val file = File(dir, "aset-${Clock.nowMs()}-${UUID.randomUUID().toString().take(8)}.jpg")
        context.contentResolver.openInputStream(uri)?.use { input ->
            file.outputStream().use { output -> input.copyTo(output) }
        } ?: return null
        compress(file)
    }.getOrNull()

    /** Mengompres hasil kamera di tempat dan mengembalikan path akhirnya. */
    fun compressCaptured(file: File): String? = runCatching { compress(file) }.getOrNull()

    private fun compress(file: File): String? {
        val raw = BitmapFactory.decodeFile(file.absolutePath) ?: return null
        val image = if (raw.width > MAX_WIDTH) {
            val height = (raw.height * (MAX_WIDTH.toFloat() / raw.width)).toInt().coerceAtLeast(1)
            Bitmap.createScaledBitmap(raw, MAX_WIDTH, height, true).also { if (it !== raw) raw.recycle() }
        } else raw
        FileOutputStream(file, false).use { output -> image.compress(Bitmap.CompressFormat.JPEG, 82, output) }
        image.recycle()
        return file.absolutePath
    }

    fun delete(path: String) {
        if (path.isBlank()) return
        runCatching { File(path).takeIf { it.isFile }?.delete() }
    }
}
