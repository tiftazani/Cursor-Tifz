package com.cuciin.laundryops.data

import org.junit.Assert.*
import org.junit.Test

class LoginOutboxRegressionTest {
    @Test fun loopbackHistoricalRecoveryPreparesDurablyWithoutEatingPendingOrRejections() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-historical-pull-").toFile()
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val fields = listOf("outbox", "persistence", "latestSnapshot").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val prior = fields.mapValues { it.value.get(CloudSync) }
        val session = CuciinStore.session.value
        val oldStorage = CuciinStore.javaClass.getDeclaredField("storageError").apply { isAccessible = true }
        val storage = oldStorage.get(CuciinStore)
        val server = java.net.ServerSocket(0, 1, java.net.InetAddress.getByName("127.0.0.1"))
        val executor = java.util.concurrent.Executors.newSingleThreadExecutor()
        try {
            val owner = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
            val stale = Snapshot(staff = listOf(owner), customers = listOf(Customer("old", "Lama", "", "")), updatedAt = 100)
            val full = stale.copy(customers = listOf(Customer("server", "Server", "", "")), updatedAt = 1)
            val body = LocalJson.json.encodeToString(Snapshot.serializer(), full).toByteArray(Charsets.UTF_8)
            val response = executor.submit {
                server.accept().use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    while (!input.readLine().isNullOrEmpty()) { }
                    socket.getOutputStream().use { output ->
                        output.write("HTTP/1.1 200 OK\r\nContent-Length: ${body.size}\r\nX-Cuciin-Revision: 23\r\nX-Cuciin-Scope: owner\r\nConnection: close\r\n\r\n".toByteArray(Charsets.UTF_8))
                        output.write(body)
                    }
                }
            }
            val wire = CloudSync.readAuthorizedSnapshot(java.net.URL("http://127.0.0.1:${server.localPort}/v1/snapshot").openConnection() as java.net.HttpURLConnection)!!
            response.get(5, java.util.concurrent.TimeUnit.SECONDS)
            val canonical = CloudSync.canonicalPulledSnapshot(stale, 20, "owner", wire.snapshot, wire.revision, wire.scope)
            assertEquals(full.customers, canonical.first.customers)
            oldStorage.set(CuciinStore, null)
            CuciinStore.session.value = Session(Role.Owner, owner.name, owner.email, "b1", owner.branchIds)
            val stamp = CloudSync.captureSession()
            val deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(30)
            val rejected = RejectedSyncCommand(SyncCommand("keep-rejected", "customer", "denied", "upsert", occurredAt = 1, actorEmail = owner.email), "denied", 2)
            val box = SyncOutbox(SyncClientState(revision = 20, scopeKey = "owner", bootstrapped = true, shadow = SyncProjection.entities(stale), rejected = listOf(rejected)))
            val disk = SyncPersistence(app)
            disk.save(box.state)
            fields.getValue("outbox").set(CloudSync, box)
            fields.getValue("persistence").set(CloudSync, disk)
            val blocked = java.io.File(directory, "cuciin-sync-state.json.tmp").apply { mkdir() }
            val before = box.state
            assertTrue(runCatching { CloudSync.prepareAuthorizedPull(stamp, deadline, canonical.first, canonical.second, 0, "owner") }.isFailure)
            assertEquals(before, box.state)
            assertEquals(before, disk.load())
            blocked.delete()
            val pending = SyncCommand("keep-local", "customer", "local", "upsert", occurredAt = 1, actorEmail = owner.email)
            for (held in listOf(before.copy(pending = listOf(pending)), before.copy(generation = 1))) {
                val heldBox = SyncOutbox(held)
                fields.getValue("outbox").set(CloudSync, heldBox)
                assertFalse(CloudSync.prepareAuthorizedPull(stamp, deadline, canonical.first, canonical.second, 0, "owner"))
                assertEquals(held, heldBox.state)
            }
            fields.getValue("outbox").set(CloudSync, box)
            assertFalse(CloudSync.prepareAuthorizedPull(stamp, System.nanoTime() - 1, canonical.first, canonical.second, 0, "owner"))
            assertFalse(CloudSync.prepareAuthorizedPull(stamp, deadline, canonical.first, canonical.second, 0, "kasir:a@example.test:b1"))
            CloudSync.invalidateSession()
            assertFalse(CloudSync.prepareAuthorizedPull(stamp, deadline, canonical.first, canonical.second, 0, "owner"))
            assertTrue(CloudSync.prepareAuthorizedPull(CloudSync.captureSession(), deadline, canonical.first, canonical.second, 0, "owner"))
            assertEquals(before.rejected, disk.load().rejected)
            assertEquals(20L, disk.load().revision)
            assertEquals(23L, disk.load().pendingRemote!!.revision)
            assertEquals(owner.email, disk.load().pendingRemote!!.actorEmail)
            assertEquals(full.customers, disk.load().pendingRemote!!.snapshot.customers)
        } finally {
            fields.forEach { (name, field) -> field.set(CloudSync, prior[name]) }
            CuciinStore.session.value = session
            oldStorage.set(CuciinStore, storage)
            server.close()
            executor.shutdownNow()
            directory.deleteRecursively()
        }
    }

    @Test fun historicalSkippedBusinessUsesBoundedAuthorizedSnapshot() {
        val owner = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
        val stale = Snapshot(staff = listOf(owner), customers = listOf(Customer("old", "Lama", "", "")), updatedAt = 100)
        val nota = Nota("N-missing", "b1", "Uji", "Pelanggan", "", "Cuci", 10000, 0, PayStatus.Belum, LaundryStatus.Masuk, "", 1, "", false)
        val full = stale.copy(customers = listOf(Customer("server", "Server", "", "")), notas = listOf(nota), updatedAt = 1)
        val canonical = CloudSync.canonicalPulledSnapshot(stale, 20, "owner", full, 23, "owner")
        assertEquals("Nota yang jurnalnya terlewat wajib pulih walau timestamp snapshot lebih tua", full.notas, canonical.first.notas)
        assertEquals(full.customers, canonical.first.customers)
        assertEquals(23L, canonical.second)
        for ((revision, scope) in listOf(null to "owner", 19L to "owner", 23L to "kasir:a@example.test:b1", -1L to "owner")) {
            val withheld = CloudSync.canonicalPulledSnapshot(stale, 20, "owner", full, revision, scope)
            assertEquals(stale.notas, withheld.first.notas)
            assertEquals(20L, withheld.second)
        }
    }


    @Test fun commandRequestsStayWithinServerStatementBudget() {
        val source = java.io.File("src/main/java/com/cuciin/laundryops/data/CloudSync.kt").readText()
        assertTrue("Satu request hanya satu command sampai Worker punya batas statement terukur", source.contains("BATCH_LIMIT = 1\n"))
    }

    @Test fun staleResponseCannotApplyAfterSwitchOrSameAccountRelogin() {
        val prior = CuciinStore.session.value
        try {
            CuciinStore.authenticateSession(Session(Role.Owner, "A", "a@example.test", "b1", listOf("b1")))
            val responseA = CloudSync.captureSession()
            assertTrue(CloudSync.sessionUnchanged(responseA))
            CuciinStore.authenticateSession(Session(Role.Owner, "B", "b@example.test", "b1", listOf("b1")))
            assertFalse(CloudSync.sessionUnchanged(responseA))
            CuciinStore.authenticateSession(Session(Role.Owner, "A", "a@example.test", "b1", listOf("b1")))
            assertFalse(CloudSync.sessionUnchanged(responseA))
            val response = CloudSync.captureSession()
            CloudSync.invalidateSession()
            assertFalse(CloudSync.sessionUnchanged(response))
            val source = java.io.File("src/main/java/com/cuciin/laundryops/data/CloudSync.kt").readText()
            for (method in listOf("pullChanges", "bootstrapSnapshot", "recoverRejectedSnapshot", "legacyPull", "legacyPushThenPull", "flushCommands")) {
                val body = source.substringAfter("private fun $method():").substringBefore(10.toChar() + "    private fun ")
                assertTrue(method, body.contains("val requestSession = captureSession()"))
                assertTrue(method, body.contains("if (!sessionUnchanged(requestSession))"))
            }
        } finally { CuciinStore.session.value = prior }
    }

    @Test fun queuedAuthorizationCannotApplyAfterDeadlineOrAccountSwitch() {
        val store = CuciinStore
        val priorSession = store.session.value
        val overlay = store.javaClass.getDeclaredField("verifiedAccess").apply { isAccessible = true }
        val priorAccess = overlay.get(store)
        val method = CloudSync.javaClass.declaredMethods.firstOrNull { it.name.startsWith("applyAuthorizationResponse") }
        assertNotNull("Respons izin harus memeriksa sesi dan batas waktu pada saat diterapkan", method)
        try {
            val user = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
            val active = Session(user.role, user.name, user.email, "b1", user.branchIds)
            val permissions = Snapshot(staff = listOf(user), accessRoles = AccessCatalog.builtInRoles())
            store.authenticateSession(active, permissions)
            val stamp = CloudSync.captureSession()
            val before = store.cloudSnapshot()
            val expired = System.nanoTime() - 1
            assertEquals(false, method!!.invoke(CloudSync, stamp, 200, Snapshot(), expired))
            assertEquals(false, method.invoke(CloudSync, stamp, 403, null, expired))
            assertEquals(active, store.session.value)
            assertTrue(store.canAccess("access", "access.role"))
            store.authenticateSession(active, permissions)
            assertEquals(false, method.invoke(CloudSync, stamp, 200, Snapshot(), System.nanoTime() + 1_000_000_000))
            assertEquals(active, store.session.value)
            assertEquals(before, store.cloudSnapshot())
            val current = CloudSync.captureSession()
            assertEquals(true, method.invoke(CloudSync, current, 200, Snapshot(), System.nanoTime() + 1_000_000_000))
            assertNull(store.session.value)
        } finally {
            store.session.value = priorSession
            overlay.set(store, priorAccess)
        }
    }

    @Test fun preparedRejectionRecoveryRestoresServerDataAfterRestart() {
        val store = CuciinStore
        val field = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val priorBox = field.get(CloudSync)
        val prior = store.cloudSnapshot()
        val priorSession = store.session.value
        val latest = CloudSync.javaClass.getDeclaredField("latestSnapshot").apply { isAccessible = true }
        val priorLatest = latest.get(CloudSync)
        val hadData = CloudSync.javaClass.getDeclaredField("hadPersistedLocalData").apply { isAccessible = true }
        val priorHadData = hadData.get(CloudSync)
        try {
            val account = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
            val server = Snapshot(staff = listOf(account), branches = listOf(Branch("b1", "B1", "Cabang", "", "")),
                customers = listOf(Customer("c1", "Server", "", "")), updatedAt = 1000)
            val local = server.copy(customers = listOf(Customer("c1", "Edit ditolak", "", "")), updatedAt = 2000)
            val business = store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }
            business.invoke(store, local)
            val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(local), rejected = listOf(
                RejectedSyncCommand(SyncCommand("denied", "customer", "c1", "upsert", occurredAt = 2000), "denied", 2001))))
            val recovery = server.copy(updatedAt = 2002)
            assertTrue(box.reconcileRejectedRemote(recovery, SyncProjection.entities(recovery), 7))
            val restarted = SyncOutbox(LocalJson.json.decodeFromString(SyncClientState.serializer(), LocalJson.json.encodeToString(SyncClientState.serializer(), box.state)))
            field.set(CloudSync, restarted)
            val prepared = CloudSync.initializeLocalState(local, true, local)
            assertEquals(recovery, prepared)
            assertEquals(1, restarted.state.rejected.size)
            store.applyRecoveredCloud(prepared!!)
            assertEquals(server.customers, store.customers.toList())
            assertTrue(restarted.state.rejected.isEmpty())
            assertNull(restarted.state.pendingRemote)
            assertTrue(restarted.state.pending.isEmpty())
        } finally {
            field.set(CloudSync, priorBox)
            store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }.invoke(store, prior)
            store.javaClass.getDeclaredField("localUpdatedAt").apply { isAccessible = true }.setLong(store, prior.updatedAt)
            store.session.value = priorSession
            latest.set(CloudSync, priorLatest)
            hadData.set(CloudSync, priorHadData)
        }
    }

    @Test fun savingRecoveredFilesDoesNotOverwriteValidBackupWithCorruptPrimary() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-valid-fallback-").toFile()
        val local = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val old = local.mapValues { it.value.get(LocalJson) }
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val state = SyncClientState(pending = listOf(SyncCommand("keep", "nota", "n1", "upsert", "b1", 1)))
        val snapshot = Snapshot(staff = listOf(Staff("A", "a@example.test", Role.Owner, listOf("b1"))), branches = listOf(Branch("b1", "B1", "Cabang", "", "")), updatedAt = 10)
        try {
            val primarySync = java.io.File(directory, "cuciin-sync-state.json").apply { writeText("{broken") }
            val backupSync = java.io.File(directory, "cuciin-sync-state.backup.json").apply { writeText(LocalJson.json.encodeToString(SyncClientState.serializer(), state)) }
            val originalSync = backupSync.readText()
            val disk = SyncPersistence(app)
            assertEquals(state, disk.load())
            disk.save(state.copy(legacyActorChecked = true))
            assertEquals("Backup valid tidak boleh ditimpa primary rusak", originalSync, backupSync.readText())
            assertEquals(state.copy(legacyActorChecked = true), disk.load())
            primarySync.delete()
            assertEquals(state, disk.load())
            val primary = java.io.File(directory, "cuciin-data.json").apply { writeText("{broken") }
            val backup = java.io.File(directory, "cuciin-data.backup.json").apply { writeText(LocalJson.json.encodeToString(Snapshot.serializer(), snapshot)) }
            local.getValue("file").set(LocalJson, primary)
            local.getValue("backup").set(LocalJson, backup)
            local.getValue("latestSavedAt").setLong(LocalJson, Long.MIN_VALUE)
            val original = backup.readText()
            assertEquals(snapshot, LocalJson.load())
            LocalJson.save(snapshot.copy(updatedAt = 11))
            assertEquals(original, backup.readText())
            assertEquals(snapshot.copy(updatedAt = 11), LocalJson.load())
            primary.delete()
            assertEquals(snapshot, LocalJson.load())
        } finally {
            local.forEach { (name, field) -> field.set(LocalJson, old[name]) }
            directory.deleteRecursively()
        }
    }

    @Test fun corruptStartupFilesStayUntouchedAndCannotBeBypassedByRetry() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-corrupt-startup-").toFile()
        val store = CuciinStore
        val before = store.cloudSnapshot()
        val priorSession = store.session.value
        val fields = listOf("app", "ready", "storageError", "verifiedAccess", "accessPersistence", "localUpdatedAt").associateWith { store.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val prior = fields.mapValues { it.value.get(store) }
        val cloud = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "hadPersistedLocalData", "lastStatus", "online", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorCloud = cloud.mapValues { it.value.get(CloudSync) }
        val local = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorLocal = local.mapValues { it.value.get(LocalJson) }
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val owner = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
        val saved = Snapshot(staff = listOf(owner), branches = listOf(Branch("b1", "B1", "Cabang", "", "")), customers = listOf(Customer("c1", "Tetap", "", "")), updatedAt = 10)
        try {
            java.io.File(directory, "cuciin-cloud-environment.txt").writeText(com.cuciin.laundryops.BuildConfig.CUCIIN_CLOUD_URL.trim())
            for (kind in listOf("business", "sync")) {
                directory.listFiles()!!.filter { it.name != "cuciin-cloud-environment.txt" }.forEach { it.delete() }
                java.io.File(directory, "cuciin-data.json").writeText(LocalJson.json.encodeToString(Snapshot.serializer(), saved))
                SyncPersistence(app).save(SyncClientState(pending = listOf(SyncCommand("keep", "nota", "n1", "upsert", "b1", 1))))
                val names = if (kind == "business") listOf("cuciin-data.json", "cuciin-data.backup.json") else listOf("cuciin-sync-state.json", "cuciin-sync-state.backup.json")
                val corrupt = if (kind == "business") "{}" else "{broken"
                names.forEach { java.io.File(directory, it).writeText(corrupt) }
                val originals = directory.listFiles()!!.associate { it.name to it.readText() }
                fields.getValue("ready").setBoolean(store, false)
                cloud.getValue("persistence").set(CloudSync, null)
                repeat(2) {
                    assertFalse("Berkas $kind rusak harus menahan startup dan retry", store.initializeStorage(app))
                    assertNull(store.session.value)
                    assertNotNull(store.storageError)
                    originals.forEach { (name, bytes) -> assertEquals("Bukti $name tidak boleh ditimpa", bytes, java.io.File(directory, name).readText()) }
                }
            }
            directory.listFiles()!!.filter { it.name != "cuciin-cloud-environment.txt" }.forEach { it.delete() }
            cloud.getValue("persistence").set(CloudSync, null)
            assertTrue("Instalasi baru tanpa berkas tetap sah", store.initializeStorage(app))
            assertNotNull(LocalJson.load())
        } finally {
            fields.forEach { (name, field) -> field.set(store, prior[name]) }
            cloud.forEach { (name, field) -> field.set(CloudSync, priorCloud[name]) }
            local.forEach { (name, field) -> field.set(LocalJson, priorLocal[name]) }
            store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }.invoke(store, before)
            store.session.value = priorSession
            directory.deleteRecursively()
        }
    }

    @Test fun legacyPreparedUnprovenBusinessDeltaKeepsRawEvidence() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-business-outbox-gap-").toFile()
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val disk = SyncPersistence(app)
        val store = CuciinStore
        val before = store.cloudSnapshot()
        val priorSession = store.session.value
        val sf = listOf("app", "ready", "storageError", "verifiedAccess", "accessPersistence", "localUpdatedAt").associateWith { store.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorStore = sf.mapValues { it.value.get(store) }
        val cf = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "hadPersistedLocalData", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason", "lastStatus", "online").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorCloud = cf.mapValues { it.value.get(CloudSync) }
        val lf = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorLocal = lf.mapValues { it.value.get(LocalJson) }
        val business = store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }
        try {
            val account = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
            val saved = Snapshot(staff = listOf(account), branches = listOf(Branch("b1", "B1", "Cabang", "", "")), accessRoles = AccessCatalog.builtInRoles(), sessionEmail = account.email, updatedAt = Clock.nowMs())
            LocalJson.init(app)
            LocalJson.save(saved)
            business.invoke(store, saved)
            sf.getValue("localUpdatedAt").setLong(store, saved.updatedAt)
            sf.getValue("storageError").set(store, null)
            sf.getValue("verifiedAccess").set(store, saved)
            sf.getValue("ready").setBoolean(store, true)
            store.session.value = Session(account.role, account.name, account.email, "b1", account.branchIds)
            val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(saved), bootstrapped = true, legacyActorChecked = true))
            sf.getValue("app").set(store, app)
            val remote = saved.copy(customers = listOf(Customer("server-only", "Server tetap", "", "")), sessionEmail = null)
            assertTrue(box.prepareRemote(remote, SyncProjection.entities(remote), 17, box.state.generation, "owner", account.email))
            disk.save(box.state)
            cf.getValue("outbox").set(CloudSync, box)
            cf.getValue("persistence").set(CloudSync, disk)
            cf.getValue("latestSnapshot").set(CloudSync, saved.copy(sessionEmail = null))
            val initialState = box.state
            val blocked = java.io.File(directory, "cuciin-sync-state.json.tmp").apply { mkdir() }
            val created = runCatching { store.addCustomer("Baru", "123", "Alamat") }
            assertTrue("Gagal outbox tidak boleh melempar ke UI: ${created.exceptionOrNull()}", created.isSuccess)
            assertNotNull(created.getOrNull())
            val durable = LocalJson.load()!!
            assertEquals(listOf(created.getOrThrow()!!), durable.customers)
            assertEquals(account.email, durable.sessionEmail)
            assertEquals(initialState, disk.load())
            assertEquals(initialState, box.state)
            assertNotNull("Gagal outbox harus menahan sesi dan mutasi", store.storageError)
            assertNull(store.session.value)
            assertFalse(sf.getValue("ready").getBoolean(store))
            assertNull(store.addCustomer("Jangan tambah", "", ""))
            assertFalse(store.finalizeAuthenticatedSession(Session(Role.Owner, "B", "b@example.test", "b1", listOf("b1")), saved))
            var remoteCompleted = false
            val heldBusiness = store.cloudSnapshot()
            assertTrue(runCatching { store.applyCloud(saved.copy(customers = emptyList(), updatedAt = durable.updatedAt + 1)) { remoteCompleted = true } }.isSuccess)
            assertFalse("Remote tidak boleh diakui saat delta lokal belum masuk antrean", remoteCompleted)
            assertEquals(heldBusiness, store.cloudSnapshot())
            assertEquals(durable, LocalJson.load())
            store.logout()
            assertEquals("Logout tidak boleh menghapus bukti asal delta", durable, LocalJson.load())
            assertFalse(store.initializeStorage(app))
            assertEquals(durable, LocalJson.load())
            assertEquals(initialState, disk.load())
            blocked.delete()
            java.io.File(directory, "cuciin-prepared-local-write.json").delete()
            val bytes = java.io.File(directory, "cuciin-data.json").readBytes()
            repeat(2) {
                assertFalse("Tanpa intent durable, delta lama harus tertahan, bukan diadopsi", store.initializeStorage(app))
                assertArrayEquals(bytes, java.io.File(directory, "cuciin-data.json").readBytes())
                assertEquals(initialState, disk.load())
            }
        } finally {
            business.invoke(store, before)
            sf.forEach { (name, field) -> field.set(store, priorStore[name]) }
            store.session.value = priorSession
            cf.forEach { (name, field) -> field.set(CloudSync, priorCloud[name]) }
            lf.forEach { (name, field) -> field.set(LocalJson, priorLocal[name]) }
            directory.deleteRecursively()
        }
    }

    @Test fun cumulativePreparedEditsSurviveFailedCompletionRetry() = cumulativePreparedEdits("adds", false)

    @Test fun cumulativePreparedEditAfterDeleteSurvivesStartupRestart() = cumulativePreparedEdits("editAfterDelete", true)

    @Test fun cumulativePreparedDeleteAfterEditSurvivesStartupRestart() = cumulativePreparedEdits("deleteAfterEdit", true)

    @Test fun cumulativePreparedEditsCompleteDuringLocalStartupRestart() = cumulativePreparedEdits("editAfterDelete", true, false)

    private fun cumulativePreparedEdits(scenario: String, restart: Boolean, cloudStartup: Boolean = true) {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-cumulative-prepared-").toFile()
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val disk = SyncPersistence(app)
        val store = CuciinStore
        val before = store.cloudSnapshot()
        val priorSession = store.session.value
        val sf = listOf("app", "ready", "storageError", "verifiedAccess", "accessPersistence", "localUpdatedAt").associateWith { store.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorStore = sf.mapValues { it.value.get(store) }
        val cf = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "hadPersistedLocalData", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason", "lastStatus", "online").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorCloud = cf.mapValues { it.value.get(CloudSync) }
        val lf = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorLocal = lf.mapValues { it.value.get(LocalJson) }
        val firebase = FirebaseCloud.javaClass.getDeclaredField("enabled").apply { isAccessible = true }
        val priorFirebase = firebase.getBoolean(FirebaseCloud)
        val business = store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }
        try {
            firebase.setBoolean(FirebaseCloud, false)
            val account = Staff("Asal", "origin@example.test", Role.Owner, listOf("b1"))
            val x = Customer("x", "X lama", "1", "Alamat X")
            val y = Customer("y", "Y lama", "2", "Alamat Y")
            val saved = Snapshot(staff = listOf(account), branches = listOf(Branch("b1", "B1", "Cabang", "", "")), customers = listOf(x, y),
                accessRoles = AccessCatalog.builtInRoles(), sessionEmail = account.email, updatedAt = Clock.nowMs())
            LocalJson.init(app)
            business.invoke(store, saved)
            sf.getValue("app").set(store, app)
            sf.getValue("localUpdatedAt").setLong(store, saved.updatedAt)
            sf.getValue("storageError").set(store, null)
            sf.getValue("verifiedAccess").set(store, saved)
            sf.getValue("ready").setBoolean(store, true)
            store.session.value = Session(account.role, account.name, account.email, "b1", account.branchIds)
            val normalized = store.cloudSnapshot().copy(sessionEmail = account.email)
            LocalJson.save(normalized)
            val serverOnly = Customer("server-only", "Hanya server", "3", "Alamat server")
            val remote = normalized.copy(customers = normalized.customers + serverOnly, sessionEmail = null)
            val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(normalized), bootstrapped = true, legacyActorChecked = true))
            assertTrue(box.prepareRemote(remote, SyncProjection.entities(remote), 17, box.state.generation, "owner", account.email))
            val prepared = box.state.pendingRemote
            disk.save(box.state)
            cf.getValue("outbox").set(CloudSync, box)
            cf.getValue("persistence").set(CloudSync, disk)
            cf.getValue("localWriteFile").set(CloudSync, java.io.File(directory, "cuciin-prepared-local-write.json"))
            cf.getValue("latestSnapshot").set(CloudSync, remote)
            var added: Customer? = null
            if (scenario == "adds") added = store.addCustomer("A baru", "4", "Alamat A")!!
            else assertNull(store.updateCustomer(x.id, "X pertama", x.phone, x.address))
            assertEquals(prepared, disk.load().pendingRemote)
            val firstPending = disk.load().pending
            if (scenario == "adds") assertNotNull(store.addCustomer("B baru", "5", "Alamat B"))
            else assertNull(store.deleteCustomer(if (scenario == "editAfterDelete") y.id else x.id))
            val beforeFailure = disk.load()
            assertEquals(prepared, beforeFailure.pendingRemote)
            val blocked = java.io.File(directory, "cuciin-sync-state.json.tmp").apply { mkdir() }
            if (restart) {
                if (scenario == "editAfterDelete") assertNull(store.updateCustomer(x.id, "X terakhir", "6", "Alamat akhir"))
                else assertNotNull(store.addCustomer("C baru", "7", "Alamat C"))
                assertNotNull(store.storageError)
                assertNull(store.session.value)
                assertEquals(beforeFailure, disk.load())
            }
            val localCustomers = LocalJson.load()!!.customers
            val expected = (localCustomers + serverOnly).toSet()
            val expectedBusiness = LocalJson.load()!!
            val businessBytes = java.io.File(directory, "cuciin-data.json").readBytes()
            val syncBytes = java.io.File(directory, "cuciin-sync-state.json").readBytes()
            if (restart) {
                cf.getValue("persistence").set(CloudSync, null)
                cf.getValue("latestSnapshot").set(CloudSync, null)
                store.session.value = null
                assertFalse(store.initializeStorage(app))
                assertArrayEquals(businessBytes, java.io.File(directory, "cuciin-data.json").readBytes())
                assertArrayEquals(syncBytes, java.io.File(directory, "cuciin-sync-state.json").readBytes())
                blocked.delete()
                firebase.setBoolean(FirebaseCloud, cloudStartup)
                assertTrue(store.initializeStorage(app))
                assertEquals(if (cloudStartup) prepared else null, disk.load().pendingRemote)
                firebase.setBoolean(FirebaseCloud, false)
                store.authenticateSession(Session(account.role, account.name, account.email, "b1", account.branchIds), remote)
            } else {
                assertFalse(CloudSync.applyPreparedRemote(CloudSync.captureSession(), System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(30)))
                assertEquals(beforeFailure, disk.load())
                assertEquals("Semua edit harus durable saat completion gagal", expected, LocalJson.load()!!.customers.toSet())
                blocked.delete()
            }
            assertTrue(CloudSync.applyPreparedRemote(CloudSync.captureSession(), System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(30)))
            assertEquals("Edit kumulatif dan pelanggan server harus tetap utuh", expected, LocalJson.load()!!.customers.toSet())
            assertEquals(expected, store.customers.toSet())
            val completed = disk.load()
            assertNull(completed.pendingRemote)
            assertEquals(17L, completed.revision)
            assertEquals(completed, (cf.getValue("outbox").get(CloudSync) as SyncOutbox).state)
            assertEquals(completed.pending.size, completed.pending.map { it.commandId }.distinct().size)
            assertTrue(completed.pending.all { it.actorEmail == account.email })
            for (command in beforeFailure.pending + firstPending) assertEquals(1, completed.pending.count { it == command })
            val customers = completed.pending.filter { it.entityType == "customer" }
            assertFalse(customers.any { it.entityId == serverOnly.id })
            if (scenario == "adds") {
                assertEquals(setOf(added!!.id, localCustomers.single { it.name == "B baru" }.id), customers.map { it.entityId }.toSet())
                assertEquals(2, customers.size)
                assertTrue(customers.all { it.operation == "upsert" })
            } else {
                val xCommands = customers.filter { it.entityId == x.id }
                assertEquals(2, xCommands.size)
                assertEquals(if (scenario == "editAfterDelete") "upsert" else "delete", xCommands.last().operation)
                if (scenario == "editAfterDelete") {
                    assertEquals(expectedBusiness.customers.single { it.id == x.id }, LocalJson.load()!!.customers.single { it.id == x.id })
                    assertEquals("\"X terakhir\"", (xCommands.last().payload as kotlinx.serialization.json.JsonObject)["name"].toString())
                    assertEquals(1, customers.count { it.entityId == y.id && it.operation == "delete" })
                } else assertFalse(LocalJson.load()!!.customers.any { it.id == x.id })
                assertEquals(3, customers.size)
            }
            val pendingOnce = completed.pending
            assertTrue(store.initializeStorage(app))
            assertEquals(pendingOnce, disk.load().pending)
            assertEquals(expected, LocalJson.load()!!.customers.toSet())
        } finally {
            business.invoke(store, before)
            sf.forEach { (name, field) -> field.set(store, priorStore[name]) }
            store.session.value = priorSession
            cf.forEach { (name, field) -> field.set(CloudSync, priorCloud[name]) }
            lf.forEach { (name, field) -> field.set(LocalJson, priorLocal[name]) }
            firebase.setBoolean(FirebaseCloud, priorFirebase)
            directory.deleteRecursively()
        }
    }

    @Test fun preparedBusinessSavedBeforeOutboxFailureSurvivesOriginRetry() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-business-outbox-gap-").toFile()
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val disk = SyncPersistence(app)
        val store = CuciinStore
        val before = store.cloudSnapshot()
        val priorSession = store.session.value
        val sf = listOf("app", "ready", "storageError", "verifiedAccess", "accessPersistence", "localUpdatedAt").associateWith { store.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorStore = sf.mapValues { it.value.get(store) }
        val cf = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "hadPersistedLocalData", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason", "lastStatus", "online").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorCloud = cf.mapValues { it.value.get(CloudSync) }
        val lf = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorLocal = lf.mapValues { it.value.get(LocalJson) }
        val business = store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }
        try {
            val account = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
            val saved = Snapshot(staff = listOf(account), branches = listOf(Branch("b1", "B1", "Cabang", "", "")), accessRoles = AccessCatalog.builtInRoles(), sessionEmail = account.email, updatedAt = Clock.nowMs())
            LocalJson.init(app)
            LocalJson.save(saved)
            business.invoke(store, saved)
            sf.getValue("localUpdatedAt").setLong(store, saved.updatedAt)
            sf.getValue("storageError").set(store, null)
            sf.getValue("verifiedAccess").set(store, saved)
            sf.getValue("ready").setBoolean(store, true)
            store.session.value = Session(account.role, account.name, account.email, "b1", account.branchIds)
            val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(saved), bootstrapped = true, legacyActorChecked = true))
            sf.getValue("app").set(store, app)
            val remote = saved.copy(customers = listOf(Customer("server-only", "Server tetap", "", "")), sessionEmail = null)
            assertTrue(box.prepareRemote(remote, SyncProjection.entities(remote), 17, box.state.generation, "owner", account.email))
            disk.save(box.state)
            cf.getValue("outbox").set(CloudSync, box)
            cf.getValue("persistence").set(CloudSync, disk)
            cf.getValue("latestSnapshot").set(CloudSync, saved.copy(sessionEmail = null))
            val initialState = box.state
            val blocked = java.io.File(directory, "cuciin-sync-state.json.tmp").apply { mkdir() }
            val created = runCatching { store.addCustomer("Baru", "123", "Alamat") }
            assertTrue("Gagal outbox tidak boleh melempar ke UI: ${created.exceptionOrNull()}", created.isSuccess)
            assertNotNull(created.getOrNull())
            val durable = LocalJson.load()!!
            assertEquals(listOf(created.getOrThrow()!!), durable.customers)
            assertEquals(account.email, durable.sessionEmail)
            assertEquals(initialState, disk.load())
            assertEquals(initialState, box.state)
            assertNotNull("Gagal outbox harus menahan sesi dan mutasi", store.storageError)
            assertNull(store.session.value)
            assertFalse(sf.getValue("ready").getBoolean(store))
            assertNull(store.addCustomer("Jangan tambah", "", ""))
            assertFalse(store.finalizeAuthenticatedSession(Session(Role.Owner, "B", "b@example.test", "b1", listOf("b1")), saved))
            var remoteCompleted = false
            val heldBusiness = store.cloudSnapshot()
            assertTrue(runCatching { store.applyCloud(saved.copy(customers = emptyList(), updatedAt = durable.updatedAt + 1)) { remoteCompleted = true } }.isSuccess)
            assertFalse("Remote tidak boleh diakui saat delta lokal belum masuk antrean", remoteCompleted)
            assertEquals(heldBusiness, store.cloudSnapshot())
            assertEquals(durable, LocalJson.load())
            store.logout()
            assertEquals("Logout tidak boleh menghapus bukti asal delta", durable, LocalJson.load())
            assertFalse(store.initializeStorage(app))
            assertEquals(durable, LocalJson.load())
            assertEquals(initialState, disk.load())
            blocked.delete()
            assertTrue(store.initializeStorage(app))
            assertNull(store.storageError)
            assertEquals("Prepared harus mempertahankan server dan edit bisnis durable", (remote.customers + durable.customers).toSet(), LocalJson.load()!!.customers.toSet())
            val restarted = disk.load()
            val command = restarted.pending.single { it.entityType == "customer" }
            assertEquals(account.email, command.actorEmail)
            assertEquals(created.getOrThrow()!!.id, command.entityId)
            assertFalse(restarted.pending.any { it.operation == "delete" })
            assertEquals(restarted, (cf.getValue("outbox").get(CloudSync) as SyncOutbox).state)
        } finally {
            business.invoke(store, before)
            sf.forEach { (name, field) -> field.set(store, priorStore[name]) }
            store.session.value = priorSession
            cf.forEach { (name, field) -> field.set(CloudSync, priorCloud[name]) }
            lf.forEach { (name, field) -> field.set(LocalJson, priorLocal[name]) }
            directory.deleteRecursively()
        }
    }

    @Test fun businessSavedBeforeOutboxFailureSurvivesLogoutAndStartupRetry() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-business-outbox-gap-").toFile()
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val disk = SyncPersistence(app)
        val store = CuciinStore
        val before = store.cloudSnapshot()
        val priorSession = store.session.value
        val sf = listOf("app", "ready", "storageError", "verifiedAccess", "accessPersistence", "localUpdatedAt").associateWith { store.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorStore = sf.mapValues { it.value.get(store) }
        val cf = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "hadPersistedLocalData", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason", "lastStatus", "online").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorCloud = cf.mapValues { it.value.get(CloudSync) }
        val lf = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorLocal = lf.mapValues { it.value.get(LocalJson) }
        val business = store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }
        try {
            val account = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
            val saved = Snapshot(staff = listOf(account), branches = listOf(Branch("b1", "B1", "Cabang", "", "")), accessRoles = AccessCatalog.builtInRoles(), sessionEmail = account.email, updatedAt = Clock.nowMs())
            LocalJson.init(app)
            LocalJson.save(saved)
            business.invoke(store, saved)
            sf.getValue("localUpdatedAt").setLong(store, saved.updatedAt)
            sf.getValue("storageError").set(store, null)
            sf.getValue("verifiedAccess").set(store, saved)
            sf.getValue("ready").setBoolean(store, true)
            store.session.value = Session(account.role, account.name, account.email, "b1", account.branchIds)
            val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(saved), bootstrapped = true, legacyActorChecked = true))
            disk.save(box.state)
            cf.getValue("outbox").set(CloudSync, box)
            cf.getValue("persistence").set(CloudSync, disk)
            cf.getValue("latestSnapshot").set(CloudSync, saved.copy(sessionEmail = null))
            val initialState = box.state
            val blocked = java.io.File(directory, "cuciin-sync-state.json.tmp").apply { mkdir() }
            val created = runCatching { store.addCustomer("Baru", "123", "Alamat") }
            assertTrue("Gagal outbox tidak boleh melempar ke UI: ${created.exceptionOrNull()}", created.isSuccess)
            assertNotNull(created.getOrNull())
            val durable = LocalJson.load()!!
            assertEquals(listOf(created.getOrThrow()!!), durable.customers)
            assertEquals(account.email, durable.sessionEmail)
            assertEquals(initialState, disk.load())
            assertEquals(initialState, box.state)
            assertNotNull("Gagal outbox harus menahan sesi dan mutasi", store.storageError)
            assertNull(store.session.value)
            assertFalse(sf.getValue("ready").getBoolean(store))
            assertNull(store.addCustomer("Jangan tambah", "", ""))
            assertFalse(store.finalizeAuthenticatedSession(Session(Role.Owner, "B", "b@example.test", "b1", listOf("b1")), saved))
            var remoteCompleted = false
            val heldBusiness = store.cloudSnapshot()
            assertTrue(runCatching { store.applyCloud(saved.copy(customers = emptyList(), updatedAt = durable.updatedAt + 1)) { remoteCompleted = true } }.isSuccess)
            assertFalse("Remote tidak boleh diakui saat delta lokal belum masuk antrean", remoteCompleted)
            assertEquals(heldBusiness, store.cloudSnapshot())
            assertEquals(durable, LocalJson.load())
            store.logout()
            assertEquals("Logout tidak boleh menghapus bukti asal delta", durable, LocalJson.load())
            assertFalse(store.initializeStorage(app))
            assertEquals(durable, LocalJson.load())
            assertEquals(initialState, disk.load())
            blocked.delete()
            assertTrue(store.initializeStorage(app))
            assertNull(store.storageError)
            assertEquals(durable.customers, LocalJson.load()!!.customers)
            val restarted = disk.load()
            val command = restarted.pending.single { it.entityType == "customer" }
            assertEquals(account.email, command.actorEmail)
            assertEquals(created.getOrThrow()!!.id, command.entityId)
            assertFalse(restarted.pending.any { it.operation == "delete" })
            assertEquals(restarted, (cf.getValue("outbox").get(CloudSync) as SyncOutbox).state)
        } finally {
            business.invoke(store, before)
            sf.forEach { (name, field) -> field.set(store, priorStore[name]) }
            store.session.value = priorSession
            cf.forEach { (name, field) -> field.set(CloudSync, priorCloud[name]) }
            lf.forEach { (name, field) -> field.set(LocalJson, priorLocal[name]) }
            directory.deleteRecursively()
        }
    }

    @Test fun moneyAndStockSavedBeforeOutboxFailureReplayOnceForOriginalAccount() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-money-stock-outbox-gap-").toFile()
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val disk = SyncPersistence(app)
        val store = CuciinStore
        val before = store.cloudSnapshot()
        val priorSession = store.session.value
        val sf = listOf("app", "ready", "storageError", "verifiedAccess", "accessPersistence", "localUpdatedAt").associateWith { store.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorStore = sf.mapValues { it.value.get(store) }
        val cf = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "hadPersistedLocalData", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason", "lastStatus", "online").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorCloud = cf.mapValues { it.value.get(CloudSync) }
        val lf = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorLocal = lf.mapValues { it.value.get(LocalJson) }
        val business = store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }
        val account = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
        val saved = Snapshot(staff = listOf(account), branches = listOf(Branch("b1", "B1", "Cabang", "", "")), accessRoles = AccessCatalog.builtInRoles(),
            notas = listOf(Nota("N1", "b1", "Uji", "Pelanggan", "", "Cuci", 10000, 0, PayStatus.Belum, LaundryStatus.Masuk, "", 1, "", false)),
            products = listOf(Product("Sabun", 0, 0, "p1")), branchStocks = listOf(BranchStock("b1", "p1", 5)), sessionEmail = account.email, updatedAt = Clock.nowMs())
        fun replay(expected: Set<String>, action: () -> Any?) {
            directory.listFiles()?.forEach { it.deleteRecursively() }
            LocalJson.init(app)
            LocalJson.save(saved)
            business.invoke(store, saved)
            sf.getValue("localUpdatedAt").setLong(store, saved.updatedAt)
            sf.getValue("storageError").set(store, null)
            sf.getValue("verifiedAccess").set(store, saved)
            sf.getValue("ready").setBoolean(store, true)
            store.session.value = Session(account.role, account.name, account.email, "b1", account.branchIds)
            val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(saved), bootstrapped = true, legacyActorChecked = true))
            disk.save(box.state)
            cf.getValue("outbox").set(CloudSync, box)
            cf.getValue("persistence").set(CloudSync, disk)
            cf.getValue("latestSnapshot").set(CloudSync, saved.copy(sessionEmail = null))
            val initial = box.state
            val blocked = java.io.File(directory, "cuciin-sync-state.json.tmp").apply { mkdir() }
            val result = runCatching(action)
            assertTrue("Gagal outbox tidak boleh melempar: ${result.exceptionOrNull()}", result.isSuccess)
            val durable = LocalJson.load()!!
            assertNotEquals("Business harus sudah durable", saved.copy(updatedAt = 0), durable.copy(updatedAt = 0))
            assertEquals(initial, disk.load())
            assertNotNull(store.storageError)
            assertNull(store.session.value)
            store.logout()
            assertEquals(durable, LocalJson.load())
            assertFalse(store.initializeStorage(app))
            assertEquals(initial, disk.load())
            blocked.delete()
            assertTrue(store.initializeStorage(app))
            val first = disk.load()
            val changed = first.pending.filter { it.entityType in expected }
            assertEquals("Tiap entitas uang/stok wajib kembali masuk antrean: ${first.pending}", expected, changed.map { it.entityType }.toSet())
            assertTrue(changed.all { it.actorEmail == account.email })
            assertFalse(first.pending.any { it.operation == "delete" })
            assertTrue(store.initializeStorage(app))
            assertEquals("Startup kedua tidak boleh menggandakan antrean", first.pending.map { it.commandId }, disk.load().pending.map { it.commandId })
            assertEquals(durable.payments, store.payments.toList())
            assertEquals(durable.branchStocks, store.branchStocks.toList())
        }
        try {
            replay(setOf("nota", "payment")) { store.markLunas("N1") }
            replay(setOf("branchStock", "stockMove")) { store.editStocks(mapOf("p1" to 2), setOf("b1"), StockKind.Tambah) }
        } finally {
            business.invoke(store, before)
            sf.forEach { (name, field) -> field.set(store, priorStore[name]) }
            store.session.value = priorSession
            cf.forEach { (name, field) -> field.set(CloudSync, priorCloud[name]) }
            lf.forEach { (name, field) -> field.set(LocalJson, priorLocal[name]) }
            directory.deleteRecursively()
        }
    }

    @Test fun nullableSaveFailuresShowStorageErrorBeforeFallbackMessage() {
        val ui = java.io.File("src/main/java/com/cuciin/laundryops/ui")
        listOf(
            "BusinessScreens.kt" to "toast(businessStore.storageError ?: \"Akses Catat biaya dicabut",
            "MasterScreens.kt" to "toast(store.storageError ?: \"Akses Kelola master data dicabut",
            "MoreScreens.kt" to "toast(store.storageError ?: \"Kas cabang ini sudah ditutup",
            "AssetScreens.kt" to "toast(assetStore.storageError ?: \"Akses Ubah aset dicabut",
            "OpsScreens.kt" to "else store.storageError ?: \"Bukti belum berhasil disimpan\"",
        ).forEach { (file, contract) -> assertTrue("$file wajib mendahulukan storageError", java.io.File(ui, file).readText().contains(contract)) }
    }

    @Test fun createdAccessRoleIsDurableImmediately() {
        val source = java.io.File("src/main/java/com/cuciin/laundryops/data/CuciinStore.kt").readText()
        val body = source.substringAfter("fun createAccessRole(").substringBefore("\n    }\n")
        assertTrue("Role baru wajib langsung disimpan, bukan menunggu perubahan lain", body.contains("bump()"))
        assertTrue(java.io.File("src/main/java/com/cuciin/laundryops/ui/AccessScreens.kt").readText()
            .contains("toast(accessStore.storageError ?: \"Hanya Owner yang dapat membuat role\")"))
    }

    @Test fun proofIsRecordedOnlyForSessionBranch() {
        val body = java.io.File("src/main/java/com/cuciin/laundryops/data/CuciinStore.kt").readText()
            .substringAfter("fun addLocalProof(").substringBefore("\n    }\n")
        val guard = body.indexOf("n.branchId !in s.allowedBranchIds")
        assertTrue("Bukti wajib memeriksa sesi dan cabang", body.contains("session.value ?: return null") && guard > 0)
        assertTrue("Cabang diperiksa sebelum foto disalin", guard < body.indexOf("FileExports.copyProof"))
    }

    @Test fun returningMutatorsMustCheckBusinessSaveResult() {
        val source = java.io.File("src/main/java/com/cuciin/laundryops/data/CuciinStore.kt").readText()
        val unchecked = source.split("\n    fun ").drop(1).filter { body ->
            val header = body.substringBefore("{")
            Regex("\\)\\s*:\\s*\\w+\\??\\s*$").containsMatchIn(header.trim()) && !header.contains(": Unit") &&
                Regex("(?m)^        bump\\(\\)$").containsMatchIn(body)
        }.map { it.substringBefore("(") }
        assertEquals("Mutator tidak boleh melaporkan sukses sebelum business tersimpan", emptyList<String>(), unchecked)
    }

    @Test fun failedBusinessWriteCannotReportCustomerCreatedOrChangeQueue() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-business-save-failure-").toFile()
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val disk = SyncPersistence(app)
        val store = CuciinStore
        val before = store.cloudSnapshot()
        val priorSession = store.session.value
        val priorSelected = store.selectedCustomer.value
        val sf = listOf("app", "ready", "storageError", "verifiedAccess", "accessPersistence", "localUpdatedAt").associateWith { store.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorStore = sf.mapValues { it.value.get(store) }
        val cf = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "hadPersistedLocalData", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason", "lastStatus", "online").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorCloud = cf.mapValues { it.value.get(CloudSync) }
        val lf = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorLocal = lf.mapValues { it.value.get(LocalJson) }
        val business = store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }
        try {
            val account = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
            val saved = Snapshot(staff = listOf(account), branches = listOf(Branch("b1", "B1", "Cabang", "", "")), accessRoles = AccessCatalog.builtInRoles(), sessionEmail = account.email, updatedAt = Clock.nowMs())
            LocalJson.init(app)
            LocalJson.save(saved)
            business.invoke(store, saved)
            sf.getValue("localUpdatedAt").setLong(store, saved.updatedAt)
            sf.getValue("storageError").set(store, null)
            sf.getValue("verifiedAccess").set(store, saved)
            sf.getValue("ready").setBoolean(store, true)
            store.session.value = Session(account.role, account.name, account.email, "b1", account.branchIds)
            val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(saved), bootstrapped = true, legacyActorChecked = true))
            disk.save(box.state)
            cf.getValue("outbox").set(CloudSync, box)
            cf.getValue("persistence").set(CloudSync, disk)
            cf.getValue("latestSnapshot").set(CloudSync, saved.copy(sessionEmail = null))
            val initialState = box.state
            val originalBusiness = java.io.File(directory, "cuciin-data.json").readText()
            val originalBackup = java.io.File(directory, "cuciin-data.backup.json").readText()
            val blocked = java.io.File(directory, "cuciin-data.json.tmp").apply { mkdir() }
            val created = runCatching { store.addCustomer("Baru", "123", "Alamat") }
            assertTrue("Gagal outbox tidak boleh melempar ke UI: ${created.exceptionOrNull()}", created.isSuccess)
            assertNull("Customer gagal disimpan tidak boleh dilaporkan berhasil", created.getOrNull())
            assertNull("Customer gagal tidak boleh menjadi pilihan transaksi", store.selectedCustomer.value)
            val durable = LocalJson.load()!!
            assertEquals(saved, durable)
            assertEquals(originalBusiness, java.io.File(directory, "cuciin-data.json").readText())
            assertEquals(originalBackup, java.io.File(directory, "cuciin-data.backup.json").readText())
            assertEquals(initialState, disk.load())
            assertEquals(initialState, box.state)
            assertNotNull("Gagal outbox harus menahan sesi dan mutasi", store.storageError)
            assertNull(store.session.value)
            assertFalse(sf.getValue("ready").getBoolean(store))
            assertNull(store.addCustomer("Jangan tambah", "", ""))
            assertFalse(store.finalizeAuthenticatedSession(Session(Role.Owner, "B", "b@example.test", "b1", listOf("b1")), saved))
            var remoteCompleted = false
            val heldBusiness = store.cloudSnapshot()
            assertTrue(runCatching { store.applyCloud(saved.copy(customers = emptyList(), updatedAt = durable.updatedAt + 1)) { remoteCompleted = true } }.isSuccess)
            assertFalse("Remote tidak boleh diakui saat delta lokal belum masuk antrean", remoteCompleted)
            assertEquals(heldBusiness, store.cloudSnapshot())
            assertEquals(durable, LocalJson.load())
            store.logout()
            assertEquals("Logout tidak boleh menghapus bukti asal delta", durable, LocalJson.load())
            assertFalse(store.initializeStorage(app))
            assertEquals(durable, LocalJson.load())
            assertEquals(initialState, disk.load())
            blocked.delete()
            assertTrue(store.initializeStorage(app))
            assertNull(store.storageError)
            assertEquals(durable.customers, LocalJson.load()!!.customers)
            val restarted = disk.load()
            assertFalse("Retry tidak boleh membuat command untuk customer gagal", restarted.pending.any { it.entityType == "customer" })
            assertEquals(saved.customers, store.customers.toList())
            assertFalse(restarted.pending.any { it.operation == "delete" })
            assertEquals(restarted, (cf.getValue("outbox").get(CloudSync) as SyncOutbox).state)
        } finally {
            business.invoke(store, before)
            sf.forEach { (name, field) -> field.set(store, priorStore[name]) }
            store.session.value = priorSession
            store.selectedCustomer.value = priorSelected
            cf.forEach { (name, field) -> field.set(CloudSync, priorCloud[name]) }
            lf.forEach { (name, field) -> field.set(LocalJson, priorLocal[name]) }
            directory.deleteRecursively()
        }
    }

    @Test fun failedMoneyOrStockWriteReportsStorageNotSuccessOrRevokedAccess() {
        val ui = java.io.File("src/main/java/com/cuciin/laundryops/ui/OpsScreens.kt").readText()
        val stockSave = ui.substringAfter("val saved = store.editStocks(validChanges").substringBefore("nav.navigate(\"stokHistory\")")
        assertTrue("Gagal simpan stok tidak boleh tampil sebagai akses dicabut", stockSave.contains("store.storageError"))
        val directory = java.nio.file.Files.createTempDirectory("cuciin-money-stock-failure-").toFile()
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val disk = SyncPersistence(app)
        val store = CuciinStore
        val before = store.cloudSnapshot()
        val priorSession = store.session.value
        val sf = listOf("app", "ready", "storageError", "verifiedAccess", "accessPersistence", "localUpdatedAt").associateWith { store.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorStore = sf.mapValues { it.value.get(store) }
        val cf = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "hadPersistedLocalData", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason", "lastStatus", "online").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorCloud = cf.mapValues { it.value.get(CloudSync) }
        val lf = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorLocal = lf.mapValues { it.value.get(LocalJson) }
        val business = store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }
        val account = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
        val nota = Nota("N1", "b1", "Uji", "Pelanggan", "", "Cuci", 10000, 0, PayStatus.Belum, LaundryStatus.Masuk, "", 1, "", false)
        val saved = Snapshot(staff = listOf(account), branches = listOf(Branch("b1", "B1", "Cabang", "", "")), accessRoles = AccessCatalog.builtInRoles(),
            notas = listOf(nota), products = listOf(Product("Sabun", 0, 0, "p1")), branchStocks = listOf(BranchStock("b1", "p1", 5)),
            sessionEmail = account.email, updatedAt = Clock.nowMs())
        fun failsWithoutChangingDisk(action: () -> Any?) {
            directory.listFiles()?.forEach { it.deleteRecursively() }
            LocalJson.init(app)
            LocalJson.save(saved)
            business.invoke(store, saved)
            sf.getValue("localUpdatedAt").setLong(store, saved.updatedAt)
            sf.getValue("storageError").set(store, null)
            sf.getValue("verifiedAccess").set(store, saved)
            sf.getValue("ready").setBoolean(store, true)
            store.session.value = Session(account.role, account.name, account.email, "b1", account.branchIds)
            val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(saved), bootstrapped = true, legacyActorChecked = true))
            disk.save(box.state)
            cf.getValue("outbox").set(CloudSync, box)
            cf.getValue("persistence").set(CloudSync, disk)
            cf.getValue("latestSnapshot").set(CloudSync, saved.copy(sessionEmail = null))
            val state = box.state
            val primary = java.io.File(directory, "cuciin-data.json").readText()
            val backup = java.io.File(directory, "cuciin-data.backup.json").readText()
            val blocked = java.io.File(directory, "cuciin-data.json.tmp").apply { mkdir() }
            val result = runCatching(action)
            assertTrue("Gagal simpan tidak boleh melempar: ${result.exceptionOrNull()}", result.isSuccess)
            assertNotNull(store.storageError)
            assertNull(store.session.value)
            assertEquals(primary, java.io.File(directory, "cuciin-data.json").readText())
            assertEquals(backup, java.io.File(directory, "cuciin-data.backup.json").readText())
            assertEquals(state, disk.load())
            assertEquals(saved, LocalJson.load())
            blocked.delete()
            assertTrue("Startup retry harus memuat snapshot durable", store.initializeStorage(app))
            assertEquals(saved.notas.single().paid, store.notas.single().paid)
            assertTrue(store.payments.isEmpty())
            assertEquals(5, store.branchStocks.single().stock)
            assertTrue(store.stockMoves.isEmpty())
            assertFalse("Retry tidak boleh membuat command perubahan gagal", disk.load().pending.any { it.entityType in setOf("payment", "stockMove", "order") })
            assertResult(result.getOrNull())
        }
        try {
            business.invoke(store, saved)
            store.branchStocks.single().stock = 99
            store.notas.single().paid = 99
            assertEquals("Memori tidak boleh berbagi objek mutable dengan snapshot sumber", 5, saved.branchStocks.single().stock)
            assertEquals(0, saved.notas.single().paid)
            failsWithoutChangingDisk { store.markLunas("N1") }
            failsWithoutChangingDisk { store.editStocks(mapOf("p1" to 2), setOf("b1"), StockKind.Tambah) }
            failsWithoutChangingDisk { store.editStock("p1", "b1", StockKind.Kurang, 1) }
        } finally {
            business.invoke(store, before)
            sf.forEach { (name, field) -> field.set(store, priorStore[name]) }
            store.session.value = priorSession
            cf.forEach { (name, field) -> field.set(CloudSync, priorCloud[name]) }
            lf.forEach { (name, field) -> field.set(LocalJson, priorLocal[name]) }
            directory.deleteRecursively()
        }
    }

    private fun assertResult(result: Any?) {
        when (result) {
            is String -> assertTrue("Pesan harus menyebut penyimpanan: $result", result.contains("tersimpan"))
            is Int -> assertTrue("Stok gagal simpan tidak boleh dilaporkan berhasil: $result", result < 0)
            else -> fail("Hasil gagal tidak dikenali: $result")
        }
    }

    @Test fun removingAssetPhotoInEditorCannotDeleteDurableFile() {
        val source = java.io.File("src/main/java/com/cuciin/laundryops/ui/AssetScreens.kt").readText()
        assertFalse("Draft foto belum disimpan tidak boleh menghapus berkas backup", source.contains("AssetPhotos.delete("))
    }

    @Test fun deletingAssetCannotErasePhotoReferencedByDurableDataOrBackup() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-asset-photo-failure-").toFile()
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val disk = SyncPersistence(app)
        val store = CuciinStore
        val before = store.cloudSnapshot()
        val priorSession = store.session.value
        val priorSelected = store.selectedCustomer.value
        val sf = listOf("app", "ready", "storageError", "verifiedAccess", "accessPersistence", "localUpdatedAt").associateWith { store.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorStore = sf.mapValues { it.value.get(store) }
        val cf = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "hadPersistedLocalData", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason", "lastStatus", "online").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorCloud = cf.mapValues { it.value.get(CloudSync) }
        val lf = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorLocal = lf.mapValues { it.value.get(LocalJson) }
        val business = store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }
        try {
            val account = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
            val photo = java.io.File(directory, "assets/photo.jpg").apply { parentFile.mkdirs(); writeBytes(byteArrayOf(1, 4, 9, 16)) }
            val photoBytes = photo.readBytes()
            val asset = InventoryItem("asset-1", "b1", "Mesin", InventoryCategory.MesinCuci, photoPath = photo.absolutePath)
            val saved = Snapshot(inventory = listOf(asset),staff = listOf(account), branches = listOf(Branch("b1", "B1", "Cabang", "", "")), accessRoles = AccessCatalog.builtInRoles(), sessionEmail = account.email, updatedAt = Clock.nowMs())
            LocalJson.init(app)
            LocalJson.save(saved)
            business.invoke(store, saved)
            sf.getValue("localUpdatedAt").setLong(store, saved.updatedAt)
            sf.getValue("storageError").set(store, null)
            sf.getValue("verifiedAccess").set(store, saved)
            sf.getValue("ready").setBoolean(store, true)
            store.session.value = Session(account.role, account.name, account.email, "b1", account.branchIds)
            val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(saved), bootstrapped = true, legacyActorChecked = true))
            disk.save(box.state)
            cf.getValue("outbox").set(CloudSync, box)
            cf.getValue("persistence").set(CloudSync, disk)
            cf.getValue("latestSnapshot").set(CloudSync, saved.copy(sessionEmail = null))
            val initialState = box.state
            val originalBusiness = java.io.File(directory, "cuciin-data.json").readText()
            val originalBackup = java.io.File(directory, "cuciin-data.backup.json").readText()
            val blocked = java.io.File(directory, "cuciin-data.json.tmp").apply { mkdir() }
            val deleted = runCatching { store.deleteInventory(asset.id) }
            assertTrue("Gagal simpan tidak boleh melempar ke UI: ${deleted.exceptionOrNull()}", deleted.isSuccess)
            assertNotNull("Penghapusan gagal harus melaporkan error", deleted.getOrNull())
            assertArrayEquals("Foto data tersimpan tidak boleh dihapus sebelum simpan berhasil", photoBytes, photo.readBytes())
            val durable = LocalJson.load()!!
            assertEquals(saved, durable)
            assertEquals(originalBusiness, java.io.File(directory, "cuciin-data.json").readText())
            assertEquals(originalBackup, java.io.File(directory, "cuciin-data.backup.json").readText())
            assertEquals(initialState, disk.load())
            assertEquals(initialState, box.state)
            assertNotNull("Gagal outbox harus menahan sesi dan mutasi", store.storageError)
            assertNull(store.session.value)
            assertFalse(sf.getValue("ready").getBoolean(store))
            assertNull(store.addCustomer("Jangan tambah", "", ""))
            assertFalse(store.finalizeAuthenticatedSession(Session(Role.Owner, "B", "b@example.test", "b1", listOf("b1")), saved))
            var remoteCompleted = false
            val heldBusiness = store.cloudSnapshot()
            assertTrue(runCatching { store.applyCloud(saved.copy(customers = emptyList(), updatedAt = durable.updatedAt + 1)) { remoteCompleted = true } }.isSuccess)
            assertFalse("Remote tidak boleh diakui saat delta lokal belum masuk antrean", remoteCompleted)
            assertEquals(heldBusiness, store.cloudSnapshot())
            assertEquals(durable, LocalJson.load())
            store.logout()
            assertEquals("Logout tidak boleh menghapus bukti asal delta", durable, LocalJson.load())
            assertFalse(store.initializeStorage(app))
            assertEquals(durable, LocalJson.load())
            assertEquals(initialState, disk.load())
            blocked.delete()
            assertTrue(store.initializeStorage(app))
            assertNull(store.storageError)
            assertEquals(durable.customers, LocalJson.load()!!.customers)
            val restarted = disk.load()
            assertFalse("Retry tidak boleh membuat command untuk customer gagal", restarted.pending.any { it.entityType == "customer" })
            assertEquals(saved.inventory, LocalJson.load()!!.inventory)
            assertEquals(restarted, (cf.getValue("outbox").get(CloudSync) as SyncOutbox).state)
            sf.getValue("verifiedAccess").set(store, saved)
            store.session.value = Session(account.role, account.name, account.email, "b1", account.branchIds)
            assertNull(store.deleteInventory(asset.id))
            assertTrue(LocalJson.load()!!.inventory.isEmpty())
            val fallback = LocalJson.json.decodeFromString<Snapshot>(java.io.File(directory, "cuciin-data.backup.json").readText())
            assertEquals(photo.absolutePath, fallback.inventory.single().photoPath)
            assertArrayEquals("Backup masih merujuk foto meski delete primary sukses", photoBytes, photo.readBytes())
            java.io.File(directory, "cuciin-data.json").writeText("{broken")
            assertEquals("Fallback backup harus memulihkan aset beserta referensi foto", fallback, LocalJson.load())
            assertArrayEquals(photoBytes, java.io.File(LocalJson.load()!!.inventory.single().photoPath).readBytes())
            assertFalse(restarted.pending.any { it.operation == "delete" })
        } finally {
            business.invoke(store, before)
            sf.forEach { (name, field) -> field.set(store, priorStore[name]) }
            store.session.value = priorSession
            store.selectedCustomer.value = priorSelected
            cf.forEach { (name, field) -> field.set(CloudSync, priorCloud[name]) }
            lf.forEach { (name, field) -> field.set(LocalJson, priorLocal[name]) }
            directory.deleteRecursively()
        }
    }

    @Test fun localEnqueueSaveFailureKeepsDurableStateUntilRetry() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-local-enqueue-").toFile()
        val disk = SyncPersistence(object : android.app.Application() { override fun getFilesDir() = directory })
        val fields = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val prior = fields.mapValues { it.value.get(CloudSync) }
        val priorSession = CuciinStore.session.value
        val original = Snapshot(customers = listOf(Customer("c1", "Awal", "", "")), updatedAt = 1)
        val changed = original.copy(customers = listOf(Customer("c1", "Edit", "", "")), updatedAt = 2)
        val rejected = RejectedSyncCommand(SyncCommand("evidence", "customer", "c0", "upsert", occurredAt = 1, actorEmail = "a@example.test"), "denied", 1)
        try {
            val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(original), bootstrapped = true, rejected = listOf(rejected)))
            disk.save(box.state)
            fields.getValue("outbox").set(CloudSync, box)
            fields.getValue("persistence").set(CloudSync, disk)
            fields.getValue("latestSnapshot").set(CloudSync, original)
            fields.getValue("pendingCount").setInt(CloudSync, 0)
            fields.getValue("rejectedCount").setInt(CloudSync, 1)
            fields.getValue("rejectedNeedsRecovery").setBoolean(CloudSync, true)
            fields.getValue("lastRejectedReason").set(CloudSync, "denied")
            CuciinStore.session.value = Session(Role.Owner, "Uji", "a@example.test", "b1", listOf("b1"))
            val before = box.state
            val blocked = java.io.File(directory, "cuciin-sync-state.json.tmp").apply { mkdir() }
            repeat(2) {
                assertTrue(runCatching { CloudSync.recordLocalSnapshot(changed) }.isFailure)
                assertEquals("Enqueue gagal tidak boleh memajukan shadow/pending", before, box.state)
                assertEquals(before, disk.load())
                assertEquals(original, fields.getValue("latestSnapshot").get(CloudSync))
                assertEquals(0, fields.getValue("pendingCount").getInt(CloudSync))
                assertEquals(1, fields.getValue("rejectedCount").getInt(CloudSync))
                assertTrue(fields.getValue("rejectedNeedsRecovery").getBoolean(CloudSync))
                assertEquals("denied", fields.getValue("lastRejectedReason").get(CloudSync))
            }
            blocked.delete()
            assertTrue(CloudSync.recordLocalSnapshot(changed))
            assertEquals(changed, fields.getValue("latestSnapshot").get(CloudSync))
            assertEquals(1, fields.getValue("pendingCount").getInt(CloudSync))
            assertEquals(1, box.state.generation)
            assertEquals("a@example.test", box.state.pending.single().actorEmail)
            assertEquals(SyncProjection.entities(changed), box.state.shadow)
            assertEquals(listOf(rejected), box.state.rejected)
            val durable = disk.load()
            assertEquals(box.state, durable)
            assertTrue(CloudSync.recordLocalSnapshot(changed))
            assertEquals(durable, box.state)
            assertEquals(durable, disk.load())
            CuciinStore.session.value = priorSession?.copy(email = "b@example.test") ?: Session(Role.Owner, "B", "b@example.test", "b1", listOf("b1"))
            assertFalse(CloudSync.recordLocalSnapshot(changed.copy(updatedAt = 3)))
            assertEquals(durable, box.state)
            assertEquals(durable, disk.load())
            assertEquals(changed, fields.getValue("latestSnapshot").get(CloudSync))
        } finally {
            CuciinStore.session.value = priorSession
            fields.forEach { (name, field) -> field.set(CloudSync, prior[name]) }
            directory.deleteRecursively()
        }
    }

    @Test fun cursorAheadOfServerRequiresFullSnapshotBeforeAcknowledgingCursor() {
        val source = java.io.File("src/main/java/com/cuciin/laundryops/data/CloudSync.kt").readText()
        val pull = source.substringAfter("private fun pullChanges():").substringBefore("private fun refreshAuthorization")
        assertTrue("Cursor turun wajib memulihkan snapshot penuh, bukan hanya mengakui cursor baru",
            pull.contains("if (next < after) return recoverRejectedSnapshot()"))
        val field = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val priorBox = field.get(CloudSync)
        val priorSession = CuciinStore.session.value
        val a = Nota("A", "b1", "Kasir A", "Uji", "", "Cuci", 7000, 0,
            PayStatus.Belum, LaundryStatus.Masuk, "", 1, "", false)
        val local = Snapshot(notas = listOf(a), updatedAt = 10)
        val remote = local.copy(notas = listOf(a, a.copy(id = "B", branchId = "b2", kasir = "Kasir B")), updatedAt = 11)
        try {
            CuciinStore.session.value = Session(Role.Owner, "Owner", "owner@example.test", "b1", listOf("b1", "b2"))
            val box = SyncOutbox(SyncClientState(revision = 99, shadow = SyncProjection.entities(local), bootstrapped = true, scopeKey = "owner"))
            field.set(CloudSync, box)
            assertTrue(CloudSync.prepareRejectedRecovery(remote, 2, "owner"))
            assertEquals(99L, box.state.revision)
            assertEquals(remote.notas, box.state.pendingRemote!!.snapshot.notas)
            assertTrue(box.completePreparedRemote {})
            assertEquals(2L, box.state.revision)
            assertEquals(setOf("A", "B"), box.state.shadow.filter { it.entityType == "nota" }.map { it.entityId }.toSet())
        } finally {
            field.set(CloudSync, priorBox)
            CuciinStore.session.value = priorSession
        }
    }

    @Test fun scopeResetSaveFailurePreservesCursorShadowAndRecoveryEvidence() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-scope-save-").toFile()
        val disk = SyncPersistence(object : android.app.Application() { override fun getFilesDir() = directory })
        val fields = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "hadPersistedLocalData", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val prior = fields.mapValues { it.value.get(CloudSync) }
        val snapshot = Snapshot(customers = listOf(Customer("c1", "Tetap", "", "")), updatedAt = 10)
        val command = SyncCommand("keep", "customer", "c1", "upsert", occurredAt = 1, actorEmail = "a@example.test")
        val rejected = RejectedSyncCommand(command, "denied", 2)
        try {
            for (mode in listOf("clear", "pending", "prepared")) {
                val box = SyncOutbox(SyncClientState(revision = 42, generation = 7, shadow = SyncProjection.entities(snapshot),
                    pending = if (mode == "pending") listOf(command) else emptyList(), rejected = listOf(rejected),
                    pendingRemote = if (mode == "prepared") PendingRemoteApply(snapshot, SyncProjection.entities(snapshot), 43, "old", 7, actorEmail = command.actorEmail) else null,
                    bootstrapped = true, scopeKey = "old", legacyActorChecked = true))
                disk.save(box.state)
                fields.getValue("outbox").set(CloudSync, box)
                fields.getValue("persistence").set(CloudSync, disk)
                fields.getValue("latestSnapshot").set(CloudSync, snapshot)
                fields.getValue("hadPersistedLocalData").setBoolean(CloudSync, true)
                fields.getValue("pendingCount").setInt(CloudSync, box.state.pending.size)
                fields.getValue("rejectedCount").setInt(CloudSync, 1)
                fields.getValue("rejectedNeedsRecovery").setBoolean(CloudSync, true)
                fields.getValue("lastRejectedReason").set(CloudSync, "denied")
                val before = box.state
                val stamp = CloudSync.captureSession()
                val blocked = java.io.File(directory, "cuciin-sync-state.json.tmp").apply { mkdir() }
                repeat(2) {
                    val attempt = runCatching { CloudSync.resetScopeResponse(stamp, "new") }
                    if (mode == "clear") assertTrue(attempt.isFailure) else assertEquals(false, attempt.getOrThrow())
                    assertEquals("Scope $mode harus menunggu disk", before, box.state)
                    assertEquals(before, disk.load())
                    assertEquals(snapshot, fields.getValue("latestSnapshot").get(CloudSync))
                    assertTrue(fields.getValue("hadPersistedLocalData").getBoolean(CloudSync))
                    assertEquals(before.pending.size, fields.getValue("pendingCount").getInt(CloudSync))
                    assertEquals(1, fields.getValue("rejectedCount").getInt(CloudSync))
                    assertTrue(fields.getValue("rejectedNeedsRecovery").getBoolean(CloudSync))
                    assertEquals("denied", fields.getValue("lastRejectedReason").get(CloudSync))
                }
                blocked.delete()
                CloudSync.invalidateSession()
                assertFalse(CloudSync.resetScopeResponse(stamp, "new"))
                assertEquals(before, box.state)
                val changed = CloudSync.resetScopeResponse(CloudSync.captureSession(), "new")
                assertEquals(mode == "clear", changed)
                if (changed) {
                    assertEquals(before.copy(revision = 0, shadow = emptyList(), bootstrapped = false, scopeKey = "new"), box.state)
                    assertFalse(fields.getValue("hadPersistedLocalData").getBoolean(CloudSync))
                } else assertEquals(before, box.state)
                assertEquals(box.state, disk.load())
            }
        } finally {
            fields.forEach { (name, field) -> field.set(CloudSync, prior[name]) }
            directory.deleteRecursively()
        }
    }

    @Test fun failedFileReplacementKeepsBackupAndPreparedTempForRetry() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-failed-replacement-").toFile()
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val local = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val prior = local.mapValues { it.value.get(LocalJson) }
        val owner = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
        val snapshot = Snapshot(staff = listOf(owner), branches = listOf(Branch("b1", "B1", "Cabang", "", "")), updatedAt = 10)
        val state = SyncClientState(pending = listOf(SyncCommand("keep", "customer", "c1", "upsert", occurredAt = 1, actorEmail = owner.email)))
        try {
            for (kind in listOf("business", "sync")) {
                val name = if (kind == "business") "cuciin-data" else "cuciin-sync-state"
                val primary = java.io.File(directory, "$name.json").apply { mkdir() }
                val obstacle = java.io.File(primary, "do-not-overwrite").apply { writeText("evidence") }
                val backup = java.io.File(directory, "$name.backup.json")
                val text = if (kind == "business") LocalJson.json.encodeToString(Snapshot.serializer(), snapshot)
                    else LocalJson.json.encodeToString(SyncClientState.serializer(), state)
                backup.writeText(text)
                val disk = SyncPersistence(app)
                local.getValue("file").set(LocalJson, primary)
                local.getValue("backup").set(LocalJson, backup)
                local.getValue("latestSavedAt").setLong(LocalJson, Long.MIN_VALUE)
                val failure = runCatching {
                    if (kind == "business") LocalJson.save(snapshot.copy(updatedAt = 11))
                    else disk.save(state.copy(legacyActorChecked = true))
                }.exceptionOrNull()
                assertTrue("$kind harus mengembalikan kegagalan I/O asli, bukan mencoba direct write: $failure", failure is java.io.IOException)
                assertEquals(text, backup.readText())
                assertEquals("evidence", obstacle.readText())
                val temp = java.io.File(directory, "$name.json.tmp")
                assertTrue("Calon data tetap ada saat replacement gagal $kind", temp.isFile)
                if (kind == "business") {
                    assertEquals(snapshot, LocalJson.load())
                    assertEquals(snapshot.copy(updatedAt = 11), LocalJson.json.decodeFromString(Snapshot.serializer(), temp.readText()))
                } else {
                    assertEquals(state, disk.load())
                    assertEquals(state.copy(legacyActorChecked = true), LocalJson.json.decodeFromString(SyncClientState.serializer(), temp.readText()))
                }
                obstacle.delete()
                primary.delete()
                if (kind == "business") {
                    LocalJson.save(snapshot.copy(updatedAt = 11))
                    assertEquals(snapshot.copy(updatedAt = 11), LocalJson.load())
                } else {
                    disk.save(state.copy(legacyActorChecked = true))
                    assertEquals(state.copy(legacyActorChecked = true), disk.load())
                }
                assertFalse(temp.exists())
                assertEquals(text, backup.readText())
            }
        } finally {
            local.forEach { (name, field) -> field.set(LocalJson, prior[name]) }
            directory.deleteRecursively()
        }
    }

    @Test fun startupQueueSaveFailureKeepsMemoryAtDurableState() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-startup-queue-").toFile()
        val disk = SyncPersistence(object : android.app.Application() { override fun getFilesDir() = directory })
        val fields = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "hadPersistedLocalData", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val prior = fields.mapValues { it.value.get(CloudSync) }
        val old = Snapshot(customers = listOf(Customer("c1", "Awal", "", "")), updatedAt = 1)
        val saved = old.copy(customers = listOf(Customer("c1", "Edit", "", "")), sessionEmail = "a@example.test", updatedAt = 2)
        val command = SyncCommand("legacy-keep", "customer", "c1", "upsert", occurredAt = 1)
        try {
            for (mode in listOf("migrate", "restore", "first")) {
                val box = SyncOutbox(SyncClientState(shadow = if (mode == "first") emptyList() else SyncProjection.entities(old),
                    pending = if (mode == "migrate") listOf(command) else emptyList(), bootstrapped = mode != "first"))
                disk.save(box.state)
                fields.getValue("outbox").set(CloudSync, box)
                fields.getValue("persistence").set(CloudSync, disk)
                fields.getValue("latestSnapshot").set(CloudSync, old)
                fields.getValue("hadPersistedLocalData").setBoolean(CloudSync, false)
                val before = box.state
                val blocked = java.io.File(directory, "cuciin-sync-state.json.tmp").apply { mkdir() }
                repeat(2) {
                    val failed = runCatching {
                        if (mode == "migrate") CloudSync.migrateLocalActor(saved.sessionEmail)
                        else CloudSync.initializeLocalState(saved.copy(sessionEmail = null), true, saved)
                    }
                    assertTrue("Disk wajib gagal $mode", failed.isFailure)
                    assertEquals("Startup $mode tidak boleh mendahului disk", before, box.state)
                    assertEquals(before, disk.load())
                    assertEquals(old, fields.getValue("latestSnapshot").get(CloudSync))
                    assertFalse(fields.getValue("hadPersistedLocalData").getBoolean(CloudSync))
                }
                blocked.delete()
                if (mode == "migrate") {
                    CloudSync.migrateLocalActor(saved.sessionEmail)
                    assertEquals(listOf(command.copy(actorEmail = "a@example.test")), box.state.pending)
                    assertTrue(box.state.legacyActorChecked)
                } else {
                    assertNull(CloudSync.initializeLocalState(saved.copy(sessionEmail = null), true, saved))
                    assertEquals(saved.copy(sessionEmail = null), fields.getValue("latestSnapshot").get(CloudSync))
                    assertTrue(fields.getValue("hadPersistedLocalData").getBoolean(CloudSync))
                    if (mode == "restore") assertEquals("a@example.test", box.state.pending.single().actorEmail)
                    else assertTrue(box.state.pending.isEmpty())
                }
                assertEquals(box.state, disk.load())
                val durable = box.state
                if (mode == "migrate") CloudSync.migrateLocalActor(saved.sessionEmail)
                else CloudSync.initializeLocalState(saved.copy(sessionEmail = null), true, saved)
                assertEquals("Retry sah tidak boleh membentuk command baru $mode", durable, box.state)
            }
        } finally {
            fields.forEach { (name, field) -> field.set(CloudSync, prior[name]) }
            directory.deleteRecursively()
        }
    }

    @Test fun endpointMarkerMismatchCannotEraseBusinessQueueOrPhotos() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-endpoint-marker-").toFile()
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val store = CuciinStore
        val before = store.cloudSnapshot()
        val oldSession = store.session.value
        val fields = listOf("app", "ready", "storageError", "verifiedAccess", "accessPersistence", "localUpdatedAt").associateWith { store.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val old = fields.mapValues { it.value.get(store) }
        val cloud = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "hadPersistedLocalData", "lastStatus", "online", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val oldCloud = cloud.mapValues { it.value.get(CloudSync) }
        val local = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val oldLocal = local.mapValues { it.value.get(LocalJson) }
        val current = com.cuciin.laundryops.BuildConfig.CUCIIN_CLOUD_URL.trim()
        val owner = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
        val saved = Snapshot(staff = listOf(owner), branches = listOf(Branch("b1", "B1", "Cabang", "", "")),
            customers = listOf(Customer("keep", "Tetap", "", "")), accessRoles = AccessCatalog.builtInRoles(), updatedAt = Clock.nowMs())
        val pending = SyncCommand("keep-command", "customer", "keep", "upsert", "b1", 1, actorEmail = owner.email)
        val state = SyncClientState(pending = listOf(pending), rejected = listOf(RejectedSyncCommand(pending.copy(commandId = "denied"), "denied", 2)),
            pendingRemote = PendingRemoteApply(saved, SyncProjection.entities(saved), 7, "owner", actorEmail = owner.email), legacyActorChecked = true)
        val disk = SyncPersistence(app)
        try {
            for (mode in listOf("changed", "missing", "blank", "directory")) {
                directory.listFiles()!!.forEach { it.deleteRecursively() }
                java.io.File(directory, "cuciin-data.json").writeText(LocalJson.json.encodeToString(Snapshot.serializer(), saved))
                disk.save(state)
                java.io.File(directory, "attendance/photo.jpg").apply { parentFile.mkdirs(); writeText("attendance-example") }
                java.io.File(directory, "proofs/photo.jpg").apply { parentFile.mkdirs(); writeText("proof-example") }
                val marker = java.io.File(directory, "cuciin-cloud-environment.txt")
                when (mode) {
                    "changed" -> marker.writeText("https://previous.example.test")
                    "blank" -> marker.writeText("")
                    "directory" -> marker.mkdir()
                }
                val originals = directory.walkTopDown().filter { it.isFile }.associate { it.relativeTo(directory).path to it.readBytes().toList() }
                cloud.getValue("persistence").set(CloudSync, null)
                fields.getValue("ready").setBoolean(store, false)
                repeat(2) {
                    assertFalse("Penanda $mode harus menahan startup", store.initializeStorage(app))
                    assertNull(store.session.value)
                    assertNotNull(store.storageError)
                    originals.forEach { (name, bytes) -> assertEquals("Bukti $name tetap pada $mode", bytes, java.io.File(directory, name).readBytes().toList()) }
                    if (mode == "missing") assertFalse(marker.exists())
                    if (mode == "directory") assertTrue(marker.isDirectory)
                    assertEquals(state, disk.load())
                }
            }
            directory.deleteRecursively()
            directory.mkdir()
            cloud.getValue("persistence").set(CloudSync, null)
            java.io.File(directory, "sdk-install-state").writeText("unrelated-example")
            assertTrue("Instalasi baru dengan berkas SDK tetap sah", store.initializeStorage(app))
            assertEquals(current, java.io.File(directory, "cuciin-cloud-environment.txt").readText())
            assertNotNull(LocalJson.load())
        } finally {
            fields.forEach { (name, field) -> field.set(store, old[name]) }
            cloud.forEach { (name, field) -> field.set(CloudSync, oldCloud[name]) }
            local.forEach { (name, field) -> field.set(LocalJson, oldLocal[name]) }
            store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }.invoke(store, before)
            store.session.value = oldSession
            directory.deleteRecursively()
        }
    }

    @Test fun acceptingSavedRemoteCannotAdvanceMemoryBeforeSyncSave() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-accept-remote-").toFile()
        val disk = SyncPersistence(object : android.app.Application() { override fun getFilesDir() = directory })
        val fields = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val prior = fields.mapValues { it.value.get(CloudSync) }
        val local = Snapshot(customers = listOf(Customer("c1", "Lokal", "", "")), updatedAt = 1)
        val remote = local.copy(customers = listOf(Customer("c1", "Server", "", "")), updatedAt = 2)
        try {
            for (prepared in listOf(false, true)) {
                val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(local), revision = 4))
                if (prepared) box.prepareBootstrapRemote(remote, SyncProjection.entities(remote), 7, "owner", "a@example.test")
                disk.save(box.state)
                fields.getValue("outbox").set(CloudSync, box)
                fields.getValue("persistence").set(CloudSync, disk)
                fields.getValue("latestSnapshot").set(CloudSync, local)
                val before = box.state
                val blocked = java.io.File(directory, "cuciin-sync-state.json.tmp").apply { mkdir() }
                assertTrue(runCatching { CloudSync.acceptRemoteSnapshot(remote) }.isFailure)
                assertEquals("Accept gagal harus menjaga seluruh state, prepared=$prepared", before, box.state)
                assertEquals(before, disk.load())
                assertEquals("latestSnapshot juga harus menunggu save", local, fields.getValue("latestSnapshot").get(CloudSync))
                blocked.delete()
                CloudSync.acceptRemoteSnapshot(remote)
                assertEquals(box.state, disk.load())
                assertEquals(remote, fields.getValue("latestSnapshot").get(CloudSync))
                assertNull(box.state.pendingRemote)
                assertEquals(SyncProjection.entities(remote), box.state.shadow)
            }
        } finally {
            fields.forEach { (name, field) -> field.set(CloudSync, prior[name]) }
            directory.deleteRecursively()
        }
    }

    @Test fun journalEmptyPullKeepsCursorAtDurableStateOnDiskFailure() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-no-journal-").toFile()
        val disk = SyncPersistence(object : android.app.Application() { override fun getFilesDir() = directory })
        val fields = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val prior = fields.mapValues { it.value.get(CloudSync) }
        try {
            val owner = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
            val local = Snapshot(staff = listOf(owner, Staff("Lama", "old@example.test", Role.Kasir, listOf("b1"))), updatedAt = 1)
            val remote = local.copy(staff = listOf(owner), updatedAt = 2)
            val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(local), revision = 4, bootstrapped = true, scopeKey = "owner"))
            disk.save(box.state)
            fields.getValue("outbox").set(CloudSync, box)
            fields.getValue("persistence").set(CloudSync, disk)
            fields.getValue("latestSnapshot").set(CloudSync, local)
            val before = box.state
            val blocked = java.io.File(directory, "cuciin-sync-state.json.tmp").apply { mkdir() }
            assertTrue(runCatching { CloudSync.preparePulledRemote(remote, 7, before.generation, "owner", owner.email) }.isFailure)
            assertEquals("Pull kosong tidak boleh memajukan cursor sebelum save", before, box.state)
            assertEquals(before, disk.load())
            assertEquals(local, fields.getValue("latestSnapshot").get(CloudSync))
            blocked.delete()
            assertTrue(CloudSync.preparePulledRemote(remote, 7, before.generation, "owner", owner.email))
            assertEquals(4L, box.state.revision)
            assertEquals(remote, disk.load().pendingRemote!!.snapshot)
            assertEquals(owner.email, disk.load().pendingRemote!!.actorEmail)
            assertEquals(box.state, disk.load())
            assertEquals(before.shadow, disk.load().shadow)
        } finally {
            fields.forEach { (name, field) -> field.set(CloudSync, prior[name]) }
            directory.deleteRecursively()
        }
    }

    @Test fun legacyPullCannotOverwriteNewLocalGeneration() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-legacy-pull-").toFile()
        val disk = SyncPersistence(object : android.app.Application() { override fun getFilesDir() = directory })
        val store = CuciinStore
        val priorSession = store.session.value
        val overlay = store.javaClass.getDeclaredField("verifiedAccess").apply { isAccessible = true }
        val priorAccess = overlay.get(store)
        val fields = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val prior = fields.mapValues { it.value.get(CloudSync) }
        try {
            val owner = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
            val original = Snapshot(staff = listOf(owner), customers = listOf(Customer("c1", "Awal", "", "")), updatedAt = 1)
            val remote = original.copy(customers = listOf(Customer("c1", "Server", "", "")), updatedAt = 100)
            val newer = original.copy(customers = listOf(Customer("c1", "Edit baru", "", "")), updatedAt = 2)
            store.authenticateSession(Session(Role.Owner, owner.name, owner.email, "b1", owner.branchIds), original)
            val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(original), revision = 7, bootstrapped = true, scopeKey = "owner"))
            fields.getValue("outbox").set(CloudSync, box)
            fields.getValue("persistence").set(CloudSync, disk)
            fields.getValue("latestSnapshot").set(CloudSync, original)
            val stamp = CloudSync.captureSession()
            val generation = box.state.generation
            val deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(30)
            box.enqueue(SyncProjection.entities(newer), 2, "b1", null, Role.Owner, owner.email)
            fields.getValue("latestSnapshot").set(CloudSync, newer)
            disk.save(box.state)
            val pending = box.state
            assertFalse(CloudSync.prepareLegacyPullResponse(stamp, remote, generation, deadline))
            assertEquals(newer, fields.getValue("latestSnapshot").get(CloudSync))
            assertEquals(pending, box.state)
            assertEquals(pending, disk.load())
            assertTrue(CloudSync.applyLegacyUploadResponse(stamp, newer, pending.generation, pending.pending.mapTo(hashSetOf()) { it.commandId }))
            val accepted = box.state
            assertFalse(CloudSync.prepareLegacyPullResponse(stamp, remote, accepted.generation, System.nanoTime() - 1))
            assertEquals(newer, fields.getValue("latestSnapshot").get(CloudSync))
            val blocked = java.io.File(directory, "cuciin-sync-state.json.tmp").apply { mkdir() }
            assertTrue(runCatching { CloudSync.prepareLegacyPullResponse(stamp, remote, accepted.generation, deadline) }.isFailure)
            assertEquals(accepted, box.state)
            assertEquals(accepted, disk.load())
            assertEquals(newer, fields.getValue("latestSnapshot").get(CloudSync))
            blocked.delete()
            assertTrue(CloudSync.prepareLegacyPullResponse(stamp, remote, accepted.generation, deadline))
            assertEquals(remote, disk.load().pendingRemote!!.snapshot)
            assertEquals(owner.email, disk.load().pendingRemote!!.actorEmail)
            assertEquals(box.state, disk.load())
        } finally {
            fields.forEach { (name, field) -> field.set(CloudSync, prior[name]) }
            overlay.set(store, priorAccess)
            store.session.value = priorSession
            directory.deleteRecursively()
        }
    }

    @Test fun lateLegacyUploadKeepsNewCommandsDurable() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-legacy-response-").toFile()
        val disk = SyncPersistence(object : android.app.Application() { override fun getFilesDir() = directory })
        val store = CuciinStore
        val priorSession = store.session.value
        val overlay = store.javaClass.getDeclaredField("verifiedAccess").apply { isAccessible = true }
        val priorAccess = overlay.get(store)
        val fields = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val prior = fields.mapValues { it.value.get(CloudSync) }
        val executor = java.util.concurrent.Executors.newSingleThreadExecutor()
        val reached = java.util.concurrent.CountDownLatch(1)
        val release = java.util.concurrent.CountDownLatch(1)
        try {
            val owner = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
            val initial = Snapshot(staff = listOf(owner), customers = listOf(Customer("c1", "Awal", "", "")), updatedAt = 1)
            val upload = initial.copy(customers = listOf(Customer("c1", "Kiriman", "", "")), updatedAt = 2)
            val newer = initial.copy(customers = listOf(Customer("c1", "Edit baru", "", "")), updatedAt = 3)
            store.authenticateSession(Session(Role.Owner, owner.name, owner.email, "b1", owner.branchIds), initial)
            val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(initial), bootstrapped = true, scopeKey = "owner"))
            val uploaded = box.enqueue(SyncProjection.entities(upload), 2, "b1", null, Role.Owner, owner.email).mapTo(hashSetOf()) { it.commandId }
            val generation = box.state.generation
            val stamp = CloudSync.captureSession()
            fields.getValue("outbox").set(CloudSync, box)
            fields.getValue("persistence").set(CloudSync, disk)
            fields.getValue("latestSnapshot").set(CloudSync, upload)
            disk.save(box.state)
            val result = executor.submit<Boolean> {
                reached.countDown()
                check(release.await(5, java.util.concurrent.TimeUnit.SECONDS))
                CloudSync.applyLegacyUploadResponse(stamp, upload, generation, uploaded)
            }
            assertTrue(reached.await(5, java.util.concurrent.TimeUnit.SECONDS))
            val newCommands = synchronized(CloudSync) {
                val created = box.enqueue(SyncProjection.entities(newer), 3, "b1", null, Role.Owner, owner.email)
                disk.save(box.state)
                fields.getValue("latestSnapshot").set(CloudSync, newer)
                created
            }
            release.countDown()
            assertFalse("Respons lama tidak boleh mengizinkan pull di atas edit baru", result.get(5, java.util.concurrent.TimeUnit.SECONDS))
            assertEquals(newCommands, disk.load().pending)
            assertEquals(SyncProjection.entities(newer), disk.load().shadow)
            assertEquals(box.state, disk.load())
            val before = box.state
            val blocked = java.io.File(directory, "cuciin-sync-state.json.tmp").apply { mkdir() }
            val ids = before.pending.mapTo(hashSetOf()) { it.commandId }
            assertTrue(runCatching { CloudSync.applyLegacyUploadResponse(stamp, newer, before.generation, ids) }.isFailure)
            assertEquals("ACK legacy gagal simpan tidak boleh makan antrean", before, box.state)
            assertEquals(before, disk.load())
            blocked.delete()
            assertTrue(CloudSync.applyLegacyUploadResponse(stamp, newer, before.generation, ids))
            assertTrue(disk.load().pending.isEmpty())
            assertEquals(SyncProjection.entities(newer), disk.load().shadow)
            store.authenticateSession(store.session.value!!, initial)
            assertFalse(CloudSync.applyLegacyUploadResponse(stamp, upload, generation, uploaded))
            assertEquals(box.state, disk.load())
        } finally {
            release.countDown()
            executor.shutdownNow()
            fields.forEach { (name, field) -> field.set(CloudSync, prior[name]) }
            overlay.set(store, priorAccess)
            store.session.value = priorSession
            directory.deleteRecursively()
        }
    }

    @Test fun startupRoleMigrationCannotReplaceUnappliedPreparedBusiness() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-prepared-upgrade-").toFile()
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val store = CuciinStore
        val before = store.cloudSnapshot()
        val oldSession = store.session.value
        val fields = listOf("app", "ready", "storageError", "verifiedAccess", "accessPersistence", "localUpdatedAt").associateWith { store.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val old = fields.mapValues { it.value.get(store) }
        val cloud = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "hadPersistedLocalData", "lastStatus", "online", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val oldCloud = cloud.mapValues { it.value.get(CloudSync) }
        val local = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val oldLocal = local.mapValues { it.value.get(LocalJson) }
        val firebase = FirebaseCloud.javaClass.getDeclaredField("enabled").apply { isAccessible = true }
        val oldFirebase = firebase.getBoolean(FirebaseCloud)
        val owner = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
        val saved = Snapshot(staff = listOf(owner), branches = listOf(Branch("b1", "B1", "Cabang", "", "")),
            customers = listOf(Customer("A", "Lama", "", "")), accessRoles = AccessCatalog.builtInRoles().map { it.copy(catalogVersion = 1) }, updatedAt = 100)
        val remote = saved.copy(customers = listOf(Customer("B", "Server", "", "")), updatedAt = 200)
        val denied = RejectedSyncCommand(SyncCommand("denied", "customer", "B", "upsert", occurredAt = 1, actorEmail = owner.email), "denied", 2)
        try {
            for (cloudEnabled in listOf(true, false)) {
                directory.listFiles()!!.forEach { it.delete() }
                java.io.File(directory, "cuciin-cloud-environment.txt").writeText(com.cuciin.laundryops.BuildConfig.CUCIIN_CLOUD_URL.trim())
                java.io.File(directory, "cuciin-data.json").writeText(LocalJson.json.encodeToString(Snapshot.serializer(), saved))
                val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(saved), rejected = listOf(denied)))
                assertTrue(box.reconcileRejectedRemote(remote, SyncProjection.entities(remote), 20, "owner", owner.email))
                val disk = SyncPersistence(app)
                disk.save(box.state)
                cloud.getValue("persistence").set(CloudSync, null)
                fields.getValue("ready").setBoolean(store, false)
                store.session.value = null
                firebase.setBoolean(FirebaseCloud, cloudEnabled)
                assertTrue(store.initializeStorage(app))
                if (cloudEnabled) {
                    assertEquals(saved.customers, LocalJson.load()!!.customers)
                    assertTrue("Migrasi memang menaikkan timestamp data lama", store.syncUpdatedAt() > remote.updatedAt)
                    assertNotNull(disk.load().pendingRemote)
                    firebase.setBoolean(FirebaseCloud, false)
                    store.authenticateSession(Session(Role.Owner, owner.name, owner.email, "b1", owner.branchIds), remote.copy(accessRoles = AccessCatalog.builtInRoles()))
                    assertTrue(CloudSync.applyPreparedRemote(CloudSync.captureSession(), System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(30)))
                }
                assertEquals("Migrasi role tidak boleh mengganti data server, cloud=$cloudEnabled", remote.customers, LocalJson.load()!!.customers)
                assertEquals(remote.customers, store.customers.toList())
                assertNull(disk.load().pendingRemote)
                assertTrue(disk.load().rejected.isEmpty())
                assertEquals(20L, disk.load().revision)
            }
        } finally {
            fields.forEach { (name, field) -> field.set(store, old[name]) }
            cloud.forEach { (name, field) -> field.set(CloudSync, oldCloud[name]) }
            local.forEach { (name, field) -> field.set(LocalJson, oldLocal[name]) }
            firebase.setBoolean(FirebaseCloud, oldFirebase)
            store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }.invoke(store, before)
            store.session.value = oldSession
            directory.deleteRecursively()
        }
    }

    @Test fun startupDiskFailureKeepsBusinessAndPendingForRetry() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-startup-disk-").toFile()
        val store = CuciinStore
        val before = store.cloudSnapshot()
        val oldSession = store.session.value
        val fields = listOf("app", "ready", "storageError", "verifiedAccess", "accessPersistence").associateWith { store.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val oldValues = fields.mapValues { it.value.get(store) }
        val cloud = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "hadPersistedLocalData", "lastStatus", "online").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val oldCloud = cloud.mapValues { it.value.get(CloudSync) }
        val local = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val oldLocal = local.mapValues { it.value.get(LocalJson) }
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val owner = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"), passwordHash = "trusted-test-fixture")
        val saved = Snapshot(staff = listOf(owner), branches = listOf(Branch("b1", "B1", "Cabang", "", "")), customers = listOf(Customer("c1", "Tetap", "", "")), updatedAt = Clock.nowMs())
        val pending = SyncCommand("legacy", "nota", "n1", "upsert", "b1", 1L)
        val disk = SyncPersistence(app)
        try {
            java.io.File(directory, "cuciin-cloud-environment.txt").writeText(com.cuciin.laundryops.BuildConfig.CUCIIN_CLOUD_URL.trim())
            java.io.File(directory, "cuciin-data.json").writeText(LocalJson.json.encodeToString(Snapshot.serializer(), saved))
            val state = SyncClientState(pending = listOf(pending), legacyActorChecked = true)
            disk.save(state)
            for (filename in listOf("cuciin-sync-state.json.tmp", "cuciin-data.json.tmp")) {
                fields.getValue("ready").setBoolean(store, false)
                cloud.getValue("persistence").set(CloudSync, null)
                val blocked = java.io.File(directory, filename).apply { mkdir() }
                val result = runCatching { store.attach(app) }
                assertTrue("Startup disk gagal tidak boleh keluar: ${result.exceptionOrNull()}", result.isSuccess)
                assertNull(store.session.value)
                assertEquals(saved.customers, store.customers.toList())
                assertEquals(listOf(pending), disk.load().pending)
                assertTrue(CloudSync.lastStatus.contains("penyimpanan"))
                assertFalse("Startup gagal tidak boleh membuka login lokal", store.login(owner.email, skipPassword = true))
                val attempt = Session(owner.role, owner.name, owner.email, "b1", owner.branchIds)
                assertFalse(store.finalizeAuthenticatedSession(attempt, saved))
                store.authenticateSession(attempt, saved)
                assertNull("Konstruksi sesi internal juga ditahan", store.session.value)
                assertEquals(store.storageError, CloudSync.accountSwitchError(owner.email))
                assertEquals(saved, LocalJson.json.decodeFromString(Snapshot.serializer(), java.io.File(directory, "cuciin-data.json").readText()))
                blocked.delete()
            }
            assertTrue("Retry harus berhasil saat disk kembali bisa ditulis", store.initializeStorage(app))
            assertNull(store.storageError)
            assertEquals(saved.customers, store.customers.toList())
            assertEquals(listOf(pending), disk.load().pending)
            val attached = java.io.File("src/main/java/com/cuciin/laundryops/data/CuciinStore.kt").readText().substringAfter("fun attach(").substringBefore("private fun applySeed(")
            assertTrue("Status ready hanya setelah persist berhasil", attached.indexOf("ready = true") > attached.indexOf("persist()"))
            val loginUi = java.io.File("src/main/java/com/cuciin/laundryops/ui/AuthScreens.kt").readText().substringAfter("fun LoginScreen(").substringBefore("fun RegisterScreen(")
            assertTrue("Pesan storage harus terlihat saat login", loginUi.contains("store.storageError ?: loginError"))
        } finally {
            fields.forEach { (name, field) -> field.set(store, oldValues[name]) }
            cloud.forEach { (name, field) -> field.set(CloudSync, oldCloud[name]) }
            local.forEach { (name, field) -> field.set(LocalJson, oldLocal[name]) }
            store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }.invoke(store, before)
            store.javaClass.getDeclaredField("localUpdatedAt").apply { isAccessible = true }.setLong(store, before.updatedAt)
            store.session.value = oldSession
            directory.deleteRecursively()
        }
    }

    @Test fun preparedRecoveryCannotCrossAccounts() {
        val store = CuciinStore
        val before = store.cloudSnapshot()
        val oldSession = store.session.value
        val fields = listOf("outbox", "latestSnapshot", "persistence").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val oldValues = fields.mapValues { it.value.get(CloudSync) }
        val overlay = store.javaClass.getDeclaredField("verifiedAccess").apply { isAccessible = true }
        val oldAccess = overlay.get(store)
        try {
            val a = Staff("A", "a@example.test", Role.Owner, listOf("b1"))
            val b = Staff("B", "b@example.test", Role.Owner, listOf("b2"))
            val remoteA = Snapshot(staff = listOf(a), customers = listOf(Customer("c-a", "Data A", "", "")), updatedAt = Clock.nowMs() + 1)
            val remoteB = before.copy(staff = listOf(b), customers = listOf(Customer("c-b", "Data B", "", "")), updatedAt = remoteA.updatedAt - 1)
            val box = SyncOutbox()
            store.authenticateSession(Session(a.role, a.name, a.email, "b1", a.branchIds), Snapshot(staff = listOf(a)))
            fields.getValue("outbox").set(CloudSync, box)
            fields.getValue("persistence").set(CloudSync, null)
            assertTrue(CloudSync.prepareRejectedRecovery(remoteA, 7, "owner"))
            val prepared = box.state
            store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }.invoke(store, remoteB)
            store.authenticateSession(Session(b.role, b.name, b.email, "b2", b.branchIds), Snapshot(staff = listOf(b)))
            fields.getValue("latestSnapshot").set(CloudSync, remoteA)
            val businessB = store.cloudSnapshot()
            val deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(30)
            val result = CloudSync.applyPreparedRemote(CloudSync.captureSession(), deadline)
            assertFalse("Prepared A tidak boleh diterapkan pada sesi B", result)
            assertEquals(prepared, box.state)
            assertEquals(businessB, store.cloudSnapshot())
            val encoded = LocalJson.json.encodeToString(SyncClientState.serializer(), prepared)
            val reloaded = SyncOutbox(LocalJson.json.decodeFromString(SyncClientState.serializer(), encoded))
            assertEquals(a.email, reloaded.state.pendingRemote?.actorEmail)
            fields.getValue("outbox").set(CloudSync, reloaded)
            store.authenticateSession(Session(a.role, a.name, a.email, "b1", a.branchIds), Snapshot(staff = listOf(a)))
            val current = CloudSync.captureSession()
            val legacyState = LocalJson.json.decodeFromString(SyncClientState.serializer(), encoded.replace("\"actorEmail\":\"${a.email}\"", "\"actorEmail\":\"\""))
            fields.getValue("outbox").set(CloudSync, SyncOutbox(legacyState))
            assertFalse("Asal kosong tidak boleh diadopsi akun baru", CloudSync.applyPreparedRemote(current, deadline))
            assertEquals(businessB.customers, store.customers.toList())
            val limited = a.copy(role = Role.Kasir, branchIds = listOf("b2"))
            store.authenticateSession(Session(limited.role, limited.name, limited.email, "b2", limited.branchIds), Snapshot(staff = listOf(limited)))
            fields.getValue("outbox").set(CloudSync, reloaded)
            assertFalse("Pencabutan role/cabang harus menahan snapshot lama", CloudSync.applyPreparedRemote(CloudSync.captureSession(), deadline))
            assertEquals(prepared, reloaded.state)
            store.authenticateSession(Session(a.role, a.name, a.email, "b1", a.branchIds), Snapshot(staff = listOf(a)))
            assertTrue("Akun asal dengan scope sama harus bisa retry", CloudSync.applyPreparedRemote(CloudSync.captureSession(), deadline))
            assertEquals(remoteA.customers, store.customers.toList())
            assertNull(reloaded.state.pendingRemote)
        } finally {
            fields.forEach { (name, field) -> field.set(CloudSync, oldValues[name]) }
            store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }.invoke(store, before)
            store.javaClass.getDeclaredField("localUpdatedAt").apply { isAccessible = true }.setLong(store, before.updatedAt)
            overlay.set(store, oldAccess)
            store.session.value = oldSession
        }
    }

    @Test fun reconciledBootstrapSurvivesBusinessSaveFailureAndRestart() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-bootstrap-business-").toFile()
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val disk = SyncPersistence(app)
        val store = CuciinStore
        val before = store.cloudSnapshot()
        val oldSession = store.session.value
        val fields = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "hadPersistedLocalData", "pendingCount").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val old = fields.mapValues { it.value.get(CloudSync) }
        val localFields = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val oldLocal = localFields.mapValues { it.value.get(LocalJson) }
        val access = store.javaClass.getDeclaredField("verifiedAccess").apply { isAccessible = true }
        val oldAccess = access.get(store)
        val business = store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }
        try {
            val account = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
            val local = Snapshot(staff = listOf(account), branches = listOf(Branch("b1", "B1", "Cabang", "", "")),
                customers = listOf(Customer("L", "Lokal", "", "")), accessRoles = AccessCatalog.builtInRoles(), updatedAt = Clock.nowMs())
            val remote = local.copy(customers = listOf(Customer("R", "Server", "", "")))
            val canonical = SyncProjection.bootstrapSnapshot(remote, local, true, local.updatedAt + 1000)
            assertEquals(setOf("L", "R"), canonical.customers.map { it.id }.toSet())
            business.invoke(store, local)
            store.javaClass.getDeclaredField("localUpdatedAt").apply { isAccessible = true }.setLong(store, local.updatedAt)
            store.authenticateSession(Session(Role.Owner, account.name, account.email, "b1", account.branchIds), local)
            val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(local)))
            fields.getValue("outbox").set(CloudSync, box)
            fields.getValue("persistence").set(CloudSync, disk)
            fields.getValue("latestSnapshot").set(CloudSync, local)
            localFields.getValue("file").set(LocalJson, java.io.File(directory, "cuciin-data.json"))
            localFields.getValue("backup").set(LocalJson, java.io.File(directory, "cuciin-data.backup.json"))
            localFields.getValue("latestSavedAt").setLong(LocalJson, Long.MIN_VALUE)
            LocalJson.save(local)
            val blocked = java.io.File(directory, "cuciin-data.json.tmp").apply { mkdir() }
            CloudSync.prepareReconciledBootstrap(remote, canonical, 7, "owner")
            val pending = box.state.pending
            assertEquals(listOf("L"), pending.filter { it.entityType == "customer" }.map { it.entityId })
            assertFalse(store.applyRecoveredCloud(canonical))
            assertEquals(local, LocalJson.load())
            val restarted = SyncOutbox(disk.load())
            assertNotNull("Bootstrap harus menyimpan snapshot bisnis sebelum ACK cursor", restarted.state.pendingRemote)
            assertEquals(canonical, restarted.state.pendingRemote!!.snapshot)
            assertEquals("a@example.test", restarted.state.pendingRemote!!.actorEmail)
            fields.getValue("outbox").set(CloudSync, restarted)
            business.invoke(store, local)
            CloudSync.initializeLocalState(local, true, local)
            assertEquals(pending, restarted.state.pending)
            assertFalse(restarted.state.pending.any { it.operation == "delete" })
            blocked.delete()
            assertTrue(CloudSync.applyPreparedRemote(CloudSync.captureSession(), System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(30)))
            assertEquals(setOf("L", "R"), LocalJson.load()!!.customers.map { it.id }.toSet())
            assertEquals(pending, disk.load().pending)
            assertNull(disk.load().pendingRemote)
            assertEquals(7L, disk.load().revision)
            assertFalse(disk.load().pending.any { it.operation == "delete" })
        } finally {
            fields.forEach { (name, field) -> field.set(CloudSync, old[name]) }
            localFields.forEach { (name, field) -> field.set(LocalJson, oldLocal[name]) }
            business.invoke(store, before)
            store.javaClass.getDeclaredField("localUpdatedAt").apply { isAccessible = true }.setLong(store, before.updatedAt)
            access.set(store, oldAccess)
            store.session.value = oldSession
            directory.deleteRecursively()
        }
    }

    @Test fun failedPullAndBootstrapPreparationKeepMemoryAtDurableState() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-prepare-siblings-").toFile()
        val fields = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val oldValues = fields.mapValues { it.value.get(CloudSync) }
        val disk = SyncPersistence(object : android.app.Application() { override fun getFilesDir() = directory })
        val local = Snapshot(customers = listOf(Customer("c1", "Lokal", "", "")), updatedAt = 1)
        val remote = local.copy(customers = listOf(Customer("c1", "Server", "", "")), updatedAt = 2)
        try {
            for (mode in listOf("pull", "bootstrap", "reconciled-business", "reconcile", "empty")) {
                val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(local), revision = 4))
                val before = box.state
                disk.save(before)
                fields.getValue("outbox").set(CloudSync, box)
                fields.getValue("persistence").set(CloudSync, disk)
                fields.getValue("latestSnapshot").set(CloudSync, local)
                val blocked = java.io.File(directory, "cuciin-sync-state.json.tmp").apply { mkdir() }
                val result = runCatching {
                    when (mode) {
                        "bootstrap" -> CloudSync.prepareBootstrapSnapshot(remote, 7, "owner", "a@example.test")
                        "reconciled-business" -> CloudSync.prepareReconciledBootstrap(local, remote, 7, "owner")
                        "reconcile", "empty" -> {
                            box.reconcileBootstrap(if (mode == "empty") emptyList() else SyncProjection.entities(local), SyncProjection.entities(remote), 7, 2, "b1", null, Role.Owner, "owner", "a@example.test", persist = disk::save)
                        }
                        else -> assertTrue(CloudSync.preparePulledRemote(remote, 7, before.generation, "owner", "a@example.test"))
                    }
                }
                assertTrue("Disk harus gagal pada prepare $mode", result.isFailure)
                assertEquals("Memori tidak boleh maju pada prepare $mode", before, box.state)
                assertEquals(before, disk.load())
                assertEquals(local, fields.getValue("latestSnapshot").get(CloudSync))
                blocked.delete()
                when (mode) {
                    "bootstrap" -> CloudSync.prepareBootstrapSnapshot(remote, 7, "owner", "a@example.test")
                        "reconciled-business" -> CloudSync.prepareReconciledBootstrap(local, remote, 7, "owner")
                    "reconcile", "empty" -> {
                        box.reconcileBootstrap(if (mode == "empty") emptyList() else SyncProjection.entities(local), SyncProjection.entities(remote), 7, 2, "b1", null, Role.Owner, "owner", "a@example.test", persist = disk::save)
                    }
                    else -> assertTrue(CloudSync.preparePulledRemote(remote, 7, before.generation, "owner", "a@example.test"))
                }
                assertEquals(box.state, disk.load())
                if (mode != "reconciled-business") assertEquals("a@example.test", box.state.pendingRemote?.actorEmail ?: box.state.pending.single().actorEmail)
                else assertEquals(remote, box.state.pendingRemote!!.snapshot)
            }
        } finally {
            fields.forEach { (name, field) -> field.set(CloudSync, oldValues[name]) }
            directory.deleteRecursively()
        }
    }

    @Test fun failedRecoveryPreparationAnswersWithoutThrowingOrLosingEvidence() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-prepare-disk-").toFile()
        val fields = listOf("outbox", "persistence", "lastStatus", "online").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val oldValues = fields.mapValues { it.value.get(CloudSync) }
        try {
            val rejected = RejectedSyncCommand(SyncCommand("denied", "customer", "c1", "upsert", occurredAt = 1), "denied", 2)
            val box = SyncOutbox(SyncClientState(rejected = listOf(rejected)))
            val disk = SyncPersistence(object : android.app.Application() { override fun getFilesDir() = directory })
            disk.save(box.state)
            val durable = box.state
            fields.getValue("outbox").set(CloudSync, box)
            fields.getValue("persistence").set(CloudSync, disk)
            java.io.File(directory, "cuciin-sync-state.json.tmp").mkdir()
            val source = java.io.File("src/main/java/com/cuciin/laundryops/data/CloudSync.kt").readText()
            val callbackGuard = CloudSync.javaClass.declaredMethods.firstOrNull { it.name.startsWith("applyRemoteSafely") && it.parameterCount == 2 }
            assertNotNull("Callback main wajib menangani error persiapan disk", callbackGuard)
            val completed = java.util.concurrent.CountDownLatch(1)
            var applied = false
            val result = runCatching {
                callbackGuard!!.invoke(CloudSync, { completed.countDown() }, {
                    if (CloudSync.prepareRejectedRecovery(Snapshot(updatedAt = 3), 7, "owner")) applied = true
                })
            }
            assertTrue("Error disk tidak boleh keluar dari callback main: ${result.exceptionOrNull()?.cause}", result.isSuccess)
            assertEquals(0L, completed.count)
            assertFalse(applied)
            assertEquals(durable, disk.load())
            assertEquals(listOf(rejected), box.state.rejected)
            assertEquals("Persiapan gagal tidak boleh meninggalkan prepared hanya di memori", durable, box.state)
            java.io.File(directory, "cuciin-sync-state.json.tmp").delete()
            assertTrue("Retry setelah disk pulih harus bisa menyiapkan kembali", CloudSync.prepareRejectedRecovery(Snapshot(updatedAt = 3), 7, "owner"))
            assertEquals(box.state, disk.load())
            assertNotNull(box.state.pendingRemote)
            assertTrue(CloudSync.lastStatus.contains("penyimpanan"))
            for (method in listOf("pullChanges", "bootstrapSnapshot", "recoverRejectedSnapshot", "legacyPull")) {
                val body = source.substringAfter("private fun $method():").substringBefore("\n    private fun ")
                assertTrue(method, body.contains("applyRemoteSafely"))
            }
        } finally {
            fields.forEach { (name, field) -> field.set(CloudSync, oldValues[name]) }
            directory.deleteRecursively()
        }
    }

    @Test fun queuedPullCannotOverwriteNewLocalGeneration() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-held-disk-job-").toFile()
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val disk = SyncPersistence(app)
        val cf = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorCloud = cf.mapValues { it.value.get(CloudSync) }
        val lf = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorLocal = lf.mapValues { it.value.get(LocalJson) }
        val storage = CuciinStore.javaClass.getDeclaredField("storageError").apply { isAccessible = true }
        val priorError = storage.get(CuciinStore)
        val priorSession = CuciinStore.session.value
        val worker = CloudSync.javaClass.getDeclaredField("disk").apply { isAccessible = true }.get(CloudSync) as java.util.concurrent.ExecutorService
        val owner = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
        val local = Snapshot(staff = listOf(owner), branches = listOf(Branch("b1", "B1", "Cabang", "", "")), customers = listOf(Customer("c1", "Lokal", "", "")), sessionEmail = owner.email, updatedAt = 10)
        val remote = local.copy(customers = listOf(Customer("c1", "Server", "", "")), updatedAt = 20)
        val rejected = RejectedSyncCommand(SyncCommand("keep-evidence", "customer", "c1", "upsert", occurredAt = 1, actorEmail = owner.email), "denied", 2)
        try {
            lf.getValue("file").set(LocalJson, java.io.File(directory, "cuciin-data.json"))
            lf.getValue("backup").set(LocalJson, java.io.File(directory, "cuciin-data.backup.json"))
            lf.getValue("latestSavedAt").setLong(LocalJson, Long.MIN_VALUE)
            LocalJson.save(local)
            val originalBytes = java.io.File(directory, "cuciin-data.json").readBytes()
            for (mode in listOf("generation")) {
                val box = SyncOutbox(SyncClientState(rejected = listOf(rejected)))
                box.reconcileRejectedRemote(remote, SyncProjection.entities(remote), 42, "owner", owner.email)
                disk.save(box.state)
                cf.getValue("outbox").set(CloudSync, box)
                cf.getValue("persistence").set(CloudSync, disk)
                cf.getValue("latestSnapshot").set(CloudSync, local)
                cf.getValue("pendingCount").setInt(CloudSync, 0)
                cf.getValue("rejectedCount").setInt(CloudSync, 1)
                cf.getValue("rejectedNeedsRecovery").setBoolean(CloudSync, true)
                cf.getValue("lastRejectedReason").set(CloudSync, "denied")
                CuciinStore.session.value = Session(Role.Owner, owner.name, owner.email, "b1", owner.branchIds)
                storage.set(CuciinStore, null)
                val stamp = CloudSync.captureSession()
                val started = java.util.concurrent.CountDownLatch(1)
                val release = java.util.concurrent.CountDownLatch(1)
                worker.execute { started.countDown(); release.await(5, java.util.concurrent.TimeUnit.SECONDS) }
                assertTrue(started.await(5, java.util.concurrent.TimeUnit.SECONDS))
                try {
                    CloudSync.persistAppliedRemote(remote, remote)
                    val edited = remote.copy(customers = listOf(Customer("c1", "Edit baru", "", "")), updatedAt = 30)
                    box.enqueueDurably(SyncProjection.entities(edited), 30, "b1", setOf("b1"), Role.Owner, owner.email) { disk.save(it) }
                    cf.getValue("latestSnapshot").set(CloudSync, edited)
                } finally { release.countDown() }
                worker.submit {}.get(5, java.util.concurrent.TimeUnit.SECONDS)
                assertTrue("Uji harus membuktikan storage guard, bukan epoch", CloudSync.sessionUnchanged(stamp))
                assertArrayEquals("Job $mode tidak boleh menimpa bisnis", originalBytes, java.io.File(directory, "cuciin-data.json").readBytes())
                assertEquals(box.state, disk.load())
                assertNotNull(box.state.pendingRemote)
                assertEquals("Edit baru", (cf.getValue("latestSnapshot").get(CloudSync) as Snapshot).customers.single().name)
                assertEquals(1, cf.getValue("rejectedCount").getInt(CloudSync))
                assertTrue(cf.getValue("rejectedNeedsRecovery").getBoolean(CloudSync))
            }
        } finally {
            worker.submit {}.get(5, java.util.concurrent.TimeUnit.SECONDS)
            cf.forEach { (name, field) -> field.set(CloudSync, priorCloud[name]) }
            lf.forEach { (name, field) -> field.set(LocalJson, priorLocal[name]) }
            storage.set(CuciinStore, priorError)
            CuciinStore.session.value = priorSession
            directory.deleteRecursively()
        }
    }

    @Test fun queuedRecoveryCannotWriteWhileStorageIsHeld() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-held-disk-job-").toFile()
        val app = object : android.app.Application() { override fun getFilesDir() = directory }
        val disk = SyncPersistence(app)
        val cf = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorCloud = cf.mapValues { it.value.get(CloudSync) }
        val lf = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val priorLocal = lf.mapValues { it.value.get(LocalJson) }
        val storage = CuciinStore.javaClass.getDeclaredField("storageError").apply { isAccessible = true }
        val priorError = storage.get(CuciinStore)
        val priorSession = CuciinStore.session.value
        val worker = CloudSync.javaClass.getDeclaredField("disk").apply { isAccessible = true }.get(CloudSync) as java.util.concurrent.ExecutorService
        val owner = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
        val local = Snapshot(staff = listOf(owner), branches = listOf(Branch("b1", "B1", "Cabang", "", "")), customers = listOf(Customer("c1", "Lokal", "", "")), sessionEmail = owner.email, updatedAt = 10)
        val remote = local.copy(customers = listOf(Customer("c1", "Server", "", "")), updatedAt = 20)
        val rejected = RejectedSyncCommand(SyncCommand("keep-evidence", "customer", "c1", "upsert", occurredAt = 1, actorEmail = owner.email), "denied", 2)
        try {
            lf.getValue("file").set(LocalJson, java.io.File(directory, "cuciin-data.json"))
            lf.getValue("backup").set(LocalJson, java.io.File(directory, "cuciin-data.backup.json"))
            lf.getValue("latestSavedAt").setLong(LocalJson, Long.MIN_VALUE)
            LocalJson.save(local)
            val originalBytes = java.io.File(directory, "cuciin-data.json").readBytes()
            for (mode in listOf("before", "waiting")) {
                val box = SyncOutbox(SyncClientState(rejected = listOf(rejected)))
                box.reconcileRejectedRemote(remote, SyncProjection.entities(remote), 42, "owner", owner.email)
                disk.save(box.state)
                cf.getValue("outbox").set(CloudSync, box)
                cf.getValue("persistence").set(CloudSync, disk)
                cf.getValue("latestSnapshot").set(CloudSync, local)
                cf.getValue("pendingCount").setInt(CloudSync, 0)
                cf.getValue("rejectedCount").setInt(CloudSync, 1)
                cf.getValue("rejectedNeedsRecovery").setBoolean(CloudSync, true)
                cf.getValue("lastRejectedReason").set(CloudSync, "denied")
                CuciinStore.session.value = null
                storage.set(CuciinStore, if (mode == "before") "disk-held" else null)
                val initial = box.state
                val stamp = CloudSync.captureSession()
                val started = java.util.concurrent.CountDownLatch(1)
                val release = java.util.concurrent.CountDownLatch(1)
                worker.execute { started.countDown(); release.await(5, java.util.concurrent.TimeUnit.SECONDS) }
                assertTrue(started.await(5, java.util.concurrent.TimeUnit.SECONDS))
                try {
                    CloudSync.persistAppliedRemote(remote, remote)
                    storage.set(CuciinStore, "disk-held")
                } finally { release.countDown() }
                worker.submit {}.get(5, java.util.concurrent.TimeUnit.SECONDS)
                assertTrue("Uji harus membuktikan storage guard, bukan epoch", CloudSync.sessionUnchanged(stamp))
                assertArrayEquals("Job $mode tidak boleh menimpa bisnis", originalBytes, java.io.File(directory, "cuciin-data.json").readBytes())
                assertEquals(initial, box.state)
                assertEquals(initial, disk.load())
                assertEquals(local, cf.getValue("latestSnapshot").get(CloudSync))
                assertEquals(1, cf.getValue("rejectedCount").getInt(CloudSync))
                assertTrue(cf.getValue("rejectedNeedsRecovery").getBoolean(CloudSync))
            }
        } finally {
            worker.submit {}.get(5, java.util.concurrent.TimeUnit.SECONDS)
            cf.forEach { (name, field) -> field.set(CloudSync, priorCloud[name]) }
            lf.forEach { (name, field) -> field.set(LocalJson, priorLocal[name]) }
            storage.set(CuciinStore, priorError)
            CuciinStore.session.value = priorSession
            directory.deleteRecursively()
        }
    }

    @Test fun queuedDiskCompletionCannotFinishReplacementRecovery() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-stale-recovery-").toFile()
        val fields = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val oldValues = fields.mapValues { it.value.get(CloudSync) }
        val localFields = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val oldLocal = localFields.mapValues { it.value.get(LocalJson) }
        val oldSession = CuciinStore.session.value
        val worker = CloudSync.javaClass.getDeclaredField("disk").apply { isAccessible = true }.get(CloudSync) as java.util.concurrent.ExecutorService
        val started = java.util.concurrent.CountDownLatch(1)
        val release = java.util.concurrent.CountDownLatch(1)
        try {
            CuciinStore.session.value = Session(Role.Owner, "A", "a@example.test", "b1", listOf("b1"))
            val first = Snapshot(customers = listOf(Customer("c1", "Pertama", "", "")), updatedAt = 10)
            val second = first.copy(customers = listOf(Customer("c1", "Kedua", "", "")), updatedAt = 20)
            val evidence = RejectedSyncCommand(SyncCommand("second-denied", "customer", "c1", "upsert", occurredAt = 1), "denied", 2)
            val box = SyncOutbox(SyncClientState(rejected = listOf(evidence)))
            assertTrue(box.reconcileRejectedRemote(first, SyncProjection.entities(first), 1))
            val disk = SyncPersistence(object : android.app.Application() { override fun getFilesDir() = directory })
            fields.getValue("outbox").set(CloudSync, box)
            fields.getValue("persistence").set(CloudSync, disk)
            fields.getValue("latestSnapshot").set(CloudSync, first)
            localFields.getValue("file").set(LocalJson, java.io.File(directory, "cuciin-data.json"))
            localFields.getValue("backup").set(LocalJson, java.io.File(directory, "cuciin-data.backup.json"))
            localFields.getValue("latestSavedAt").setLong(LocalJson, Long.MIN_VALUE)
            worker.execute { started.countDown(); release.await() }
            assertTrue(started.await(5, java.util.concurrent.TimeUnit.SECONDS))
            CloudSync.persistAppliedRemote(first, first)
            CloudSync.completeRecoveredRemote(first)
            assertTrue(box.reconcileRejectedRemote(second, SyncProjection.entities(second), 2))
            disk.save(box.state)
            val expected = box.state
            fields.getValue("latestSnapshot").set(CloudSync, second)
            release.countDown()
            worker.submit {}.get(5, java.util.concurrent.TimeUnit.SECONDS)
            assertEquals("Pekerjaan lama tidak boleh menyelesaikan prepared pengganti", expected, box.state)
            assertEquals(expected, disk.load())
            assertEquals(second, fields.getValue("latestSnapshot").get(CloudSync))
            assertFalse("Pekerjaan basi tidak boleh menulis snapshot lama", java.io.File(directory, "cuciin-data.json").exists())
            val waiting = java.util.concurrent.CountDownLatch(1)
            val resume = java.util.concurrent.CountDownLatch(1)
            worker.execute { waiting.countDown(); resume.await(5, java.util.concurrent.TimeUnit.SECONDS) }
            assertTrue(waiting.await(5, java.util.concurrent.TimeUnit.SECONDS))
            try {
                CloudSync.persistAppliedRemote(second, second)
                CloudSync.invalidateSession()
                CloudSync.invalidateSession()
            } finally { resume.countDown() }
            worker.submit {}.get(5, java.util.concurrent.TimeUnit.SECONDS)
            assertEquals("Relogin akun sama harus menolak pekerjaan sesi lama", expected, box.state)
            assertEquals(expected, disk.load())
            assertFalse(java.io.File(directory, "cuciin-data.json").exists())
        } finally {
            release.countDown()
            worker.submit {}.get(5, java.util.concurrent.TimeUnit.SECONDS)
            fields.forEach { (name, field) -> field.set(CloudSync, oldValues[name]) }
            localFields.forEach { (name, field) -> field.set(LocalJson, oldLocal[name]) }
            CuciinStore.session.value = oldSession
            directory.deleteRecursively()
        }
    }

    @Test fun preparedRecoveryDiskFailureKeepsEvidenceAndCanRetry() {
        val store = CuciinStore
        val directory = java.nio.file.Files.createTempDirectory("cuciin-recovery-disk-").toFile()
        val before = store.cloudSnapshot()
        val oldSession = store.session.value
        val fields = listOf("localWriteFile", "outbox", "persistence", "latestSnapshot").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val oldValues = fields.mapValues { it.value.get(CloudSync) }
        val localFields = listOf("file", "backup", "latestSavedAt").associateWith { LocalJson.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val oldLocal = localFields.mapValues { it.value.get(LocalJson) }
        val access = store.javaClass.getDeclaredField("verifiedAccess").apply { isAccessible = true }
        val oldAccess = access.get(store)
        try {
            val account = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
            val server = Snapshot(staff = listOf(account), branches = listOf(Branch("b1", "B1", "Cabang", "", "")),
                customers = listOf(Customer("c1", "Server", "", "")), updatedAt = Clock.nowMs() + 1000)
            val local = server.copy(customers = listOf(Customer("c1", "Ditolak", "", "")), updatedAt = server.updatedAt - 1)
            store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }.invoke(store, local)
            store.authenticateSession(Session(account.role, account.name, account.email, "b1", account.branchIds), Snapshot(staff = listOf(account)))
            val denied = RejectedSyncCommand(SyncCommand("denied", "customer", "c1", "upsert", occurredAt = 1, actorEmail = account.email), "denied", 2)
            val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(local), rejected = listOf(denied)))
            assertTrue(box.reconcileRejectedRemote(server, SyncProjection.entities(server), 7, "owner", account.email))
            fields.getValue("outbox").set(CloudSync, box)
            val disk = SyncPersistence(object : android.app.Application() { override fun getFilesDir() = directory })
            fields.getValue("persistence").set(CloudSync, disk)
            disk.save(box.state)
            localFields.getValue("file").set(LocalJson, java.io.File(directory, "cuciin-data.json"))
            localFields.getValue("backup").set(LocalJson, java.io.File(directory, "cuciin-data.backup.json"))
            localFields.getValue("latestSavedAt").setLong(LocalJson, Long.MIN_VALUE)
            val dataTemp = java.io.File(directory, "cuciin-data.json.tmp").apply { mkdir() }
            val stateTemp = java.io.File(directory, "cuciin-sync-state.json.tmp")
            val prepared = box.state
            val stamp = CloudSync.captureSession()
            val deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(30)
            assertFalse(CloudSync.applyPreparedRemote(stamp, System.nanoTime() - 1))
            store.authenticateSession(store.session.value!!, Snapshot(staff = listOf(account)))
            assertFalse("Callback dari sesi sebelum relogin tidak boleh berlaku", CloudSync.applyPreparedRemote(stamp, deadline))
            val currentStamp = CloudSync.captureSession()
            val failed = runCatching { CloudSync.applyPreparedRemote(currentStamp, deadline) }
            assertTrue("Recovery disk gagal tidak boleh menjatuhkan startup", failed.isSuccess)
            assertEquals(false, failed.getOrNull())
            assertEquals(prepared, box.state)
            assertEquals(prepared, disk.load())
            dataTemp.delete()
            stateTemp.mkdir()
            assertEquals("Gagal menyimpan completion harus mempertahankan evidence", false, CloudSync.applyPreparedRemote(currentStamp, deadline))
            assertEquals(prepared, box.state)
            assertEquals(prepared, disk.load())
            stateTemp.delete()
            val newer = server.copy(customers = listOf(Customer("c1", "Edit baru", "", "")), updatedAt = server.updatedAt + 1)
            assertEquals(1, box.enqueue(SyncProjection.entities(newer), newer.updatedAt, "b1", null, Role.Owner, account.email).size)
            fields.getValue("latestSnapshot").set(CloudSync, newer)
            disk.save(box.state)
            val beforeRestart = box.state
            assertEquals("Generation perubahan pengguna harus menjaga edit baru saat startup", newer, CloudSync.initializeLocalState(newer, true, newer))
            assertEquals("Startup belum boleh mengakui prepared sebelum simpan bisnis", beforeRestart, box.state)
            assertEquals(beforeRestart, disk.load())
            assertEquals(true, CloudSync.applyPreparedRemote(currentStamp, deadline))
            assertNull(box.state.pendingRemote)
            assertTrue(box.state.rejected.isEmpty())
            assertEquals(1, box.state.pending.size)
            assertEquals(box.state, disk.load())
            assertEquals(newer.customers, LocalJson.load()!!.customers)
            assertEquals(newer.customers, store.customers.toList())
            val source = java.io.File("src/main/java/com/cuciin/laundryops/data/CloudSync.kt").readText()
            val synchronize = source.substringAfter("private fun synchronize()").substringBefore("private fun flushCommands()")
            assertTrue("Sesi hidup harus mencoba ulang prepared recovery sebelum flush", synchronize.indexOf("retryPreparedRemote()") in 0 until synchronize.indexOf("when (flushCommands())"))
        } finally {
            fields.forEach { (name, field) -> field.set(CloudSync, oldValues[name]) }
            localFields.forEach { (name, field) -> field.set(LocalJson, oldLocal[name]) }
            store.javaClass.getDeclaredMethod("applyBusiness", Snapshot::class.java).apply { isAccessible = true }.invoke(store, before)
            store.javaClass.getDeclaredField("localUpdatedAt").apply { isAccessible = true }.setLong(store, before.updatedAt)
            access.set(store, oldAccess)
            store.session.value = oldSession
            directory.deleteRecursively()
        }
    }

    @Test fun failedAuthorizationRefreshCannotPermitFlush() {
        val store = CuciinStore
        val priorSession = store.session.value
        val overlay = store.javaClass.getDeclaredField("verifiedAccess").apply { isAccessible = true }
        val priorAccess = overlay.get(store)
        try {
            val account = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
            val access = Snapshot(staff = listOf(account))
            store.authenticateSession(Session(account.role, account.name, account.email, "b1", account.branchIds), access)
            val stamp = CloudSync.captureSession()
            val before = store.cloudSnapshot()
            for (code in listOf(200, 429, 500, 503)) {
                assertFalse("Respons $code tanpa izin valid tidak boleh melanjutkan flush", CloudSync.applyAuthorizationResponse(stamp, code, null, System.nanoTime() + 1_000_000_000))
                assertTrue(store.canAccess("access", "access.role"))
                assertEquals(before, store.cloudSnapshot())
                assertTrue(CloudSync.sessionUnchanged(stamp))
            }
        } finally {
            store.session.value = priorSession
            overlay.set(store, priorAccess)
        }
    }

    @Test fun heldHttpAuthorizationCannotRevokeReloggedSession() {
        val store = CuciinStore
        val prior = store.session.value
        val overlay = store.javaClass.getDeclaredField("verifiedAccess").apply { isAccessible = true }
        val priorAccess = overlay.get(store)
        val reached = java.util.concurrent.CountDownLatch(1)
        val release = java.util.concurrent.CountDownLatch(1)
        val server = java.net.ServerSocket(0, 1, java.net.InetAddress.getByName("127.0.0.1"))
        server.soTimeout = 5000
        val executor = java.util.concurrent.Executors.newFixedThreadPool(2)
        val serving = executor.submit {
            server.accept().use { socket ->
                socket.soTimeout = 5000
                val reader = socket.getInputStream().bufferedReader()
                while (!reader.readLine().isNullOrEmpty()) { }
                reached.countDown()
                check(release.await(5, java.util.concurrent.TimeUnit.SECONDS))
                val body = LocalJson.json.encodeToString(Snapshot.serializer(), Snapshot()).toByteArray()
                socket.getOutputStream().use {
                    it.write("HTTP/1.1 200 OK\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n".toByteArray())
                    it.write(body)
                }
            }
        }
        try {
            val account = Staff("Uji", "a@example.test", Role.Owner, listOf("b1"))
            val active = Session(account.role, account.name, account.email, "b1", account.branchIds)
            val access = Snapshot(staff = listOf(account))
            store.authenticateSession(active, access)
            val stamp = CloudSync.captureSession()
            val response = executor.submit<Snapshot> {
                val connection = java.net.URL("http://127.0.0.1:${server.localPort}/v1/snapshot").openConnection() as java.net.HttpURLConnection
                connection.connectTimeout = 5000
                connection.readTimeout = 5000
                try {
                    assertEquals(200, connection.responseCode)
                    LocalJson.json.decodeFromString(Snapshot.serializer(), connection.inputStream.bufferedReader().use { it.readText() })
                } finally { connection.disconnect() }
            }
            assertTrue(reached.await(5, java.util.concurrent.TimeUnit.SECONDS))
            store.logout()
            store.authenticateSession(active, access)
            val before = store.cloudSnapshot()
            release.countDown()
            val remote = response.get(5, java.util.concurrent.TimeUnit.SECONDS)
            serving.get(5, java.util.concurrent.TimeUnit.SECONDS)
            assertFalse(CloudSync.applyAuthorizationResponse(stamp, 200, remote, System.nanoTime() + 1_000_000_000))
            assertEquals(active, store.session.value)
            assertTrue(store.canAccess("access", "access.role"))
            assertEquals(before, store.cloudSnapshot())
        } finally {
            release.countDown()
            server.close()
            executor.shutdownNow()
            store.session.value = prior
            overlay.set(store, priorAccess)
        }
    }

    @Test fun failedCommandResultSaveKeepsPendingAndRetriesExactlyOnce() {
        val directory = java.nio.file.Files.createTempDirectory("cuciin-command-result-").toFile()
        val fields = listOf("outbox", "persistence", "pendingCount", "rejectedCount", "rejectedNeedsRecovery", "lastRejectedReason").associateWith { CloudSync.javaClass.getDeclaredField(it).apply { isAccessible = true } }
        val old = fields.mapValues { it.value.get(CloudSync) }
        val disk = SyncPersistence(object : android.app.Application() { override fun getFilesDir() = directory })
        val priorSession = CuciinStore.session.value
        val ack = SyncCommand("ack", "nota", "n1", "upsert", "b1", 1, actorEmail = "a@example.test")
        val next = ack.copy(commandId = "next", occurredAt = 2)
        val denied = ack.copy(commandId = "deny", entityId = "n2")
        val response = SyncCommandResponse(results = listOf(SyncCommandResult("ack", "duplicate", updatedAt = 50), SyncCommandResult("deny", "rejected", message = "forbidden")))
        try {
            CuciinStore.session.value = Session(Role.Owner, "A", "a@example.test", "b1", listOf("b1"))
            for (permanent in listOf(false, true)) {
                val box = SyncOutbox(SyncClientState(pending = listOf(ack, next, denied)))
                val before = box.state
                disk.save(before)
                fields.getValue("outbox").set(CloudSync, box)
                fields.getValue("persistence").set(CloudSync, disk)
                fields.getValue("pendingCount").setInt(CloudSync, 3)
                fields.getValue("rejectedCount").setInt(CloudSync, 0)
                fields.getValue("rejectedNeedsRecovery").setBoolean(CloudSync, false)
                val reject = CloudSync.javaClass.getDeclaredMethod("moveToRejected", Map::class.java).apply { isAccessible = true }
                val blocked = java.io.File(directory, "cuciin-sync-state.json.tmp").apply { mkdir() }
                val failed = runCatching {
                    if (permanent) reject.invoke(CloudSync, mapOf("deny" to "forbidden"))
                    else CloudSync.applyCommandResponse(response, CloudSync.captureSession())
                }
                assertTrue(failed.isFailure)
                assertEquals("Hasil kirim gagal tersimpan tidak boleh memakan pending", before, box.state)
                assertEquals(before, disk.load())
                assertEquals(3, CloudSync.pendingCount)
                assertEquals(0, CloudSync.rejectedCount)
                assertFalse(fields.getValue("rejectedNeedsRecovery").getBoolean(CloudSync))
                blocked.delete()
                if (permanent) assertEquals(1, reject.invoke(CloudSync, mapOf("deny" to "forbidden")))
                else assertEquals(2, CloudSync.applyCommandResponse(response, CloudSync.captureSession()))
                assertEquals(box.state, disk.load())
                assertEquals(1, box.state.rejected.size)
                assertEquals(if (permanent) 2 else 1, box.state.pending.size)
                if (!permanent) assertEquals(50L, box.state.pending.single().expectedUpdatedAt)
                if (permanent) assertEquals(0, reject.invoke(CloudSync, mapOf("deny" to "forbidden")))
                else assertEquals(0, CloudSync.applyCommandResponse(response, CloudSync.captureSession()))
                assertEquals(1, box.state.rejected.size)
                assertEquals(box.state, disk.load())
            }
        } finally {
            fields.forEach { (name, field) -> field.set(CloudSync, old[name]) }
            CuciinStore.session.value = priorSession
            directory.deleteRecursively()
        }
    }

    @Test fun staleCommandAcknowledgementKeepsPendingUntilOriginalAccountRetries() {
        val store = CuciinStore
        val prior = store.session.value
        val field = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val previous = field.get(CloudSync)
        val command = SyncCommand("sent-a", "nota", "n1", "upsert", "b1", 1L, actorEmail = "a@example.test")
        val response = SyncCommandResponse(acknowledgedCommandIds = listOf(command.commandId))
        val box = SyncOutbox(SyncClientState(pending = listOf(command)))
        try {
            field.set(CloudSync, box)
            val active = Session(Role.Owner, "A", "a@example.test", "b1", listOf("b1"))
            store.authenticateSession(active)
            val stamp = CloudSync.captureSession()
            store.authenticateSession(Session(Role.Kasir, "B", "b@example.test", "b2", listOf("b2")))
            assertEquals(0, CloudSync.applyCommandResponse(response, stamp))
            assertEquals(listOf(command), box.state.pending)
            store.authenticateSession(active)
            assertEquals(0, CloudSync.applyCommandResponse(response, stamp))
            assertEquals(listOf(command), box.state.pending)
            assertEquals(1, CloudSync.applyCommandResponse(response, CloudSync.captureSession()))
            assertTrue(box.state.pending.isEmpty())
        } finally {
            field.set(CloudSync, previous)
            store.session.value = prior
        }
    }

    @Test fun timedOutBootstrapAndRecoveryCannotRunQueuedMutation() {
        val source = java.io.File("src/main/java/com/cuciin/laundryops/data/CloudSync.kt").readText()
        for (method in listOf("bootstrapSnapshot", "recoverRejectedSnapshot")) {
            val body = source.substringAfter("private fun $method():").substringBefore(10.toChar() + "    private fun ")
            assertTrue("$method harus memberi batas umur callback", body.contains("val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30)"))
            val callback = body.substringAfter("main.post {")
            assertTrue("$method harus menolak callback kadaluarsa sebelum mutasi", callback.substringBefore("val local =").substringBefore("val reconciled =").contains("System.nanoTime() - deadline >= 0"))
        }
    }

    @Test fun loggedOutStartupUsesSavedBusinessNotNormalizedDifferences() {
        val field = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val priorBox = field.get(CloudSync)
        val priorSession = CuciinStore.session.value
        val saved = Snapshot(assetTypes = CuciinStore.defaultAssetTypes(), updatedAt = 10)
        val entities = SyncProjection.entities(saved)
        val box = SyncOutbox(SyncClientState(shadow = entities, bootstrapped = true))
        field.set(CloudSync, box)
        CuciinStore.session.value = null
        try {
            CloudSync.migrateLocalActor(null)
            CloudSync.initializeLocalState(saved.copy(assetTypes = emptyList(), updatedAt = 20), true, saved)
            assertTrue(box.state.pending.isEmpty())
            assertEquals(SyncProjection.entities(saved.copy(assetTypes = emptyList(), updatedAt = 20)), box.state.shadow)
            val restarted = SyncOutbox(box.state)
            assertFalse(restarted.blockedActor("owner@example.test"))
        } finally { field.set(CloudSync, priorBox); CuciinStore.session.value = priorSession }
    }

    @Test fun startupRestoresAssetTypesBeforeLogin() {
        val store = CuciinStore
        val prior = store.assetTypes.toList()
        val method = store.javaClass.getDeclaredMethod("applySnapshot", Snapshot::class.java).apply { isAccessible = true }
        val snapshot = store.cloudSnapshot().copy(assetTypes = listOf(AssetType("test-asset", "TS", "Jenis uji")), sessionEmail = null)
        try {
            method.invoke(store, snapshot)
            assertEquals(snapshot.assetTypes, store.assetTypes.toList())
        } finally { store.assetTypes.clear(); store.assetTypes.addAll(prior) }
    }

    @Test fun selfDeletionCannotReportCloudSuccessOrChangeLocalData() {
        val store = CuciinStore
        val prior = store.session.value
        val staff = store.staff.toList()
        val audit = store.audit.toList()
        try {
            store.session.value = Session(Role.Kasir, "Kasir", "cashier@example.test", "b1", listOf("b1"))
            assertFalse(store.deleteMyAccount())
            assertEquals(staff, store.staff.toList())
            assertEquals(audit, store.audit.toList())
            assertEquals("cashier@example.test", store.session.value?.email)
        } finally { store.session.value = prior }
    }

    @Test fun unknownQueuePreventsBusinessEditsAfterLogin() {
        val store = CuciinStore
        val field = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val previous = field.get(CloudSync)
        val priorSession = store.session.value
        val command = SyncCommand("legacy", "nota", "n1", "upsert", "b1", 1L)
        field.set(CloudSync, SyncOutbox(SyncClientState(pending = listOf(command))))
        store.session.value = Session(Role.Owner, "Owner", "owner@example.test", "b1", listOf("b1"))
        val products = store.products.toList()
        val roles = store.accessRoles.toList()
        try {
            assertNull(store.addProduct("Tidak boleh tersimpan", 10, 1, setOf("b1")))
            assertNull(store.createAccessRole("Tidak boleh tersimpan"))
            assertEquals(products, store.products.toList())
            assertEquals(roles, store.accessRoles.toList())
        } finally {
            store.products.clear(); store.products.addAll(products)
            store.accessRoles.clear(); store.accessRoles.addAll(roles)
            store.session.value = priorSession
            field.set(CloudSync, previous)
        }
    }

    @Test fun ownerLoginWithUnknownLegacyQueueKeepsPendingUnchanged() {
        val store = CuciinStore
        val owner = Staff("Owner uji", "owner@example.test", Role.Owner, listOf("b1"), passwordHash = "trusted-test-fixture")
        val field = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val previous = field.get(CloudSync)
        val priorStaff = store.staff.toList()
        val priorSession = store.session.value
        val command = SyncCommand("legacy", "nota", "n1", "upsert", "b1", 1L)
        val box = SyncOutbox(SyncClientState(pending = listOf(command), scopeKey = "owner"))
        field.set(CloudSync, box)
        store.staff.clear()
        store.staff.add(owner)
        store.session.value = null
        try {
            assertTrue("antrean tanpa asal tidak boleh mengunci login Owner", store.login(owner.email, skipPassword = true))
            assertEquals(owner.email, store.session.value?.email)
            assertEquals(listOf(command), box.state.pending)
            assertTrue("login tidak boleh mengadopsi perintah tanpa asal", box.blockedActor(owner.email))
        } finally {
            field.set(CloudSync, previous)
            store.staff.clear()
            store.staff.addAll(priorStaff)
            store.session.value = priorSession
        }
    }
}
