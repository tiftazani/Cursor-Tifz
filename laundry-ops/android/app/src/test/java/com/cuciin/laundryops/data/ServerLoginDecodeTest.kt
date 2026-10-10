package com.cuciin.laundryops.data

import org.junit.Assert.*
import org.junit.Test

class ServerLoginDecodeTest {
    private val account = Staff("Owner uji", "owner@example.test", Role.Owner, listOf("b1"))
    private val access = Snapshot(staff = listOf(account), accessRoles = AccessCatalog.builtInRoles())
    private val identity = CloudIdentity(account.email, account.name, account.role, account.branchIds, access)

    private fun verify(body: String, fallback: () -> Snapshot): CloudIdentity {
        val method = CloudSync.javaClass.declaredMethods.firstOrNull { it.name.startsWith("verifiedIdentity") }
        assertNotNull("Login harus memakai izin ringkas dari /me sebelum meminta seluruh transaksi", method)
        method!!.isAccessible = true
        return method.invoke(CloudSync, body, fallback) as CloudIdentity
    }

    @Test fun permissionRefreshUsesCompactIdentityBeforeSendingPendingChanges() {
        val source = java.io.File("src/main/java/com/cuciin/laundryops/data/CloudSync.kt").readText()
        val refresh = source.substringAfter("private fun refreshAuthorization():").substringBefore("internal fun applyAuthorizationResponse")
        assertTrue("Antrean tidak boleh menunggu pembacaan seluruh transaksi untuk memeriksa izin",
            refresh.contains("apiUrl(\"/v1/me\")") && refresh.contains("verifiedIdentity(body)"))
    }

    @Test fun actualWorkerPayloadDecodesWithoutBusinessFallback() {
        val fixture = LocalJson.json.parseToJsonElement(javaClass.getResource("/worker-login-contract.json")!!.readText()) as kotlinx.serialization.json.JsonObject
        var calls = 0
        val result = verify(fixture.getValue("identity").toString()) { calls++; error("Worker compact access was lost") }
        assertEquals(Role.Kasir, result.role)
        assertEquals("role-kasir", result.access!!.staff.single().accessRoleId)
        assertEquals(0, calls)
        val nota = LocalJson.json.decodeFromString(Nota.serializer(), fixture.getValue("nota").toString())
        assertEquals("contract-1", nota.id)
        assertEquals("Kasir contoh", nota.kasir)
        assertEquals(20000, nota.total)
        assertEquals(2.0, nota.lines.single().qty, 0.0)
    }

    @Test fun compactIdentityDoesNotLoadBusinessSnapshot() {
        var calls = 0
        val result = verify(LocalJson.json.encodeToString(CloudIdentity.serializer(), identity)) { calls++; error("Tidak boleh mengambil transaksi") }
        assertEquals(identity, result)
        assertEquals(0, calls)
    }

    @Test fun oldServerUsesFreshSnapshotWithoutCachedPermissions() {
        var calls = 0
        val result = verify(LocalJson.json.encodeToString(CloudIdentity.serializer(), identity.copy(access = null))) { calls++; access }
        assertEquals(identity, result)
        assertEquals(1, calls)
    }

    @Test fun inactiveOrForeignCompactIdentityCannotFallBackToOwnerCache() {
        for (bad in listOf(access.copy(staff = emptyList()), access.copy(staff = listOf(account.copy(approved = false))),
            access.copy(staff = listOf(account.copy(branchIds = emptyList()))))) {
            var calls = 0
            val attempt = runCatching { verify(LocalJson.json.encodeToString(CloudIdentity.serializer(), identity.copy(access = bad))) { calls++; access } }
            assertTrue(attempt.isFailure)
            assertEquals(0, calls)
        }
    }
}
