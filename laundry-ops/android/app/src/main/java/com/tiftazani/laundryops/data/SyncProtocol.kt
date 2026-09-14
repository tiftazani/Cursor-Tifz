package com.tiftazani.laundryops.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.intOrNull
import java.security.MessageDigest
import java.util.UUID

@Serializable
data class SyncCommand(
    val commandId: String,
    val entityType: String,
    val entityId: String,
    val operation: String,
    val branchId: String? = null,
    val occurredAt: Long,
    val expectedUpdatedAt: Long? = null,
    val payload: JsonElement = JsonNull,
)

@Serializable
data class SyncCommandBatch(val commands: List<SyncCommand>)

@Serializable
data class SyncCommandResult(
    val commandId: String,
    val status: String = "",
    val accepted: Boolean? = null,
    val code: JsonElement = JsonNull,
    val error: String? = null,
    val message: String? = null,
    val detail: JsonElement = JsonNull,
    val updatedAt: Long? = null,
)

@Serializable
data class SyncCommandResponse(
    val revision: Long = 0,
    val acknowledgedCommandIds: List<String> = emptyList(),
    val ackedCommandIds: List<String> = emptyList(),
    val acceptedCommandIds: List<String> = emptyList(),
    val results: List<SyncCommandResult> = emptyList(),
    val commandId: String? = null,
    val error: String? = null,
    val message: String? = null,
    val detail: JsonElement = JsonNull,
) {
    fun acknowledged(): Set<String> = buildSet {
        addAll(acknowledgedCommandIds)
        addAll(ackedCommandIds)
        addAll(acceptedCommandIds)
        results.filter { it.accepted == true || it.status.lowercase() in setOf("accepted", "applied", "duplicate", "ok") }
            .forEach { add(it.commandId) }
    }

    fun rejected(): Map<String, String> = results.mapNotNull { result ->
        val status = result.status.lowercase()
        val retryable = status in setOf("retry", "retryable", "temporary", "unavailable")
        val rejected = !retryable && (result.accepted == false || status in setOf("rejected", "conflict", "invalid", "forbidden", "failed"))
        if (!rejected) null else result.commandId to result.reason()
    }.toMap()

    fun topLevelReason(): String = listOfNotNull(error, message, detail.takeUnless { it is JsonNull }?.toString())
        .filter { it.isNotBlank() }.joinToString(" · ").ifBlank { "Command ditolak server" }.take(500)
}

private fun SyncCommandResult.reason(): String =
    listOfNotNull(
        error,
        message,
        status.takeIf { it.isNotBlank() },
        code.takeUnless { it is JsonNull }?.toString(),
        detail.takeUnless { it is JsonNull }?.toString(),
    ).filter { it.isNotBlank() }.joinToString(" · ").ifBlank { "Command ditolak server" }.take(500)

@Serializable
data class SyncChange(
    val revision: Long = 0,
    val entityType: String,
    val entityId: String,
    val operation: String,
    val branchId: String? = null,
    val payload: JsonElement = JsonNull,
)

@Serializable
data class SyncChangesResponse(
    val revision: Long = 0,
    val nextRevision: Long = 0,
    val latestRevision: Long = 0,
    val hasMore: Boolean = false,
    val scopeKey: String = "",
    val changes: List<SyncChange> = emptyList(),
) {
    fun cursor(): Long = maxOf(revision, nextRevision, latestRevision.takeUnless { hasMore } ?: 0)
}

@Serializable
data class SyncEntity(
    val entityType: String,
    val entityId: String,
    val branchId: String? = null,
    val payload: JsonElement,
) {
    val key: String get() = "$entityType\u0000$entityId"
}

@Serializable
data class SyncClientState(
    val revision: Long = 0,
    val generation: Long = 0,
    val shadow: List<SyncEntity> = emptyList(),
    val pending: List<SyncCommand> = emptyList(),
    val rejected: List<RejectedSyncCommand> = emptyList(),
    val bootstrapped: Boolean = false,
    val scopeKey: String = "",
    val pendingRemote: PendingRemoteApply? = null,
)

