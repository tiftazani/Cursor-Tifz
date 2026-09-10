package com.tiftazani.laundryops.data

import java.security.MessageDigest

object Passwords {
    fun hash(raw: String): String {
        val md = MessageDigest.getInstance("SHA-256")
        return md.digest(raw.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }

    fun matches(raw: String, stored: String): Boolean {
        if (stored.isBlank()) return true
        return hash(raw) == stored
    }
}
