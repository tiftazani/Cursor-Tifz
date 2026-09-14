package com.tiftazani.laundryops.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.mutableStateOf
import java.net.URI

/** Receives an explicitly shared map link, never an arbitrary executable intent URI. */
internal object MapSelection {
    val pendingLink = mutableStateOf<String?>(null)

    fun parseShared(text: String): String? {
        val links = Regex("https?://[^\\s<>]+", RegexOption.IGNORE_CASE).findAll(text)
        return links.map { it.value.trimEnd('.', ',', ')', ']') }.firstOrNull { link ->
            runCatching {
                val uri = URI(link)
                val host = uri.host?.lowercase().orEmpty()
                val path = uri.path.orEmpty()
                uri.userInfo == null && (uri.port == -1 || uri.port == 443) && uri.scheme.equals("https", true) && when (host) {
                    "maps.app.goo.gl", "maps.google.com", "maps.apple.com" -> true
                    "google.com", "www.google.com", "google.co.id", "www.google.co.id" -> path == "/maps" || path.startsWith("/maps/")
                    "goo.gl" -> path.startsWith("/maps/")
                    "openstreetmap.org", "www.openstreetmap.org", "osm.org", "waze.com", "www.waze.com" -> true
                    else -> false
                }
            }.getOrDefault(false)
        }
    }

    fun receive(intent: Intent?) {
        if (intent?.action != Intent.ACTION_SEND || intent.type?.startsWith("text/") != true) return
        val candidates = buildList {
            intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.let(::add)
            intent.clipData?.let { clip ->
                repeat(clip.itemCount) { index ->
                    clip.getItemAt(index).text?.toString()?.let(::add)
                    clip.getItemAt(index).uri?.toString()?.let(::add)
                }
            }
        }
        candidates.firstNotNullOfOrNull(::parseShared)?.let { pendingLink.value = it }
    }

    fun open(context: Context, query: String, toast: (String) -> Unit) {
        val knownLink = parseShared(query)
        val geo = Uri.parse("geo:0,0?q=${Uri.encode(query.ifBlank { "laundry" })}")
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, knownLink?.let(Uri::parse) ?: geo))
        } catch (_: android.content.ActivityNotFoundException) {
            try {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(knownLink ?: "https://www.google.com/maps/search/?api=1&query=${Uri.encode(query.ifBlank { "laundry" })}")))
            } catch (_: android.content.ActivityNotFoundException) {
                toast("Aplikasi peta atau browser belum tersedia di perangkat ini.")
            }
        }
    }
}
