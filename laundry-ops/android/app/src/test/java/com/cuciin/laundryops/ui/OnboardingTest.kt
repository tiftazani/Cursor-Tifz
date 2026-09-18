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

    @Test
    fun tombolUtamaBerubahDiHalamanTerakhir() {
        // Halaman 1 dan 2 masih punya lanjutan, halaman 3 adalah pintu masuk ke akun.
        assertEquals("Lanjut", Onboarding.primaryLabel(0))
        assertEquals("Lanjut", Onboarding.primaryLabel(1))
        assertEquals("Masuk ke akun", Onboarding.primaryLabel(Onboarding.lastIndex))
    }

    @Test
    fun tombolKeduaHanyaSaatMasihAdaYangBisaDilewati() {
        // Di halaman terakhir tidak ada lagi halaman berikutnya, jadi "Lewati" dihilangkan.
        // Kalau dibiarkan, layar punya dua tombol berbeda tulisan yang kerjanya sama.
        assertEquals(true, Onboarding.hasSecondButton(0))
        assertEquals(true, Onboarding.hasSecondButton(1))
        assertEquals(false, Onboarding.hasSecondButton(Onboarding.lastIndex))
        assertEquals(null, Onboarding.secondLabel(Onboarding.lastIndex))
        assertEquals("Lewati", Onboarding.secondLabel(0))
    }

    @Test
    fun tidakAdaTombolKeduaYangMenjanjikanHalLain() {
        // Pernah ada tombol kedua bertulisan "Lihat panduan singkat" padahal tombolnya hanya
        // menutup layar. Test ini menjaga supaya tulisan tombol kedua tetap "Lewati".
        Onboarding.pages.indices.forEach { i ->
            val label = Onboarding.secondLabel(i)
            if (label != null) {
                assertEquals("Tombol kedua halaman $i harus 'Lewati'", "Lewati", label)
            }
        }
    }
}
