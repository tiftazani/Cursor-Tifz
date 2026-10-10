package com.cuciin.laundryops.data

import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SyncProtocolTest {
    private fun entity(type: String, id: String, branch: String? = null, value: Int = 1) =
        SyncEntity(type, id, branch, buildJsonObject { put("id", id); put("value", value) })

    @Test fun legacyOrderJournalIsVisibleWithoutCreatingOrderCommands() {
        val nota = Nota("LEG-1", "b1", "Kasir", "Uji", "", "Cuci", 7000, 0,
            PayStatus.Belum, LaundryStatus.Masuk, "", 1, "", false)
        val payload = LocalJson.json.encodeToJsonElement(Nota.serializer(), nota)
        val result = SyncProjection.apply(Snapshot(), listOf(SyncChange(entityType = "order",
            entityId = nota.id, operation = "upsert", branchId = "b1", payload = payload)), 2)
        assertEquals(listOf(nota), result.notas)
        assertEquals(listOf("nota"), SyncProjection.entities(result).filter { it.entityId == nota.id }.map { it.entityType })
        assertTrue(SyncProjection.apply(result, listOf(SyncChange(entityType = "order",
            entityId = nota.id, operation = "delete", branchId = "b1")), 3).notas.isEmpty())
    }

    @Test fun androidWireMatchesWorkerFixture() {
        val actor = "kasir@cuciin.id"
        val line = NotaLine("cuci", "Cuci", 1.0, "kg", 10000, actor, "Kasir Melati", 1000)
        val initial = Nota("MLT-wire", "melati", "Kasir Melati", "Pelanggan", "0813", "Cuci", 10000, 0,
            PayStatus.Belum, LaundryStatus.Masuk, "1 Okt 2026, 08.00", 1, "", false, lines = listOf(line), kasirEmail = actor)
        val cases = linkedMapOf<String, kotlinx.serialization.json.JsonElement>()
        var next = 0
        fun commands(before: Snapshot, after: Snapshot): kotlinx.serialization.json.JsonElement {
            val box = SyncOutbox(SyncClientState(shadow = SyncProjection.entities(before), bootstrapped = true))

            val pending = box.enqueue(SyncProjection.entities(after), 2, "melati", setOf("melati"), Role.Kasir, actor) { "wire-${after.notas.first().id}-${next++}" }
            return LocalJson.json.encodeToJsonElement(SyncCommandBatch.serializer(), SyncCommandBatch(pending))
        }
        val base = Snapshot(notas = listOf(initial))
        cases["create"] = commands(Snapshot(), base)
        cases["payment"] = commands(base, base.copy(notas = listOf(initial.copy(paid = 10000, pay = PayStatus.Lunas, payMethod = PayMethod.Qris)),
            payments = listOf(PaymentRecord("pay-wire", initial.id, "melati", 10000, PayMethod.Qris, 2, "1 Okt 2026, 08.01", "Kasir Melati"))))
        cases["status"] = commands(base, base.copy(notas = listOf(initial.copy(laundry = LaundryStatus.Selesai, completedAt = "1 Okt 2026, 09.00"))))
        cases["whatsapp"] = commands(base, base.copy(notas = listOf(initial.copy(waSent = true, waAt = "1 Okt 2026, 09.01"))))
        val completed = initial.copy(paid = 10000, pay = PayStatus.Lunas, laundry = LaundryStatus.Selesai, completedAt = "1 Okt 2026, 09.00")
        cases["handoverBase"] = commands(Snapshot(), Snapshot(notas = listOf(completed)))
        cases["handover"] = commands(Snapshot(notas = listOf(completed)), Snapshot(notas = listOf(completed.copy(pickedUpAt = "1 Okt 2026, 10.00"))))
        val fixture = kotlinx.serialization.json.JsonObject(cases)
        java.io.File("build/android-wire.json").apply { parentFile?.mkdirs(); writeText(fixture.toString()) }
        assertEquals(fixture, LocalJson.json.parseToJsonElement(java.io.File("../../cloudflare/tests/fixtures/android-wire.json").readText()))
    }

    @Test fun debugBootstrapBranchUsesKotlinLocationField() {
        val valid = """{"branches":[{"id":"debug-bunayya","code":"DEBUG","name":"Cabang Debug","location":"Data uji lokal","mapsQuery":""}],"staff":[{"name":"Cuciin","email":"tiftazani.khara@gmail.com","role":"Owner","branchIds":["debug-bunayya"]}]}"""
        val snapshot = LocalJson.json.decodeFromString(Snapshot.serializer(), valid)
        assertEquals("Data uji lokal", snapshot.branches.single().location)

        val legacyAddress = valid.replace("\"location\":\"Data uji lokal\"", "\"address\":\"Data uji lokal\"")
        assertTrue(runCatching { LocalJson.json.decodeFromString(Snapshot.serializer(), legacyAddress) }.isFailure)
    }

    @Test fun acknowledgedNotaDoesNotRequeueWhenOnlyUnrelatedLocalDataChanges() {
        val nota = Nota("ACK-1", "b1", "Kasir", "Data contoh", "", "Cuci", 7000, 0,
            PayStatus.Belum, LaundryStatus.Masuk, "", 1, "", false)
        val local = Snapshot(notas = listOf(nota))
        val box = SyncOutbox(SyncClientState(bootstrapped = true))
        val sent = box.enqueue(SyncProjection.entities(local), 1, "b1", null, Role.Owner, "owner@example.test") { "ack-create" }
        assertEquals(1, sent.size)
        box.acknowledge(setOf("ack-create"), 7, mapOf("ack-create" to 100L))
        val changed = local.copy(customers = listOf(Customer("new-customer", "Contoh", "", "")))
        val commands = box.enqueue(SyncProjection.entities(changed), 2, "b1", null, Role.Owner, "owner@example.test") { "next-customer" }
        assertEquals(listOf("customer"), commands.map { it.entityType })
        assertEquals(100L, box.state.shadow.single { it.entityType == "nota" }.payload.jsonObject["updatedAtMs"]!!.jsonPrimitive.content.toLong())
        assertTrue(box.enqueue(SyncProjection.entities(changed), 3, "b1", null, Role.Owner, "owner@example.test") { "duplicate" }.isEmpty())
        val edited = changed.copy(notas = listOf(nota.copy(customer = "Perubahan nyata")))
        val correction = box.enqueue(SyncProjection.entities(edited), 4, "b1", null, Role.Owner, "owner@example.test") { "correction" }.single()
        assertEquals("nota", correction.entityType)
        assertEquals(100L, correction.expectedUpdatedAt)
        assertEquals("Perubahan nyata", correction.payload.jsonObject["customer"]!!.jsonPrimitive.content)
    }

    @Test fun offlinePaymentsWaitForEveryPendingNotaVersion() {
        val actor = "kasir@cuciin.id"
        val line = NotaLine("cuci", "Cuci", 1.0, "kg", 10000, actor, "Kasir Melati", 1000)
        val nota = Nota("MLT-offline", "melati", "Kasir Melati", "Data contoh", "", "Cuci", 10000, 0,
            PayStatus.Belum, LaundryStatus.Masuk, "1 Okt 2026, 08.00", 1, "", false, lines = listOf(line), kasirEmail = actor)
        val box = SyncOutbox(SyncClientState(bootstrapped = true))
        var id = 0
        fun enqueue(snapshot: Snapshot) = box.enqueue(SyncProjection.entities(snapshot), 2, "melati", setOf("melati"), Role.Kasir, actor) { "offline-command-${id++}" }
        enqueue(Snapshot(notas = listOf(nota)))
        val payment1 = PaymentRecord("offline-pay-1", nota.id, "melati", 4000, PayMethod.Tunai, 2, "1 Okt 2026, 08.01", "Kasir Melati")
        val payment2 = payment1.copy(id = "offline-pay-2", amount = 6000, atMs = 3)
        enqueue(Snapshot(notas = listOf(nota.copy(paid = 4000)), payments = listOf(payment1)))
        enqueue(Snapshot(notas = listOf(nota.copy(paid = 10000, pay = PayStatus.Lunas)), payments = listOf(payment1, payment2)))
        val batches = mutableListOf<kotlinx.serialization.json.JsonElement>()
        repeat(3) { version ->
            val batch = box.nextBatch(100)
            assertEquals("payment must not race an older nota version", listOf("nota"), batch.map { it.entityType })
            batches += LocalJson.json.encodeToJsonElement(SyncCommandBatch.serializer(), SyncCommandBatch(batch))
            box.acknowledge(batch.mapTo(hashSetOf()) { it.commandId }, version + 1L, batch.associate { it.commandId to (100L + version) })
        }
        val payments = box.nextBatch(100)
        assertEquals(listOf("payment", "payment"), payments.map { it.entityType })
        assertEquals(listOf(4000, 6000), payments.map { it.payload.jsonObject["amount"]!!.jsonPrimitive.content.toInt() })
        batches += LocalJson.json.encodeToJsonElement(SyncCommandBatch.serializer(), SyncCommandBatch(payments))
        java.io.File("build/offline-payment-wire.json").writeText(kotlinx.serialization.json.JsonArray(batches).toString())
        box.acknowledge(payments.mapTo(hashSetOf()) { it.commandId }, 4)
        assertTrue(box.state.pending.isEmpty())
        assertTrue(box.state.rejected.isEmpty())
    }

    @Test fun backlogOver100PreservesPaymentDependenciesAcrossRestart() {
        val pending = (1..120).flatMap { index ->
            val notaId = "backlog-$index"
            listOf(
                SyncCommand("create-$index", "nota", notaId, "upsert", "melati", 1, payload = buildJsonObject { put("paid", 0) }, actorEmail = "a@example.test"),
                SyncCommand("paid-$index", "nota", notaId, "upsert", "melati", 2, payload = buildJsonObject { put("paid", 10000) }, actorEmail = "a@example.test"),
                SyncCommand("payment-$index", "payment", "pay-$index", "upsert", "melati", 2, payload = buildJsonObject { put("notaId", notaId); put("amount", 10000) }, actorEmail = "a@example.test"),
            )
        }
        var box = SyncOutbox(SyncClientState(pending = pending, bootstrapped = true))
        val paid = hashSetOf<String>()
        val acknowledged = hashSetOf<String>()
        var rounds = 0
        while (box.state.pending.isNotEmpty()) {
            val batch = box.nextBatch(100)
            assertTrue("dependency selection must make progress", batch.isNotEmpty())
            assertTrue(batch.size <= 100)
            batch.forEach { command ->
                if (command.entityType == "payment") {
                    assertTrue("payment before paid nota ACK", command.payload.jsonObject["notaId"]!!.jsonPrimitive.content in paid)
                } else if (command.commandId.startsWith("paid-")) paid += command.entityId
                assertTrue("a command may be acknowledged only once", acknowledged.add(command.commandId))
            }
            rounds++
            box.acknowledge(batch.mapTo(hashSetOf()) { it.commandId }, rounds.toLong())
            box = SyncOutbox(LocalJson.json.decodeFromString(SyncClientState.serializer(), LocalJson.json.encodeToString(SyncClientState.serializer(), box.state)))
            assertTrue("backlog must finish within a bounded number of requests", rounds <= 8)
        }
        assertEquals(360, acknowledged.size)
        assertEquals(120, paid.size)
        assertTrue(box.state.rejected.isEmpty())
    }

    @Test fun repeatedSnapshotDoesNotCreateDuplicateCommands() {
        val initial = listOf(entity("nota", "MEL-1", "melati"))
        val outbox = SyncOutbox()
        assertTrue(outbox.initialize(initial))
        val changed = listOf(entity("nota", "MEL-1", "melati", value = 2))

        assertEquals(1, outbox.enqueue(changed, 10, "melati", null) { "cmd-1" }.size)
        assertTrue(outbox.enqueue(changed, 11, "melati", null) { "cmd-2" }.isEmpty())
        assertEquals(listOf("cmd-1"), outbox.state.pending.map { it.commandId })
    }

    @Test fun commandRemainsUntilItsOwnAcknowledgementArrives() {
        val outbox = SyncOutbox()
        outbox.initialize(emptyList())
        outbox.enqueue(listOf(entity("expense", "e-1", "melati")), 10, "melati", null) { "cmd-1" }

        assertEquals(0, outbox.acknowledge(setOf("unknown"), revision = 8))
        assertEquals(1, outbox.state.pending.size)
        assertEquals(1, outbox.acknowledge(setOf("cmd-1"), revision = 9))
        assertTrue(outbox.state.pending.isEmpty())
        assertEquals(0, outbox.state.revision)
    }

    @Test fun nonOwnerCannotQueueAnotherBranchMutation() {
        val before = listOf(entity("branchStock", "melati:sabun", "melati"))
        val after = before + entity("branchStock", "cibaduyut:sabun", "cibaduyut")
        val outbox = SyncOutbox().also { it.initialize(before) }

        val commands = outbox.enqueue(after, 10, "melati", setOf("melati")) { "cmd" }
        assertTrue(commands.isEmpty())
        assertTrue(outbox.state.pending.isEmpty())
    }

    @Test fun stockCommandCarriesBaselineAndAtomicDelta() {
        fun stock(value: Int) = SyncEntity(
            "branchStock", "melati:sabun", "melati",
            buildJsonObject { put("branchId", "melati"); put("productKey", "sabun"); put("stock", value) },
        )
        val outbox = SyncOutbox().also { it.initialize(listOf(stock(10))) }
        val command = outbox.enqueue(listOf(stock(7)), 10, "melati", null) { "stock-command" }.single()
        val payload = command.payload.toString()
        assertTrue(payload.contains("\"syncBaseStock\":10"))
        assertTrue(payload.contains("\"syncDelta\":-3"))
    }

    @Test fun bootstrapStateIsPersistentAndCannotReplacePendingCommands() {
        val outbox = SyncOutbox().also { it.initialize(emptyList()) }
        assertFalse(outbox.state.bootstrapped)
        outbox.completeBootstrap(listOf(entity("branch", "melati")), revision = 12)
        assertTrue(outbox.state.bootstrapped)
        assertEquals(12, outbox.state.revision)
        outbox.enqueue(listOf(entity("branch", "melati", value = 2)), 20, "melati", null) { "cmd" }
        assertFalse(outbox.acceptRemote(emptyList(), revision = 13))
        assertEquals(1, outbox.state.pending.size)
    }

    @Test fun entriJurnalStaffMenggantiNamaOwnerTanpaMenambahBaris() {
        // Perangkat menerima perubahan nama Owner lewat jurnal, bukan lewat snapshot penuh.
        // Dua hal yang harus benar: baris lama diganti (bukan ditambah), dan Owner kedua
        // tidak ikut berubah.
        val awal = Snapshot(
            staff = listOf(
                Staff("Tiftazani", "tiftazani.khara@gmail.com", Role.Owner, listOf("melati")),
                Staff("Ustutifa", "us.archuleta1207@gmail.com", Role.Owner, listOf("melati")),
            ),
            updatedAt = 1,
        )
        val payload = LocalJson.json.encodeToJsonElement(
            Staff.serializer(),
            Staff("Cuciin", "tiftazani.khara@gmail.com", Role.Owner, listOf("melati")),
        )
        val sesudah = SyncProjection.apply(
            awal,
            listOf(SyncChange(9, "staff", "tiftazani.khara@gmail.com", "upsert", "melati", payload)),
            updatedAt = 20,
        )
        assertEquals("jumlah staff tidak boleh bertambah", 2, sesudah.staff.size)
        assertEquals(
            "Cuciin",
            sesudah.staff.single { it.email == "tiftazani.khara@gmail.com" }.name,
        )
        assertEquals(
            "Owner kedua tidak boleh ikut berubah",
            "Ustutifa",
            sesudah.staff.single { it.email == "us.archuleta1207@gmail.com" }.name,
        )
    }

    @Test fun deltaProjectionUpsertsAndDeletesByStableEntityId() {
        val original = Snapshot(
            branches = listOf(Branch("melati", "MEL", "Lama", "", "")),
            staff = listOf(Staff("Owner", "owner@example.com", Role.Owner, listOf("melati"))),
            updatedAt = 1,
        )
        val replacement = LocalJson.json.encodeToJsonElement(
            Branch.serializer(), Branch("melati", "MEL", "Baru", "Alamat", ""),
        )
        val updated = SyncProjection.apply(
            original,
            listOf(SyncChange(2, "branch", "melati", "upsert", "melati", replacement)),
            updatedAt = 20,
        )
        assertEquals("Baru", updated.branches.single().name)
        assertEquals(20, updated.updatedAt)

        val deleted = SyncProjection.apply(
            updated,
            listOf(SyncChange(3, "branch", "melati", "delete", "melati", JsonPrimitive("ignored"))),
            updatedAt = 21,
        )
        assertTrue(deleted.branches.isEmpty())
        assertFalse(deleted.staff.isEmpty())
    }

    @Test fun responseAcceptsServerAckAliasesAndDuplicateResult() {
        val response = SyncCommandResponse(
            acknowledgedCommandIds = listOf("a"),
            ackedCommandIds = listOf("b"),
            acceptedCommandIds = listOf("c"),
            results = listOf(SyncCommandResult("d", "duplicate"), SyncCommandResult("e", "rejected"), SyncCommandResult("f", accepted = true)),
        )
        assertEquals(setOf("a", "b", "c", "d", "f"), response.acknowledged())
    }

    @Test fun partialBatchConflictMovesToPersistentDeadLetterWithoutBlockingQueue() {
        val outbox = SyncOutbox().also { it.initialize(emptyList()) }
        var commandNumber = 0
        outbox.enqueue(
            listOf(entity("expense", "e-1", "melati"), entity("expense", "e-2", "melati")),
            10, "melati", null,
        ) { "cmd-${++commandNumber}" }
        val commands = outbox.state.pending
        assertEquals(2, commands.size)
        outbox.acknowledge(setOf(commands[0].commandId), revision = 7)
        outbox.reject(mapOf(commands[1].commandId to "409 · data berubah di perangkat lain"), rejectedAt = 99)
        assertTrue(outbox.state.pending.isEmpty())
        assertEquals(1, outbox.state.rejected.size)

        val encoded = LocalJson.json.encodeToString(SyncClientState.serializer(), outbox.state)
        val restored = LocalJson.json.decodeFromString(SyncClientState.serializer(), encoded)
        assertEquals("409 · data berubah di perangkat lain", restored.rejected.single().reason)
        assertEquals(99, restored.rejected.single().rejectedAt)
        assertEquals(0, restored.revision)
    }

    @Test fun permanentRejectionReplacesDivergentShadowWithServerAndClearsResolvedEvidence() {
        val local = listOf(entity("expense", "e-1", "melati", value = 2))
        val remote = listOf(entity("expense", "e-1", "melati", value = 1))
        val outbox = SyncOutbox().also { it.initialize(listOf(entity("expense", "e-1", "melati", value = 1))) }
        val command = outbox.enqueue(local, 10, "melati", null) { "rejected-edit" }.single()
        outbox.reject(mapOf(command.commandId to "Khusus Owner"), rejectedAt = 11)

        assertTrue(outbox.reconcileRejectedRemote(Snapshot(updatedAt = 13), remote, revision = 12, scopeKey = "owner:all"))
        assertTrue(outbox.state.pending.isEmpty())
        assertEquals("Pemulihan belum boleh menghapus bukti sebelum data tersimpan", 1, outbox.state.rejected.size)
        assertTrue("Pemulihan harus disiapkan agar snapshot lama tetap diterapkan", outbox.state.pendingRemote != null)
        val encoded = LocalJson.json.encodeToString(SyncClientState.serializer(), outbox.state)
        val restarted = SyncOutbox(LocalJson.json.decodeFromString(SyncClientState.serializer(), encoded))
        assertEquals(outbox.state, restarted.state)
        assertTrue(outbox.completePreparedRemote())
        assertTrue(outbox.state.rejected.isEmpty())
        assertEquals(remote, outbox.state.shadow)
        assertEquals(12, outbox.state.revision)
        assertEquals("owner:all", outbox.state.scopeKey)
    }

    @Test fun completedRecoveryKeepsRejectionsCreatedAfterPreparation() {
        val remote = listOf(entity("expense", "e-1", "melati", value = 1))
        val box = SyncOutbox().also { it.initialize(remote) }
        box.enqueue(listOf(entity("expense", "e-1", "melati", value = 2)), 10, "melati", null) { "first" }
        box.reject(mapOf("first" to "denied"), 11)
        assertTrue(box.reconcileRejectedRemote(Snapshot(updatedAt = 12), remote, 7))
        box.enqueue(listOf(entity("expense", "e-1", "melati", value = 3)), 13, "melati", null) { "second" }
        box.reject(mapOf("second" to "denied later"), 14)
        assertTrue(box.completePreparedRemote())
        assertEquals(listOf("second"), box.state.rejected.map { it.command.commandId })
    }

    @Test fun paymentJournalIsProjectedAsItsOwnBranchScopedEntity() {
        val payment = PaymentRecord("pay-1", "BNY-1", "bunayya", 15_000, PayMethod.Qris, 100, "16 Sep 2026, 10.00", "Kasir")
        val entity = SyncProjection.entities(Snapshot(payments = listOf(payment))).single()
        assertEquals("payment", entity.entityType)
        assertEquals("pay-1", entity.entityId)
        assertEquals("bunayya", entity.branchId)

        val restored = SyncProjection.apply(Snapshot(), listOf(SyncChange(1, "payment", "pay-1", "upsert", "bunayya", entity.payload)), 101)
        assertEquals(listOf(payment), restored.payments)
    }

    @Test fun supervisorStatusMutationIsExplicitAndPhotoPathsNeverEnterProjection() {
        val oldNota = Nota(
            "MEL-1", "melati", "Rina", "Nadia", "0812", "Cuci", 10_000, 0,
            PayStatus.Belum, LaundryStatus.Masuk, "hari ini", 1, "besok", false,
            photos = mutableListOf("/data/user/0/private-photo.jpg"), updatedAtMs = 21,
        )
        val newNota = oldNota.copy(laundry = LaundryStatus.Selesai, completedAt = "sekarang")
        fun projected(nota: Nota) = SyncProjection.entities(Snapshot(notas = listOf(nota))).single()
        val oldEntity = projected(oldNota)
        val newEntity = projected(newNota)
        assertEquals("[]", oldEntity.payload.jsonObject["photos"].toString())
        assertFalse(oldEntity.payload.toString().contains("private-photo"))

        val outbox = SyncOutbox().also { it.initialize(listOf(oldEntity)) }
        val command = outbox.enqueue(
            listOf(newEntity), 22, "melati", setOf("melati"), actorRole = Role.Supervisor,
        ) { "status-command" }.single()
        assertEquals("\"status\"", command.payload.jsonObject["syncIntent"].toString())
        assertEquals(21L, command.expectedUpdatedAt)
    }

    @Test fun bootstrapPreservesLocalOverridesAndImportsRemoteOnlyEntities() {
        val remote = Snapshot(
            branches = listOf(Branch("melati", "MEL", "Nama server", "", "")),
            customers = listOf(Customer("server-only", "Server", "0811", "")),
            notas = listOf(
                Nota("deleted-local", "melati", "Rina", "Pelanggan", "0812", "Cuci", 10_000, 0, PayStatus.Belum, LaundryStatus.Masuk, "hari ini", 1, "besok", false),
            ),
            updatedAt = 100,
        )
        val local = Snapshot(
            branches = listOf(Branch("melati", "MEL", "Edit lokal", "", "")),
            deletedNotaIds = listOf("deleted-local"),
            updatedAt = 200,
        )
        val merged = SyncProjection.reconcileBootstrap(remote, local, 201)
        assertEquals("Edit lokal", merged.branches.single().name)
        assertEquals("Server", merged.customers.single().name)
        assertTrue(merged.notas.isEmpty())

        val outbox = SyncOutbox().also { it.initialize(SyncProjection.entities(local)) }
        var sequence = 0
        val commands = outbox.reconcileBootstrap(
            SyncProjection.entities(remote), SyncProjection.entities(merged), 12, 201, "melati", null,
        ) { "bootstrap-${sequence++}" }
        assertTrue(outbox.state.bootstrapped)
        assertEquals(12, outbox.state.revision)
        assertTrue(commands.any { it.entityType == "branch" && it.operation == "upsert" })
        assertTrue(commands.any { it.entityType == "nota" && it.operation == "delete" })
        assertFalse(commands.any { it.entityType == "customer" })
    }

    @Test fun freshInstallSeedDoesNotOverwriteExistingServerData() {
        val remote = Snapshot(branches = listOf(Branch("remote", "REM", "Cabang server", "", "")), updatedAt = 50)
        val seed = Snapshot(branches = listOf(Branch("melati", "MEL", "Data contoh", "", "")), updatedAt = 0)
        val selected = SyncProjection.bootstrapSnapshot(remote, seed, preserveLocal = false, updatedAt = 60)
        assertEquals(listOf("remote"), selected.branches.map { it.id })
        assertEquals(60, selected.updatedAt)
    }

    @Test fun remotePullIsRejectedWhenLocalStateChangedDuringNetworkWait() {
        val initial = listOf(entity("customer", "c-1", value = 1))
        val outbox = SyncOutbox().also { it.initialize(initial) }
        outbox.enqueue(listOf(entity("customer", "c-1", value = 2)), 20, null, null) { "local-edit" }

        assertFalse(outbox.acceptRemoteIfUnchanged(listOf(entity("customer", "c-1", value = 3)), 8, initial))
        assertEquals(2, outbox.state.shadow.single().payload.jsonObject["value"]?.toString()?.toInt())
        assertEquals(0, outbox.state.revision)
    }

    @Test fun startupRecoveryQueuesLocalFileThatIsAheadOfPersistedShadow() {
        val persisted = listOf(entity("customer", "c-1", value = 1))
        val localFile = listOf(entity("customer", "c-1", value = 2))
        val outbox = SyncOutbox(SyncClientState(revision = 4, shadow = persisted, bootstrapped = true))

        val recovered = outbox.restoreLocal(localFile, 20, null, null, commandId = { "recovered-command" })
        assertEquals(listOf("recovered-command"), recovered.map { it.commandId })
        assertEquals(2, outbox.state.shadow.single().payload.jsonObject["value"]?.toString()?.toInt())
        assertEquals(4, outbox.state.revision)
    }

    @Test fun startupDoesNotReverseACommandWhenLocalFileIsOlderThanOutbox() {
        val desired = listOf(entity("customer", "c-1", value = 2))
        val pending = SyncCommand("pending-edit", "customer", "c-1", "upsert", occurredAt = 20, payload = desired.single().payload)
        val outbox = SyncOutbox(SyncClientState(shadow = desired, pending = listOf(pending), bootstrapped = true))

        val recovered = outbox.restoreLocal(listOf(entity("customer", "c-1", value = 1)), 19, null, null) { "reverse" }
        assertTrue(recovered.isEmpty())
        assertEquals(listOf("pending-edit"), outbox.state.pending.map { it.commandId })
        assertEquals(desired, outbox.state.shadow)
    }

    @Test fun sequentialNotaEditsUseAcknowledgedServerVersionAndAreSentOneAtATime() {
        fun nota(version: Long, value: Int) = SyncEntity(
            "nota", "MEL-1", "melati",
            buildJsonObject { put("id", "MEL-1"); put("branchId", "melati"); put("value", value); put("updatedAtMs", version) },
        )
        val outbox = SyncOutbox().also { it.initialize(listOf(nota(10, 1))) }
        outbox.enqueue(listOf(nota(10, 2)), 20, "melati", null) { "nota-edit-1" }
        outbox.enqueue(listOf(nota(10, 3)), 21, "melati", null) { "nota-edit-2" }
        assertEquals(listOf("nota-edit-1"), outbox.nextBatch(100).map { it.commandId })

        outbox.acknowledge(setOf("nota-edit-1"), revision = 5, updatedAtByCommand = mapOf("nota-edit-1" to 30L))
        val second = outbox.state.pending.single()
        assertEquals(30L, second.expectedUpdatedAt)
        assertEquals("30", second.payload.jsonObject["updatedAtMs"].toString())
        assertEquals(listOf("nota-edit-2"), outbox.nextBatch(100).map { it.commandId })
    }

    @Test fun stockCompensationWaitsUntilNotaCreateAndDeleteAreAcknowledged() {
        val compensation = SyncCommand(
            commandId = "stock-compensation",
            entityType = "stockMove",
            entityId = "move-1",
            operation = "upsert",
            branchId = "melati",
            occurredAt = 12,
            payload = buildJsonObject {
                put("notaId", "MEL-1")
                put("requiresDeletedNota", true)
            },
        )
        val create = SyncCommand("nota-create", "nota", "MEL-1", "upsert", "melati", 10)
        val delete = SyncCommand("nota-delete", "nota", "MEL-1", "delete", "melati", 11)
        val outbox = SyncOutbox(SyncClientState(pending = listOf(create, delete, compensation), bootstrapped = true))

        assertEquals(listOf("nota-create"), outbox.nextBatch(100).map { it.commandId })
        outbox.acknowledge(setOf("nota-create"), revision = 1)
        assertEquals(listOf("nota-delete"), outbox.nextBatch(100).map { it.commandId })
        outbox.acknowledge(setOf("nota-delete"), revision = 2)
        assertEquals(listOf("stock-compensation"), outbox.nextBatch(100).map { it.commandId })
    }

    @Test fun localEditDuringRemotePersistenceUsesPreparedRemoteAsItsBaseline() {
        val old = listOf(entity("customer", "c-1", value = 1))
        val remote = listOf(entity("customer", "c-1", value = 2))
        val localAfterRemote = listOf(entity("customer", "c-1", value = 3))
        val outbox = SyncOutbox(SyncClientState(shadow = old, bootstrapped = true))
        assertTrue(outbox.prepareRemote(Snapshot(updatedAt = 20), remote, 7, expectedGeneration = 0, scopeKey = "kasir:melati"))

        val commands = outbox.enqueue(localAfterRemote, 21, null, null) { "local-after-remote" }
        assertEquals(listOf("local-after-remote"), commands.map { it.commandId })
        assertEquals("3", commands.single().payload.jsonObject["value"].toString())
        assertTrue(outbox.completePreparedRemote())
        assertEquals(localAfterRemote, outbox.state.shadow)
        assertEquals(listOf("local-after-remote"), outbox.state.pending.map { it.commandId })
        assertEquals(7, outbox.state.revision)
    }

    @Test fun acknowledgedLocalEditIsNotReplacedWhenRemotePersistenceFinishes() {
        val old = listOf(entity("customer", "c-1", value = 1))
        val remote = listOf(entity("customer", "c-1", value = 2))
        val localAfterRemote = listOf(entity("customer", "c-1", value = 3))
        val outbox = SyncOutbox(SyncClientState(shadow = old, bootstrapped = true))
        assertTrue(outbox.prepareRemote(Snapshot(updatedAt = 20), remote, 7, expectedGeneration = 0, scopeKey = "kasir:melati"))
        outbox.enqueue(localAfterRemote, 21, null, null) { "local-after-remote" }
        outbox.acknowledge(setOf("local-after-remote"), revision = 8)

        assertTrue(outbox.state.pending.isEmpty())
        assertTrue(outbox.completePreparedRemote())
        assertEquals(localAfterRemote, outbox.state.shadow)
    }

    @Test fun legacyPreparedMarkerStillCompletesWithItsRemoteShadow() {
        val old = listOf(entity("customer", "c-1", value = 1))
        val remote = listOf(entity("customer", "c-1", value = 2))
        val marker = PendingRemoteApply(Snapshot(updatedAt = 20), remote, revision = 7)
        val outbox = SyncOutbox(SyncClientState(generation = 5, shadow = old, pendingRemote = marker, bootstrapped = true))

        assertTrue(outbox.completePreparedRemote())
        assertEquals(remote, outbox.state.shadow)
    }

    @Test fun notaEditCreatedAfterPreviousAckUsesNewServerVersionWithoutSkippingPullCursor() {
        fun nota(version: Long, value: Int) = SyncEntity(
            "nota", "MEL-1", "melati",
            buildJsonObject { put("id", "MEL-1"); put("branchId", "melati"); put("value", value); put("updatedAtMs", version) },
        )
        val outbox = SyncOutbox(SyncClientState(revision = 4, shadow = listOf(nota(10, 1)), bootstrapped = true))
        outbox.enqueue(listOf(nota(10, 2)), 20, "melati", null) { "nota-edit-1" }
        outbox.acknowledge(setOf("nota-edit-1"), revision = 9, updatedAtByCommand = mapOf("nota-edit-1" to 30L))
        assertEquals(4, outbox.state.revision)

        assertTrue(outbox.acceptRemote(listOf(nota(30, 2)), revision = 9))
        assertEquals(9, outbox.state.revision)

        val localSecondEdit = listOf(nota(30, 3))
        val second = outbox.enqueue(localSecondEdit, 31, "melati", null) { "nota-edit-2" }.single()
        assertEquals(30L, second.expectedUpdatedAt)
    }

    @Test fun nonOwnerSyncScopeIncludesEveryAssignedBranch() {
        val session = Session(Role.Kasir, "Rina", "rina@example.com", "melati", listOf("melati", "cibaduyut"))
        val staff = listOf(Staff("Rina", "RINA@example.com", Role.Kasir, listOf("melati")))
        assertEquals(setOf("melati", "cibaduyut"), allowedSyncBranches(session, staff))
        assertEquals(null, allowedSyncBranches(session.copy(role = Role.Owner), staff))
    }

    @Test fun stableOperationalIdSurvivesCanonicalActorAndSupportsLegacyRows() {
        val legacy = StockMove("hari ini", 10, "Sabun", StockKind.Tambah, 2, "Nama lokal", "melati", "Tambah")
        val legacyId = SyncProjection.entities(Snapshot(stockMoves = listOf(legacy))).single().entityId
        val canonical = legacy.copy(by = "server@example.com", syncId = legacyId)
        assertEquals(legacyId, SyncProjection.entities(Snapshot(stockMoves = listOf(canonical))).single().entityId)
        assertEquals(legacyId, SyncProjection.entities(Snapshot(stockMoves = listOf(legacy))).single().payload.jsonObject["syncId"]?.jsonPrimitive?.content)
    }

    @Test fun localEditGenerationPreventsAnInFlightPullFromApplying() {
        val initial = listOf(entity("customer", "c-1", value = 1))
        val outbox = SyncOutbox(SyncClientState(revision = 4, shadow = initial, bootstrapped = true))
        val generationBeforePull = outbox.state.generation
        outbox.enqueue(listOf(entity("customer", "c-1", value = 2)), 20, null, null) { "edit-during-pull" }

        assertFalse(outbox.canAcceptRemote(generationBeforePull))
        outbox.acknowledge(setOf("edit-during-pull"), revision = 8)
        assertFalse(outbox.canAcceptRemote(generationBeforePull))
        assertEquals(4, outbox.state.revision)
    }

    @Test fun persistedBusinessDataIsPreservedWithoutTrustingDeviceClock() {
        val remote = Snapshot(
            branches = listOf(Branch("melati", "MEL", "Server", "", "")),
            updatedAt = 100,
        )
        val stale = Snapshot(
            branches = listOf(Branch("melati", "MEL", "Lokal lama", "", "")),
            updatedAt = 90,
        )
        val newer = stale.copy(
            branches = listOf(Branch("melati", "MEL", "Edit offline", "", "")),
            updatedAt = 110,
        )

        assertEquals("Lokal lama", SyncProjection.bootstrapSnapshot(remote, stale, preserveLocal = true, updatedAt = 120).branches.single().name)
        assertEquals("Edit offline", SyncProjection.bootstrapSnapshot(remote, newer, preserveLocal = true, updatedAt = 120).branches.single().name)
        assertEquals("Server", SyncProjection.bootstrapSnapshot(remote, newer, preserveLocal = false, updatedAt = 120).branches.single().name)
    }

    @Test fun identicalOperationalEventsKeepDistinctExplicitIds() {
        val first = StockMove("hari ini", 10, "Sabun", StockKind.Tambah, 2, "Rina", "melati", "Tambah", syncId = "event-1")
        val second = first.copy(syncId = "event-2")
        val ids = SyncProjection.entities(Snapshot(stockMoves = listOf(first, second))).map { it.entityId }.toSet()
        assertEquals(setOf("event-1", "event-2"), ids)
    }

    @Test fun preparedRemoteApplySurvivesCrashWithoutCreatingOutboundCommand() {
        val local = Snapshot(customers = listOf(Customer("c-1", "Lama", "", "")), updatedAt = 10)
        val remote = Snapshot(customers = listOf(Customer("c-1", "Baru", "", "")), updatedAt = 20)
        val outbox = SyncOutbox(SyncClientState(revision = 4, shadow = SyncProjection.entities(local), bootstrapped = true, scopeKey = "kasir:melati"))
        assertTrue(outbox.prepareRemote(remote, SyncProjection.entities(remote), 8, outbox.state.generation, "kasir:melati"))

        val encoded = LocalJson.json.encodeToString(SyncClientState.serializer(), outbox.state)
        val recovered = SyncOutbox(LocalJson.json.decodeFromString(SyncClientState.serializer(), encoded))
        assertTrue(recovered.restoreLocal(SyncProjection.entities(remote), 20, "melati", setOf("melati")).isEmpty())
        assertTrue(recovered.completePreparedRemote())
        assertEquals(8, recovered.state.revision)
        assertEquals(SyncProjection.entities(remote), recovered.state.shadow)
        assertTrue(recovered.state.pending.isEmpty())
    }

    @Test fun changedBranchScopeForcesFreshBootstrapOnlyAfterOutboxIsClear() {
        val outbox = SyncOutbox(SyncClientState(revision = 9, shadow = listOf(entity("customer", "c-1")), bootstrapped = true, scopeKey = "kasir:melati"))
        assertTrue(outbox.resetForScope("kasir:melati,cibaduyut"))
        assertEquals(0, outbox.state.revision)
        assertFalse(outbox.state.bootstrapped)
        assertEquals("kasir:melati,cibaduyut", outbox.state.scopeKey)

        outbox.beginFromEmptyRemote(outbox.state.scopeKey)
        outbox.enqueue(listOf(entity("expense", "e-1", "melati")), 10, "melati", null) { "pending" }
        assertFalse(outbox.resetForScope("kasir:melati"))
    }

    @Test fun legacyBlankScopeCanBeResetBeforeTrustingItsOldCursor() {
        val legacy = SyncOutbox(SyncClientState(revision = 99, shadow = listOf(entity("expense", "old", "melati")), bootstrapped = true))
        assertEquals("", legacy.state.scopeKey)
        assertTrue(legacy.resetForScope("kasir:cibaduyut"))
        assertEquals(0, legacy.state.revision)
        assertFalse(legacy.state.bootstrapped)
    }

    /**
     * Snapshot non-Owner tidak memuat master data tingkat organisasi, dan selisih itu TIDAK boleh
     * dibaca sebagai penghapusan.
     *
     * Insiden nyata: login sebagai Supervisor menghasilkan enam `assetType.delete` (semua jenis
     * aset organisasi) karena `asset_types` tidak punya kolom cabang sehingga tidak ikut disaring.
     * Perintah itu diterima Worker pada saat itu dan akan menghapus jenis aset untuk semua cabang.
     */
    @Test fun nonOwnerTidakMenyimpulkanDeleteUntukEntitasTanpaCabang() {
        val outbox = SyncOutbox(
            SyncClientState(
                revision = 5,
                shadow = listOf(entity("assetType", "at-setrika"), entity("expense", "e-1", "melati")),
                bootstrapped = true,
                scopeKey = "supervisor:melati",
            ),
        )
        // Snapshot Supervisor hanya memuat entitas bercabang; jenis aset tidak ada di dalamnya.
        val dibuat = outbox.enqueue(
            listOf(entity("expense", "e-1", "melati", value = 2)),
            10,
            "melati",
            setOf("melati"),
            Role.Supervisor,
        )
        assertEquals(listOf("expense.upsert"), dibuat.map { it.entityType + "." + it.operation })
    }

    /** Owner tetap boleh menghapus master data organisasi: aturan di atas hanya menahan non-Owner. */
    @Test fun ownerTetapMenyimpulkanDeleteUntukEntitasTanpaCabang() {
        val outbox = SyncOutbox(
            SyncClientState(
                revision = 5,
                shadow = listOf(entity("assetType", "at-setrika")),
                bootstrapped = true,
                scopeKey = "owner",
            ),
        )
        val dibuat = outbox.enqueue(emptyList(), 10, null, null, Role.Owner)
        assertEquals(listOf("assetType.delete"), dibuat.map { it.entityType + "." + it.operation })
    }

    /**
     * Perintah tertahan dari sesi lain dibuang sebelum terkirim, bukan menunggu terkirim.
     *
     * Insiden nyata: enam `assetType.delete` tertinggal di antrean setelah berpindah dari Owner ke
     * Supervisor. Tanpa aturan ini perintah itu terkirim pada sync berikutnya, dan pada saat itu
     * `assetType.delete` belum Owner-only di Worker sehingga diterima.
     */
    @Test fun perintahDeleteTanpaCabangDibuangSaatAktorBukanOwner() {
        val outbox = SyncOutbox(
            SyncClientState(
                revision = 5,
                shadow = listOf(entity("assetType", "at-setrika"), entity("assetType", "at-mesin-cuci")),
                bootstrapped = true,
                scopeKey = "owner",
            ),
        )
        // Owner menghapus dua jenis aset: perintahnya sah saat itu.
        outbox.enqueue(emptyList(), 10, null, null, Role.Owner)
        assertEquals(2, outbox.state.pending.size)

        // Akun berganti ke Supervisor sebelum perintah sempat terkirim.
        val dibuang = outbox.buangYangTidakBerhak(Role.Supervisor)
        assertEquals(2, dibuang)
        assertTrue(outbox.state.pending.isEmpty())
        assertEquals(2, outbox.state.rejected.size)
    }

    /** Owner tidak kehilangan perintah sahnya sendiri. */
    @Test fun ownerTidakMembuangPerintahDeleteTanpaCabang() {
        val outbox = SyncOutbox(
            SyncClientState(
                revision = 5,
                shadow = listOf(entity("assetType", "at-setrika")),
                bootstrapped = true,
                scopeKey = "owner",
            ),
        )
        outbox.enqueue(emptyList(), 10, null, null, Role.Owner)
        assertEquals(0, outbox.buangYangTidakBerhak(Role.Owner))
        assertEquals(1, outbox.state.pending.size)
    }

    /** Bila shadow benar-benar diganti, kursor memang harus maju. */
    @Test fun kursorMajuBilaShadowDiganti() {
        val outbox = SyncOutbox(SyncClientState(revision = 4, shadow = listOf(entity("customer", "c-1")), bootstrapped = true, scopeKey = "kasir:melati"))
        val remote = listOf(entity("customer", "c-1", value = 2))
        assertTrue(outbox.prepareRemote(Snapshot(updatedAt = 20), remote, 9, outbox.state.generation, "kasir:melati"))
        assertTrue(outbox.completePreparedRemote())
        assertEquals(9, outbox.state.revision)
        assertEquals(remote, outbox.state.shadow)
    }
}
