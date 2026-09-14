package com.tiftazani.laundryops.data

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.tiftazani.laundryops.BuildConfig
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Sinkronisasi local-first. Endpoint produksi dipasang saat build melalui
 * CUCIIN_CLOUD_URL; tidak ada URL atau kunci server yang ditanam di repository.
 */
object CloudSync {
    private const val TAG = "CuciinCloud"
    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val poll = Handler(Looper.getMainLooper())

    @Volatile var lastStatus: String = "belum nyambung"
        private set
    @Volatile var lastOkAt: Long = 0
        private set
    @Volatile var online: Boolean = false
        private set

    private var started = false
    private var pushing = false
    @Volatile private var pendingPush: Snapshot? = null
    private val endpointConfigured: Boolean get() = BuildConfig.CUCIIN_CLOUD_URL.isNotBlank()

    fun onAuthenticated() {
        if (endpointConfigured) pull()
    }

    fun verifyIdentity(onDone: (CloudIdentity?, String?) -> Unit) {
        if (!endpointConfigured) {
            main.post { onDone(null, "Server identitas belum dikonfigurasi") }
            return
        }
        io.execute {
            try {
                val configured = URL(BuildConfig.CUCIIN_CLOUD_URL)
                val meUrl = URL(configured.protocol, configured.host, configured.port, "/v1/me")
                val conn = open("GET", meUrl)
                val code = conn.responseCode
                val body = (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.readText().orEmpty()
                conn.disconnect()
                if (code == 200) {
                    val identity = LocalJson.json.decodeFromString(CloudIdentity.serializer(), body)
                    main.post { onDone(identity, null) }
                } else {
                    main.post { onDone(null, if (code == 401 || code == 403) "Akun tidak aktif atau belum disetujui Owner" else "Server identitas belum tersedia ($code)") }
                }
            } catch (e: Exception) {
                Log.w(TAG, "verifikasi identitas gagal", e)
                main.post { onDone(null, "Tidak dapat memverifikasi akses ke server") }
            }
        }
    }

    fun onSignedOut() {
        pushing = false
        pendingPush = null
        online = false
        lastStatus = "Menunggu login untuk sinkronisasi"
    }

    fun start() {
        if (started) return
        started = true
        if (endpointConfigured) {
            lastStatus = if (FirebaseCloud.authenticated) "Menyambungkan database…" else "Menunggu login untuk sinkronisasi"
            if (FirebaseCloud.authenticated) pull()
            poll.post(object : Runnable {
                override fun run() {
                    if (FirebaseCloud.authenticated) pull()
                    poll.postDelayed(this, 12_000)
                }
            })
            return
        }
        lastStatus = "Mode lokal · server cloud belum dikonfigurasi"
        online = false
        CuciinStore.touchStatus()
    }

    fun pull() {
        if (!endpointConfigured) return
        io.execute {
            try {
                val conn = open("GET")
                val code = conn.responseCode
                val body = (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.readText().orEmpty()
                conn.disconnect()
                if (code == 200 && body.isNotBlank()) {
                    val snap = LocalJson.json.decodeFromString(Snapshot.serializer(), body)
                    online = true
                    lastOkAt = Clock.nowMs()
                    lastStatus = "Database server nyambung"
                    main.post { CuciinStore.applyCloud(snap) }
                } else {
                    online = false
                    lastStatus = "Server $code"
                    Log.w(TAG, "pull HTTP $code")
                    main.post { CuciinStore.touchStatus() }
                }
            } catch (e: Exception) {
                online = false
                lastStatus = "Koneksi server belum tersedia"
                Log.w(TAG, "pull gagal", e)
                main.post { CuciinStore.touchStatus() }
            }
        }
    }

    fun push(snap: Snapshot) {
        if (!endpointConfigured) {
            lastStatus = "Tersimpan aman di perangkat · server cloud belum aktif"
            online = false
            return
        }
        if (FirebaseCloud.enabled && !FirebaseCloud.authenticated) {
            lastStatus = "Tersimpan di HP · menunggu login untuk sinkronisasi"
            online = false
            return
        }
        if (pushing) {
            pendingPush = snap
            return
        }
        pushing = true
        io.execute {
            try {
                val payload = LocalJson.json.encodeToString(Snapshot.serializer(), snap)
                val conn = open("PUT")
                conn.doOutput = true
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload) }
                val code = conn.responseCode
                conn.inputStream?.close()
                conn.disconnect()
                online = code in 200..299
                lastStatus = if (online) "Database server nyambung" else "Push $code"
                if (online) lastOkAt = Clock.nowMs()
            } catch (e: Exception) {
                online = false
                lastStatus = "Perubahan belum terkirim ke server"
                Log.w(TAG, "push gagal", e)
            } finally {
                pushing = false
                val next = pendingPush
                pendingPush = null
                if (next != null && next.updatedAt > snap.updatedAt) push(next)
            }
        }
    }

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
}
