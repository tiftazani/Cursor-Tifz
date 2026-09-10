package com.tiftazani.laundryops.data

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.core.content.FileProvider
import com.tiftazani.laundryops.BuildConfig
import java.io.File

object FileExports {
    fun copyProof(ctx: Context, notaId: String, uri: Uri): String? {
        val dir = File(ctx.filesDir, "proofs/$notaId").apply { mkdirs() }
        val name = "bukti-${Clock.nowMs()}.jpg"
        val dest = File(dir, name)
        return try {
            ctx.contentResolver.openInputStream(uri)?.use { input ->
                dest.outputStream().use { input.copyTo(it) }
            } ?: return null
            dest.absolutePath
        } catch (_: Exception) {
            null
        }
    }

    fun shareText(ctx: Context, text: String) {
        ctx.startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                },
                "Kirim nota",
            ),
        )
    }

    fun shareCsv(ctx: Context, n: Nota) {
        val dir = File(ctx.cacheDir, "share").apply { mkdirs() }
        val file = File(dir, "${n.id}.csv")
        file.writeText(
            "ID,Cabang,Waktu,Kasir,Pelanggan,Telepon,Item,Total,Dibayar,Metode,Bayar,Laundry,Pickup\n" +
                listOf(
                    n.id, n.branchId, n.createdAt, n.kasir, n.customer, n.phone, n.items,
                    n.total, n.paid, n.payMethod.label, n.pay.label, n.laundry.label, n.pickupAt,
                ).joinToString(",") { "\"${it.toString().replace("\"", "\"\"")}\"" } + "\n",
        )
        shareFile(ctx, file, "text/csv")
    }

    fun sharePdf(ctx: Context, n: Nota) {
        val dir = File(ctx.cacheDir, "share").apply { mkdirs() }
        val file = File(dir, "${n.id}.pdf")
        val pdf = PdfDocument()
        val page = pdf.startPage(PdfDocument.PageInfo.Builder(595, 842, 1).create())
        val canvas = page.canvas
        val title = Paint().apply {
            color = Color.BLACK
            textSize = 18f
            isFakeBoldText = true
            isAntiAlias = true
        }
        val body = Paint().apply {
            color = Color.BLACK
            textSize = 12f
            isAntiAlias = true
        }
        var y = 56f
        canvas.drawText("Cuciin — Nota ${n.id}", 48f, y, title)
        y += 28f
        CuciinStore.notaText(n).lines().forEach { line ->
            if (y > 800f) return@forEach
            canvas.drawText(line, 48f, y, body)
            y += 16f
        }
        pdf.finishPage(page)
        file.outputStream().use { pdf.writeTo(it) }
        pdf.close()
        shareFile(ctx, file, "application/pdf")
    }

    private fun shareFile(ctx: Context, file: File, type: String) {
        val uri = FileProvider.getUriForFile(ctx, "${BuildConfig.APPLICATION_ID}.files", file)
        ctx.startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND).apply {
                    this.type = type
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                },
                "Kirim file",
            ),
        )
    }
}
