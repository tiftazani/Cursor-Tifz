package com.cuciin.laundryops.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import java.io.File

/**
 * JPEG nota pelanggan.
 *
 * Sumbernya berkas PDF yang sama dengan tombol PDF ([ReportPdf.nota]), lalu tiap halaman
 * dirender ke bitmap dan digabung tegak menjadi satu gambar. Karena tata letak nota hanya hidup
 * di `ReportPdf.renderNota`, gambar JPEG tidak mungkin berbeda dari PDF-nya.
 *
 * Nota banyak halaman tetap menjadi SATU berkas gambar, jadi pelanggan menerima satu gambar
 * utuh, bukan beberapa lampiran.
 */
internal object ReportJpeg {

    fun nota(ctx: Context, nota: Nota): File {
        val pdf = ReportPdf.nota(ctx, nota)
        val file = File(File(ctx.cacheDir, "share").apply { mkdirs() }, "${nota.id}.jpg")
        ParcelFileDescriptor.open(pdf, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
            PdfRenderer(descriptor).use { renderer -> render(renderer, file) }
        }
        return file
    }

    private fun render(renderer: PdfRenderer, out: File) {
        val halaman = renderer.pageCount
        if (halaman <= 0) return
        val ukuran = renderer.openPage(0).use { it.width to it.height }
        val skala = NotaJpeg.skalaEfektif(halaman, ukuran.second)
        val lebar = NotaJpeg.lebar(halaman, ukuran.first, ukuran.second)
        val tinggi = NotaJpeg.tinggiGabungan(halaman, ukuran.second) / halaman
        // PdfRenderer tidak menskalakan sendiri: tanpa matriks ini halaman dirender 1:1 di
        // pojok kiri atas bitmap yang lebih besar, sehingga nota tampak kecil.
        val matriks = Matrix().apply { setScale(skala, skala) }
        val gambar = Bitmap.createBitmap(lebar, tinggi * halaman, Bitmap.Config.ARGB_8888)
        val kanvas = Canvas(gambar)
        kanvas.drawColor(Color.WHITE)
        val lembar = Bitmap.createBitmap(lebar, tinggi, Bitmap.Config.ARGB_8888)
        repeat(halaman) { index ->
            lembar.eraseColor(Color.WHITE)
            renderer.openPage(index).use { page ->
                page.render(lembar, null, matriks, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            }
            kanvas.drawBitmap(lembar, 0f, (index * tinggi).toFloat(), null)
        }
        lembar.recycle()
        out.outputStream().use { gambar.compress(Bitmap.CompressFormat.JPEG, NotaJpeg.KUALITAS, it) }
        gambar.recycle()
    }
}
