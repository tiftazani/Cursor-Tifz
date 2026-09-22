package com.cuciin.laundryops.data

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penyamaan hak akses harus memakai endpoint snapshot, bukan alamat dasar Worker.
 *
 * Kejadian nyata 21 Sep pada 1.10.36: `hakAksesDariServer()` memanggil `open("GET")`, dan `open`
 * memakai `BuildConfig.CUCIIN_CLOUD_URL` apa adanya. Nilainya berakhir di `/api/cuciin`, sehingga
 * permintaan menuju alamat dasar itu ditambah `/v1/snapshot` menjadi `/api/cuciin/v1/snapshot`.
 * Worker tidak mengenal rute itu dan menjawab 404. Karena `runCatching` menelan kegagalannya,
 * fungsi itu selalu mengembalikan null dan penyamaan hak akses tidak pernah berjalan.
 *
 * Akibat yang terbukti di perangkat: `aidanurita25@gmail.com` tetap tampil "Aida · SPV" dan akun
 * `alfinhumendru@gmail.com` yang sudah tidak ada di D1 masih muncul di layar Daftar User.
 *
 * Test ini membaca berkas sumber, bukan nilai di memori. Tanpa itu, bug yang sama bisa masuk
 * kembali lewat pemanggilan `open("GET")` tanpa alamat dan tidak ada satu pun test yang gagal.
 */
class SnapshotPrivilegeEndpointTest {

    private val appDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    private fun sumber(nama: String): String =
        File(appDir, "src/main/java/com/cuciin/laundryops/data/$nama").readText()

    private fun badanFungsi(teks: String, nama: String): String {
        val awal = teks.indexOf("private fun $nama(")
        assertTrue("$nama tidak ditemukan di CloudSync.kt", awal >= 0)
        // Fungsi ini berbentuk ekspresi: diakhiri `.getOrNull()`. Batasi di situ supaya
        // fungsi berikutnya (bootstrapSnapshot, yang memang benar memakai alamat dasar)
        // tidak ikut terbaca dan menghasilkan temuan palsu.
        val akhir = teks.indexOf(".getOrNull()", awal)
        assertTrue("akhir $nama tidak ditemukan", akhir > awal)
        return teks.substring(awal, akhir)
    }

    @Test
    fun penyamaanHakAksesMemakaiAlamatSnapshot() {
        val badan = badanFungsi(sumber("CloudSync.kt"), "hakAksesDariServer")

        assertTrue(
            "hakAksesDariServer harus meminta /v1/snapshot secara eksplisit. " +
                "Memakai open(\"GET\") tanpa alamat berarti memakai alamat dasar Worker, " +
                "yang tidak punya rute dan menjawab 404 sehingga penyamaan hak akses diam-diam mati.",
            badan.contains("apiUrl(\"/v1/snapshot\")"),
        )
    }

    @Test
    fun penyamaanHakAksesTidakMemakaiAlamatDasar() {
        val badan = badanFungsi(sumber("CloudSync.kt"), "hakAksesDariServer")

        // Fungsi lain (bootstrapSnapshot, recoverRejectedSnapshot, legacyPull) memang benar
        // memakai alamat dasar, karena alamat dasar itu SENDIRI adalah endpoint snapshot.
        // Yang salah hanyalah memakainya untuk permintaan yang butuh rute berbeda.
        assertTrue(
            "hakAksesDariServer tidak boleh memakai open(\"GET\") tanpa alamat: itu menuju " +
                "alamat dasar Worker yang tidak punya rute, dijawab 404, dan penyamaan hak " +
                "akses diam-diam tidak pernah berjalan.",
            !badan.contains("open(\"GET\")"),
        )
    }
}
