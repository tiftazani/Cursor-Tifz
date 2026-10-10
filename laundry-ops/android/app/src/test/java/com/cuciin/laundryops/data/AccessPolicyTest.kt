package com.cuciin.laundryops.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AccessPolicyTest {
    private val roles = AccessCatalog.builtInRoles()

    private fun staff(role: Role, accessRoleId: String = "") =
        Staff(name = "Uji", email = "uji@cuciin.test", role = role, branchIds = listOf("b1"), accessRoleId = accessRoleId)

    @Test fun ownerAlwaysHasEverything() {
        val owner = staff(Role.Owner)
        assertTrue(AccessPolicy.can(owner, roles, null, "queue"))
        assertTrue(AccessPolicy.can(owner, roles, null, "access", "access.role"))
        assertEquals(AccessCatalog.moduleKeys, AccessPolicy.grants(owner, roles, null).first)
    }

    @Test fun ownerStaysFullEvenWithEmptyRoleCatalog() {
        // Katalog role bisa belum tersinkron di perangkat baru; Owner tidak boleh terkunci.
        val owner = staff(Role.Owner)
        assertTrue(AccessPolicy.can(owner, emptyList(), null, "service", "service.create"))
    }

    @Test fun staffWithoutAccessRoleFallsBackToLegacyRole() {
        val cashier = staff(Role.Kasir)
        val effective = AccessPolicy.effectiveRole(cashier, roles)
        assertEquals("role-kasir", effective.id)
        assertTrue(AccessPolicy.can(cashier, roles, null, "service", "service.create"))
        assertFalse(AccessPolicy.can(cashier, roles, null, "access", "access.role"))
    }

    @Test fun userFollowsTheAssignedRoleNotTheLegacyRole() {
        // Akun lama berperan Kasir, tetapi dipindahkan ke role Supervisor.
        val person = staff(Role.Kasir, accessRoleId = "role-supervisor")
        assertTrue(AccessPolicy.can(person, roles, null, "inventory", "inventory.write"))
        assertFalse(AccessPolicy.can(person, roles, null, "whatsapp", "whatsapp.send"))
    }

    @Test fun customRoleGrantsExactlyWhatItLists() {
        val custom = AccessRole(
            id = "role-gudang",
            name = "Gudang",
            modules = setOf("stock", "inventory"),
            functions = setOf("stock.write"),
        )
        val catalog = roles + custom
        val person = staff(Role.Kasir, accessRoleId = "role-gudang")
        assertTrue(AccessPolicy.can(person, catalog, null, "stock", "stock.write"))
        // Modul inventory diizinkan, tetapi fungsinya tidak dipilih.
        assertTrue(AccessPolicy.can(person, catalog, null, "inventory"))
        assertFalse(AccessPolicy.can(person, catalog, null, "inventory", "inventory.write"))
        assertFalse(AccessPolicy.can(person, catalog, null, "service", "service.create"))
    }

    @Test fun perUserPolicyOnlyNarrowsTheRole() {
        val person = staff(Role.Kasir)
        val narrowed = UserAccessPolicy(email = person.email, modules = setOf("service"), functions = setOf("service.create"))
        assertTrue(AccessPolicy.can(person, roles, narrowed, "service", "service.create"))
        // Role mengizinkan queue, tetapi kebijakan pengguna mempersempitnya.
        assertFalse(AccessPolicy.can(person, roles, narrowed, "queue"))
        // Kebijakan tidak dapat menambah modul di luar role.
        val widened = UserAccessPolicy(email = person.email, modules = setOf("access"), functions = setOf("access.role"))
        assertFalse(AccessPolicy.can(person, roles, widened, "access", "access.role"))
    }

    @Test fun missingExplicitRoleCannotRecoverLegacyPrivileges() {
        val person = staff(Role.Kasir, "deleted-custom-role")
        assertEquals(emptySet<String>() to emptySet<String>(), AccessPolicy.grants(person, roles, null))
    }

    @Test fun functionsWithoutTheirModuleAreDropped() {
        val (modules, functions) = AccessCatalog.sanitize(setOf("stock"), setOf("stock.write", "service.create"))
        assertEquals(setOf("stock"), modules)
        assertEquals(setOf("stock.write"), functions)
    }

    @Test fun unknownKeysAreIgnored() {
        val (modules, functions) = AccessCatalog.sanitize(setOf("stock", "modul-tidak-ada"), setOf("stock.write", "fungsi-tidak-ada"))
        assertEquals(setOf("stock"), modules)
        assertEquals(setOf("stock.write"), functions)
    }

    @Test fun nonOwnerCannotGainOwnerLockedFunctionsFromAssignedRoleOrPolicy() {
        for (legacy in listOf(Role.Kasir, Role.Supervisor)) {
            for (roleId in listOf("role-owner", "custom-full")) {
                val person = staff(legacy, roleId)
                val catalog = roles + AccessRole("custom-full", "Penuh", AccessCatalog.moduleKeys, AccessCatalog.allFunctionKeys())
                val policy = UserAccessPolicy(person.email, AccessCatalog.moduleKeys, AccessCatalog.allFunctionKeys())
                for (fn in AccessCatalog.ownerLocked) {
                    assertFalse("$legacy/$roleId/$fn", AccessPolicy.can(person, catalog, policy, AccessCatalog.moduleOf(fn)!!, fn))
                }
                assertTrue(AccessPolicy.can(person, catalog, policy, "service", "service.price"))
            }
        }
    }

    @Test fun unapprovedAccountCannotUseAnyModuleOrFunction() {
        for (role in Role.entries) {
            val person = staff(role).copy(approved = false)
            for (module in AccessCatalog.modules) {
                assertFalse(AccessPolicy.can(person, roles, null, module.key))
                for (function in module.functions) assertFalse(AccessPolicy.can(person, roles, null, module.key, function.key))
            }
        }
    }

    @Test fun missingRoleNeverBorrowsFirstRolePrivileges() {
        val catalog = listOf(roles.first { it.id == "role-owner" })
        for (role in listOf(Role.Kasir, Role.Supervisor)) {
            for (roleId in listOf("", "missing-role")) {
                val person = staff(role, roleId)
                assertEquals(emptySet<String>() to emptySet<String>(), AccessPolicy.grants(person, catalog, null))
                for (module in AccessCatalog.modules) {
                    assertFalse(AccessPolicy.can(person, catalog, null, module.key))
                    for (function in module.functions) assertFalse(AccessPolicy.can(person, catalog, null, module.key, function.key))
                }
            }
        }
    }

    @Test fun memberCountFollowsAssignedRoleAndLegacyFallback() {
        val staff = listOf(
            Staff("A", "a@x.test", Role.Kasir, listOf("b1"), accessRoleId = "role-kasir"),
            Staff("B", "b@x.test", Role.Kasir, listOf("b1")),
            Staff("C", "c@x.test", Role.Owner, listOf("b1")),
        )
        assertEquals(2, AccessPolicy.memberCount(staff, "role-kasir"))
        assertEquals(1, AccessPolicy.memberCount(staff, "role-owner"))
        assertEquals(0, AccessPolicy.memberCount(staff, "role-supervisor"))
    }

    @Test fun everyCatalogFunctionBelongsToAKnownModule() {
        // Menjaga agar tidak ada fungsi yang tampil di layar tetapi tidak pernah diperiksa.
        AccessCatalog.modules.forEach { module ->
            assertTrue("Modul ${module.key} tidak punya fungsi", module.functions.isNotEmpty())
            module.functions.forEach { fn ->
                assertTrue("Kunci fungsi ${fn.key} tidak diawali modulnya", fn.key.startsWith("${module.key}."))
            }
        }
        assertEquals(AccessCatalog.modules.size, AccessCatalog.modules.map { it.key }.toSet().size)
        assertEquals(AccessCatalog.allFunctionKeys().size, AccessCatalog.modules.flatMap { it.functions }.map { it.key }.toSet().size)
    }

    @Test fun builtInRolesOnlyUseCatalogKeys() {
        roles.forEach { role ->
            assertTrue("Role ${role.id} memuat modul asing", AccessCatalog.moduleKeys.containsAll(role.modules))
            assertTrue("Role ${role.id} memuat fungsi asing", AccessCatalog.allFunctionKeys().containsAll(role.functions))
            val (modules, functions) = AccessCatalog.sanitize(role.modules, role.functions)
            assertEquals(role.modules, modules)
            assertEquals(role.functions, functions)
        }
    }
}
