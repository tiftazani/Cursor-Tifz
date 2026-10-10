package com.cuciin.laundryops.data

import com.cuciin.laundryops.ui.RouteAccess
import org.junit.Assert.*
import org.junit.Test

class AccessOutboxRegressionTest {
    @Test fun loginRequiresServerPermissionsInsteadOfCachedApprovalOrAssignment() {
        val source = java.io.File("src/main/java/com/cuciin/laundryops/data/CloudSync.kt").readText()
        val verify = source.substringAfter("fun verifyIdentity(").substringBefore("fun onSignedOut(")
        assertTrue("Login wajib memuat snapshot izin sebelum callback sukses", verify.contains("/v1/snapshot"))
        val firebase = java.io.File("src/main/java/com/cuciin/laundryops/data/FirebaseCloud.kt").readText()
        val signIn = firebase.substringAfter("fun signIn(").substringBefore("private fun friendlyAuthMessage")
        assertTrue("Izin login tidak boleh mengambil approved/assignment cache", signIn.contains("identity.access"))
        val store = CuciinStore
        val oldStaff = store.staff.toList()
        val oldSession = store.session.value
        try {
            val owner = Staff("Uji", "user@example.test", Role.Owner, listOf("b1"))
            store.staff.clear(); store.staff.add(owner.copy(approved = false, role = Role.Kasir))
            store.authenticateSession(Session(owner.role, owner.name, owner.email, "b1", owner.branchIds), Snapshot(staff = listOf(owner), accessRoles = AccessCatalog.builtInRoles()))
            assertTrue(store.canAccess("access", "access.role"))
            val kasir = owner.copy(role = Role.Kasir)
            store.staff.clear(); store.staff.add(owner.copy(accessRoleId = "role-owner"))
            store.authenticateSession(Session(kasir.role, kasir.name, kasir.email, "b1", kasir.branchIds), Snapshot(staff = listOf(kasir), accessRoles = AccessCatalog.builtInRoles()))
            for (module in AccessCatalog.modules) for (function in module.functions) {
                assertEquals(function.key, AccessPolicy.can(kasir, AccessCatalog.builtInRoles(), null, module.key, function.key), store.canAccess(module.key, function.key))
            }
        } finally {
            store.staff.clear(); store.staff.addAll(oldStaff)
            if (oldSession != null) store.authenticateSession(oldSession) else store.logout()
        }
    }

