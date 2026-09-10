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
 * Database di server: HP kasir/owner nge-share lewat
 * `https://cuan-tif.vercel.app/api/cuciin`. Kalau Firebase nyala, pakai Firestore.
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

    fun start() {
        if (started) return
        started = true
        if (FirebaseCloud.enabled) {
            lastStatus = "Firebase Firestore"
            online = true
            FirebaseCloud.listenSnapshot { snap ->
                CuciinStore.applyCloud(snap)
            }
            return
        }
        pull()
        poll.post(object : Runnable {
            override fun run() {
                pull()
                poll.postDelayed(this, 8_000)
            }
        })
    }

    fun pull() {
        if (FirebaseCloud.enabled) return
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
                    Log.w(TAG, "pull $code $body")
                    main.post { CuciinStore.touchStatus() }
                }
            } catch (e: Exception) {
                online = false
                lastStatus = "Server: ${e.message}"
                Log.w(TAG, "pull gagal", e)
                main.post { CuciinStore.touchStatus() }
            }
        }
    }

    fun push(snap: Snapshot) {
        if (FirebaseCloud.enabled) {
            FirebaseCloud.pushSnapshot(snap)
            return
        }
        if (pushing) return
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
                lastStatus = "Push: ${e.message}"
                Log.w(TAG, "push gagal", e)
            } finally {
                pushing = false
            }
        }
    }

    private fun open(method: String): HttpURLConnection {
        val conn = URL(BuildConfig.CUCIIN_CLOUD_URL).openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = 12_000
        conn.readTimeout = 12_000
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Accept", "application/json")
        conn.setRequestProperty("X-Cuciin-Key", BuildConfig.CUCIIN_CLOUD_KEY)
        conn.useCaches = false
        return conn
    }
}
