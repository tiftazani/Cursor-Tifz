package com.cuciin.laundryops.data

import android.app.Application
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.cuciin.laundryops.BuildConfig
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** Local-first sync with a durable command outbox and revision-based deltas. */
object CloudSync {
    private const val TAG = "CuciinCloud"
    private const val BATCH_LIMIT = 100
    private val io = Executors.newSingleThreadExecutor()
    private val disk = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val poll = Handler(Looper.getMainLooper())

    @Volatile var lastStatus: String = "belum nyambung"
        private set
    @Volatile var lastOkAt: Long = 0
        private set
    @Volatile var online: Boolean = false
        private set
    @Volatile var pendingCount: Int = 0
        private set
    @Volatile var rejectedCount: Int = 0
        private set
    @Volatile var lastRejectedReason: String? = null
        private set
    @Volatile var started: Boolean = false
        private set

    private var startedInternal = false
    private var syncing = false
    private var rerunRequested = false
    private var latestSnapshot: Snapshot? = null
    private var hadPersistedLocalData = false
    private var persistence: SyncPersistence? = null
    private var outbox = SyncOutbox()
    @Volatile private var rejectedNeedsRecovery = false
    private val endpointConfigured: Boolean get() = BuildConfig.CUCIIN_CLOUD_URL.isNotBlank()

    @Synchronized fun init(application: Application) {
        if (persistence != null) return
        persistence = SyncPersistence(application)
        outbox = SyncOutbox(persistence!!.load())
        pendingCount = outbox.state.pending.size
        rejectedNeedsRecovery = outbox.state.rejected.isNotEmpty()
        updateRejectedStatus()
    }

    @Synchronized fun initializeLocalState(snapshot: Snapshot, hadPersistedData: Boolean): Snapshot? {
        latestSnapshot = snapshot
        hadPersistedLocalData = hadPersistedData
        outbox.state.pendingRemote?.let { prepared ->
            if (snapshot.updatedAt > prepared.snapshot.updatedAt) {
                outbox.completePreparedRemote()
                outbox.restoreLocal(
                    SyncProjection.entities(snapshot), snapshot.updatedAt,
                    CuciinStore.session.value?.branchId,
                    allowedSyncBranches(CuciinStore.session.value, CuciinStore.staff),
                    actorRole = CuciinStore.session.value?.role,
                )
                saveState()
                return null
            }
            latestSnapshot = prepared.snapshot
            return prepared.snapshot
        }
        val entities = SyncProjection.entities(snapshot)
        val session = CuciinStore.session.value
        outbox.restoreLocal(
            entities,
            snapshot.updatedAt.takeIf { it > 0 } ?: Clock.nowMs(),
            session?.branchId,
            allowedSyncBranches(session, CuciinStore.staff),
            actorRole = session?.role,
        )
        saveState()
        return null
    }

    fun onAuthenticated() { if (endpointConfigured) synchronize() }

