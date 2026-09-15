package com.tiftazani.laundryops.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.net.Uri
import androidx.core.content.FileProvider
import com.tiftazani.laundryops.BuildConfig
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/** Foto absensi disimpan hanya di ruang privat aplikasi dan diberi cap waktu setelah kamera selesai. */
object AttendancePhotos {
    fun createTarget(context: Context, stage: String): Pair<File, Uri> {
        val dir = File(context.filesDir, "attendance").apply { mkdirs() }
        val file = File(dir, "${stage}-${Clock.nowMs()}-${UUID.randomUUID().toString().take(8)}.jpg")
        val uri = FileProvider.getUriForFile(context, "${BuildConfig.APPLICATION_ID}.files", file)
        return file to uri
    }

    fun stamp(file: File, stage: String, staffName: String, branchName: String, atMs: Long = Clock.nowMs()): String? = runCatching {
        val raw = BitmapFactory.decodeFile(file.absolutePath) ?: return null
        val maxWidth = 1920
        val image = if (raw.width > maxWidth) {
            val height = (raw.height * (maxWidth.toFloat() / raw.width)).toInt().coerceAtLeast(1)
            Bitmap.createScaledBitmap(raw, maxWidth, height, true).also { if (it !== raw) raw.recycle() }
        } else raw
        val canvas = Canvas(image)
        val density = image.density.takeIf { it > 0 } ?: 160
        val textSize = (16 * density / 160f).coerceAtLeast(22f)
        val padding = (12 * density / 160f).toInt().coerceAtLeast(18)
        val lines = listOf("ABSEN ${stage.uppercase()}", staffName, branchName, Clock.nowLabel(atMs) + " WIB")
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; this.textSize = textSize; typeface = android.graphics.Typeface.DEFAULT_BOLD }
        val boxHeight = (lines.size * (textSize * 1.35f) + padding * 2).toInt()
        Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(190, 0, 35, 38) }.also { canvas.drawRect(0f, (image.height - boxHeight).toFloat(), image.width.toFloat(), image.height.toFloat(), it) }
        lines.forEachIndexed { index, line -> canvas.drawText(line, padding.toFloat(), image.height - boxHeight + padding + textSize * (index + 1), paint) }
        FileOutputStream(file, false).use { output -> image.compress(Bitmap.CompressFormat.JPEG, 90, output) }
        image.recycle()
        file.absolutePath
    }.getOrNull()
}
