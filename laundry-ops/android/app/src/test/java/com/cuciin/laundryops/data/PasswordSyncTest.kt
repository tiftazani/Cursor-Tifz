package com.cuciin.laundryops.data

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Kata sandi ada di dua tempat dan keduanya harus berubah bersama.
 *
 * Kata sandi yang dipakai layar masuk adalah hash lokal (`Passwords`, PBKDF2), sedangkan
 * `FirebaseCloud` mengubah kata sandi akun Firebase. Pernah terjadi: setelah Firebase menerima
 * kata sandi baru, hash lokal tidak ikut diperbarui, sehingga orang tidak bisa masuk lagi dengan
 * kata sandi barunya. Sebaliknya, setelah "Lupa kata sandi", hash lokal yang lama menolak kata
 * sandi yang baru disetel lewat email.
 */
class PasswordSyncTest {

    private val appDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    private val sumber = { jalur: String ->
        File(appDir, "src/main/java/com/cuciin/laundryops/$jalur").readText()
    }

    @Test
    fun setelahGantiKataSandiFirebaseHashLokalIkutDiperbarui() {
        val cloud = sumber("data/FirebaseCloud.kt")

        // Firebase harus memanggil pengait lokal saat berhasil, bukan hanya melaporkan sukses.
        assertTrue(
            "changePassword tidak memperbarui hash lokal setelah Firebase menerima sandi baru",
            cloud.contains("onDone(changeLocal(currentPassword, newPassword))"),
        )
        assertTrue(cloud.contains("var changeLocal:"))

        // Layar profil yang memasang pengaitnya. Tanpa ini, pengait tetap kosong dan
        // hash lokal tidak pernah ikut berubah.
        val layar = sumber("ui/MoreScreens.kt")
        assertTrue(
            "ProfilScreen tidak memasang FirebaseCloud.changeLocal",
            layar.contains("FirebaseCloud.changeLocal = { lama, baru ->"),
        )
    }

    @Test
    fun lupaKataSandiMembuangHashLokalYangUsang() {
        val cloud = sumber("data/FirebaseCloud.kt")
        assertTrue(
            "sendPasswordReset tidak membuang hash lokal setelah reset dikirim",
            cloud.contains("forgetLocal(email); onDone(null)"),
        )

        val layar = sumber("ui/MoreScreens.kt")
        assertTrue(
            "ProfilScreen tidak memasang FirebaseCloud.forgetLocal",
            layar.contains("FirebaseCloud.forgetLocal = { email -> store.forgetLocalPassword(email) }"),
        )

        val store = sumber("data/CuciinStore.kt")
        assertTrue(store.contains("fun forgetLocalPassword(email: String)"))
        // Hash dibuang, bukan diganti kata sandi karangan.
        assertTrue(store.contains("staff[index].copy(passwordHash = \"\")"))
    }

    @Test
    fun hashKosongDitanganiDanTidakPernahDikirimKeServer() {
        // Kata sandi kosong tidak boleh cocok dengan hash apa pun.
        assertFalse(Passwords.matches("", ""))
        assertFalse(Passwords.matches("apa saja", ""))

        // `staff` milik server: sandi tidak boleh ikut dalam entitas yang dikirim.
        val protokol = sumber("data/SyncProtocol.kt")
        assertTrue(protokol.contains("serverOwnedEntities = setOf(\"staff\", \"accessRole\", \"accessPolicy\")"))

        // Worker juga membuang kolom sandi sebelum data dikirim balik ke perangkat.
        // Path dari android/app menuju laundry-ops/cloudflare.
        val worker = File(appDir.parentFile.parentFile, "cloudflare/src/index.ts").readText()
        assertTrue(
            "Worker tidak membuang passwordHash dari snapshot staff",
            worker.contains("passwordHash: _passwordHash"),
        )
    }

    @Test
    fun pembungkusPengaitTidakDiisiKataSandiSungguhan() {
        // Pengait default harus no-op, supaya tidak ada jalur yang menulis hash tanpa
        // melalui store saat layar profil belum terbuka.
        val cloud = sumber("data/FirebaseCloud.kt")
        assertTrue(cloud.contains("var changeLocal: (String, String) -> String? = { _, _ -> null }"))
        assertTrue(cloud.contains("var forgetLocal: (String) -> Unit = {}"))
    }
}