@Serializable
data class PendingRemoteApply(
    val snapshot: Snapshot,
    val entities: List<SyncEntity>,
    val revision: Long,
    val scopeKey: String = "",
)

@Serializable
data class RejectedSyncCommand(
    val command: SyncCommand,
    val reason: String,
    val rejectedAt: Long,
)

/** Pure state machine so queue durability and acknowledgement rules can be unit tested. */
class SyncOutbox(initial: SyncClientState = SyncClientState()) {
    var state: SyncClientState = initial
        private set

    fun initialize(entities: List<SyncEntity>): Boolean {
        if (state.shadow.isNotEmpty() || state.pending.isNotEmpty()) return false
        state = state.copy(shadow = entities)
        return true
    }

    fun restoreLocal(
        entities: List<SyncEntity>,
        occurredAt: Long,
        defaultBranchId: String?,
        allowedBranchIds: Set<String>?,
        actorRole: Role? = null,
        commandId: () -> String = { UUID.randomUUID().toString() },
    ): List<SyncCommand> {
        if (state.pendingRemote != null) return emptyList()
        if (!state.bootstrapped) {
            initialize(entities)
            return emptyList()
        }
        val newestPendingAt = state.pending.maxOfOrNull { it.occurredAt } ?: Long.MIN_VALUE
        if (state.pending.isNotEmpty() && occurredAt <= newestPendingAt) return emptyList()
        return enqueue(entities, occurredAt, defaultBranchId, allowedBranchIds, actorRole, commandId)
    }

    fun enqueue(
        entities: List<SyncEntity>,
        occurredAt: Long,
        defaultBranchId: String?,
        allowedBranchIds: Set<String>?,
        actorRole: Role? = null,
        commandId: () -> String = { UUID.randomUUID().toString() },
    ): List<SyncCommand> {
        val before = state.shadow.associateBy { it.key }
        val after = entities.associateBy { it.key }
        val created = mutableListOf<SyncCommand>()

        (before.keys + after.keys).sorted().forEach { key ->
            val old = before[key]
            val current = after[key]
            if (old?.payload == current?.payload && old?.branchId == current?.branchId) return@forEach
            val source = current ?: old ?: return@forEach
            val branch = source.branchId ?: defaultBranchId
            if (allowedBranchIds != null && branch != null && branch !in allowedBranchIds) return@forEach
            var payload = if (source.entityType == "branchStock" && current?.payload is JsonObject) {
                val oldStock = (old?.payload as? JsonObject)?.get("stock")?.jsonPrimitive?.intOrNull ?: 0
                val newStock = current.payload["stock"]?.jsonPrimitive?.intOrNull ?: 0
                JsonObject(current.payload + mapOf(
                    "syncBaseStock" to JsonPrimitive(oldStock),
                    "syncDelta" to JsonPrimitive(newStock - oldStock),
                ))
            } else current?.payload ?: JsonNull
            if (source.entityType == "nota" && current != null && payload is JsonObject && actorRole == Role.Supervisor && statusOnly(old?.payload, current.payload)) {
                payload = JsonObject(payload + ("syncIntent" to JsonPrimitive("status")))
            }
            val expectedUpdatedAt = (old?.payload as? JsonObject)
                ?.get("updatedAtMs")?.jsonPrimitive?.content?.toLongOrNull()?.takeIf { it > 0 }
            created += SyncCommand(
                commandId = commandId(),
                entityType = source.entityType,
                entityId = source.entityId,
                operation = if (current == null) "delete" else "upsert",
                branchId = branch,
                occurredAt = occurredAt,
                expectedUpdatedAt = expectedUpdatedAt,
                payload = payload,
            )
        }
        state = state.copy(
            generation = if (created.isEmpty()) state.generation else state.generation + 1,
            shadow = entities,
            pending = state.pending + created,
        )
        return created
    }

