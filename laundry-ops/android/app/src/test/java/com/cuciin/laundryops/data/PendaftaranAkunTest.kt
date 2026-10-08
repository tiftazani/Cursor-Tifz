package com.cuciin.laundryops.data

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pendaftaran yang gagal karena emailnya masih tersimpan di server identitas.
 *
 * Kejadian nyata yang dikunci di sini: seorang kasir mencoba mendaftar dan layarnya hanya
 * berbunyi "Pendaftaran belum berhasil. Periksa koneksi dan data akun." Koneksinya sehat.
 * Sebab sebenarnya: emailnya masih tersimpan di Firebase walaupun baris user-nya sudah
 * dihapus Owner. Orang itu terjebak dua arah — tidak bisa masuk, dan tidak bisa daftar ulang.
 *
 * Tiga hal yang dijaga:
 *
 * 1. Pengenal EMAIL_EXISTS tepat sasaran. Kalau terlalu longgar, kegagalan sandi lemah ikut
 *    dianggap email terpakai dan aplikasi mencoba masuk dengan sandi yang belum pernah diterima.
 * 2. Pesannya menyebut jalan keluar, bukan menyuruh "periksa koneksi".
 * 3. Jalur pemulihannya benar-benar ada di kode aplikasi. Pesan yang bagus tidak berguna kalau
 *    aplikasinya tetap berhenti di situ.
 */
class PendaftaranAkunTest {

    private val appDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    private fun baca(relatif: String): String = File(appDir, relatif).readText()

    private val firebaseCloud: String get() = baca("src/main/java/com/cuciin/laundryops/data/FirebaseCloud.kt")
    private val authScreens: String get() = baca("src/main/java/com/cuciin/laundryops/ui/AuthScreens.kt")

    // ---- pengenal sebab ----

    @Test
    fun pesanAsliFirebaseDikenaliSebagaiEmailTerpakai() {
        // "The email address is already in use by another account."
        assertTrue(PendaftaranAkun.emailSudahTerpakai("The email address is already in use by another account."))
        // Firebase Android kadang hanya memberi kode.
        assertTrue(PendaftaranAkun.emailSudahTerpakai("ERROR_EMAIL_EXISTS"))
        assertTrue(PendaftaranAkun.emailSudahTerpakai("EMAIL_EXISTS"))
    }

    @Test
    fun kegagalanLainTidakDianggapEmailTerpakai() {
        // Kalau ini lolos, aplikasi akan mencoba masuk dengan sandi yang baru saja ditolak
        // server karena terlalu lemah. Orangnya lalu diberi pesan email terkunci, padahal
        // masalahnya sandi.
        assertFalse(PendaftaranAkun.emailSudahTerpakai("The password must be 6 characters long."))
        assertFalse(PendaftaranAkun.emailSudahTerpakai("network error"))
        assertFalse(PendaftaranAkun.emailSudahTerpakai(null))
        assertFalse(PendaftaranAkun.emailSudahTerpakai(""))
    }

    // ---- pesan ----

    @Test
    fun emailTerpakaiDijelaskanDanDiberiJalanKeluar() {
        val pesan = PendaftaranAkun.sebab("The email address is already in use by another account.")
        assertTrue("Sebabnya harus disebut, bukan 'periksa koneksi': $pesan", pesan.contains("server identitas"))
        assertTrue("Harus menunjuk pemulihan sandi: $pesan", pesan.contains("Lupa kata sandi"))
        assertTrue("Harus menyebut pilihan email lain: $pesan", pesan.contains("email lain"))
    }

    @Test
    fun koneksiPutusTetapDisebutKoneksi() {
        val pesan = PendaftaranAkun.sebab("network error")
        assertTrue("Koneksi putus harus tetap dijelaskan sebagai koneksi: $pesan", pesan.contains("koneksi"))
        assertTrue("Harus disuruh coba lagi: $pesan", pesan.contains("coba lagi"))
    }

    @Test
    fun sandiDitolakDisebutSandi() {
        assertTrue(PendaftaranAkun.sebab("The password must be 6 characters long.").contains("Kata sandi"))
    }

    @Test
    fun pesanAsingDiteruskanApaAdanya() {
        // Sebab yang belum dikenal tidak boleh ditelan menjadi kalimat generik; itu justru
        // membuat masalah baru tidak bisa dilacak.
        assertEquals("Sebab aneh dari server", PendaftaranAkun.sebab("Sebab aneh dari server"))
    }

    @Test
    fun pesanKosongTetapMemberiPetunjuk() {
        assertTrue(PendaftaranAkun.sebab(null).isNotBlank())
    }

    // ---- jalur pemulihan benar-benar terpasang ----

    @Test
    fun aplikasiMencobaAkunLamaSaatEmailTerpakai() {
        val sumber = firebaseCloud
        assertTrue(
            "Saat EMAIL_EXISTS, aplikasi harus mencoba memakai akun lama itu, bukan langsung menyerah",
            sumber.contains("PendaftaranAkun.emailSudahTerpakai(e.message)"),
        )
        assertTrue(
            "Percobaan memakai akun lama memakai sandi yang diketik pendaftar",
            sumber.contains("signInWithEmailAndPassword(surel, password)"),
        )
    }

    @Test
    fun akunBaruYangDitolakServerTetapDibatalkan() {
        // Akun yang baru dibuat di percobaan ini harus dihapus kalau pendaftaran ditolak server,
        // supaya tidak menumpuk akun tanpa baris user. Akun lama tidak boleh dihapus.
        val sumber = firebaseCloud
        assertTrue("Akun baru harus dibatalkan saat server menolak", sumber.contains("kirim(hapusAkun = true)"))
        assertTrue("Akun lama tidak boleh dihapus", sumber.contains("kirim(hapusAkun = false)"))
        assertTrue("Penghapusan hanya untuk akun baru", sumber.contains("if (hapusAkun) {"))
    }

    @Test
    fun layarDaftarMenampilkanSebabAslinya() {
        // Pesan yang sudah bagus tidak berguna kalau layarnya menimpanya dengan kalimat generik.
        // Sebelum diperbaiki, layar selalu menulis satu kalimat tetap dan membuang sebabnya.
        val sumber = authScreens
        assertTrue(
            "Layar Daftar harus menampilkan sebab dari register(), bukan kalimat tetap",
            sumber.contains("regError = result.ifBlank"),
        )
        assertFalse(
            "Pesan generik lama tidak boleh kembali",
            sumber.contains("\"Pendaftaran belum berhasil. Periksa koneksi dan data akun.\""),
        )
    }
}
