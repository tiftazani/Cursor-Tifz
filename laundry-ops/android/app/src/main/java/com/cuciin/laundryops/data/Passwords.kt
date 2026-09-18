package com.cuciin.laundryops.data

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

object Passwords {
    private const val ITERATIONS = 120_000
    private const val KEY_BITS = 256
    private const val PREFIX = "pbkdf2-sha256"

    fun hash(raw: String): String {
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val derived = derive(raw, salt, ITERATIONS)
        return listOf(PREFIX, ITERATIONS.toString(), encode(salt), encode(derived)).joinToString("\$")
    }

    fun matches(raw: String, stored: String): Boolean {
        if (stored.isBlank()) return false
        if (raw.isEmpty() && stored.startsWith("${PREFIX}\$")) return false
        if (!stored.startsWith("${PREFIX}\$")) return MessageDigest.isEqual(legacyHash(raw).toByteArray(), stored.toByteArray())
        val parts = stored.split('$')
        if (parts.size != 4) return false
        val iterations = parts[1].toIntOrNull()?.takeIf { it in 10_000..1_000_000 } ?: return false
        return try {
            val salt = Base64.getDecoder().decode(parts[2])
            val expected = Base64.getDecoder().decode(parts[3])
            MessageDigest.isEqual(derive(raw, salt, iterations), expected)
        } catch (_: Exception) {
            false
        }
    }

    fun needsUpgrade(stored: String): Boolean = stored.isNotBlank() && !stored.startsWith("${PREFIX}\$")

    private fun derive(raw: String, salt: ByteArray, iterations: Int): ByteArray {
        val spec = PBEKeySpec(raw.toCharArray(), salt, iterations, KEY_BITS)
        return try { SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded }
        finally { spec.clearPassword() }
    }

    private fun encode(value: ByteArray): String = Base64.getEncoder().withoutPadding().encodeToString(value)

    private fun legacyHash(raw: String): String = MessageDigest.getInstance("SHA-256")
        .digest(raw.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
}
