package com.cuciin.laundryops.ui

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga endpoint debug vs produksi, diuji dari SUMBER build.
 *
 * Bug yang dikunci (1 Okt 2026): perintah build kandidat 1.10.43 mengekspor
 * `CUCIIN_DEBUG_CLOUD_URL="$CUCIIN_CLOUD_URL"`, sehingga APK debug memuat URL Worker
 * PRODUKSI. Paket debug itu dipasang di emulator, login sebagai Owner, lalu mendorong
 * tiga entri accessRole ke D1 produksi (revision 3417 -> 3420). APK debug yang menunjuk
 * produksi membuat setiap transaksi uji menjadi mutasi data operasional.
 *
 * Tiga aturan yang dikunci di sini:
 * 1. env var yang ADA TAPI KOSONG diperlakukan seperti tidak diisi; tanpa itu rantai
 *    fallback mati dan nilai kosong menang.
 * 2. build debug DITOLAK bila endpoint debug sama dengan endpoint produksi.
 * 3. jalur build resmi memakai skrip yang membersihkan env cloud dan memverifikasi
 *    endpoint di dalam dex hasil build.
 */
class BuildEndpointGuardTest {

    private val androidDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it.parentFile else it
    }

    private val gradleKts: String = File(androidDir, "app/build.gradle.kts").readText()

    @Test
    fun envKosongTidakMemenangkanRantaiFallback() {
        val jumlah = Regex("""takeIf \{ it\.isNotBlank\(\) \}""").findAll(gradleKts).count()
        assertTrue(
            "build.gradle.kts harus memperlakukan env var kosong sebagai tidak diisi " +
                "(`.orNull()?.takeIf { it.isNotBlank() }`) untuk releaseCloudUrl dan debugCloudUrl. " +
                "Ditemukan $jumlah kemunculan, minimal 2 diperlukan.",
            jumlah >= 2,
        )
    }

    @Test
    fun buildDebugDitolakBilaEndpointSamaDenganProduksi() {
        assertTrue(
            "build.gradle.kts tidak memuat perbandingan endpoint debug vs produksi",
            gradleKts.contains("debugCloudUrl.trimEnd('/') != releaseCloudUrl.trimEnd('/')"),
        )
        assertTrue(
            "penjaga harus gagal dengan pesan yang menyebut kedua nilai",
            gradleKts.contains("Endpoint debug sama dengan endpoint produksi"),
        )
    }

    @Test
    fun jalurBuildResmiBersihDanMemverifikasiEndpoint() {
        val skrip = File(androidDir, "scripts/build_cuciin.sh")
        assertTrue("scripts/build_cuciin.sh tidak ada", skrip.isFile)
        val isi = skrip.readText()
        assertTrue(
            "skrip build harus membuang CUCIIN_CLOUD_URL dari lingkungan",
            isi.contains("-u CUCIIN_CLOUD_URL"),
        )
        assertTrue(
            "skrip build harus membuang CUCIIN_DEBUG_CLOUD_URL",
            isi.contains("-u CUCIIN_DEBUG_CLOUD_URL"),
        )
        assertTrue(
            "skrip build harus memverifikasi endpoint hasil build",
            isi.contains("guard_endpoint.py"),
        )
        assertTrue(
            "skrip build harus mengenali endpoint debug dan produksi",
            isi.contains("cuciin-api-debug.tiftazani-cuciin.workers.dev") &&
                isi.contains("cuciin-api.tiftazani-cuciin.workers.dev"),
        )

        val penjaga = File(androidDir, "scripts/guard_endpoint.py")
        assertTrue("scripts/guard_endpoint.py tidak ada", penjaga.isFile)
    }
}