    @Test fun verifiedPermissionsSurviveDiskReloadWithUnknownPending() {
        val store = CuciinStore
        val field = store.javaClass.getDeclaredField("accessPersistence").apply { isAccessible = true }
        val previous = field.get(store)
        val oldStaff = store.staff.toList()
        val oldSession = store.session.value
        val outboxField = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val oldBox = outboxField.get(CloudSync)
        val unknown = SyncCommand("unknown", "nota", "n1", "upsert", "b1", 1L)
        val box = SyncOutbox(SyncClientState(pending = listOf(unknown)))
        val directory = java.nio.file.Files.createTempDirectory("cuciin-access-").toFile()
        val type = Class.forName("com.cuciin.laundryops.data.AccessPersistence")
        try {
            field.set(store, type.getDeclaredConstructor(java.io.File::class.java).newInstance(directory))
            outboxField.set(CloudSync, box)
            val old = Staff("Uji", "user@example.test", Role.Owner, listOf("b1"), passwordHash = Passwords.hash("fixture"))
            store.staff.clear(); store.staff.add(old)
            store.authenticateSession(Session(old.role, old.name, old.email, "b1", old.branchIds))
            val limited = AccessRole("limited", "Stok", setOf("stock"), setOf("stock.view"))
            val remote = Snapshot(staff = listOf(old.copy(role = Role.Kasir, branchIds = listOf("b2"), accessRoleId = limited.id)), accessRoles = listOf(limited))
            val refresh = store.javaClass.declaredMethods.first { it.name.startsWith("applyVerifiedAccess") }
            refresh.invoke(store, remote)
            assertEquals(listOf(unknown), box.state.pending)
            val overlayField = store.javaClass.getDeclaredField("verifiedAccess").apply { isAccessible = true }
            overlayField.set(store, null)
            store.session.value = null
            field.set(store, type.getDeclaredConstructor(java.io.File::class.java).newInstance(directory))
            assertTrue(store.login(old.email, skipPassword = true))
            assertEquals(Role.Kasir, store.session.value?.role)
            assertEquals(listOf("b2"), store.session.value?.branchIds)
            assertTrue(store.canAccess("stock", "stock.view"))
            assertFalse(store.canAccess("access", "access.role"))
            assertFalse(store.canAccess("service", "service.create"))
            refresh.invoke(store, Snapshot())
            store.session.value = null
            assertFalse(store.login(old.email, skipPassword = true))
            assertEquals(listOf(unknown), box.state.pending)
            java.io.File(directory, "cuciin-access.json").writeText("invalid-json")
            assertFalse(store.login(old.email, skipPassword = true))
            assertEquals(listOf(unknown), box.state.pending)
            val fresh = remote.staff.single()
            store.authenticateSession(Session(fresh.role, fresh.name, fresh.email, "b2", fresh.branchIds), remote)
            assertTrue(store.canAccess("stock", "stock.view"))
            assertFalse(store.canAccess("access", "access.role"))
            assertEquals(remote.staff.map { it.copy(passwordHash = "") }, AccessPersistence(directory).load(old.email)?.staff)
            assertNotNull(AccessPersistence(directory).load("other@example.test"))
            assertTrue(AccessPersistence(directory).load("other@example.test")!!.staff.isEmpty())
            assertEquals(listOf(unknown), box.state.pending)
        } finally {
            outboxField.set(CloudSync, oldBox)
            field.set(store, previous)
            store.staff.clear(); store.staff.addAll(oldStaff)
            store.session.value = oldSession
            directory.deleteRecursively()
        }
    }

    @Test fun failedPermissionWriteRevokesSessionWithoutLosingPending() {
        val store = CuciinStore
        val diskField = store.javaClass.getDeclaredField("accessPersistence").apply { isAccessible = true }
        val oldDisk = diskField.get(store)
        val boxField = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val oldBox = boxField.get(CloudSync)
        val oldSession = store.session.value
        val directory = java.nio.file.Files.createTempDirectory("cuciin-access-write-").toFile()
        val unknown = SyncCommand("unknown", "nota", "n1", "upsert", "b1", 1L)
        val box = SyncOutbox(SyncClientState(pending = listOf(unknown)))
        try {
            boxField.set(CloudSync, box)
            diskField.set(store, null)
            val owner = Staff("Uji", "user@example.test", Role.Owner, listOf("b1"))
            store.authenticateSession(Session(owner.role, owner.name, owner.email, "b1", owner.branchIds), Snapshot(staff = listOf(owner)))
            val disk = AccessPersistence(directory)
            disk.save(owner.email, Snapshot(staff = listOf(owner)))
            diskField.set(store, disk)
            java.io.File(directory, "cuciin-access.json.tmp").mkdir()
            store.applyVerifiedAccess(Snapshot())
            assertNull(store.session.value)
            assertFalse(store.canAccess("access", "access.role"))
            assertEquals(listOf(unknown), box.state.pending)
            val restarted = AccessPersistence(directory)
            assertTrue("Sisa penulisan gagal harus menolak izin Owner lama", restarted.load(owner.email)!!.staff.isEmpty())
            java.io.File(directory, "cuciin-access.json.tmp").delete()
            restarted.save(owner.email, Snapshot())
            assertTrue(AccessPersistence(directory).load(owner.email)!!.staff.isEmpty())
            assertEquals(listOf(unknown), box.state.pending)
        } finally {
            boxField.set(CloudSync, oldBox)
            diskField.set(store, oldDisk)
            store.session.value = oldSession
            store.javaClass.getDeclaredField("verifiedAccess").apply { isAccessible = true }.set(store, null)
            directory.deleteRecursively()
        }
    }

