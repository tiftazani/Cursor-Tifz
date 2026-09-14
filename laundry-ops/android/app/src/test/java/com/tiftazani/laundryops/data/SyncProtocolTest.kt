package com.tiftazani.laundryops.data

import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SyncProtocolTest {
    private fun entity(type: String, id: String, branch: String? = null, value: Int = 1) =
        SyncEntity(type, id, branch, buildJsonObject { put("id", id); put("value", value) })

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
        assertEquals(9, outbox.state.revision)
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
        assertEquals(7, restored.revision)
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
}
