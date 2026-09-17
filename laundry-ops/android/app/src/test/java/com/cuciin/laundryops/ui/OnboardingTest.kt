package com.cuciin.laundryops.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Layar pembuka sebelum halaman masuk.
 *
 * Dikunci di sini: jumlah halaman, urutan teks, dan pemetaan gambar. Salah tempel gambar atau
 * salah urutan tidak akan ketahuan dari build, jadi harus diperiksa di sini.
 */
class OnboardingTest {

    @Test
    fun jumlahHalamanTiga() {
        assertEquals(3, Onboarding.pages.size)
        assertEquals(2, Onboarding.lastIndex)
    }

    @Test
    fun urutanJudulSesuaiKesepakatan() {
        assertEquals(
            listOf(
                "Semua cabang dalam satu aplikasi",
                "Tetap jalan tanpa internet",
                "Akses sesuai peran",
            ),
            Onboarding.pages.map { it.title },
        )
    }

    @Test
    fun setiapHalamanPunyaGambarDanBarisPendukung() {
        Onboarding.pages.forEach { page ->
            assertTrue("Gambar halaman '${page.title}' harus ada", page.image != 0)
            assertTrue("Baris pendukung '${page.title}' tidak boleh kosong", page.body.isNotBlank())
        }
    }

    @Test
    fun gambarTidakDipakaiBerulang() {
        val images = Onboarding.pages.map { it.image }
        assertEquals("Tiap halaman memakai gambar berbeda", images.size, images.toSet().size)
    }

    @Test
    fun judulTidakTerlaluPanjangUntukSatuLayar() {
        // Judul panjang akan memakan ruang gambar; batas ini menjaga tata letaknya tetap lega.
        Onboarding.pages.forEach { page ->
            assertTrue("Judul '${page.title}' terlalu panjang (${page.title.length} huruf)", page.title.length <= 40)
        }
    }

    @Test
    fun barisPendukungSatuKalimatPendek() {
        Onboarding.pages.forEach { page ->
            assertTrue("Baris '${page.body}' terlalu panjang (${page.body.length} huruf)", page.body.length <= 60)
        }
    }
}
