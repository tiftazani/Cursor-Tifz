package com.cuciin.laundryops.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.longOrNull
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
    val actorEmail: String = "",
)

@Serializable
data class SyncCommandBatch(val commands: List<SyncCommand>)

@Serializable
data class RegistrationRequest(
    val name: String,
    val email: String,
    val role: Role,
    val branchId: String,
)

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

private fun SyncCommandResult.reason(): String {
    val human = listOfNotNull(
        error,
        message,
        detail.takeUnless { it is JsonNull }?.toString(),
    ).filter { it.isNotBlank() }
    if (human.isNotEmpty()) return human.joinToString(" · ").ifBlank { "Command ditolak server" }.take(500)
    return listOfNotNull(
        status.takeIf { it.isNotBlank() },
        code.takeUnless { it is JsonNull }?.toString(),
    ).filter { it.isNotBlank() }.joinToString(" · ").ifBlank { "Command ditolak server" }.take(500)
}

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
    val legacyActorChecked: Boolean = false,
)

@Serializable
data class PendingRemoteApply(
    val snapshot: Snapshot,
    val entities: List<SyncEntity>,
    val revision: Long,
    val scopeKey: String = "",
    val generation: Long = -1,
    val resolvedRejectedIds: Set<String> = emptySet(),
    val actorEmail: String = "",
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

    fun blockedActor(email: String?): Boolean = state.pending.any {
        it.actorEmail.isBlank() || email.isNullOrBlank() || !it.actorEmail.equals(email.trim(), ignoreCase = true)
    }

    fun migrateLegacyActor(snapshotEmail: String?, persist: (SyncClientState) -> Unit = {}): String {
        if (state.legacyActorChecked) {
            persist(state)
            return snapshotEmail.orEmpty().trim().lowercase()
        }
        val saved = snapshotEmail.orEmpty().trim().lowercase()
        val scope = state.scopeKey.split(':').takeIf { it.size == 3 }
            ?.get(1)?.trim()?.lowercase().orEmpty()
        val candidate = if (saved.isNotBlank() && scope.isNotBlank() && saved != scope) "" else scope.ifBlank { saved }
        val origin = candidate.takeUnless { email ->
            state.pending.any { it.actorEmail.isNotBlank() && !it.actorEmail.equals(email, true) }
        }.orEmpty()
        val migrated = state.copy(legacyActorChecked = true, pending = state.pending.map {
            if (origin.isNotBlank() && it.actorEmail.isBlank()) it.copy(actorEmail = origin) else it
        })
        persist(migrated)
        state = migrated
        return origin
    }

    fun initialize(entities: List<SyncEntity>): Boolean {
        if (state.shadow.isNotEmpty() || state.pending.isNotEmpty()) return false
        state = state.copy(shadow = entities)
        return true
    }

    fun restoreLocal(
        entities: List<SyncEntity>, occurredAt: Long, defaultBranchId: String?,
        allowedBranchIds: Set<String>?, actorRole: Role?, legacyCommandId: () -> String,
    ): List<SyncCommand> = restoreLocal(entities, occurredAt, defaultBranchId, allowedBranchIds, actorRole, "", legacyCommandId)

    fun restoreLocal(
        entities: List<SyncEntity>,
        occurredAt: Long,
        defaultBranchId: String?,
        allowedBranchIds: Set<String>?,
        actorRole: Role? = null,
        actorEmail: String = "",
        commandId: () -> String = { UUID.randomUUID().toString() },
    ): List<SyncCommand> {
        if (state.pendingRemote != null) return emptyList()
        if (!state.bootstrapped) {
            initialize(entities)
            return emptyList()
        }
        val newestPendingAt = state.pending.maxOfOrNull { it.occurredAt } ?: Long.MIN_VALUE
        if (state.pending.isNotEmpty() && occurredAt <= newestPendingAt) return emptyList()
        return enqueue(entities, occurredAt, defaultBranchId, allowedBranchIds, actorRole, actorEmail, commandId)
    }

    fun enqueueDurably(entities: List<SyncEntity>, occurredAt: Long, defaultBranchId: String?, allowedBranchIds: Set<String>?, actorRole: Role, actorEmail: String, persist: (SyncClientState) -> Unit) {
        val candidate = SyncOutbox(state)
        candidate.enqueue(entities, occurredAt, defaultBranchId, allowedBranchIds, actorRole, actorEmail)
        persist(candidate.state)
        state = candidate.state
    }

    fun restoreStartup(restored: Snapshot, normalized: Snapshot, defaultBranchId: String?, allowedBranchIds: Set<String>?, actorRole: Role?, actorEmail: String, persist: (SyncClientState) -> Unit) {
        val candidate = SyncOutbox(state)
        candidate.restoreLocal(SyncProjection.entities(restored), restored.updatedAt.takeIf { it > 0 } ?: Clock.nowMs(), defaultBranchId, allowedBranchIds, actorRole, actorEmail)
        if (candidate.state.pending.isEmpty()) candidate.acceptRemote(SyncProjection.entities(normalized), candidate.state.revision)
        persist(candidate.state)
        state = candidate.state
    }

    fun enqueue(
        entities: List<SyncEntity>, occurredAt: Long, defaultBranchId: String?,
        allowedBranchIds: Set<String>?, actorRole: Role?, legacyCommandId: () -> String,
    ): List<SyncCommand> = enqueue(entities, occurredAt, defaultBranchId, allowedBranchIds, actorRole, "", legacyCommandId)

    fun enqueue(
        entities: List<SyncEntity>,
        occurredAt: Long,
        defaultBranchId: String?,
        allowedBranchIds: Set<String>?,
        actorRole: Role? = null,
        actorEmail: String = "",
        commandId: () -> String = { UUID.randomUUID().toString() },
    ): List<SyncCommand> {
        if ((actorEmail.isNotBlank() || state.pending.any { it.actorEmail.isNotBlank() }) && blockedActor(actorEmail)) return emptyList()
        val before = if (state.pendingRemote != null && state.pending.isEmpty()) {
            state.pendingRemote!!.entities.associateBy { it.key }
        } else state.shadow.associateBy { it.key }
        val normalized = entities.map { entity ->
            val previous = before[entity.key]?.payload as? JsonObject
            val current = entity.payload as? JsonObject
            val acknowledgedVersion = previous?.get("updatedAtMs")?.jsonPrimitive?.longOrNull ?: 0
            val localVersion = current?.get("updatedAtMs")?.jsonPrimitive?.longOrNull ?: 0
            if (entity.entityType == "nota" && current != null && acknowledgedVersion > localVersion) {
                entity.copy(payload = JsonObject(current + ("updatedAtMs" to JsonPrimitive(acknowledgedVersion))))
            } else entity
        }
        val after = normalized.associateBy { it.key }
        val created = mutableListOf<SyncCommand>()

        (before.keys + after.keys).sorted().forEach { key ->
            val old = before[key]
            val current = after[key]
            if (old?.payload == current?.payload && old?.branchId == current?.branchId) return@forEach
            val source = current ?: old ?: return@forEach
            val branch = source.branchId ?: defaultBranchId
            if (allowedBranchIds != null && branch != null && branch !in allowedBranchIds) return@forEach
            // Penghapusan hanya boleh DISIMPULKAN untuk entitas yang memang dapat dihapus aktor ini.
            //
            // Snapshot yang diterima non-Owner disaring server, sedangkan entitas tingkat organisasi
            // (branchId == null: cabang, staff, layanan, produk, jenis aset, role) tidak punya cabang
            // untuk disaring. Bila snapshot itu tidak memuat entitas tersebut, selisihnya terbaca
            // sebagai "sudah dihapus" dan perangkat mengirim perintah delete untuk seluruh organisasi.
            // Insiden nyata: login Supervisor menghasilkan enam `assetType.delete` untuk semua cabang,
            // dan `assetType.delete` belum Owner-only di Worker sehingga perintah itu diterima.
            //
            // Aturan ini sejalan dengan izin Worker: seluruh delete tanpa cabang memang Owner-only.
            if (current == null && source.branchId == null && actorRole != null && actorRole != Role.Owner) return@forEach
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
            // Pembatalan nota dikirim lewat entitas `nota` yang sama dengan koreksi biasa, karena
            // perangkat mengirim selisih snapshot, bukan nama perintah. Server membedakannya lewat
            // `syncIntent` (lihat `parseCommand` di command-sync.ts). Tanpa penanda ini, pembatalan
            // akan sampai sebagai `order.put` dan hanya dianggap koreksi.
            if (source.entityType == "nota" && current != null && payload is JsonObject && canceledNow(old?.payload, current.payload)) {
                payload = JsonObject(payload + ("syncIntent" to JsonPrimitive("cancel")))
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
                actorEmail = actorEmail.trim().lowercase(),
            )
        }
        state = state.copy(
            generation = if (created.isEmpty()) state.generation else state.generation + 1,
            shadow = normalized,
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

    fun applyCommandResults(response: SyncCommandResponse, rejectedAt: Long, persist: (SyncClientState) -> Unit): Int {
        val candidate = SyncOutbox(state)
        val versions = response.results.mapNotNull { result -> result.updatedAt?.let { result.commandId to it } }.toMap()
        val acked = candidate.acknowledge(response.acknowledged(), response.revision, versions)
        val rejected = candidate.reject(response.rejected(), rejectedAt)
        if (acked + rejected == 0) return 0
        persist(candidate.state)
        state = candidate.state
        return acked + rejected
    }

    fun nextBatch(limit: Int): List<SyncCommand> {
        val entities = hashSetOf<String>()
        val pendingNotaIds = state.pending.asSequence()
            .filter { it.entityType == "nota" }
            .mapTo(hashSetOf()) { it.entityId }
        return state.pending.asSequence()
            .filterNot { command ->
                val notaId = (command.payload as? JsonObject)?.get("notaId")?.jsonPrimitive?.content
                notaId in pendingNotaIds && (command.entityType == "payment" ||
                    (command.entityType == "stockMove" &&
                        (command.payload as? JsonObject)?.get("requiresDeletedNota")?.jsonPrimitive?.booleanOrNull == true))
            }
            .filter { entities.add("${it.entityType}\u0000${it.entityId}") }
            .take(limit)
            .toList()
    }

    /**
     * Buang perintah tertahan yang aktornya sudah tidak berhak lagi, sebelum terkirim.
     *
     * Aturannya sama dengan penjaga di `enqueue`: delete untuk entitas tanpa cabang hanya boleh
     * dilakukan Owner. Perintah yang tertinggal dari sesi lain dibuang ke `rejected` supaya tetap
     * ada jejaknya, bukan hilang tanpa bekas.
     */
    fun buangYangTidakBerhak(actorRole: Role?): Int {
        if (actorRole == null || actorRole == Role.Owner) return 0
        val doomed = state.pending.filter { it.operation == "delete" && it.branchId == null }
        if (doomed.isEmpty()) return 0
        return reject(doomed.associate { it.commandId to "Dibatalkan: delete tanpa cabang hanya untuk Owner" }, Clock.nowMs())
    }

    fun reject(reasons: Map<String, String>, rejectedAt: Long, limit: Int = 200, persist: (SyncClientState) -> Unit = {}): Int {
        if (reasons.isEmpty()) return 0
        val doomed = state.pending.filter { it.commandId in reasons }
        if (doomed.isEmpty()) return 0
        val evidence = doomed.map { RejectedSyncCommand(it, reasons[it.commandId].orEmpty().ifBlank { "Command ditolak server" }, rejectedAt) }
        val rejected = state.copy(
            pending = state.pending.filterNot { it.commandId in reasons },
            rejected = (state.rejected + evidence).takeLast(limit),
        )
        persist(rejected)
        state = rejected
        return doomed.size
    }

    fun acceptRemote(entities: List<SyncEntity>, revision: Long, scopeKey: String = "", persist: (SyncClientState) -> Unit = {}): Boolean {
        if (state.pending.isNotEmpty() || state.pendingRemote != null) return false
        // Kursor ditetapkan dari server, bukan `maxOf`. Perangkat yang kursornya melampaui server
        // tidak akan pernah membaca halaman jurnal yang lebih tua dari kursornya, jadi perubahan
        // server berhenti sampai selamanya. Kursor yang lebih rendah hanya berarti membaca ulang
        // perubahan yang sudah diterapkan — aman karena penerapan bersifat idempoten.
        val accepted = state.copy(revision = revision, shadow = entities, scopeKey = scopeKey.ifBlank { state.scopeKey })
        persist(accepted)
        state = accepted
        return true
    }

    fun prepareRemote(snapshot: Snapshot, entities: List<SyncEntity>, revision: Long, expectedGeneration: Long, scopeKey: String, actorEmail: String = "", persist: (SyncClientState) -> Unit = {}): Boolean {
        if (!canAcceptRemote(expectedGeneration)) return false
        val prepared = state.copy(pendingRemote = PendingRemoteApply(snapshot, entities, revision, scopeKey, state.generation, actorEmail = actorEmail.trim().lowercase()))
        persist(prepared)
        state = prepared
        return true
    }

    fun prepareBootstrapRemote(snapshot: Snapshot, entities: List<SyncEntity>, revision: Long, scopeKey: String, actorEmail: String = "", persist: (SyncClientState) -> Unit = {}) {
        require(state.pending.isEmpty())
        val prepared = state.copy(pendingRemote = PendingRemoteApply(snapshot, entities, revision, scopeKey, state.generation, actorEmail = actorEmail.trim().lowercase()))
        persist(prepared)
        state = prepared
    }

    fun completePreparedRemote(persist: (SyncClientState) -> Unit = {}): Boolean {
        val prepared = state.pendingRemote ?: return false
        val completed = state.copy(
            // Sama seperti acceptRemote: kursor ditetapkan dari server, bukan maxOf. Kalau kursor
            // perangkat dibiarkan di depan server, halaman jurnal yang lebih tua tidak pernah dibaca.
            revision = prepared.revision,
            shadow = if (prepared.generation < 0 || state.generation == prepared.generation) prepared.entities else state.shadow,
            scopeKey = prepared.scopeKey.ifBlank { state.scopeKey },
            pendingRemote = null,
            rejected = state.rejected.filterNot { it.command.commandId in prepared.resolvedRejectedIds },
            bootstrapped = true,
        )
        persist(completed)
        state = completed
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
        remote: List<SyncEntity>, desired: List<SyncEntity>, revision: Long, occurredAt: Long,
        defaultBranchId: String?, allowedBranchIds: Set<String>?, actorRole: Role?, scopeKey: String,
        legacyCommandId: () -> String,
    ): List<SyncCommand> = reconcileBootstrap(remote, desired, revision, occurredAt, defaultBranchId,
        allowedBranchIds, actorRole, scopeKey, "", commandId = legacyCommandId)

    fun reconcileBootstrap(
        remote: List<SyncEntity>,
        desired: List<SyncEntity>,
        revision: Long,
        occurredAt: Long,
        defaultBranchId: String?,
        allowedBranchIds: Set<String>?,
        actorRole: Role? = null,
        scopeKey: String = "",
        actorEmail: String = "",
        persist: (SyncClientState) -> Unit = {},
        preparedSnapshot: Snapshot? = null,
        commandId: () -> String = { UUID.randomUUID().toString() },
    ): List<SyncCommand> {
        require(state.pending.isEmpty())
        val candidate = SyncOutbox(state.copy(revision = revision, shadow = remote, bootstrapped = true, scopeKey = scopeKey))
        val commands = candidate.enqueue(desired, occurredAt, defaultBranchId, allowedBranchIds, actorRole, actorEmail, commandId)
        val prepared = if (preparedSnapshot == null) candidate.state else candidate.state.copy(
            pendingRemote = PendingRemoteApply(preparedSnapshot, desired, revision, scopeKey, candidate.state.generation, actorEmail = actorEmail.trim().lowercase()),
        )
        persist(prepared)
        state = prepared
        return commands
    }

    // Bukti penolakan tetap ada sampai snapshot pemulihan tersimpan.
    fun reconcileRejectedRemote(snapshot: Snapshot, remote: List<SyncEntity>, revision: Long, scopeKey: String = "", actorEmail: String = "", persist: (SyncClientState) -> Unit = {}): Boolean {
        if (state.pending.isNotEmpty() || state.pendingRemote != null) return false
        val prepared = state.copy(pendingRemote = PendingRemoteApply(snapshot, remote, revision, scopeKey, state.generation, resolvedRejectedIds = state.rejected.mapTo(hashSetOf()) { it.command.commandId }, actorEmail = actorEmail.trim().lowercase()))
        persist(prepared)
        state = prepared
        return true
    }

    fun resetForScope(scopeKey: String, persist: (SyncClientState) -> Unit = {}): Boolean {
        if (state.pending.isNotEmpty() || state.pendingRemote != null) return false
        val reset = state.copy(revision = 0, shadow = emptyList(), bootstrapped = false, scopeKey = scopeKey)
        persist(reset)
        state = reset
        return true
    }

    fun acceptLegacySnapshot(entities: List<SyncEntity>, generation: Long, uploadedIds: Set<String>, persist: (SyncClientState) -> Unit): Boolean {
        val unchanged = state.generation == generation
        val accepted = state.copy(
            shadow = if (unchanged) entities else state.shadow,
            pending = state.pending.filterNot { it.commandId in uploadedIds },
            bootstrapped = true,
        )
        persist(accepted)
        state = accepted
        return unchanged && state.pending.isEmpty() && state.pendingRemote == null
    }

    private fun statusOnly(old: JsonElement?, current: JsonElement): Boolean {
        val previous = old as? JsonObject ?: return false
        val next = current as? JsonObject ?: return false
        val ignored = setOf("laundry", "completedAt", "updatedAtMs")
        return (previous.keys + next.keys).all { key -> key in ignored || previous[key] == next[key] }
    }

    /**
     * Apakah pembatalan BARU saja terjadi pada nota ini.
     *
     * Dibaca dari perpindahan penanda `canceledAtMs`: nol di payload lama, terisi di payload baru.
     * Nota yang sudah batal sejak awal tidak dihitung, supaya koreksi lain pada nota batal tidak
     * ikut terkirim sebagai pembatalan ulang.
     */
    private fun canceledNow(old: JsonElement?, current: JsonElement): Boolean {
        val previous = old as? JsonObject ?: return false
        val next = current as? JsonObject ?: return false
        val before = previous["canceledAtMs"]?.jsonPrimitive?.content?.toLongOrNull() ?: 0
        val after = next["canceledAtMs"]?.jsonPrimitive?.content?.toLongOrNull() ?: 0
        return before == 0L && after > 0L
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
        "assetType" to Spec("assetTypes", text("id"), { null }),
        "expense" to Spec("expenses", text("id"), text("branchId")),
        "nota" to Spec("notas", text("id"), text("branchId")),
        "stockMove" to Spec("stockMoves", { syncIdOrLegacyHash(it) }, text("branchId")),
        "audit" to Spec("audit", { syncIdOrLegacyHash(it) }, text("branchId")),
        "cashClose" to Spec("cashCloses", text("id"), text("branchId")),
        "payment" to Spec("payments", text("id"), text("branchId")),
        "attendance" to Spec("attendance", text("id"), text("branchId")),
        "accessPolicy" to Spec("accessPolicies", { text("email")(it).lowercase() }, { null }),
        "accessRole" to Spec("accessRoles", text("id"), { null }),
        "whatsappTemplate" to Spec("whatsappTemplates", text("id"), { null }),
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
                    "attendance" -> JsonObject(obj + ("checkInPhotoPath" to JsonPrimitive("")) + ("checkOutPhotoPath" to JsonPrimitive("")))
                    // Foto aset hanya ada di perangkat pencatat; metadata aset tetap dibagikan.
                    "inventory" -> JsonObject(obj + ("photoPath" to JsonPrimitive("")))
                    else -> obj
                }
                if (id.isBlank()) null else SyncEntity(type, id, spec.branch(obj)?.ifBlank { null }, cloudPayload)
            }
        }.sortedBy { it.key }
    }

    fun apply(snapshot: Snapshot, changes: List<SyncChange>, updatedAt: Long): Snapshot {
        val root = LocalJson.json.encodeToJsonElement(Snapshot.serializer(), snapshot).jsonObject.toMutableMap()
        changes.forEach { change ->
            val spec = specs[if (change.entityType == "order") "nota" else change.entityType] ?: return@forEach
            val rows = (root[spec.field] as? JsonArray).orEmpty().toMutableList()
            val identity = if (change.entityType == "attendance") attendanceIdentity(change.payload) else null
            // Baris lama dipakai sebagai dasar penggabungan, bukan dibuang. Aturan pemilik:
            // absen pagi dan sore adalah satu catatan harian, dan data yang sudah tercatat tidak
            // boleh dikosongkan oleh kiriman berikutnya.
            val lama = if (identity == null) null else rows
                .mapNotNull { it as? JsonObject }
                .filter { attendanceIdentity(it) == identity }
                .reduceOrNull { acc, obj -> if (attendanceLebihLengkap(obj, acc)) obj else acc }
            rows.removeAll { row ->
                val obj = row as? JsonObject ?: return@removeAll false
                spec.id(obj) == change.entityId || (identity != null && attendanceIdentity(obj) == identity)
            }
            if (change.operation.lowercase() != "delete" && change.payload is JsonObject) {
                rows += if (change.entityType == "attendance") gabungAbsensi(lama, change.payload) else change.payload
            }
            root[spec.field] = JsonArray(rows)
        }
        root["updatedAt"] = JsonPrimitive(updatedAt)
        return LocalJson.json.decodeFromJsonElement(Snapshot.serializer(), JsonObject(root))
    }

    /**
     * Entitas yang hak aksesnya hanya boleh datang dari server.
     *
     * `staff` memuat peran; `accessRole` memuat centang modul dan fungsi. Kalau perangkat ikut
     * merekonsiliasi keduanya, perangkat yang perannya pernah dinaikkan sementara untuk pengujian
     * akan mengirim kenaikan itu sebagai UPSERT dan menimpanya ke server.
     */
    private val serverOwnedEntities = setOf("staff", "accessRole", "accessPolicy")

    fun reconcileBootstrap(remote: Snapshot, local: Snapshot, updatedAt: Long): Snapshot {
        val remoteEntities = entities(remote).associateBy { it.key }
        val localEntities = entities(local).associateBy { it.key }
        val changes = localEntities.values.mapNotNull { entity ->
            if (entity.entityType in serverOwnedEntities) null
            else if (remoteEntities[entity.key] == entity) null
            else SyncChange(
                entityType = entity.entityType,
                entityId = entity.entityId,
                operation = "upsert",
                branchId = entity.branchId,
                payload = entity.payload,
            )
        }.toMutableList()
        // Entitas hak akses harus mengikuti server SEPENUHNYA: yang sudah tidak ada di server
        // dibuang dari perangkat, dan yang ada di server tetapi belum ada di perangkat ditambahkan.
        // Tanpa langkah ini, akun uji atau role uji yang pernah dibuat di perangkat tetap tinggal
        // selamanya — server tidak memuatnya, jadi tidak ada perubahan yang menyentuhnya, sedangkan
        // `apply` hanya menambah entitas yang disebut di `changes`.
        // Kejadian nyata: `gudang-uji@contoh.test` dan dua role "Gudang" bertahan di perangkat
        // berminggu-minggu sesudah dihapus dari server, dan `aidanurita25@gmail.com` tetap
        // Supervisor di perangkat padahal server sudah menurunkannya ke Kasir.
        serverOwnedEntities.forEach { tipe ->
            val entitasServer = remoteEntities.values.filter { it.entityType == tipe }.associateBy { it.entityId }
            localEntities.values.filter { it.entityType == tipe && it.entityId !in entitasServer }
                .forEach { entity ->
                    changes += SyncChange(
                        entityType = entity.entityType,
                        entityId = entity.entityId,
                        operation = "delete",
                        branchId = entity.branchId,
                    )
                }
            val entitasPerangkat = localEntities.values.filter { it.entityType == tipe }.map { it.entityId }.toSet()
            entitasServer.values.filter { it.entityId !in entitasPerangkat }
                .forEach { entity ->
                    changes += SyncChange(
                        entityType = entity.entityType,
                        entityId = entity.entityId,
                        operation = "upsert",
                        branchId = entity.branchId,
                        payload = entity.payload,
                    )
                }
        }
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

    /**
     * Samakan entitas hak akses dengan server pada snapshot yang dibangun dari perubahan bertahap.
     *
     * `apply` hanya menambah dan mengubah entitas yang disebut di `changes`. Entitas hak akses yang
     * sudah lama ada di perangkat tetapi TIDAK ada di server tidak pernah disebut, jadi tidak pernah
     * dibuang: perangkat memakai peran lama selamanya. Ini terjadi pada perangkat yang sudah
     * `bootstrapped` — jalur `bootstrapSnapshot` tidak dijalankan lagi, hanya `pullChanges`.
     *
     * Kejadian nyata: `aidanurita25@gmail.com` tetap Supervisor di perangkat padahal server sudah
     * Kasir, dan akun serta role uji bertahan sesudah dihapus dari server.
     */
    fun samakanHakAkses(hasil: Snapshot, server: Snapshot): Snapshot = hasil.copy(
        staff = server.staff,
        accessRoles = server.accessRoles,
        accessPolicies = server.accessPolicies,
        branchStocks = server.branchStocks,
        inventory = server.inventory,
    )

    /**
     * Identitas absensi: (karyawan, tanggal, cabang). `null` bila salah satunya kosong.
     *
     * Sama dengan aturan di Worker: absensi tidak dikenali dari `id` saja, karena perangkat lama
     * memakai id acak sedangkan perangkat baru memakai id deterministik untuk catatan yang sama.
     */
    private fun attendanceIdentity(element: JsonElement?): String? {
        val obj = element as? JsonObject ?: return null
        val email = obj["staffEmail"]?.jsonPrimitive?.contentOrNull?.lowercase().orEmpty()
        val workDate = obj["workDate"]?.jsonPrimitive?.contentOrNull.orEmpty()
        val branchId = obj["branchId"]?.jsonPrimitive?.contentOrNull.orEmpty()
        if (email.isBlank() || workDate.isBlank() || branchId.isBlank()) return null
        return "$email|$workDate|$branchId"
    }

    /** Baris absensi yang sudah punya jam pulang (atau jam masuk lebih baru) dianggap lebih lengkap. */
    private fun attendanceLebihLengkap(baru: JsonObject, lama: JsonObject): Boolean {
        fun pulang(obj: JsonObject): Long = obj["checkOutAtMs"]?.jsonPrimitive?.longOrNull ?: 0L
        fun masuk(obj: JsonObject): Long = obj["checkInAtMs"]?.jsonPrimitive?.longOrNull ?: 0L
        val pulangBaru = pulang(baru) > 0
        val pulangLama = pulang(lama) > 0
        if (pulangBaru != pulangLama) return pulangBaru
        return masuk(baru) >= masuk(lama)
    }

    /**
     * Menggabungkan kiriman absensi dengan baris yang sudah ada tanpa mengosongkan isinya.
     *
     * Aturan pemilik: absen pagi dan sore adalah SATU catatan harian, dan "tidak boleh ada yang
     * menimpa". Kiriman berikutnya boleh mengisi jam pulang, tetapi tidak boleh mengosongkan jam
     * masuk, jam pulang, atau catatan yang sudah tercatat.
     */
    private fun gabungAbsensi(lama: JsonObject?, baru: JsonObject): JsonObject {
        if (lama == null) return baru
        val hasil = baru.toMutableMap()
        // Jam masuk dan jam pulang yang SUDAH tercatat tidak pernah ditimpa. Ini sejalan dengan
        // SQL `ON CONFLICT ... check_in_at=attendance.check_in_at, check_out_at=COALESCE(...)`,
        // supaya isi tabel dan isi snapshot tidak pernah berbeda cerita.
        val masukLama = lama["checkInAtMs"]?.jsonPrimitive?.longOrNull ?: 0L
        if (masukLama > 0) {
            hasil["checkInAtMs"] = JsonPrimitive(masukLama)
            lama["checkInAt"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
                ?.let { hasil["checkInAt"] = JsonPrimitive(it) }
        }
        val pulangLama = lama["checkOutAtMs"]?.jsonPrimitive?.longOrNull ?: 0L
        if (pulangLama > 0) {
            hasil["checkOutAtMs"] = JsonPrimitive(pulangLama)
            lama["checkOutAt"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
                ?.let { hasil["checkOutAt"] = JsonPrimitive(it) }
        }
        val catatanBaru = baru["note"]?.jsonPrimitive?.contentOrNull.orEmpty()
        val catatanLama = lama["note"]?.jsonPrimitive?.contentOrNull.orEmpty()
        if (catatanBaru.isBlank() && catatanLama.isNotBlank()) hasil["note"] = JsonPrimitive(catatanLama)
        return JsonObject(hasil)
    }

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
    return session.allowedBranchIds.toSet()
}