    fun submitRegistration(name: String, email: String, role: Role, branchId: String, onDone: (String?) -> Unit) {
        if (!endpointConfigured) {
            main.post { onDone("Server pendaftaran belum dikonfigurasi") }
            return
        }
        io.execute {
            try {
                val conn = open("POST", apiUrl("/v1/registration"))
                conn.doOutput = true
                val payload = LocalJson.json.encodeToString(RegistrationRequest.serializer(), RegistrationRequest(name.trim(), email.trim(), role, branchId))
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload) }
                val code = conn.responseCode
                val body = readBody(conn, code)
                conn.disconnect()
                val error = if (code in 200..299) null else runCatching {
                    LocalJson.json.parseToJsonElement(body).jsonObject["error"]?.jsonPrimitive?.content
                }.getOrNull().orEmpty().ifBlank { "Pendaftaran ditolak server ($code)" }
                main.post { onDone(error) }
            } catch (error: Exception) {
                Log.w(TAG, "pendaftaran server gagal", error)
                main.post { onDone("Pendaftaran belum terkirim ke server") }
            }
        }
    }

    fun verifyIdentity(onDone: (CloudIdentity?, String?) -> Unit) {
        if (!endpointConfigured) {
            main.post { onDone(null, "Server identitas belum dikonfigurasi") }
            return
        }
        io.execute {
            try {
                val conn = open("GET", apiUrl("/v1/me"))
                val code = conn.responseCode
                val body = readBody(conn, code)
                conn.disconnect()
                if (code == 200) {
                    val identity = LocalJson.json.decodeFromString(CloudIdentity.serializer(), body)
                    main.post { onDone(identity, null) }
                } else main.post {
                    onDone(null, if (code == 401 || code == 403) "Akun tidak aktif atau belum disetujui Owner" else "Server identitas belum tersedia ($code)")
                }
            } catch (error: Exception) {
                Log.w(TAG, "verifikasi identitas gagal", error)
                main.post { onDone(null, "Tidak dapat memverifikasi akses ke server") }
            }
        }
    }

    fun onSignedOut() {
        online = false
        lastStatus = if (pendingCount > 0) "$pendingCount perubahan aman di HP · menunggu login" else "Menunggu login untuk sinkronisasi"
        CuciinStore.touchStatus()
    }

    fun start() {
        if (startedInternal) return
        startedInternal = true
        started = true
        if (!endpointConfigured) {
            lastStatus = "Mode lokal · server cloud belum dikonfigurasi"
            CuciinStore.touchStatus()
            return
        }
        lastStatus = if (FirebaseCloud.authenticated) "Menyambungkan database…" else "Menunggu login untuk sinkronisasi"
        if (FirebaseCloud.authenticated) synchronize()
        poll.post(object : Runnable {
            override fun run() {
                if (FirebaseCloud.authenticated) synchronize()
                poll.postDelayed(this, 12_000)
            }
        })
    }

    /** Existing store entry point; changes are now recorded per entity before network I/O. */
    @Synchronized fun push(snapshot: Snapshot) {
        latestSnapshot = snapshot
        val session = CuciinStore.session.value
        val allowed = allowedSyncBranches(session, CuciinStore.staff)
        outbox.enqueue(
            SyncProjection.entities(snapshot),
            snapshot.updatedAt.takeIf { it > 0 } ?: Clock.nowMs(),
            session?.branchId,
            allowed,
            actorRole = session?.role,
        )
        saveState()
        if (!endpointConfigured) {
            lastStatus = if (pendingCount > 0) "$pendingCount perubahan aman di perangkat" else "Mode lokal"
            return
        }
        if (FirebaseCloud.enabled && !FirebaseCloud.authenticated) {
            lastStatus = "$pendingCount perubahan aman di HP · menunggu login"
            online = false
            return
        }
        synchronize()
    }

    fun pull() = synchronize()

    @Synchronized fun acceptRemoteSnapshot(snapshot: Snapshot) {
        latestSnapshot = snapshot
        if (outbox.completePreparedRemote() || outbox.acceptRemote(SyncProjection.entities(snapshot), outbox.state.revision)) saveState()
    }

    fun persistAppliedRemote(localSnapshot: Snapshot, cloudSnapshot: Snapshot, onDone: (() -> Unit)? = null) {
        disk.execute {
            LocalJson.save(localSnapshot)
            synchronized(this) {
                if ((latestSnapshot?.updatedAt ?: Long.MIN_VALUE) <= cloudSnapshot.updatedAt) {
                    latestSnapshot = cloudSnapshot
                }
                if (outbox.completePreparedRemote()) saveState()
            }
            main.post { onDone?.invoke() }
        }
    }

    @Synchronized fun completeRecoveredRemote(snapshot: Snapshot) {
        latestSnapshot = snapshot
        if (outbox.completePreparedRemote()) saveState()
    }

    @Synchronized fun hasPreparedRemote(): Boolean = outbox.state.pendingRemote != null

    private fun synchronize() {
        if (!endpointConfigured || (FirebaseCloud.enabled && !FirebaseCloud.authenticated)) return
        synchronized(this) {
            if (syncing) { rerunRequested = true; return }
            syncing = true
        }
        io.execute {
            try {
                if (needsBootstrap() && pendingCommands().isEmpty() && bootstrapSnapshot() == EndpointResult.FAILED) return@execute
                when (flushCommands()) {
                    EndpointResult.UNSUPPORTED -> legacyPushThenPull()
                    EndpointResult.FAILED -> Unit
                    EndpointResult.OK -> if (pendingCommands().isEmpty()) {
                        if (rejectedNeedsRecovery) {
                            if (recoverRejectedSnapshot() == EndpointResult.FAILED) return@execute
                        } else if (needsBootstrap() && bootstrapSnapshot() == EndpointResult.FAILED) return@execute
                        pullChanges()
                    }
                }
            } catch (error: Exception) {
                markOffline("Koneksi server belum tersedia", error)
            } finally {
                synchronized(this) {
                    syncing = false
                    if (rerunRequested) { rerunRequested = false; main.post { synchronize() } }
                }
            }
        }
    }

    private fun flushCommands(): EndpointResult {
        while (true) {
            val batch = synchronized(this) { outbox.nextBatch(BATCH_LIMIT) }
            if (batch.isEmpty()) return EndpointResult.OK
            val conn = open("POST", apiUrl("/v1/sync/commands"))
            conn.doOutput = true
            val payload = LocalJson.json.encodeToString(SyncCommandBatch.serializer(), SyncCommandBatch(batch))
            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload) }
            val code = conn.responseCode
            val body = readBody(conn, code)
            conn.disconnect()
            if (code in setOf(404, 405, 501)) return EndpointResult.UNSUPPORTED
            val decoded = runCatching { LocalJson.json.decodeFromString(SyncCommandResponse.serializer(), body) }
            val response = decoded.getOrNull()
            if (code !in 200..299) {
                if (code in setOf(403, 409, 422) && response != null) {
                    val reasons = response.rejected().toMutableMap()
                    response.commandId?.takeIf { id -> batch.any { it.commandId == id } }
                        ?.let { reasons[it] = response.topLevelReason() }
                    if (reasons.isEmpty() && batch.size == 1) reasons[batch.single().commandId] = response.topLevelReason()
                    if (moveToRejected(reasons) > 0) continue
                }
                markOffline("Sinkronisasi ditolak server ($code)")
                return EndpointResult.FAILED
            }
            if (response == null) {
                markOffline("Jawaban sinkronisasi tidak valid", decoded.exceptionOrNull()); return EndpointResult.FAILED
            }
            val acknowledged = response.acknowledged()
            val rejected = response.rejected()
            val updatedAtByCommand = response.results.mapNotNull { result ->
                result.updatedAt?.let { result.commandId to it }
            }.toMap()
            val moved = synchronized(this) {
                val acked = outbox.acknowledge(acknowledged, response.revision, updatedAtByCommand)
                val dead = outbox.reject(rejected, Clock.nowMs())
                if (dead > 0) rejectedNeedsRecovery = true
                if (acked > 0 || dead > 0) saveState()
                acked + dead
            }
            if (moved == 0) { markOffline("Server belum mengakui perubahan"); return EndpointResult.FAILED }
            markOnline()
        }
    }

    private fun pullChanges(): EndpointResult {
        var after = synchronized(this) { outbox.state.revision }
        val base = synchronized(this) { latestSnapshot } ?: return EndpointResult.OK
        val expectedGeneration = synchronized(this) { outbox.state.generation }
        var current = base
        val collected = mutableListOf<SyncChange>()
        var responseScope = synchronized(this) { outbox.state.scopeKey }
        while (true) {
            val conn = open("GET", apiUrl("/v1/sync/changes?after=$after"))
            val code = conn.responseCode
            val body = readBody(conn, code)
            conn.disconnect()
            if (code in setOf(404, 405, 501)) return legacyPull()
            if (code !in 200..299) { markOffline("Tarik perubahan gagal ($code)"); return EndpointResult.FAILED }
            val response = runCatching { LocalJson.json.decodeFromString(SyncChangesResponse.serializer(), body) }.getOrElse {
                markOffline("Data perubahan server tidak valid", it); return EndpointResult.FAILED
            }
            val knownScope = synchronized(this) { outbox.state.scopeKey }
            if (response.scopeKey.isNotBlank() && response.scopeKey != knownScope) {
                val reset = synchronized(this) {
                    outbox.resetForScope(response.scopeKey).also { if (it) { hadPersistedLocalData = false; saveState() } }
                }
                return if (reset) bootstrapSnapshot() else EndpointResult.FAILED
            }
            if (response.scopeKey.isNotBlank()) responseScope = response.scopeKey
            collected += response.changes
            current = SyncProjection.apply(current, response.changes, maxOf(current.updatedAt + 1, Clock.nowMs()))
            val next = response.cursor()
            if (!response.hasMore) { after = maxOf(after, next); break }
            if (next <= after) { markOffline("Cursor sinkronisasi server tidak maju"); return EndpointResult.FAILED }
            after = next
        }
        val remote = current
        val revision = after
        main.post {
            val accepted = synchronized(this) { outbox.canAcceptRemote(expectedGeneration) }
            if (accepted) {
                if (collected.isNotEmpty()) {
                    val prepared = synchronized(this) {
                        outbox.prepareRemote(remote, SyncProjection.entities(remote), revision, expectedGeneration, responseScope)
                            .also { if (it) saveState() }
                    }
                    if (prepared) CuciinStore.applyCloud(remote) else synchronize()
                } else {
                    synchronized(this) {
                        outbox.acceptRemote(SyncProjection.entities(remote), revision, responseScope)
                        saveState()
                    }
                    CuciinStore.touchStatus()
                }
            } else synchronize()
        }
        markOnline()
        return EndpointResult.OK
    }

    private fun bootstrapSnapshot(): EndpointResult {
        val conn = open("GET")
        val code = conn.responseCode
        val body = readBody(conn, code)
        val remoteRevision = conn.getHeaderField("X-Cuciin-Revision")?.toLongOrNull()?.coerceAtLeast(0) ?: 0
        val remoteScope = conn.getHeaderField("X-Cuciin-Scope").orEmpty()
        conn.disconnect()
        if (code !in 200..299 || body.isBlank()) { markOffline("Bootstrap database gagal ($code)"); return EndpointResult.FAILED }
        val remote = runCatching { LocalJson.json.decodeFromString(Snapshot.serializer(), body) }.getOrElse {
            markOffline("Snapshot bootstrap tidak valid", it); return EndpointResult.FAILED
        }
        val completed = CountDownLatch(1)
        var result = EndpointResult.FAILED
        main.post {
            val local = synchronized(this) { latestSnapshot }
            if (local != null) {
                if (synchronized(this) { outbox.state.pending.isNotEmpty() }) {
                    result = EndpointResult.OK
                    completed.countDown()
                    return@post
                }
                if (remote.staff.isEmpty()) {
                    synchronized(this) {
                        val session = CuciinStore.session.value
                        outbox.beginFromEmptyRemote(remoteScope)
                        outbox.enqueue(
                            SyncProjection.entities(local), Clock.nowMs(), session?.branchId,
                            allowedSyncBranches(session, CuciinStore.staff), session?.role,
                        )
                        saveState()
                    }
                } else {
                    val canonical = SyncProjection.bootstrapSnapshot(
                        remote,
                        local,
                        hadPersistedLocalData,
                        maxOf(remote.updatedAt, local.updatedAt + 1, Clock.nowMs()),
                    )
                    synchronized(this) {
                        val session = CuciinStore.session.value
                        latestSnapshot = canonical
                        val remoteEntities = SyncProjection.entities(remote)
                        val canonicalEntities = SyncProjection.entities(canonical)
                        if (remoteEntities == canonicalEntities) {
                            outbox.prepareBootstrapRemote(canonical, canonicalEntities, remoteRevision, remoteScope)
                        } else {
                            outbox.reconcileBootstrap(
                                remoteEntities, canonicalEntities, remoteRevision, Clock.nowMs(),
                                session?.branchId, allowedSyncBranches(session, CuciinStore.staff),
                                session?.role, remoteScope,
                            )
                        }
                        saveState()
                    }
                    CuciinStore.applyCloud(canonical) {
                        result = EndpointResult.OK
                        completed.countDown()
                    }
                    return@post
                }
                result = EndpointResult.OK
            }
            completed.countDown()
        }
        if (!completed.await(30, TimeUnit.SECONDS)) {
            markOffline("Bootstrap database melewati batas waktu")
            return EndpointResult.FAILED
        }
        return result
    }

    /** Rejection permanen harus kembali ke snapshot server, bukan tinggal sebagai data lokal berbeda. */
    private fun recoverRejectedSnapshot(): EndpointResult {
        val conn = open("GET")
        val code = conn.responseCode
        val body = readBody(conn, code)
        val remoteRevision = conn.getHeaderField("X-Cuciin-Revision")?.toLongOrNull()?.coerceAtLeast(0) ?: 0
        val remoteScope = conn.getHeaderField("X-Cuciin-Scope").orEmpty()
        conn.disconnect()
        if (code !in 200..299 || body.isBlank()) {
            markOffline("Pemulihan perubahan yang ditolak gagal ($code)")
            return EndpointResult.FAILED
        }
        val remote = runCatching { LocalJson.json.decodeFromString(Snapshot.serializer(), body) }.getOrElse {
            markOffline("Snapshot pemulihan tidak valid", it)
            return EndpointResult.FAILED
        }
        val completed = CountDownLatch(1)
        var result = EndpointResult.FAILED
        main.post {
            val reconciled = synchronized(this) {
                outbox.reconcileRejectedRemote(SyncProjection.entities(remote), remoteRevision, remoteScope).also { accepted ->
                    if (accepted) {
                        latestSnapshot = remote
                        rejectedNeedsRecovery = false
                        saveState()
                    }
                }
            }
            if (!reconciled) {
                completed.countDown()
                return@post
            }
            CuciinStore.applyCloud(remote) {
                result = EndpointResult.OK
                completed.countDown()
            }
        }
        if (!completed.await(30, TimeUnit.SECONDS)) {
            markOffline("Pemulihan perubahan yang ditolak melewati batas waktu")
            return EndpointResult.FAILED
        }
        if (result == EndpointResult.OK) markOnline()
        return result
    }

    private fun legacyPushThenPull(): EndpointResult {
        val snapshot = synchronized(this) { latestSnapshot } ?: return legacyPull()
        if (pendingCommands().isNotEmpty()) {
            val conn = open("PUT")
            conn.doOutput = true
            val payload = LocalJson.json.encodeToString(Snapshot.serializer(), snapshot)
            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload) }
            val code = conn.responseCode
            readBody(conn, code)
            conn.disconnect()
            if (code !in 200..299) { markOffline("Perubahan belum terkirim ke server ($code)"); return EndpointResult.FAILED }
            synchronized(this) { outbox.acceptLegacySnapshot(SyncProjection.entities(snapshot)); saveState() }
            markOnline("Database server nyambung · mode kompatibilitas")
        }
        return legacyPull()
    }

    private fun legacyPull(): EndpointResult {
        val conn = open("GET")
        val code = conn.responseCode
        val body = readBody(conn, code)
        conn.disconnect()
        if (code != 200 || body.isBlank()) { markOffline("Server $code"); return EndpointResult.FAILED }
        val snapshot = runCatching { LocalJson.json.decodeFromString(Snapshot.serializer(), body) }.getOrElse {
            markOffline("Snapshot server tidak valid", it); return EndpointResult.FAILED
        }
        synchronized(this) { latestSnapshot = snapshot }
        main.post { CuciinStore.applyCloud(snapshot) }
        markOnline("Database server nyambung · mode kompatibilitas")
        return EndpointResult.OK
    }

    @Synchronized private fun pendingCommands(): List<SyncCommand> = outbox.state.pending
    @Synchronized private fun needsBootstrap(): Boolean = !outbox.state.bootstrapped
    @Synchronized private fun saveState() {
        persistence?.save(outbox.state)
        pendingCount = outbox.state.pending.size
        updateRejectedStatus()
    }

    @Synchronized private fun moveToRejected(reasons: Map<String, String>): Int {
        val moved = outbox.reject(reasons, Clock.nowMs())
        if (moved > 0) {
            rejectedNeedsRecovery = true
            saveState()
        }
        return moved
    }

    private fun updateRejectedStatus() {
        rejectedCount = outbox.state.rejected.size
        lastRejectedReason = outbox.state.rejected.lastOrNull()?.reason
    }

    private fun markOnline(status: String = "Database server nyambung") {
        online = true
        lastOkAt = Clock.nowMs()
        lastStatus = if (pendingCount == 0) status else "$pendingCount perubahan menunggu sinkronisasi"
        main.post { CuciinStore.touchStatus() }
    }

    private fun markOffline(status: String, error: Throwable? = null) {
        online = false
        val base = if (pendingCount > 0) "$status · $pendingCount perubahan aman di HP" else status
        lastStatus = rejectionSuffix(base)
        if (error == null) Log.w(TAG, status) else Log.w(TAG, status, error)
        main.post { CuciinStore.touchStatus() }
    }

    private fun apiUrl(pathAndQuery: String): URL {
        val configured = URL(BuildConfig.CUCIIN_CLOUD_URL)
        return URL(configured.protocol, configured.host, configured.port, pathAndQuery)
    }

    private fun rejectionSuffix(base: String): String = if (rejectedCount == 0) base
    else "$base · $rejectedCount konflik perlu ditinjau: ${lastRejectedReason.orEmpty().take(120)}"

    private fun open(method: String, endpoint: URL = URL(BuildConfig.CUCIIN_CLOUD_URL)): HttpURLConnection {
        val conn = endpoint.openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = 12_000
        conn.readTimeout = 12_000
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Accept", "application/json")
        FirebaseCloud.idTokenBlocking()?.let { conn.setRequestProperty("Authorization", "Bearer $it") }
        if (BuildConfig.CUCIIN_CLOUD_KEY.isNotBlank()) conn.setRequestProperty("X-Cuciin-Key", BuildConfig.CUCIIN_CLOUD_KEY)
        conn.useCaches = false
        return conn
    }

    private fun readBody(conn: HttpURLConnection, code: Int): String =
        (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()

    private enum class EndpointResult { OK, UNSUPPORTED, FAILED }
}
