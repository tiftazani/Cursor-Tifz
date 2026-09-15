package com.tiftazani.laundryops.data

/** Membungkus teks berdasarkan ukuran aktual font, termasuk token panjang tanpa spasi. */
internal fun wrapMeasuredText(
    text: String,
    width: Float,
    maxLines: Int = Int.MAX_VALUE,
    measure: (String) -> Float,
): List<String> {
    if (text.isBlank() || width <= 0f || maxLines <= 0) return listOf("")

    fun splitToken(token: String): List<String> {
        if (measure(token) <= width) return listOf(token)
        val chunks = mutableListOf<String>()
        var current = ""
        token.forEach { character ->
            val candidate = current + character
            if (current.isNotEmpty() && measure(candidate) > width) {
                chunks += current
                current = character.toString()
            } else {
                current = candidate
            }
        }
        if (current.isNotEmpty()) chunks += current
        return chunks.ifEmpty { listOf(token) }
    }

    val result = mutableListOf<String>()
    text.lines().forEach { paragraph ->
        if (paragraph.isBlank()) {
            result += ""
            return@forEach
        }
        var line = ""
        paragraph.split(Regex("\\s+")).filter(String::isNotBlank).forEach { token ->
            splitToken(token).forEach { chunk ->
                val candidate = if (line.isBlank()) chunk else "$line $chunk"
                if (measure(candidate) <= width) {
                    line = candidate
                } else {
                    if (line.isNotBlank()) result += line
                    line = chunk
                }
            }
        }
        if (line.isNotBlank()) result += line
    }
    if (result.size <= maxLines) return result.ifEmpty { listOf("") }

    val clipped = result.take(maxLines).toMutableList()
    var last = clipped.last()
    while (last.isNotEmpty() && measure("$last…") > width) last = last.dropLast(1)
    clipped[clipped.lastIndex] = "$last…"
    return clipped
}

internal fun receiptPageLineCounts(lineCount: Int): List<Int> {
    if (lineCount <= 7) return listOf(lineCount.coerceAtLeast(0))
    val pages = mutableListOf(7)
    var remaining = lineCount - 7
    while (remaining > 0) {
        pages += minOf(remaining, 10)
        remaining -= 10
    }
    return pages
}
