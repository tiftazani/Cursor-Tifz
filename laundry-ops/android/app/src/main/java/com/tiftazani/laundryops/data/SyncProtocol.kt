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
    val shadow: List<SyncEntity> = emptyList(),
    val pending: List<SyncCommand> = emptyList(),
    val rejected: List<RejectedSyncCommand> = emptyList(),
    val bootstrapped: Boolean = false,
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
        state = state.copy(shadow = entities, pending = state.pending + created)
        return created
    }

    fun acknowledge(commandIds: Set<String>, revision: Long): Int {
        if (commandIds.isEmpty()) return 0
        val known = state.pending.mapTo(hashSetOf()) { it.commandId }
        val accepted = commandIds.intersect(known)
        if (accepted.isEmpty()) return 0
        state = state.copy(
            revision = maxOf(state.revision, revision),
            pending = state.pending.filterNot { it.commandId in accepted },
        )
        return accepted.size
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

    fun acceptRemote(entities: List<SyncEntity>, revision: Long): Boolean {
        if (state.pending.isNotEmpty()) return false
        state = state.copy(revision = maxOf(state.revision, revision), shadow = entities)
        return true
    }

    fun completeBootstrap(entities: List<SyncEntity>, revision: Long = 0) {
        require(state.pending.isEmpty())
        state = state.copy(revision = revision, shadow = entities, bootstrapped = true)
    }

    fun beginFromEmptyRemote() {
        require(state.pending.isEmpty())
        state = state.copy(revision = 0, shadow = emptyList(), bootstrapped = true)
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
        "stockMove" to Spec("stockMoves", { stableId(it) }, text("branchId")),
        "audit" to Spec("audit", { stableId(it) }, text("branchId")),
        "cashClose" to Spec("cashCloses", text("id"), text("branchId")),
        "attendance" to Spec("attendance", text("id"), text("branchId")),
    )

    fun entities(snapshot: Snapshot): List<SyncEntity> {
        val root = LocalJson.json.encodeToJsonElement(Snapshot.serializer(), snapshot).jsonObject
        return specs.flatMap { (type, spec) ->
            (root[spec.field] as? JsonArray).orEmpty().mapNotNull { element ->
                val obj = element as? JsonObject ?: return@mapNotNull null
                val id = spec.id(obj)
                val cloudPayload = if (type == "nota") JsonObject(obj + ("photos" to JsonArray(emptyList()))) else obj
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

    private fun stableId(value: JsonObject): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(value.toString().toByteArray())
        return digest.take(16).joinToString("") { "%02x".format(it) }
    }
}
