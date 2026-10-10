package com.cuciin.laundryops.data

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OutboxAccountTest {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val legacy = """{"commandId":"widad-1","entityType":"nota","entityId":"BUN-1","operation":"upsert","branchId":"bunayya","occurredAt":10}"""

    @Test fun foreignPendingBlocksSameBranchWithoutRemovingCommands() {
        val command = json.decodeFromString(SyncCommand.serializer(), legacy.dropLast(1) + """, "actorEmail":"widad@example.com"}""")
        val outbox = SyncOutbox(SyncClientState(pending = listOf(command)))
        assertTrue(outbox.blockedActor("aida@example.com"))
        assertFalse(outbox.blockedActor("widad@example.com"))
        assertEquals(listOf(command), outbox.state.pending)
    }

    @Test fun enqueuePersistsAuthorAcrossRestart() {
        val outbox = SyncOutbox()
        val entity = SyncEntity("nota", "BUN-1", "bunayya", kotlinx.serialization.json.JsonPrimitive("nota"))
        outbox.enqueue(listOf(entity), 10, "bunayya", null, Role.Kasir, " WIDAD@example.com ") { "widad-1" }
        val restarted = SyncOutbox(json.decodeFromString(SyncClientState.serializer(), json.encodeToString(SyncClientState.serializer(), outbox.state)))
        assertEquals("widad@example.com", restarted.state.pending.single().actorEmail)
        assertFalse(restarted.blockedActor("widad@example.com"))
        assertTrue(restarted.blockedActor("aida@example.com"))
    }

    @Test fun legacyOwnershipUsesPersistedOriginOnly() {
        val command = json.decodeFromString(SyncCommand.serializer(), legacy)
        val outbox = SyncOutbox(SyncClientState(pending = listOf(command), scopeKey = "kasir:widad@example.com:bunayya"))
        outbox.migrateLegacyActor(null)
        assertEquals("widad@example.com", outbox.state.pending.single().actorEmail)
        assertTrue(outbox.blockedActor("aida@example.com"))
    }

    @Test fun cannotAppendAnotherActorToExistingQueue() {
        val outbox = SyncOutbox()
        val first = SyncEntity("nota", "BUN-1", "bunayya", kotlinx.serialization.json.JsonPrimitive("first"))
        outbox.enqueue(listOf(first), 10, "bunayya", null, actorEmail = "widad@example.com")
        val before = outbox.state
        val changed = first.copy(payload = kotlinx.serialization.json.JsonPrimitive("changed"))
        assertTrue(outbox.enqueue(listOf(changed), 11, "bunayya", null, actorEmail = "aida@example.com").isEmpty())
        assertEquals(before, outbox.state)
    }

    @Test fun emptyJournalRepairsStockFromAuthorizedSnapshot() {
        val stale = Snapshot(
            branchStocks = listOf(BranchStock("bunayya", "sabun", 1), BranchStock("other", "sabun", 9)),
            inventory = listOf(InventoryItem("asset", "bunayya", "Sabun", InventoryCategory.BahanHabisPakai, quantity = 1)),
        )
        val server = stale.copy(
            branchStocks = listOf(BranchStock("bunayya", "sabun", 68)),
            inventory = stale.inventory.map { it.copy(quantity = 66) },
        )
        val result = SyncProjection.samakanHakAkses(SyncProjection.apply(stale, emptyList(), 20), server)
        assertEquals(server.branchStocks, result.branchStocks)
        assertEquals(server.inventory, result.inventory)
        val deleted = SyncProjection.samakanHakAkses(result, server.copy(branchStocks = emptyList(), inventory = emptyList()))
        assertTrue(deleted.branchStocks.isEmpty())
        assertTrue(deleted.inventory.isEmpty())
    }

    @Test fun pendingStockPreventsAuthoritativeRemoteApply() {
        val outbox = SyncOutbox()
        val entity = SyncEntity("branchStock", "bunayya:sabun", "bunayya", kotlinx.serialization.json.JsonPrimitive(67))
        outbox.enqueue(listOf(entity), 10, "bunayya", null, actorEmail = "widad@example.com")
        val before = outbox.state
        assertFalse(outbox.canAcceptRemote(before.generation))
        assertFalse(outbox.prepareRemote(Snapshot(), emptyList(), 20, before.generation, "kasir:widad@example.com:bunayya"))
        assertEquals(before, outbox.state)
    }

    @Test fun unknownOriginCannotBeAdoptedByCurrentAccount() {
        val command = json.decodeFromString(SyncCommand.serializer(), legacy)
        val outbox = SyncOutbox(SyncClientState(pending = listOf(command), scopeKey = "owner"))
        outbox.migrateLegacyActor(null)
        assertTrue(outbox.blockedActor("owner@example.com"))
        assertEquals(listOf(command), outbox.state.pending)
    }

    @Test fun snapshotOriginTagsOnlyLegacyCommands() {
        val old = json.decodeFromString(SyncCommand.serializer(), legacy)
        val tagged = old.copy(commandId = "tagged", actorEmail = "owner@example.com")
        val outbox = SyncOutbox(SyncClientState(pending = listOf(old, tagged), scopeKey = "owner"))
        outbox.migrateLegacyActor(" WIDAD@example.com ")
        assertEquals(listOf("", "owner@example.com"), outbox.state.pending.map { it.actorEmail })
    }

    @Test fun conflictingLegacyEvidenceRemainsBlocked() {
        val old = json.decodeFromString(SyncCommand.serializer(), legacy)
        val outbox = SyncOutbox(SyncClientState(pending = listOf(old), scopeKey = "kasir:widad@example.com:bunayya"))
        outbox.migrateLegacyActor("aida@example.com")
        assertEquals(listOf(old), outbox.state.pending)
        assertTrue(outbox.blockedActor("widad@example.com"))
        assertTrue(outbox.blockedActor("aida@example.com"))
    }

    @Test fun ownerSwitchBlockedUntilOriginalAuthorAcknowledged() {
        val outbox = SyncOutbox()
        val entity = SyncEntity("nota", "BUN-1", "bunayya", kotlinx.serialization.json.JsonPrimitive("nota"))
        outbox.enqueue(listOf(entity), 10, "bunayya", null, Role.Owner, "owner@example.com") { "owner-command" }
        assertTrue(outbox.blockedActor("widad@example.com"))
        assertFalse(outbox.blockedActor("OWNER@example.com"))
        outbox.acknowledge(setOf("owner-command"), 50)
        assertFalse(outbox.blockedActor("widad@example.com"))
        assertFalse(outbox.blockedActor(null))
        assertEquals(0L, outbox.state.revision)
    }

    @Test fun restoreAndBootstrapTagOriginalAuthor() {
        val entity = SyncEntity("nota", "BUN-1", "bunayya", kotlinx.serialization.json.JsonPrimitive("nota"))
        val restored = SyncOutbox(SyncClientState(bootstrapped = true))
        assertEquals("widad@example.com", restored.restoreLocal(listOf(entity), 10, "bunayya", null,
            actorEmail = "widad@example.com").single().actorEmail)
        val bootstrap = SyncOutbox()
        assertEquals("widad@example.com", bootstrap.reconcileBootstrap(emptyList(), listOf(entity), 1, 10,
            "bunayya", null, actorEmail = "widad@example.com").single().actorEmail)
    }

    @Test fun oldPositionalCommandIdCallsRemainCompatible() {
        val entity = SyncEntity("nota", "BUN-1", "bunayya", kotlinx.serialization.json.JsonPrimitive("nota"))
        assertEquals("old-enqueue", SyncOutbox().enqueue(listOf(entity), 10, "bunayya", null, Role.Kasir, { "old-enqueue" }).single().commandId)
        assertEquals("old-restore", SyncOutbox(SyncClientState(bootstrapped = true)).restoreLocal(
            listOf(entity), 10, "bunayya", null, Role.Kasir, { "old-restore" }).single().commandId)
        assertEquals("old-bootstrap", SyncOutbox().reconcileBootstrap(emptyList(), listOf(entity), 1, 10,
            "bunayya", null, Role.Kasir, "kasir:widad@example.com:bunayya", { "old-bootstrap" }).single().commandId)
    }

    @Test fun ownerLegacyOriginSurvivesUpgradeAndRestart() {
        val command = json.decodeFromString(SyncCommand.serializer(), legacy)
        val outbox = SyncOutbox(SyncClientState(pending = listOf(command), scopeKey = "owner"))
        outbox.migrateLegacyActor("owner@example.com")
        val restarted = SyncOutbox(json.decodeFromString(SyncClientState.serializer(), json.encodeToString(SyncClientState.serializer(), outbox.state)))
        restarted.migrateLegacyActor("other@example.com")
        assertEquals("owner@example.com", restarted.state.pending.single().actorEmail)
        assertFalse(restarted.blockedActor("owner@example.com"))
        assertTrue(restarted.blockedActor("other@example.com"))
    }

    @Test fun unknownLegacyCannotBeAdoptedAfterLoginAndRestart() {
        val command = json.decodeFromString(SyncCommand.serializer(), legacy)
        val outbox = SyncOutbox(SyncClientState(pending = listOf(command), scopeKey = "owner"))
        outbox.migrateLegacyActor(null)
        val restarted = SyncOutbox(json.decodeFromString(SyncClientState.serializer(), json.encodeToString(SyncClientState.serializer(), outbox.state)))
        restarted.migrateLegacyActor("other@example.com")
        assertEquals(listOf(command), restarted.state.pending)
        assertTrue(restarted.blockedActor("other@example.com"))
    }

    @Test fun unknownAndRejectedPreventEveryRemoteRecoveryWithoutDataLoss() {
        val command = json.decodeFromString(SyncCommand.serializer(), legacy)
        val outbox = SyncOutbox(SyncClientState(pending = listOf(command), rejected = listOf(RejectedSyncCommand(command.copy(commandId = "rejected"), "denied", 1))))
        val before = outbox.state
        assertFalse(outbox.reconcileRejectedRemote(Snapshot(), emptyList(), 5, "owner"))
        assertFalse(outbox.resetForScope("owner"))
        assertFalse(outbox.acceptRemote(emptyList(), 5))
        assertFalse(outbox.prepareRemote(Snapshot(), emptyList(), 5, before.generation, "owner"))
        assertEquals(before, outbox.state)
    }

    @Test fun persistedCommandsKeepActorAndReadLegacy() {
        val tagged = legacy.dropLast(1) + """, "actorEmail":"widad@example.com"}"""
        val command = json.decodeFromString(SyncCommand.serializer(), tagged)
        assertTrue(json.encodeToString(SyncCommand.serializer(), command).contains("widad@example.com"))
        assertEquals("widad-1", json.decodeFromString(SyncCommand.serializer(), legacy).commandId)
    }
}