    @Test fun diskFailureDuringLoginOrLogoutClosesSessionAndKeepsPending() {
        val store = CuciinStore
        val fileField = LocalJson.javaClass.getDeclaredField("file").apply { isAccessible = true }
        val backupField = LocalJson.javaClass.getDeclaredField("backup").apply { isAccessible = true }
        val savedAtField = LocalJson.javaClass.getDeclaredField("latestSavedAt").apply { isAccessible = true }
        val oldFile = fileField.get(LocalJson)
        val oldBackup = backupField.get(LocalJson)
        val oldSavedAt = savedAtField.getLong(LocalJson)
        val diskField = store.javaClass.getDeclaredField("accessPersistence").apply { isAccessible = true }
        val oldDisk = diskField.get(store)
        val overlay = store.javaClass.getDeclaredField("verifiedAccess").apply { isAccessible = true }
        val oldAccess = overlay.get(store)
        val oldSession = store.session.value
        val boxField = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val oldBox = boxField.get(CloudSync)
        val before = store.cloudSnapshot()
        val directory = java.nio.file.Files.createTempDirectory("cuciin-login-disk-").toFile()
        val command = SyncCommand("unknown", "nota", "n1", "upsert", "b1", 1L)
        val box = SyncOutbox(SyncClientState(pending = listOf(command)))
        try {
            fileField.set(LocalJson, java.io.File(directory, "cuciin-data.json"))
            backupField.set(LocalJson, java.io.File(directory, "cuciin-data.backup.json"))
            savedAtField.setLong(LocalJson, Long.MIN_VALUE)
            java.io.File(directory, "cuciin-data.json.tmp").mkdir()
            diskField.set(store, AccessPersistence(directory))
            boxField.set(CloudSync, box)
            val owner = Staff("Uji", "user@example.test", Role.Owner, listOf("b1"))
            val active = Session(owner.role, owner.name, owner.email, "b1", owner.branchIds)
            store.authenticateSession(active, Snapshot(staff = listOf(owner)))
            assertTrue("Logout gagal tulis tidak boleh melempar ke UI", runCatching { store.logout() }.isSuccess)
            assertNull(store.session.value)
            val finalize = store.javaClass.declaredMethods.firstOrNull { it.name.startsWith("finalizeAuthenticatedSession") }
            assertNotNull("Login perlu menangani kegagalan finalisasi disk", finalize)
            assertEquals(false, finalize!!.invoke(store, active, Snapshot(staff = listOf(owner))))
            java.io.File(directory, "cuciin-access.json.tmp").mkdir()
            assertEquals("Gagal tulis izin dan data bersamaan tetap menutup sesi", false, finalize.invoke(store, active, Snapshot(staff = listOf(owner))))
            assertNull(store.session.value)
            assertFalse(store.canAccess("access", "access.role"))
            assertEquals(listOf(command), box.state.pending)
            assertEquals(before.notas, store.notas.toList())
            assertEquals(before.payments, store.payments.toList())
            diskField.set(store, null)
            store.staff.clear(); store.staff.add(owner.copy(passwordHash = "trusted-test-fixture"))
            val localLogin = runCatching { store.login(owner.email, skipPassword = true) }
            assertTrue("Pemulihan login lokal tidak boleh melempar saat disk gagal", localLogin.isSuccess)
            assertEquals(false, localLogin.getOrNull())
            assertNull(store.session.value)
            store.staff[0] = owner.copy(approved = false)
            store.session.value = active
            val unapprovedLogin = runCatching { store.login(owner.email, skipPassword = true) }
            assertTrue("Pencabutan persetujuan tetap ditangani saat disk gagal", unapprovedLogin.isSuccess)
            assertEquals(false, unapprovedLogin.getOrNull())
            assertNull(store.session.value)
            assertEquals(listOf(command), box.state.pending)
            store.staff.clear(); store.staff.addAll(before.staff)
            diskField.set(store, AccessPersistence(directory))
            java.io.File(directory, "cuciin-access.json.tmp").delete()
            java.io.File(directory, "cuciin-data.json.tmp").delete()
            assertEquals(true, finalize.invoke(store, active, Snapshot(staff = listOf(owner))))
            assertEquals(active, store.session.value)
            assertEquals(listOf(command), box.state.pending)
            val saved = LocalJson.json.decodeFromString(Snapshot.serializer(), java.io.File(directory, "cuciin-data.json").readText())
            assertEquals(active.email, saved.sessionEmail)
        } finally {
            fileField.set(LocalJson, oldFile)
            backupField.set(LocalJson, oldBackup)
            savedAtField.setLong(LocalJson, oldSavedAt)
            diskField.set(store, oldDisk)
            overlay.set(store, oldAccess)
            store.session.value = oldSession
            boxField.set(CloudSync, oldBox)
            store.javaClass.getDeclaredField("localUpdatedAt").apply { isAccessible = true }.setLong(store, before.updatedAt)
            directory.deleteRecursively()
        }
    }