    fun acknowledge(commandIds: Set<String>, revision: Long): Int {
        return acknowledge(commandIds, revision, emptyMap())
    }

    fun acknowledge(commandIds: Set<String>, revision: Long, updatedAtByCommand: Map<String, Long>): Int {
        if (commandIds.isEmpty()) return 0
        val pending = state.pending
        val known = pending.mapTo(hashSetOf()) { it.commandId }
        val accepted = commandIds.intersect(known)
        if (accepted.isEmpty()) return 0
        val acceptedCommands = pending.filter { it.commandId in accepted }
        val remaining = pending.filterNot { it.commandId in accepted }.map { command ->
            val predecessor = acceptedCommands.lastOrNull {
                it.entityType == command.entityType && it.entityId == command.entityId
            } ?: return@map command
            val serverUpdatedAt = updatedAtByCommand[predecessor.commandId] ?: return@map command
            command.copy(
                expectedUpdatedAt = serverUpdatedAt,
                payload = if (command.entityType == "nota" && command.payload is JsonObject) {
                    JsonObject(command.payload + ("updatedAtMs" to JsonPrimitive(serverUpdatedAt)))
                } else command.payload,
            )
        }
        val acknowledgedNotaVersions = acceptedCommands.mapNotNull { command ->
            updatedAtByCommand[command.commandId]?.takeIf { command.entityType == "nota" }
                ?.let { "${command.entityType}\u0000${command.entityId}" to it }
        }.toMap()
        val shadow = state.shadow.map { entity ->
            val serverUpdatedAt = acknowledgedNotaVersions[entity.key]
            if (serverUpdatedAt == null || entity.payload !is JsonObject) entity
            else entity.copy(payload = JsonObject(entity.payload + ("updatedAtMs" to JsonPrimitive(serverUpdatedAt))))
        }
        state = state.copy(
            shadow = shadow,
            pending = remaining,
        )
        return accepted.size
    }

    fun nextBatch(limit: Int): List<SyncCommand> {
        val entities = hashSetOf<String>()
        return state.pending.filter { entities.add("${it.entityType}\u0000${it.entityId}") }.take(limit)
    }

    fun reject(reasons: Map<String, String>, rejectedAt: Long, limit: Int = 200): Int {
        if (reasons.isEmpty()) return 0
        val doomed = state.pending.filter { it.commandId in reasons }
        if (doomed.isEmpty()) return 0
        val evidence = doomed.map { RejectedSyncCommand(it, reasons[it.commandId].orEmpty().ifBlank { "Command ditolak server" }, rejectedAt) }
        state = state.copy(
            pending = state.pending.filterNot { it.commandId in reasons },
            rejected = (state.rejected + evidence).takeLast(limit),
        )
        return doomed.size
    }

    fun acceptRemote(entities: List<SyncEntity>, revision: Long, scopeKey: String = ""): Boolean {
        if (state.pending.isNotEmpty() || state.pendingRemote != null) return false
        state = state.copy(revision = maxOf(state.revision, revision), shadow = entities, scopeKey = scopeKey.ifBlank { state.scopeKey })
        return true
    }

    fun prepareRemote(snapshot: Snapshot, entities: List<SyncEntity>, revision: Long, expectedGeneration: Long, scopeKey: String): Boolean {
        if (!canAcceptRemote(expectedGeneration)) return false
        state = state.copy(pendingRemote = PendingRemoteApply(snapshot, entities, revision, scopeKey))
        return true
    }

    fun prepareBootstrapRemote(snapshot: Snapshot, entities: List<SyncEntity>, revision: Long, scopeKey: String) {
        require(state.pending.isEmpty())
        state = state.copy(pendingRemote = PendingRemoteApply(snapshot, entities, revision, scopeKey))
    }

