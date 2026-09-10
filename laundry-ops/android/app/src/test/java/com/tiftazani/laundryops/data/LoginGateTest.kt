package com.tiftazani.laundryops.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LoginGateTest {
    @Test
    fun emailKosongHanyaMintaEmail() {
        assertEquals(LoginGate.EMAIL_REQUIRED, LoginGate.emailError("  "))
        assertNull(LoginGate.emailError("tiftazani.khara@gmail.com"))
    }

    @Test
    fun toastTidakWajibkanKataSandi() {
        val msg = LoginGate.EMAIL_REQUIRED.lowercase()
        assertFalse(msg.contains("kata sandi"))
        assertFalse(msg.contains("password"))
    }

    @Test
    fun passwordKosongPakaiLoginLokal() {
        assertTrue(LoginGate.useLocalLogin("", firebaseEnabled = true))
        assertTrue(LoginGate.useLocalLogin("", firebaseEnabled = false))
        assertTrue(LoginGate.useLocalLogin("rahasia", firebaseEnabled = false))
        assertFalse(LoginGate.useLocalLogin("rahasia", firebaseEnabled = true))
    }

    @Test
    fun hashKosongMenerimaPasswordKosong() {
        assertTrue(Passwords.matches("", ""))
        assertTrue(Passwords.matches("apa-saja", ""))
    }
}