    @Test fun invalidPermissionFileCannotFallBackToOldBusinessPermissions() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-access-invalid-").toFile()
        try {
            java.io.File(directory, "cuciin-access.json").mkdir()
            val attempt = runCatching { AccessPersistence(directory).load("owner@example.test") }
            assertTrue("Cache tidak terbaca harus menolak fallback hak lama", attempt.isFailure || attempt.getOrNull()?.staff?.isEmpty() == true)
        } finally { directory.deleteRecursively() }
    }

    @Test fun cloudStartupCannotOpenSessionFromUnmarkedStaleOwnerCache() {
        val store = CuciinStore
        val snapshot = store.cloudSnapshot()
        val oldSession = store.session.value
        val diskField = store.javaClass.getDeclaredField("accessPersistence").apply { isAccessible = true }
        val overlay = store.javaClass.getDeclaredField("verifiedAccess").apply { isAccessible = true }
        val enabled = FirebaseCloud.javaClass.getDeclaredField("enabled").apply { isAccessible = true }
        val boxField = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val oldDisk = diskField.get(store)
        val oldAccess = overlay.get(store)
        val oldEnabled = enabled.getBoolean(FirebaseCloud)
        val oldBox = boxField.get(CloudSync)
        val directory = java.nio.file.Files.createTempDirectory("cuciin-unmarked-cache-").toFile()
        val owner = Staff("Uji", "owner@example.test", Role.Owner, listOf("b1"), passwordHash = "trusted-test-fixture")
        val pending = SyncCommand("unknown", "nota", "n1", "upsert", "b1", 1L)
        val box = SyncOutbox(SyncClientState(pending = listOf(pending)))
        val saved = snapshot.copy(staff = listOf(owner), sessionEmail = owner.email)
        val apply = store.javaClass.getDeclaredMethod("applySnapshot", Snapshot::class.java).apply { isAccessible = true }
        try {
            AccessPersistence(directory).save(owner.email, Snapshot(staff = listOf(owner)))
            assertFalse(java.io.File(directory, "cuciin-access.json.tmp").exists())
            diskField.set(store, AccessPersistence(directory))
            boxField.set(CloudSync, box)
            enabled.setBoolean(FirebaseCloud, true)
            store.session.value = null
            overlay.set(store, null)
            apply.invoke(store, saved)
            assertNull("Startup cloud harus menunggu izin segar, bukan cache Owner lama", store.session.value)
            assertFalse(store.canAccess("access", "access.role"))
            assertEquals(listOf(pending), box.state.pending)
            assertEquals(saved.customers, store.customers.toList())
            assertEquals(saved.notas, store.notas.toList())
            assertFalse(store.login(owner.email, skipPassword = true))
            assertFalse(store.login(owner.email, "fixture"))
            val loginScreen = java.io.File("src/main/java/com/cuciin/laundryops/ui/AuthScreens.kt").readText().substringAfter("internal fun LoginScreen(").substringBefore("internal fun RegisterScreen(")
            assertTrue("Restore async harus mengantar sesi sah ke beranda", loginScreen.contains("LaunchedEffect(store.session.value)"))
            val source = java.io.File("src/main/java/com/cuciin/laundryops/data/FirebaseCloud.kt").readText()
            val restore = source.substringAfter("fun restoreSession(").substringBefore("fun signIn(")
            assertTrue("Restore cloud harus mengambil izin server", restore.contains("verifyIdentity"))
            assertTrue("Restore terlambat harus memeriksa epoch", restore.contains("sessionUnchanged"))
            assertTrue("Restore cloud memerlukan identitas Firebase yang sama", restore.contains("currentEmail"))
        } finally {
            enabled.setBoolean(FirebaseCloud, false)
            diskField.set(store, null)
            apply.invoke(store, snapshot.copy(sessionEmail = null))
            diskField.set(store, oldDisk)
            overlay.set(store, oldAccess)
            store.session.value = oldSession
            boxField.set(CloudSync, oldBox)
            enabled.setBoolean(FirebaseCloud, oldEnabled)
            directory.deleteRecursively()
        }
    }

    @Test fun cachedAccessCannotBeBypassedByInternalSessionConstruction() {
        val store = CuciinStore
        val field = store.javaClass.getDeclaredField("accessPersistence").apply { isAccessible = true }
        val overlay = store.javaClass.getDeclaredField("verifiedAccess").apply { isAccessible = true }
        val oldDisk = field.get(store)
        val oldAccess = overlay.get(store)
        val oldSession = store.session.value
        val directory = java.nio.file.Files.createTempDirectory("cuciin-internal-session-").toFile()
        val owner = Staff("Uji", "owner@example.test", Role.Owner, listOf("b1"))
        val requested = Session(owner.role, owner.name, owner.email, "b1", owner.branchIds)
        val disk = AccessPersistence(directory)
        try {
            field.set(store, disk)
            disk.save(owner.email, Snapshot(staff = listOf(owner)))
            val temp = java.io.File(directory, "cuciin-access.json.tmp").apply { mkdir() }
            store.authenticateSession(requested)
            assertNull("Cache tertahan tidak boleh menerima sesi Owner", store.session.value)
            assertFalse(store.canAccess("access", "access.role"))
            temp.delete()
            for (account in listOf(null, owner.copy(approved = false), owner.copy(branchIds = emptyList()))) {
                disk.save(owner.email, Snapshot(staff = listOfNotNull(account)))
                store.authenticateSession(requested)
                assertNull(store.session.value)
                assertFalse(store.canAccess("access", "access.role"))
            }
            val kasir = owner.copy(role = Role.Kasir, branchIds = listOf("b2"))
            disk.save(owner.email, Snapshot(staff = listOf(kasir), accessRoles = AccessCatalog.builtInRoles()))
            store.authenticateSession(requested)
            assertEquals(Role.Kasir, store.session.value?.role)
            assertEquals(listOf("b2"), store.session.value?.branchIds)
            assertEquals("b2", store.session.value?.branchId)
            assertFalse(store.canAccess("access", "access.role"))
            assertTrue(store.canAccess("service", "service.create"))
        } finally {
            field.set(store, oldDisk)
            overlay.set(store, oldAccess)
            store.session.value = oldSession
            directory.deleteRecursively()
        }
    }

    @Test fun interruptedPermissionWriteCannotRestoreOtherAccounts() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-access-interrupted-").toFile()
        try {
            val owner = Staff("Uji", "old@example.test", Role.Owner, listOf("b1"))
            val disk = AccessPersistence(directory)
            disk.save(owner.email, Snapshot(staff = listOf(owner)))
            java.io.File(directory, "cuciin-access.json.tmp").writeText("{partial")
            assertTrue(AccessPersistence(directory).load(owner.email)!!.staff.isEmpty())
            val kasir = owner.copy(email = "new@example.test", role = Role.Kasir)
            AccessPersistence(directory).save(kasir.email, Snapshot(staff = listOf(kasir)))
            val restarted = AccessPersistence(directory)
            assertEquals(listOf(kasir), restarted.load(kasir.email)?.staff)
            assertTrue("Pemulihan akun baru tidak boleh memulihkan izin lama", restarted.load(owner.email)!!.staff.isEmpty())
            assertFalse(java.io.File(directory, "cuciin-access.json.tmp").exists())
        } finally { directory.deleteRecursively() }
    }

    @Test fun pendingOwnershipDoesNotChangeRolesOrMenuPermissions() {
        val store = CuciinStore
        val field = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val priorBox = field.get(CloudSync)
        val priorSession = store.session.value
        val priorStaff = store.staff.toList()
        val priorRoles = store.accessRoles.toList()
        val priorPolicies = store.accessPolicies.toList()
        val roles = AccessCatalog.builtInRoles() + AccessRole("limited", "Gudang", modules = setOf("stock"), functions = setOf("stock.view"))
        val routes = listOf("queue", "service", "attendance", "inventory", "stok", "expenses", "cash", "customers", "wa", "waArchive", "analytics", "analyticsReport", "audit", "branches", "users", "services", "products", "accessRoles", "ownerSettings")
        try {
            store.accessRoles.clear(); store.accessRoles.addAll(roles)
            store.accessPolicies.clear()
            for (actor in listOf(null, "", "user@example.test", "other@example.test")) {
                val pending = if (actor == null) emptyList() else listOf(SyncCommand("pending", "nota", "n1", "upsert", "b1", 1L, actorEmail = actor))
                val box = SyncOutbox(SyncClientState(pending = pending))
                field.set(CloudSync, box)
                for (role in Role.entries) {
                    for (roleId in listOf("", "limited")) {
                        val user = Staff("Uji", "user@example.test", role, listOf("b1"), accessRoleId = roleId)
                        store.staff.clear(); store.staff.add(user)
                        store.session.value = Session(role, user.name, user.email, "b1", user.branchIds)
                        for (module in AccessCatalog.modules) {
                            assertEquals("$actor/$role/$roleId/${module.key}", AccessPolicy.can(user, roles, null, module.key), store.canAccess(module.key))
                            for (function in module.functions) {
                                assertEquals("$actor/$role/$roleId/${function.key}", AccessPolicy.can(user, roles, null, module.key, function.key), store.canAccess(module.key, function.key))
                            }
                        }
                        for (route in routes) {
                            val gate = RouteAccess.gateOf(route)!!
                            assertEquals("$actor/$role/$roleId/$route", AccessPolicy.can(user, roles, null, gate.module, gate.function), store.canAccess(gate.module, gate.function))
                        }
                        if (role == Role.Owner) assertTrue(store.canAccess("access", "access.role"))
                        else assertFalse(store.canAccess("access", "access.role"))
                        assertEquals(pending, box.state.pending)
                    }
                }
            }
        } finally {
            field.set(CloudSync, priorBox)
            store.session.value = priorSession
            store.staff.clear(); store.staff.addAll(priorStaff)
            store.accessRoles.clear(); store.accessRoles.addAll(priorRoles)
            store.accessPolicies.clear(); store.accessPolicies.addAll(priorPolicies)
        }
    }

    @Test fun refreshedBranchEnqueuesBusinessInsteadOfAdvancingShadowWithoutCommands() {
        val user = Staff("Uji", "user@example.test", Role.Kasir, listOf("b1"))
        val active = Session(Role.Kasir, user.name, user.email, "b2", listOf("b2"))
        val data = Snapshot(notas = listOf(Nota("n2", "b2", "Uji", "Pelanggan", "", "", 10, 0,
            PayStatus.Belum, LaundryStatus.Masuk, "", pickupAt = "", waSent = false)),
            payments = listOf(PaymentRecord("p2", "n2", "b2", 10, PayMethod.Tunai, 1, "", active.email)),
            branchStocks = listOf(BranchStock("b2", "retail", 3)))
        val box = SyncOutbox()
        val commands = box.enqueue(SyncProjection.entities(data), 1, "b2", allowedSyncBranches(active, listOf(user)), active.role, active.email)
        assertTrue(commands.any { it.entityType == "nota" && it.entityId == "n2" })
        assertTrue(commands.any { it.entityType == "payment" && it.entityId == "p2" })
        assertTrue(commands.any { it.entityType == "branchStock" && it.branchId == "b2" })
        assertTrue(commands.all { it.actorEmail == active.email })
        assertTrue(box.enqueue(SyncProjection.entities(data), 2, "b2", allowedSyncBranches(active, listOf(user)), active.role, active.email).isEmpty())
        val restarted = SyncOutbox(LocalJson.json.decodeFromString(SyncClientState.serializer(), LocalJson.json.encodeToString(SyncClientState.serializer(), box.state)))
        assertEquals(commands, restarted.state.pending)
    }

    @Test fun readOnlyAuthorizationRefreshDoesNotOverwritePendingBusinessOrAdoptActor() {
        val store = CuciinStore
        val field = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val priorBox = field.get(CloudSync)
        val priorSession = store.session.value
        val before = store.cloudSnapshot()
        val command = SyncCommand("unknown", "nota", "n1", "upsert", "b1", 1L)
        val box = SyncOutbox(SyncClientState(pending = listOf(command)))
        try {
            field.set(CloudSync, box)
            store.authenticateSession(Session(Role.Kasir, "Uji", "user@example.test", "b1", listOf("b1")))
            val beforeRefresh = store.cloudSnapshot()
            val method = store.javaClass.declaredMethods.firstOrNull { it.name.startsWith("applyVerifiedAccess") }
            assertNotNull("refresh izin harus terpisah dari applyCloud bisnis", method)
            val limited = AccessRole("limited", "Hanya stok", setOf("stock"), setOf("stock.view"))
            val account = Staff("Uji", "user@example.test", Role.Kasir, listOf("b2"), accessRoleId = limited.id)
            method!!.invoke(store, Snapshot(staff = listOf(account), accessRoles = listOf(limited)))
            assertTrue(store.canAccess("stock", "stock.view"))
            assertFalse(store.canAccess("stock", "stock.write"))
            assertFalse(store.canAccess("service", "service.create"))
            assertEquals(listOf("b2"), store.session.value?.branchIds)
            assertEquals(beforeRefresh, store.cloudSnapshot())
            assertEquals(listOf(command), box.state.pending)
            assertTrue(box.blockedActor(account.email))
            val applyBusiness = store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }
            applyBusiness.invoke(store, before)
            assertEquals(listOf("b2"), store.session.value?.branchIds)
            assertFalse(store.canAccess("service", "service.create"))
            method.invoke(store, Snapshot(staff = listOf(account.copy(approved = false))))
            assertNull(store.session.value)
            assertEquals(listOf(command), box.state.pending)
        } finally {
            field.set(CloudSync, priorBox)
            if (priorSession != null) store.authenticateSession(priorSession) else store.logout()
        }
    }

    @Test fun authoritativeRevocationClosesSessionWithoutChangingPendingOrBusiness() {
        val store = CuciinStore
        val field = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val priorBox = field.get(CloudSync)
        val priorSession = store.session.value
        val command = SyncCommand("unknown", "nota", "n1", "upsert", "b1", 1L)
        val box = SyncOutbox(SyncClientState(pending = listOf(command)))
        val before = store.cloudSnapshot()
        val method = store.javaClass.getDeclaredMethod("segarkanSesiDariStaff").apply { isAccessible = true }
        val savedStaff = store.staff.toList()
        try {
            field.set(CloudSync, box)
            val account = Staff("Uji", "user@example.test", Role.Kasir, listOf("b1"))
            for (remoteStaff in listOf(emptyList(), listOf(account.copy(approved = false)), listOf(account.copy(branchIds = emptyList())))) {
                store.staff.clear(); store.staff.addAll(remoteStaff)
                store.authenticateSession(Session(account.role, account.name, account.email, "b1", listOf("b1")))
                method.invoke(store)
                assertNull(store.session.value)
                assertEquals(listOf(command), box.state.pending)
                assertEquals(before.notas, store.notas.toList())
                assertEquals(before.products, store.products.toList())
            }
        } finally {
            field.set(CloudSync, priorBox)
            store.session.value = priorSession
            store.staff.clear(); store.staff.addAll(savedStaff)
        }
    }

    @Test fun verifiedSessionRoleOverridesStaleLocalRoleWithoutChangingPending() {
        val store = CuciinStore
        val field = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val priorBox = field.get(CloudSync)
        val priorSession = store.session.value
        val priorStaff = store.staff.toList()
        val command = SyncCommand("unknown", "nota", "n1", "upsert", "b1", 1L)
        val box = SyncOutbox(SyncClientState(pending = listOf(command)))
        try {
            field.set(CloudSync, box)
            for (cached in listOf(Role.Owner, Role.Kasir, null)) {
                store.staff.clear()
                if (cached != null) store.staff.add(Staff("Uji", "user@example.test", cached, listOf("b1")))
                store.authenticateSession(Session(Role.Owner, "Uji", "user@example.test", "b1", listOf("b1")))
                assertTrue("Owner/$cached", store.canAccess("access", "access.role"))
                store.authenticateSession(Session(Role.Kasir, "Uji", "user@example.test", "b1", listOf("b1")))
                assertFalse("Kasir/$cached", store.canAccess("access", "access.role"))
                assertEquals(listOf(command), box.state.pending)
            }
        } finally {
            field.set(CloudSync, priorBox)
            store.session.value = priorSession
            store.staff.clear(); store.staff.addAll(priorStaff)
        }
    }

    @Test fun unknownAndForeignPendingKeepOwnerMenuButRejectBusinessAndAccessWrites() {
        val store = CuciinStore
        val field = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val priorBox = field.get(CloudSync)
        val priorSession = store.session.value
        val priorStaff = store.staff.toList()
        val priorRoles = store.accessRoles.toList()
        val priorProducts = store.products.toList()
        val priorPolicies = store.accessPolicies.toList()
        val priorAudit = store.audit.toList()
        val user = Staff("Owner", "owner@example.test", Role.Owner, listOf("b1"))
        try {
            store.staff.clear(); store.staff.add(user)
            store.accessRoles.clear(); store.accessRoles.addAll(AccessCatalog.builtInRoles())
            store.accessPolicies.clear()
            store.session.value = Session(user.role, user.name, user.email, "b1", user.branchIds)
            for (actor in listOf("", "other@example.test")) {
                val command = SyncCommand("pending", "nota", "n1", "upsert", "b1", 1L, actorEmail = actor)
                val box = SyncOutbox(SyncClientState(pending = listOf(command)))
                field.set(CloudSync, box)
                assertTrue(store.canAccess("access", "access.role"))
                assertTrue(store.canAccess("staff", "staff.manage"))
                assertNull(store.createAccessRole("Jangan tersimpan"))
                assertNotNull(store.saveAccessRole(store.accessRoles.first().copy(name = "Jangan tersimpan")))
                assertNotNull(store.assignAccessRole(user.email, "role-kasir"))
                assertNotNull(store.saveAccessPolicy(user.email, emptySet(), emptySet()))
                assertNotNull(store.clearAccessPolicy(user.email))
                assertNull(store.addProduct("Jangan tersimpan", 1, 0, setOf("b1")))
                assertNotNull(store.notaReject(emptyList(), 0, "b1"))
                assertEquals(priorProducts, store.products.toList())
                assertEquals(AccessCatalog.builtInRoles(), store.accessRoles.toList())
                assertEquals(listOf(user), store.staff.toList())
                assertTrue(store.accessPolicies.isEmpty())
                assertEquals(priorAudit, store.audit.toList())
                assertEquals(listOf(command), box.state.pending)
            }
        } finally {
            field.set(CloudSync, priorBox)
            store.session.value = priorSession
            store.staff.clear(); store.staff.addAll(priorStaff)
            store.accessRoles.clear(); store.accessRoles.addAll(priorRoles)
            store.products.clear(); store.products.addAll(priorProducts)
            store.accessPolicies.clear(); store.accessPolicies.addAll(priorPolicies)
            store.audit.clear(); store.audit.addAll(priorAudit)
        }
    }
}
