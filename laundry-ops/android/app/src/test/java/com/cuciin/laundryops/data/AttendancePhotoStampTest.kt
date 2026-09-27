package com.cuciin.laundryops.data

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga: foto absensi harus dibaca sebagai bitmap yang boleh diubah.
 *
 * Kamera mengembalikan berkas JPEG. `BitmapFactory.decodeFile(path)` tanpa opsi menghasilkan
 * bitmap yang tidak boleh diubah (immutable), sehingga `Canvas(image)` melempar
 * `IllegalStateException: Immutable bitmap passed to Canvas constructor`. Akibatnya cap waktu
 * gagal digambar dan layar absensi berbunyi "Foto belum dapat diproses. Coba ambil kembali.",
 * padahal fotonya sudah terambil.
 *
 * Test ini membaca berkas sumber langsung supaya perbaikan tidak bisa hilang tanpa ketahuan.
 */
class AttendancePhotoStampTest {

    /** Akar sumber, naik dari folder kelas test ke akar modul `app`. */
    private val appDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    private val sumber: File
        get() = File(appDir, "src/main/java/com/cuciin/laundryops/data/AttendancePhotos.kt")

    @Test
    fun berkasSumberDitemukan() {
        assertTrue("Berkas AttendancePhotos.kt tidak ditemukan di ${sumber.path}", sumber.isFile)
    }

    @Test
    fun fotoAbsensiDibacaSebagaiBitmapYangBolehDiubah() {
        val teks = sumber.readText()
        val baris = teks.lines().firstOrNull { it.contains("decodeFile(") }.orEmpty()
        assertTrue("Baris decodeFile tidak ditemukan di AttendancePhotos.kt", baris.isNotBlank())
        assertTrue(
            "decodeFile harus membaca dengan opsi inMutable = true supaya cap waktu bisa digambar: $baris",
            baris.contains("inMutable = true"),
        )
    }
}