    fun completePreparedRemote(): Boolean {
        val prepared = state.pendingRemote ?: return false
        state = state.copy(
            revision = maxOf(state.revision, prepared.revision),
            shadow = prepared.entities,
            scopeKey = prepared.scopeKey.ifBlank { state.scopeKey },
            pendingRemote = null,
            bootstrapped = true,
        )
        return true
    }

    fun acceptRemoteIfUnchanged(entities: List<SyncEntity>, revision: Long, expectedLocal: List<SyncEntity>): Boolean {
        if (state.pending.isNotEmpty() || state.shadow != expectedLocal) return false
        state = state.copy(revision = maxOf(state.revision, revision), shadow = entities)
        return true
    }

    fun canAcceptRemote(expectedGeneration: Long): Boolean =
        state.pending.isEmpty() && state.pendingRemote == null && state.generation == expectedGeneration

    fun completeBootstrap(entities: List<SyncEntity>, revision: Long = 0, scopeKey: String = "") {
        require(state.pending.isEmpty())
        state = state.copy(revision = revision, shadow = entities, bootstrapped = true, scopeKey = scopeKey)
    }

    fun beginFromEmptyRemote(scopeKey: String = "") {
        require(state.pending.isEmpty())
        state = state.copy(revision = 0, shadow = emptyList(), bootstrapped = true, scopeKey = scopeKey)
    }

    fun reconcileBootstrap(
        remote: List<SyncEntity>,
        desired: List<SyncEntity>,
        revision: Long,
        occurredAt: Long,
        defaultBranchId: String?,
        allowedBranchIds: Set<String>?,
        actorRole: Role? = null,
        scopeKey: String = "",
        commandId: () -> String = { UUID.randomUUID().toString() },
    ): List<SyncCommand> {
        require(state.pending.isEmpty())
        state = state.copy(revision = revision, shadow = remote, bootstrapped = true, scopeKey = scopeKey)
        return enqueue(desired, occurredAt, defaultBranchId, allowedBranchIds, actorRole, commandId)
    }

    fun resetForScope(scopeKey: String): Boolean {
        if (state.pending.isNotEmpty() || state.pendingRemote != null) return false
        state = state.copy(revision = 0, shadow = emptyList(), bootstrapped = false, scopeKey = scopeKey)
        return true
    }

    fun acceptLegacySnapshot(entities: List<SyncEntity>) {
        state = state.copy(shadow = entities, pending = emptyList(), bootstrapped = true)
    }

    private fun statusOnly(old: JsonElement?, current: JsonElement): Boolean {
        val previous = old as? JsonObject ?: return false
        val next = current as? JsonObject ?: return false
        val ignored = setOf("laundry", "completedAt", "updatedAtMs")
        return (previous.keys + next.keys).all { key -> key in ignored || previous[key] == next[key] }
    }
}

object SyncProjection {
    private data class Spec(val field: String, val id: (JsonObject) -> String, val branch: (JsonObject) -> String?)

    private fun text(name: String): (JsonObject) -> String = { it[name]?.jsonPrimitive?.content.orEmpty() }
    private val specs = mapOf(
        "branch" to Spec("branches", text("id"), text("id")),
        "staff" to Spec("staff", { text("email")(it).lowercase() }, { null }),
        "customer" to Spec("customers", text("id"), { null }),
        "service" to Spec("services", text("id"), { null }),
        "product" to Spec("products", { text("id")(it).ifBlank { text("name")(it) } }, { null }),
        "branchStock" to Spec("branchStocks", { "${text("branchId")(it)}:${text("productKey")(it)}" }, text("branchId")),
        "inventory" to Spec("inventory", text("id"), text("branchId")),
        "expense" to Spec("expenses", text("id"), text("branchId")),
        "nota" to Spec("notas", text("id"), text("branchId")),
        "stockMove" to Spec("stockMoves", { syncIdOrLegacyHash(it) }, text("branchId")),
        "audit" to Spec("audit", { syncIdOrLegacyHash(it) }, text("branchId")),
        "cashClose" to Spec("cashCloses", text("id"), text("branchId")),
        "attendance" to Spec("attendance", text("id"), text("branchId")),
    )

