package com.tiftazani.laundryops.data

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
}
