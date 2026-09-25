package com.cuciin.laundryops.data

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Akun login Firebase untuk user yang ditambahkan Owner.
 *
 * Kejadian nyata yang dikunci di sini: Owner menambahkan kasir lewat layar "Pengguna baru".
 * Layar itu hanya menulis baris user ke server, tanpa membuat akun login Firebase. Barisnya
 * rapi di daftar user dan sandinya benar, tetapi orangnya TIDAK PERNAH bisa masuk karena
 * Firebase tidak mengenal email itu. Lima kasir terjebak seperti itu, dan baru ketahuan
 * setelah operasi berjalan.
 *
 * Dua hal yang dijaga:
 *
 * 1. Aturan sandi diperiksa SEBELUM baris user disimpan. Kalau Firebase yang menolak lebih
 *    dulu, barisnya sudah terlanjur ada tanpa akun login, dan itu persis keadaan yang sulit
 *    dilacak karena di daftar user semuanya tampak normal.
 * 2. Layar Daftar User benar-benar memanggil pembuatan akun login. Tanpa pemeriksaan ini,
 *    aturannya bisa benar tetapi tidak pernah dipakai.
 */
class LoginProvisionTest {

    private val appDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    private fun baca(relatif: String): String = File(appDir, relatif).readText()

    @Test
    fun sandiKosongMemakaiSandiAwalAplikasi() {
        // Kasir lapangan memakai sandi awal aplikasi. Kosong berarti "pakai sandi awal",
        // bukan "tanpa sandi", karena akun login wajib punya sandi.
        assertEquals("test1234", LoginProvision.initialPassword(""))
        assertEquals("test1234", LoginProvision.initialPassword("   "))
        assertEquals("rahasia123", LoginProvision.initialPassword("  rahasia123  "))
    }

    @Test
    fun sandiTerlaluPendekDitolakSebelumBarisUserDisimpan() {
        // Firebase menolak sandi di bawah 6 karakter. Kalau penolakan itu baru terjadi di
        // Firebase, baris usernya sudah tersimpan tanpa akun login.
        val problem = LoginProvision.passwordProblem("123", firebaseOn = true)
        assertTrue("Sandi 3 karakter harus ditolak lebih dulu", problem != null)
        assertTrue(
            "Pesan harus menyebut jalan keluarnya, bukan hanya melarang",
            problem!!.contains("sandi awal"),
        )
        assertTrue(LoginProvision.passwordProblem("12345", firebaseOn = true) != null)
        assertNull(LoginProvision.passwordProblem("123456", firebaseOn = true))
        assertNull(LoginProvision.passwordProblem("", firebaseOn = true))
    }

    @Test
    fun tanpaFirebaseTidakAdaPemeriksaanSandi() {
        // Di build lokal tanpa Firebase, akun login memang tidak dibuat, jadi tidak ada
        // yang perlu ditolak.
        assertNull(LoginProvision.passwordProblem("123", firebaseOn = false))
    }

    @Test
    fun pesanSuksesMenyebutAkunLoginDibuat() {
        val pesan = LoginProvision.message(ProvisionResult(ProvisionKind.CREATED), passwordTyped = false)
        assertTrue("Owner harus tahu akun loginnya dibuat: $pesan", pesan.contains("Akun login dibuat"))
    }

    @Test
    fun pesanGagalTidakMengakuAkunLoginSudahDibuat() {
        val pesan = LoginProvision.message(ProvisionResult(ProvisionKind.FAILED, "koneksi putus"), passwordTyped = false)
        assertTrue("Kegagalan harus terlihat jelas: $pesan", pesan.contains("GAGAL"))
        assertTrue("Sebabnya ikut disebut: $pesan", pesan.contains("koneksi putus"))
        assertTrue("Baris user tetap tersimpan, itu harus jujur disebut: $pesan", pesan.contains("tersimpan"))
    }

    @Test
    fun pesanSudahAdaDanSandiDiketikMenyebutSandiTidakBerubah() {
        // Jebakan yang harus dicegah: Owner mengetik sandi baru untuk kasir yang lupa sandinya,
        // menyimpannya, lalu mengira sandi itu berlaku. Akun login yang sudah ada tidak berubah,
        // jadi Owner harus diberi tahu supaya memakai jalur Lupa kata sandi.
        val pesan = LoginProvision.message(ProvisionResult(ProvisionKind.ALREADY_EXISTS), passwordTyped = true)
        assertTrue("Harus jujur bahwa sandi tidak berubah: $pesan", pesan.contains("TIDAK"))
        assertTrue("Harus menyebut jalan keluarnya: $pesan", pesan.contains("Lupa kata sandi"))
    }

    @Test
    fun layarDaftarUserMemanggilPembuatanAkunLogin() {
        // Penjaga sesungguhnya: aturan di atas tidak berguna kalau layarnya tidak memanggilnya.
        // Layar ini dulu berhenti di penyimpanan baris user, dan itulah akar bug lima kasir.
        val sumber = baca("src/main/java/com/cuciin/laundryops/ui/MasterScreens.kt")
        assertTrue(
            "Layar Daftar User harus memanggil pembuatan akun login setelah baris user disimpan. " +
                "Tanpa itu, kasir baru tidak akan pernah bisa masuk.",
            sumber.contains("provisionLoginAccount("),
        )
        assertTrue(
            "Aturan sandi harus diperiksa sebelum baris user disimpan",
            sumber.contains("LoginProvision.passwordProblem("),
        )
    }
}
