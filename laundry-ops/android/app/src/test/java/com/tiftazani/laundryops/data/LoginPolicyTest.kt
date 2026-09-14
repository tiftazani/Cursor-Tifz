package com.tiftazani.laundryops.data

import org.junit.Assert.*
import org.junit.Test

class LoginPolicyTest {
    @Test fun releaseRequiresApprovedPasswordProtectedAccount() {
        for (approved in listOf(false, true)) {
            for (hasBranches in listOf(false, true)) {
                for (hasPassword in listOf(false, true)) {
                    for (restored in listOf(false, true)) {
                        for (matches in listOf(false, true)) {
                            assertEquals(approved && hasBranches && hasPassword && (restored || matches),
                                LoginPolicy.permits(false, approved, hasBranches, hasPassword, restored, matches))
                        }
                    }
                }
            }
        }
    }
    @Test fun debugSeedStillWorksButWrongPasswordDoesNot() {
        assertTrue(LoginPolicy.permits(true, true, true, false, false, false))
        assertFalse(LoginPolicy.permits(true, true, true, true, false, false))
        assertFalse(LoginPolicy.permits(true, false, true, false, true, false))
    }
}
