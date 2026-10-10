package com.cuciin.laundryops.data

import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.ServerSocket
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.junit.Assert.*
import org.junit.Test

class SnapshotRecoveryFailureTest {
    @Test fun authoritativeRecoveryFailureCannotBecomeOptionalMetadata() {
        val failure = request(503, "{\"code\":\"snapshot_recovery_required\",\"error\":\"Synthetic\"}")
        assertTrue("Kegagalan recovery wajib menghentikan pull, bukan menjadi snapshot izin null", failure.isFailure)
        assertTrue(failure.exceptionOrNull() is IllegalStateException)
    }

    @Test fun ordinaryTemporarySnapshotFailureStillAllowsLegacyDeltaFallback() {
        val failure = request(503, "{\"error\":\"Synthetic temporary failure\"}")
        assertTrue(failure.isSuccess)
        assertNull(failure.getOrNull())
    }

    private fun request(status: Int, payload: String): Result<CloudSync.AuthorizedSnapshot?> {
        val server = ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))
        val executor = Executors.newSingleThreadExecutor()
        try {
            val body = payload.toByteArray(Charsets.UTF_8)
            val response = executor.submit {
                server.accept().use { socket ->
                    socket.soTimeout = 5000
                    val input = socket.getInputStream().bufferedReader()
                    while (!input.readLine().isNullOrEmpty()) { }
                    socket.getOutputStream().use { output ->
                        output.write("HTTP/1.1 $status Synthetic\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n".toByteArray(Charsets.UTF_8))
                        output.write(body)
                    }
                }
            }
            val result = runCatching {
                val conn = URL("http://127.0.0.1:${server.localPort}/v1/snapshot").openConnection() as HttpURLConnection
                conn.connectTimeout = 5000
                conn.readTimeout = 5000
                CloudSync.readAuthorizedSnapshot(conn)
            }
            response.get(5, TimeUnit.SECONDS)
            return result
        } finally {
            server.close()
            executor.shutdownNow()
        }
    }
}
