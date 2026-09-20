package com.cuciin.laundryops.data

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PasswordsTest {
    @Test fun saltedHashesMatchOnlyTheOriginalPassword() {
        val first = Passwords.hash("test1234")
        val second = Passwords.hash("test1234")
        assertTrue(first.startsWith("pbkdf2-sha256$"))
        assertNotEquals(first, second)
        assertTrue(Passwords.matches("test1234", first))
        assertFalse(Passwords.matches("salah", first))
        assertFalse(Passwords.matches("", first))
        assertFalse(Passwords.matches("", ""))
    }

    @Test fun legacySha256StillMatchesForOneTimeMigration() {
        val legacy = "937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244"
        assertTrue(Passwords.needsUpgrade(legacy))
        assertTrue(Passwords.matches("test1234", legacy))
    }

    @Test fun hashKataSandiTidakIkutKeSnapshotServer() {
        // Endpoint /v1/sync/changes mengirim snapshot dari D1. Kolom sandi tidak pernah ada
        // di sana, jadi snapshot yang datang selalu membawa passwordHash kosong. Kalau
        // applyBusiness tidak mempertahankan hash lokal, semua akun langsung tidak bisa masuk.
        val dariServer = Staff("Aida", "aida@cuciin.test", Role.Kasir, listOf("bunayya"), approved = true)
        assertTrue(dariServer.passwordHash.isEmpty())

        val lokal = HashMap<String, String>().apply { put("aida@cuciin.test", Passwords.hash("rahasia-uji")) }
        val digabung = dariServer.copy(passwordHash = lokal[dariServer.email.lowercase()].orEmpty())
        assertTrue(Passwords.matches("rahasia-uji", digabung.passwordHash))
        assertFalse(Passwords.matches("rahasia-uji", dariServer.passwordHash))
    }
}
