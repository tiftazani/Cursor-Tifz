package com.cuciin.laundryops.data

import android.app.Application
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.cuciin.laundryops.BuildConfig
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
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
    private const val BATCH_LIMIT = 1
    private val io = Executors.newSingleThreadExecutor()
    private val disk = Executors.newSingleThreadExecutor()
    private val main by lazy { Handler(Looper.getMainLooper()) }
    private val poll by lazy { Handler(Looper.getMainLooper()) }

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

    private val sessionEpoch = java.util.concurrent.atomic.AtomicLong()
    internal data class SessionStamp(val epoch: Long, val email: String?, val firebaseEmail: String?)
    internal fun captureSession() = SessionStamp(sessionEpoch.get(), CuciinStore.session.value?.email, FirebaseCloud.currentEmail)
    internal fun sessionUnchanged(stamp: SessionStamp): Boolean = stamp == captureSession()
    @Synchronized fun invalidateSession() { sessionEpoch.incrementAndGet() }

    private var startedInternal = false
    private var syncing = false
    private var rerunRequested = false
    private var latestSnapshot: Snapshot? = null
    private var hadPersistedLocalData = false
    private var persistence: SyncPersistence? = null
    private var outbox = SyncOutbox()
    private var localWriteFile: java.io.File? = null

    @kotlinx.serialization.Serializable
    private data class PreparedLocalWrite(val prepared: PendingRemoteApply, val snapshot: Snapshot, val baseline: List<SyncEntity>, val actorEmail: String, val role: Role, val branchId: String, val branchIds: List<String>)

    @Synchronized internal fun prepareLocalBusinessWrite(directory: java.io.File, snapshot: Snapshot) {
        val prepared = outbox.state.pendingRemote ?: return
        val session = CuciinStore.session.value ?: error("Asal perubahan belum diketahui")
        check(prepared.actorEmail.isNotBlank() && prepared.actorEmail.equals(session.email, true) && prepared.scopeKey == sessionScope(session))
        val file = java.io.File(directory, "cuciin-prepared-local-write.json")
        val temp = java.io.File(directory, file.name + ".tmp")
        val baseline = checkNotNull(LocalJson.load()).let { it.copy(staff = it.staff.map { staff -> staff.copy(passwordHash = "") }) }
        val intent = PreparedLocalWrite(prepared, snapshot, SyncProjection.entities(baseline), session.email, session.role, session.branchId, session.branchIds)
        temp.writeText(LocalJson.json.encodeToString(PreparedLocalWrite.serializer(), intent))
        java.nio.file.Files.move(temp.toPath(), file.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING)
        localWriteFile = file
    }

    private fun sessionScope(session: Session): String = if (session.role == Role.Owner) "owner" else "${session.role.name.lowercase()}:${session.email.lowercase()}:${session.branchIds.distinct().sorted().joinToString(",")}"

    private fun restorePreparedLocalWrite(restored: Snapshot, prepared: PendingRemoteApply): Snapshot? {
        val file = localWriteFile?.takeIf { it.exists() } ?: return null
        val intent = LocalJson.json.decodeFromString(PreparedLocalWrite.serializer(), file.readText())
        if (intent.prepared != prepared) return null
        check(intent.actorEmail.isNotBlank() && intent.actorEmail.equals(prepared.actorEmail, true))
        check(sessionScope(Session(intent.role, "", intent.actorEmail, intent.branchId, intent.branchIds)) == prepared.scopeKey && !outbox.blockedActor(intent.actorEmail))
        if (SyncProjection.entities(intent.snapshot) != SyncProjection.entities(restored)) return null
        check(restored.sessionEmail.equals(intent.actorEmail, true))
        val before = intent.baseline.associateBy { it.key }
        val desired = SyncProjection.entities(restored).associateBy { it.key }
        val changes = (before.keys + desired.keys).mapNotNull { key ->
            val old = before[key]
            val next = desired[key]
            if (old == next) null else SyncChange(entityType = (next ?: old)!!.entityType, entityId = (next ?: old)!!.entityId,
                operation = if (next == null) "delete" else "upsert", branchId = (next ?: old)!!.branchId, payload = next?.payload ?: kotlinx.serialization.json.JsonNull)
        }
        // Shadow durable sudah memuat edit sebelumnya; baseline intent hanya mencakup edit terakhir.
        val base = if (prepared.generation >= 0 && outbox.state.generation > prepared.generation) {
            val shadow = outbox.state.shadow.associateBy { it.key }
            val cumulative = (prepared.entities.associateBy { it.key } + shadow).map { (key, entity) ->
                SyncChange(entityType = entity.entityType, entityId = entity.entityId, operation = if (key in shadow) "upsert" else "delete",
                    branchId = entity.branchId, payload = shadow[key]?.payload ?: kotlinx.serialization.json.JsonNull)
            }
            SyncProjection.apply(prepared.snapshot, cumulative, restored.updatedAt)
        } else prepared.snapshot
        val canonical = SyncProjection.apply(base, changes, restored.updatedAt)
        outbox.enqueueDurably(SyncProjection.entities(canonical), restored.updatedAt, intent.branchId, intent.branchIds.toSet(), intent.role, intent.actorEmail) { persistence?.save(it) }
        return canonical
    }
    @Volatile private var rejectedNeedsRecovery = false
    private val endpointConfigured: Boolean get() = BuildConfig.CUCIIN_CLOUD_URL.isNotBlank()

    @Synchronized fun init(application: Application) {
        localWriteFile = java.io.File(application.filesDir, "cuciin-prepared-local-write.json")
        if (persistence != null) return
        val disk = SyncPersistence(application)
        val loaded = SyncOutbox(disk.load())
        outbox = loaded
        persistence = disk
        pendingCount = outbox.state.pending.size
        rejectedNeedsRecovery = outbox.state.rejected.isNotEmpty()
        updateRejectedStatus()
    }

    @Synchronized fun migrateLocalActor(persistedSessionEmail: String?) {
        outbox.migrateLegacyActor(persistedSessionEmail) { persistence?.save(it) }
        pendingCount = outbox.state.pending.size
        rejectedNeedsRecovery = outbox.state.rejected.isNotEmpty()
        updateRejectedStatus()
    }

    @Synchronized internal fun validatePreparedBusiness(snapshot: Snapshot?) {
        val prepared = outbox.state.pendingRemote ?: return
        if (snapshot == null || outbox.state.pending.isNotEmpty() || outbox.state.generation > prepared.generation) return
        val file = localWriteFile?.takeIf { it.exists() }
        if (file != null) {
            val intent = LocalJson.json.decodeFromString(PreparedLocalWrite.serializer(), file.readText())
            if (intent.prepared == prepared && intent.actorEmail.isNotBlank() && intent.actorEmail.equals(prepared.actorEmail, true) && snapshot.sessionEmail.equals(intent.actorEmail, true) && SyncProjection.entities(intent.snapshot) == SyncProjection.entities(snapshot.copy(staff = snapshot.staff.map { it.copy(passwordHash = "") }))) return
        }
        fun business(entities: List<SyncEntity>) = entities.filterNot { it.entityType in setOf("staff", "accessRole", "accessPolicy") }
        val saved = business(SyncProjection.entities(snapshot))
        check(saved == business(outbox.state.shadow) || saved == business(prepared.entities)) { "Delta bisnis lama belum memiliki bukti asal durable" }
    }

    @Synchronized fun initializeLocalState(snapshot: Snapshot, hadPersistedData: Boolean, persistedSnapshot: Snapshot? = null): Snapshot? {
        val originEmail = persistedSnapshot?.sessionEmail.orEmpty().trim().lowercase()
        val restored = persistedSnapshot?.copy(staff = persistedSnapshot.staff.map { it.copy(passwordHash = "") }) ?: snapshot
        outbox.state.pendingRemote?.let { prepared ->
            val recoveredEdit = restorePreparedLocalWrite(restored, prepared)
            persistence?.save(outbox.state)
            hadPersistedLocalData = hadPersistedData
            // Naik katalog role mengubah waktu simpan, bukan generation perubahan bisnis.
            val newerLocal = prepared.generation >= 0 && outbox.state.generation > prepared.generation
            latestSnapshot = recoveredEdit ?: if (newerLocal) snapshot else prepared.snapshot
            if (FirebaseCloud.enabled) return null
            return latestSnapshot
        }
        val session = CuciinStore.session.value
        outbox.restoreStartup(restored, snapshot, session?.branchId, allowedSyncBranches(session, CuciinStore.staff), session?.role, originEmail) { persistence?.save(it) }
        latestSnapshot = snapshot
        hadPersistedLocalData = hadPersistedData
        pendingCount = outbox.state.pending.size
        rejectedNeedsRecovery = outbox.state.rejected.isNotEmpty()
        updateRejectedStatus()
        return null
    }

    internal fun storageUnavailable(message: String) {
        online = false
        lastStatus = message
    }

    fun onAuthenticated() { if (endpointConfigured) synchronize() }

    fun submitRegistration(name: String, email: String, role: Role, branchId: String, onDone: (String?) -> Unit) {
        if (!endpointConfigured) {
            main.post { onDone("Server pendaftaran belum dikonfigurasi") }
            return
        }
        io.execute {
            try {
                val conn = open("POST", apiUrl("/v1/registration"), email)
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
                    val verified = verifiedIdentity(body) {
                        val permissions = open("GET", apiUrl("/v1/snapshot"))
                        try {
                            val accessCode = permissions.responseCode
                            check(accessCode in 200..299) { "Izin akun belum dapat diverifikasi ($accessCode)" }
                            LocalJson.json.decodeFromString(Snapshot.serializer(), readBody(permissions, accessCode))
                        } finally { permissions.disconnect() }
                    }
                    main.post { onDone(verified, null) }
                } else main.post {
                    onDone(null, if (code == 401 || code == 403) "Akun tidak aktif atau belum disetujui Owner" else "Server identitas belum tersedia ($code)")
                }
            } catch (error: Exception) {
                Log.w(TAG, "verifikasi identitas gagal", error)
                main.post { onDone(null, "Tidak dapat memverifikasi akses ke server") }
            }
        }
    }

    internal fun verifiedIdentity(body: String, fallback: () -> Snapshot): CloudIdentity {
        val identity = LocalJson.json.decodeFromString(CloudIdentity.serializer(), body)
        val access = identity.access ?: fallback()
        val account = access.staff.firstOrNull { it.email.equals(identity.email, true) }
        check(account != null && account.approved && account.branchIds.isNotEmpty()) { "Akun tidak aktif atau belum memiliki cabang" }
        return identity.copy(name = account.name, role = account.role, branchIds = account.branchIds, access = access)
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
                // Polling latar belakang untuk menarik perubahan cabang lain.
                // Pengiriman perubahan lokal tetap instan karena dipicu langsung
                // oleh push(). Nilai 60 detik cukup segar antar-kasir tanpa
                // memboroskan baterai, kuota data, dan kuota baca server.
                poll.postDelayed(this, 60_000)
            }
        })
    }

    /** Existing store entry point; changes are now recorded per entity before network I/O. */
    @Synchronized fun push(snapshot: Snapshot) {
        accountSwitchError(CuciinStore.session.value?.email.orEmpty())?.let {
            markOffline(it)
            return
        }
        if (!recordLocalSnapshot(snapshot)) return
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

    @Synchronized internal fun recordLocalSnapshot(snapshot: Snapshot): Boolean {
        val session = CuciinStore.session.value ?: return false
        if (accountSwitchError(session.email) != null) return false
        val recovered = outbox.state.pendingRemote?.let { prepared ->
            restorePreparedLocalWrite(snapshot.copy(sessionEmail = session.email), prepared)
        }
        if (recovered == null) outbox.enqueueDurably(SyncProjection.entities(snapshot), snapshot.updatedAt.takeIf { it > 0 } ?: Clock.nowMs(),
            session.branchId, allowedSyncBranches(session, CuciinStore.staff), session.role, session.email) { persistence?.save(it) }
        latestSnapshot = recovered ?: snapshot
        pendingCount = outbox.state.pending.size
        rejectedNeedsRecovery = outbox.state.rejected.isNotEmpty()
        updateRejectedStatus()
        return true
    }

    fun pull() = synchronize()

    @Synchronized fun acceptRemoteSnapshot(snapshot: Snapshot) {
        val accepted = outbox.completePreparedRemote { persistence?.save(it) } ||
            outbox.acceptRemote(SyncProjection.entities(snapshot), outbox.state.revision, persist = { persistence?.save(it) })
        if (accepted) {
            latestSnapshot = snapshot
            pendingCount = outbox.state.pending.size
            rejectedNeedsRecovery = outbox.state.rejected.isNotEmpty()
            updateRejectedStatus()
        }
    }

    fun persistAppliedRemote(localSnapshot: Snapshot, cloudSnapshot: Snapshot, onDone: (() -> Unit)? = null) {
        if (CuciinStore.storageError != null) return
        val stamp = captureSession()
        val prepared = synchronized(this) { outbox.state.pendingRemote }
        val generation = synchronized(this) { outbox.state.generation }
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30)
        disk.execute {
            try {
                val completedState = synchronized(this) {
                    if (CuciinStore.storageError != null || !sessionUnchanged(stamp) || outbox.state.pendingRemote !== prepared || outbox.state.generation != generation || System.nanoTime() - deadline >= 0) return@execute
                    LocalJson.save(localSnapshot)
                    completeRecoveredRemote(cloudSnapshot)
                    outbox.state
                }
                if (onDone != null) main.post {
                    if (CuciinStore.storageError == null && sessionUnchanged(stamp) && System.nanoTime() - deadline < 0 && synchronized(this) { outbox.state === completedState }) onDone()
                }
            } catch (error: Exception) {
                markOffline("Pemulihan belum tersimpan. Periksa ruang penyimpanan lalu coba lagi.", error)
            }
        }
    }

    @Synchronized fun completeRecoveredRemote(snapshot: Snapshot) {
        val completed = outbox.completePreparedRemote { persistence?.save(it) }
        latestSnapshot = snapshot
        if (completed) {
            pendingCount = outbox.state.pending.size
            rejectedNeedsRecovery = outbox.state.rejected.isNotEmpty()
            updateRejectedStatus()
        }
    }

    @Synchronized fun hasPreparedRemote(): Boolean = outbox.state.pendingRemote != null

    private fun synchronize() {
        if (CuciinStore.storageError != null || !endpointConfigured || (FirebaseCloud.enabled && !FirebaseCloud.authenticated)) return
        synchronized(this) {
            if (syncing) { rerunRequested = true; return }
            syncing = true
        }
        io.execute {
            try {
                if (!refreshAuthorization() || CuciinStore.session.value == null) return@execute
                if (!retryPreparedRemote()) return@execute
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

    private fun retryPreparedRemote(): Boolean {
        if (!hasPreparedRemote()) return true
        val stamp = captureSession()
        val completed = CountDownLatch(1)
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30)
        var applied = false
        main.post {
            try {
                applied = applyPreparedRemote(stamp, deadline)
            } finally { completed.countDown() }
        }
        if (!completed.await(30, TimeUnit.SECONDS) || !applied) {
            markOffline("Pemulihan tertahan. Masuk dengan akun asal dan cabang yang sama, lalu periksa ruang penyimpanan.")
            return false
        }
        return true
    }

    internal fun applyPreparedRemote(stamp: SessionStamp, deadline: Long): Boolean {
        if (!sessionUnchanged(stamp) || System.nanoTime() - deadline >= 0) return false
        val snapshot = synchronized(this) {
            val prepared = outbox.state.pendingRemote ?: return@synchronized null
            val session = CuciinStore.session.value ?: return false
            val scope = sessionScope(session)
            if (prepared.actorEmail.isBlank() || !prepared.actorEmail.equals(session.email.trim(), true) || prepared.scopeKey != scope) return false
            latestSnapshot?.takeIf {
                prepared.generation >= 0 && outbox.state.generation > prepared.generation
            } ?: prepared.snapshot
        }
        return snapshot == null || CuciinStore.applyRecoveredCloud(snapshot)
    }

    private fun flushCommands(): EndpointResult {
        val requestSession = captureSession()
        while (true) {
            if (!sessionUnchanged(requestSession)) return EndpointResult.FAILED
            val actorEmail = verifiedSessionEmail()
            val batch = synchronized(this) {
                if (outbox.blockedActor(actorEmail)) null else outbox.nextBatch(BATCH_LIMIT)
            }
            if (batch == null) {
                markOffline("Login akun asal untuk mengirim perubahan")
                return EndpointResult.FAILED
            }
            if (batch.isEmpty()) return EndpointResult.OK
            val conn = open("POST", apiUrl("/v1/sync/commands"), actorEmail)
            conn.doOutput = true
            val payload = LocalJson.json.encodeToString(SyncCommandBatch.serializer(), SyncCommandBatch(batch))
            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload) }
            val code = conn.responseCode
            val body = readBody(conn, code)
            conn.disconnect()
            if (!sessionUnchanged(requestSession)) return EndpointResult.FAILED
            if (code in setOf(404, 405, 501)) return EndpointResult.UNSUPPORTED
            val decoded = runCatching { LocalJson.json.decodeFromString(SyncCommandResponse.serializer(), body) }
            val response = decoded.getOrNull()
            if (code !in 200..299) {
                if (code in setOf(403, 409, 422) && response != null) {
                    val reasons = response.rejected().toMutableMap()
                    response.commandId?.takeIf { id -> batch.any { it.commandId == id } }
                        ?.let { reasons[it] = response.topLevelReason() }
                    if (reasons.isEmpty() && batch.size == 1) reasons[batch.single().commandId] = response.topLevelReason()
                    if (synchronized(this) { if (sessionUnchanged(requestSession)) moveToRejected(reasons) else 0 } > 0) continue
                }
                markOffline("Sinkronisasi ditolak server ($code)")
                return EndpointResult.FAILED
            }
            if (response == null) {
                markOffline("Jawaban sinkronisasi tidak valid", decoded.exceptionOrNull()); return EndpointResult.FAILED
            }
            val moved = applyCommandResponse(response, requestSession)
            if (moved == 0) { markOffline("Server belum mengakui perubahan"); return EndpointResult.FAILED }
            markOnline()
        }
    }

    @Synchronized internal fun applyCommandResponse(response: SyncCommandResponse, stamp: SessionStamp): Int {
        if (!sessionUnchanged(stamp)) return 0
        val moved = outbox.applyCommandResults(response, Clock.nowMs()) { persistence?.save(it) }
        if (moved > 0) {
            pendingCount = outbox.state.pending.size
            rejectedNeedsRecovery = outbox.state.rejected.isNotEmpty()
            updateRejectedStatus()
        }
        return moved
    }

    @Synchronized internal fun resetScopeResponse(stamp: SessionStamp, scopeKey: String): Boolean {
        if (!sessionUnchanged(stamp)) return false
        val reset = outbox.resetForScope(scopeKey) { persistence?.save(it) }
        if (reset) {
            hadPersistedLocalData = false
            pendingCount = outbox.state.pending.size
            rejectedNeedsRecovery = outbox.state.rejected.isNotEmpty()
            updateRejectedStatus()
        }
        return reset
    }

    private fun pullChanges(): EndpointResult {
        val requestSession = captureSession()
        var after = synchronized(this) { outbox.state.revision }
        val base = synchronized(this) { latestSnapshot } ?: return EndpointResult.OK
        val expectedGeneration = synchronized(this) { outbox.state.generation }
        var current = base
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
            if (!sessionUnchanged(requestSession)) return EndpointResult.FAILED
            val knownScope = synchronized(this) { outbox.state.scopeKey }
            if (response.scopeKey.isNotBlank() && response.scopeKey != knownScope) {
                val reset = synchronized(this) {
                    if (!sessionUnchanged(requestSession)) return EndpointResult.FAILED
                    resetScopeResponse(requestSession, response.scopeKey)
                }
                return if (reset) bootstrapSnapshot() else EndpointResult.FAILED
            }
            if (response.scopeKey.isNotBlank()) responseScope = response.scopeKey
            current = SyncProjection.apply(current, response.changes, maxOf(current.updatedAt + 1, Clock.nowMs()))
            val next = response.cursor()
            if (next < after) return recoverRejectedSnapshot()
            // Kursor harus turun bila perangkat berada DI DEPAN server. Kalau tidak, halaman jurnal
            // yang lebih tua dari kursor perangkat tidak akan pernah dibaca lagi: server menjawab
            // kosong, `maxOf` mempertahankan kursor lama, dan perangkat berhenti menerima perubahan
            // selamanya. Perbaikan sebelumnya hanya menambah entri, jadi keadaan server yang sudah
            // berubah tidak pernah sampai ke perangkat.
            if (!response.hasMore) { after = next; break }
            if (next <= after) { markOffline("Cursor sinkronisasi server tidak maju"); return EndpointResult.FAILED }
            after = next
        }
        val remote = current
        val revision = after
        // Full snapshot hanya otoritatif pada scope yang sama dan revision yang mencakup halaman delta.
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30)
        val authorized = authorizedSnapshot()
        val authorization = authorized?.snapshot
        val (kanonik, canonicalRevision) = canonicalPulledSnapshot(remote, revision, responseScope, authorization, authorized?.revision, authorized?.scope)
        main.post {
            applyRemoteSafely({  }) {
                if (!sessionUnchanged(requestSession)) return@applyRemoteSafely
                if (System.nanoTime() - deadline >= 0 || CuciinStore.storageError != null) return@applyRemoteSafely
                if (authorization != null) CuciinStore.applyVerifiedAccess(authorization)
                if (!sessionUnchanged(requestSession)) return@applyRemoteSafely
                val accepted = synchronized(this) {
                    sessionScope(CuciinStore.session.value ?: return@applyRemoteSafely) == responseScope && outbox.canAcceptRemote(expectedGeneration)
                }
                if (accepted) {
                    val prepared = prepareAuthorizedPull(requestSession, deadline, kanonik, canonicalRevision, expectedGeneration, responseScope)
                    if (prepared) CuciinStore.applyCloud(kanonik) else synchronize()
                } else synchronize()
            }
        }
        markOnline()
        return EndpointResult.OK
    }

    /**
     * Snapshot server lengkap, khusus untuk menyamakan hak akses.
     *
     * Dipakai `pullChanges` pada perangkat yang sudah bootstrap. Kegagalan di sini tidak menghentikan
     * sinkronisasi: pemanggilnya memakai snapshot hasil tarikan bertahap apa adanya, sehingga hanya
     * hak akses yang tertunda penyamaannya, bukan seluruh sinkronisasi.
     *
     * Alamatnya harus endpoint snapshot, bukan alamat dasar Worker. Worker tidak punya rute di akar
     * (`/`), jadi permintaan ke alamat dasar selalu dijawab 404 dan fungsi ini diam-diam selalu
     * mengembalikan null. Akibatnya penyamaan hak akses TIDAK PERNAH berjalan: perangkat yang sudah
     * `bootstrapped` terus memakai peran lama. Terbukti 21 Sep pada 1.10.36-debug —
     * `aidanurita25@gmail.com` masih "Aida · SPV" di HP padahal D1 sudah menyimpannya sebagai Kasir,
     * dan akun yang sudah dihapus dari server masih muncul di layar Daftar User.
     */
    private fun refreshAuthorization(): Boolean {
        val requestSession = captureSession()
        val conn = open("GET", apiUrl("/v1/me"))
        val code = conn.responseCode
        val body = readBody(conn, code)
        conn.disconnect()
        val remote = if (code in 200..299) runCatching {
            verifiedIdentity(body) { hakAksesDariServer() ?: error("Izin akun belum dapat diverifikasi") }.access
        }.getOrNull() else null
        val completed = CountDownLatch(1)
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(15)
        var applied = false
        main.post {
            try {
                applied = applyAuthorizationResponse(requestSession, code, remote, deadline)
            } finally { completed.countDown() }
        }
        check(completed.await(15, TimeUnit.SECONDS)) { "Penyegaran izin belum selesai" }
        return applied
    }

    internal fun applyAuthorizationResponse(stamp: SessionStamp, code: Int, remote: Snapshot?, deadline: Long): Boolean {
        if (!sessionUnchanged(stamp) || System.nanoTime() - deadline >= 0) return false
        if (remote != null) CuciinStore.applyVerifiedAccess(remote)
        else if (code == 401 || code == 403) CuciinStore.logout()
        else return false
        return true
    }

    internal data class AuthorizedSnapshot(val snapshot: Snapshot, val revision: Long?, val scope: String?)

    private class SnapshotRecoveryRequired : IllegalStateException("Pemulihan data server belum dapat diverifikasi")

    private fun authorizedSnapshot(): AuthorizedSnapshot? = runCatching {
        readAuthorizedSnapshot(open("GET", apiUrl("/v1/snapshot")))
    }.onFailure { if (it is SnapshotRecoveryRequired) throw it }.getOrNull()

    internal fun readAuthorizedSnapshot(conn: HttpURLConnection): AuthorizedSnapshot? = try {
        val code = conn.responseCode
        val body = readBody(conn, code)
        val recoveryRequired = code == 503 && runCatching {
            LocalJson.json.parseToJsonElement(body).jsonObject["code"]?.jsonPrimitive?.content == "snapshot_recovery_required"
        }.getOrDefault(false)
        if (recoveryRequired) throw SnapshotRecoveryRequired()
        if (code !in 200..299 || body.isBlank()) null
        else AuthorizedSnapshot(LocalJson.json.decodeFromString(Snapshot.serializer(), body),
            conn.getHeaderField("X-Cuciin-Revision")?.toLongOrNull(), conn.getHeaderField("X-Cuciin-Scope"))
    } finally { conn.disconnect() }

    private fun hakAksesDariServer(): Snapshot? = authorizedSnapshot()?.snapshot

    private fun bootstrapSnapshot(): EndpointResult {
        val requestSession = captureSession()
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
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30)
        var result = EndpointResult.FAILED
        main.post {
            applyRemoteSafely({ completed.countDown() }) {
                if (!sessionUnchanged(requestSession)) { completed.countDown(); return@applyRemoteSafely }
                if (System.nanoTime() - deadline >= 0) { completed.countDown(); return@applyRemoteSafely }
                val local = synchronized(this) { latestSnapshot }
                if (local != null) {
                    if (synchronized(this) { outbox.state.pending.isNotEmpty() }) {
                        result = EndpointResult.OK
                        completed.countDown()
                        return@applyRemoteSafely
                    }
                    if (remote.staff.isEmpty()) {
                        synchronized(this) {
                            val session = CuciinStore.session.value
                            outbox.reconcileBootstrap(
                                emptyList(), SyncProjection.entities(local), 0, Clock.nowMs(), session?.branchId,
                                allowedSyncBranches(session, CuciinStore.staff), session?.role, remoteScope,
                                actorEmail = session?.email.orEmpty(), persist = { persistence?.save(it) },
                            )
                            pendingCount = outbox.state.pending.size
                        }
                    } else {
                        val canonical = SyncProjection.bootstrapSnapshot(
                            remote,
                            local,
                            hadPersistedLocalData,
                            maxOf(remote.updatedAt, local.updatedAt + 1, Clock.nowMs()),
                        )
                        synchronized(this) {
                            val remoteEntities = SyncProjection.entities(remote)
                            val canonicalEntities = SyncProjection.entities(canonical)
                            if (remoteEntities == canonicalEntities) {
                                prepareBootstrapSnapshot(canonical, remoteRevision, remoteScope, requestSession.email.orEmpty())
                            } else {
                                prepareReconciledBootstrap(remote, canonical, remoteRevision, remoteScope)
                            }
                        }
                        CuciinStore.applyCloud(canonical) {
                            result = EndpointResult.OK
                            completed.countDown()
                        }
                        return@applyRemoteSafely
                    }
                    result = EndpointResult.OK
                }
                completed.countDown()
            }
        }
        if (!completed.await(30, TimeUnit.SECONDS)) {
            markOffline("Bootstrap database melewati batas waktu")
            return EndpointResult.FAILED
        }
        return result
    }

    internal fun applyRemoteSafely(onFailure: () -> Unit, apply: () -> Unit) {
        try { apply() } catch (_: Exception) {
            online = false
            lastStatus = "Data belum tersimpan. Periksa ruang penyimpanan lalu coba lagi."
            try { CuciinStore.touchStatus() } finally { onFailure() }
        }
    }

    internal fun canonicalPulledSnapshot(delta: Snapshot, revision: Long, scope: String, authorized: Snapshot?, authorizedRevision: Long?, authorizedScope: String?): Pair<Snapshot, Long> {
        if (authorized != null && authorizedRevision != null && authorizedRevision >= revision && revision >= 0 && scope.isNotBlank() && authorizedScope == scope) {
            return authorized.copy(updatedAt = maxOf(delta.updatedAt + 1, authorized.updatedAt, Clock.nowMs())) to authorizedRevision
        }
        return (authorized?.let { SyncProjection.samakanHakAkses(delta, it) } ?: delta) to revision
    }

    @Synchronized internal fun prepareAuthorizedPull(stamp: SessionStamp, deadline: Long, snapshot: Snapshot, revision: Long, generation: Long, scope: String): Boolean {
        val session = CuciinStore.session.value ?: return false
        if (CuciinStore.storageError != null || !sessionUnchanged(stamp) || System.nanoTime() - deadline >= 0 || stamp.email.isNullOrBlank() || sessionScope(session) != scope) return false
        return preparePulledRemote(snapshot, revision, generation, scope, stamp.email)
    }

    @Synchronized internal fun preparePulledRemote(snapshot: Snapshot, revision: Long, generation: Long, scope: String, actorEmail: String): Boolean =
        outbox.prepareRemote(snapshot, SyncProjection.entities(snapshot), revision, generation, scope, actorEmail) { persistence?.save(it) }

    @Synchronized internal fun prepareBootstrapSnapshot(snapshot: Snapshot, revision: Long, scope: String, actorEmail: String) {
        outbox.prepareBootstrapRemote(snapshot, SyncProjection.entities(snapshot), revision, scope, actorEmail) { persistence?.save(it) }
        latestSnapshot = snapshot
    }

    @Synchronized internal fun prepareReconciledBootstrap(remote: Snapshot, canonical: Snapshot, revision: Long, scope: String) {
        val session = CuciinStore.session.value
        outbox.reconcileBootstrap(
            SyncProjection.entities(remote), SyncProjection.entities(canonical), revision, Clock.nowMs(),
            session?.branchId, allowedSyncBranches(session, CuciinStore.staff), session?.role, scope,
            actorEmail = session?.email.orEmpty(), persist = { persistence?.save(it) }, preparedSnapshot = canonical,
        )
        pendingCount = outbox.state.pending.size
        latestSnapshot = canonical
    }

    internal fun prepareRejectedRecovery(recovery: Snapshot, revision: Long, scope: String): Boolean = synchronized(this) {
        outbox.reconcileRejectedRemote(recovery, SyncProjection.entities(recovery), revision, scope, CuciinStore.session.value?.email.orEmpty()) { persistence?.save(it) }
    }

    /** Rejection permanen harus kembali ke snapshot server, bukan tinggal sebagai data lokal berbeda. */
    private fun recoverRejectedSnapshot(): EndpointResult {
        val requestSession = captureSession()
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
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30)
        var result = EndpointResult.FAILED
        main.post {
            applyRemoteSafely({ completed.countDown() }) {
                if (!sessionUnchanged(requestSession)) { completed.countDown(); return@applyRemoteSafely }
                if (System.nanoTime() - deadline >= 0) { completed.countDown(); return@applyRemoteSafely }
                val recovery = remote.copy(updatedAt = maxOf(remote.updatedAt, CuciinStore.syncUpdatedAt() + 1, Clock.nowMs()))
                val reconciled = prepareRejectedRecovery(recovery, remoteRevision, remoteScope)
                if (!reconciled) {
                    completed.countDown()
                    return@applyRemoteSafely
                }
                CuciinStore.applyCloud(recovery) {
                    result = EndpointResult.OK
                    completed.countDown()
                }
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
        val requestSession = captureSession()
        val (snapshot, requestState) = synchronized(this) { latestSnapshot to outbox.state }
        if (snapshot == null) return legacyPull()
        if (requestState.pending.isNotEmpty()) {
            val actorEmail = verifiedSessionEmail()
            if (synchronized(this) { outbox.blockedActor(actorEmail) }) {
                markOffline("Login akun asal untuk mengirim perubahan")
                return EndpointResult.FAILED
            }
            val conn = open("PUT", expectedActorEmail = actorEmail)
            conn.doOutput = true
            val payload = LocalJson.json.encodeToString(Snapshot.serializer(), snapshot)
            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload) }
            val code = conn.responseCode
            readBody(conn, code)
            conn.disconnect()
            if (code !in 200..299) { markOffline("Perubahan belum terkirim ke server ($code)"); return EndpointResult.FAILED }
            synchronized(this) {
                if (!sessionUnchanged(requestSession)) return EndpointResult.FAILED
                if (!applyLegacyUploadResponse(requestSession, snapshot, requestState.generation, requestState.pending.mapTo(hashSetOf()) { it.commandId })) return EndpointResult.FAILED
            }
            markOnline("Database server nyambung · mode kompatibilitas")
        }
        if (!sessionUnchanged(requestSession)) return EndpointResult.FAILED
        return legacyPull()
    }

    @Synchronized internal fun applyLegacyUploadResponse(stamp: SessionStamp, snapshot: Snapshot, generation: Long, uploadedIds: Set<String>): Boolean {
        if (!sessionUnchanged(stamp)) return false
        val canPull = outbox.acceptLegacySnapshot(SyncProjection.entities(snapshot), generation, uploadedIds) { persistence?.save(it) }
        pendingCount = outbox.state.pending.size
        rejectedNeedsRecovery = outbox.state.rejected.isNotEmpty()
        updateRejectedStatus()
        return canPull
    }

    private fun legacyPull(): EndpointResult {
        val requestSession = captureSession()
        val generation = synchronized(this) { outbox.state.generation }
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30)
        val conn = open("GET")
        val code = conn.responseCode
        val body = readBody(conn, code)
        conn.disconnect()
        if (code != 200 || body.isBlank()) { markOffline("Server $code"); return EndpointResult.FAILED }
        val snapshot = runCatching { LocalJson.json.decodeFromString(Snapshot.serializer(), body) }.getOrElse {
            markOffline("Snapshot server tidak valid", it); return EndpointResult.FAILED
        }
        if (!sessionUnchanged(requestSession)) return EndpointResult.FAILED
        main.post {
            applyRemoteSafely({  }) {
                if (!sessionUnchanged(requestSession)) return@applyRemoteSafely
                if (prepareLegacyPullResponse(requestSession, snapshot, generation, deadline)) CuciinStore.applyCloud(snapshot)
            }
        }
        markOnline("Database server nyambung · mode kompatibilitas")
        return EndpointResult.OK
    }

    @Synchronized internal fun prepareLegacyPullResponse(stamp: SessionStamp, snapshot: Snapshot, generation: Long, deadline: Long): Boolean {
        if (!sessionUnchanged(stamp) || System.nanoTime() - deadline >= 0) return false
        if (!preparePulledRemote(snapshot, outbox.state.revision, generation, outbox.state.scopeKey, stamp.email.orEmpty())) return false
        latestSnapshot = snapshot
        return true
    }

    @Synchronized fun accountSwitchError(email: String): String? =
        CuciinStore.storageError ?: if (outbox.blockedActor(email)) "Login akun asal untuk mengirim perubahan yang masih tersimpan" else null

    private fun verifiedSessionEmail(): String? = CuciinStore.session.value?.email?.trim()?.lowercase()
        ?.takeIf { it.isNotBlank() && it.equals(FirebaseCloud.currentEmail, ignoreCase = true) }

    @Synchronized private fun pendingCommands(): List<SyncCommand> = outbox.state.pending
    @Synchronized private fun needsBootstrap(): Boolean = !outbox.state.bootstrapped
    @Synchronized private fun saveState() {
        persistence?.save(outbox.state)
        pendingCount = outbox.state.pending.size
        rejectedNeedsRecovery = outbox.state.rejected.isNotEmpty()
        updateRejectedStatus()
    }

    @Synchronized private fun moveToRejected(reasons: Map<String, String>): Int {
        val moved = outbox.reject(reasons, Clock.nowMs(), persist = { persistence?.save(it) })
        if (moved > 0) {
            pendingCount = outbox.state.pending.size
            rejectedNeedsRecovery = true
            updateRejectedStatus()
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

    private fun open(method: String, endpoint: URL = URL(BuildConfig.CUCIIN_CLOUD_URL), expectedActorEmail: String? = null): HttpURLConnection {
        val user = if (FirebaseCloud.enabled) FirebaseAuth.getInstance().currentUser else null
        if (method != "GET") {
            val actor = expectedActorEmail ?: CuciinStore.session.value?.email
            check(!actor.isNullOrBlank() && user?.email?.equals(actor.trim(), ignoreCase = true) == true) {
                "Akun Firebase berbeda dari sesi aplikasi; perubahan tidak dikirim"
            }
            if (endpoint.path != "/v1/registration") {
                check(CuciinStore.session.value?.email?.equals(actor.trim(), ignoreCase = true) == true) {
                    "Sesi aplikasi berganti; perubahan tidak dikirim"
                }
            }
        }
        // Token berasal dari user yang diperiksa, bukan akun baru setelah pergantian login.
        val token = user?.let { Tasks.await(it.getIdToken(false), 10, TimeUnit.SECONDS).token }
        if (method != "GET") check(!token.isNullOrBlank()) { "Token akun tidak tersedia; perubahan tidak dikirim" }
        val conn = endpoint.openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = 12_000
        conn.readTimeout = 12_000
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Accept", "application/json")
        token?.let { conn.setRequestProperty("Authorization", "Bearer $it") }
        if (BuildConfig.CUCIIN_CLOUD_KEY.isNotBlank()) conn.setRequestProperty("X-Cuciin-Key", BuildConfig.CUCIIN_CLOUD_KEY)
        conn.useCaches = false
        return conn
    }

    private fun readBody(conn: HttpURLConnection, code: Int): String =
        (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()

    private enum class EndpointResult { OK, UNSUPPORTED, FAILED }
}