    fun entities(snapshot: Snapshot): List<SyncEntity> {
        val root = LocalJson.json.encodeToJsonElement(Snapshot.serializer(), snapshot).jsonObject
        return specs.flatMap { (type, spec) ->
            (root[spec.field] as? JsonArray).orEmpty().mapNotNull { element ->
                val obj = element as? JsonObject ?: return@mapNotNull null
                val id = spec.id(obj)
                val cloudPayload = when (type) {
                    "nota" -> JsonObject(obj + ("photos" to JsonArray(emptyList())))
                    "stockMove", "audit" -> JsonObject(obj + ("syncId" to JsonPrimitive(id)))
                    else -> obj
                }
                if (id.isBlank()) null else SyncEntity(type, id, spec.branch(obj)?.ifBlank { null }, cloudPayload)
            }
        }.sortedBy { it.key }
    }

    fun apply(snapshot: Snapshot, changes: List<SyncChange>, updatedAt: Long): Snapshot {
        val root = LocalJson.json.encodeToJsonElement(Snapshot.serializer(), snapshot).jsonObject.toMutableMap()
        changes.forEach { change ->
            val spec = specs[change.entityType] ?: return@forEach
            val rows = (root[spec.field] as? JsonArray).orEmpty().toMutableList()
            rows.removeAll { row -> (row as? JsonObject)?.let(spec.id) == change.entityId }
            if (change.operation.lowercase() != "delete" && change.payload is JsonObject) rows += change.payload
            root[spec.field] = JsonArray(rows)
        }
        root["updatedAt"] = JsonPrimitive(updatedAt)
        return LocalJson.json.decodeFromJsonElement(Snapshot.serializer(), JsonObject(root))
    }

    fun reconcileBootstrap(remote: Snapshot, local: Snapshot, updatedAt: Long): Snapshot {
        val remoteEntities = entities(remote).associateBy { it.key }
        val localEntities = entities(local).associateBy { it.key }
        val changes = localEntities.values.mapNotNull { entity ->
            if (remoteEntities[entity.key] == entity) null
            else SyncChange(
                entityType = entity.entityType,
                entityId = entity.entityId,
                operation = "upsert",
                branchId = entity.branchId,
                payload = entity.payload,
            )
        }.toMutableList()
        remoteEntities.values.filter { it.entityType == "nota" && it.entityId in local.deletedNotaIds }
            .forEach { entity ->
                changes += SyncChange(
                    entityType = entity.entityType,
                    entityId = entity.entityId,
                    operation = "delete",
                    branchId = entity.branchId,
                )
            }
        return apply(remote, changes, updatedAt).copy(
            deletedNotaIds = (remote.deletedNotaIds + local.deletedNotaIds).distinct(),
        )
    }

    fun bootstrapSnapshot(remote: Snapshot, local: Snapshot, preserveLocal: Boolean, updatedAt: Long): Snapshot =
        if (preserveLocal) reconcileBootstrap(remote, local, updatedAt)
        else remote.copy(updatedAt = updatedAt)

    private fun stableId(value: JsonObject): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(value.toString().toByteArray())
        return digest.take(16).joinToString("") { "%02x".format(it) }
    }

    private fun syncIdOrLegacyHash(value: JsonObject): String =
        value["syncId"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
            ?: stableId(JsonObject(value.filterKeys { it != "syncId" }))
}

internal fun allowedSyncBranches(session: Session?, staff: List<Staff>): Set<String>? {
    if (session == null || session.role == Role.Owner) return null
    return staff.firstOrNull { it.email.equals(session.email, ignoreCase = true) }
        ?.branchIds?.toSet()?.takeIf { it.isNotEmpty() }
        ?: setOf(session.branchId)
}
