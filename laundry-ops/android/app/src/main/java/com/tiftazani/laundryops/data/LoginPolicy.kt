package com.tiftazani.laundryops.data

/** Release builds never admit an unapproved or passwordless account. */
internal object LoginPolicy {
    fun permits(
        debug: Boolean,
        approved: Boolean,
        hasBranches: Boolean,
        hasPassword: Boolean,
        trustedRestore: Boolean,
        passwordMatches: Boolean,
    ): Boolean = approved && hasBranches && (debug || hasPassword) &&
        (trustedRestore || (debug && !hasPassword) || passwordMatches)
}
