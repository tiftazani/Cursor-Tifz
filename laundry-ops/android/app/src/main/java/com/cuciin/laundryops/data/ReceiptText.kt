package com.cuciin.laundryops.data

/** Nota teks ringkas yang tetap terbaca rapi di WhatsApp. PDF memakai tata letak tabel tersendiri. */
object ReceiptText {
    fun format(nota: Nota, branch: Branch, template: WhatsAppTemplate = WhatsAppTemplate()): String {
        val mapLine = mapReference(branch.mapsQuery)
        val serviceLines = nota.lines.takeIf { it.isNotEmpty() }?.mapIndexed { index, line ->
            "${index + 1}. *${line.name}*\n   ${quantity(line.qty)} ${line.unit} × ${rp(line.unitPrice)}\n   Subtotal: *${rp((line.qty * line.unitPrice).toInt())}*"
        }?.joinToString("\n\n") ?: normalizeLegacyItems(nota.items)
        fun expand(value: String): String = value
            .replace("{pelanggan}", nota.customer)
            .replace("{cabang}", branch.name)
            .replace("{kasir}", nota.kasir)
            .replace("{nota}", nota.id)
        return """
            ${expand(template.opening)}

            ${expand(template.content)}

            *${branch.name.uppercase()}*
            _Nota Service ${nota.id}_

            ${branch.location.ifBlank { "Alamat cabang belum diisi" }}
            $mapLine

            *Informasi Service*
            Kasir: ${nota.kasir}
            Pelanggan: ${nota.customer}
            WhatsApp: ${nota.phone}
            Waktu Masuk: ${nota.createdAt}
            Estimasi Waktu Keluar: ${nota.pickupAt}
            Status Pengerjaan: ${nota.laundry.label}

            *Rincian Layanan*
            $serviceLines

            ─────────────
            *GRAND TOTAL: ${rp(nota.total)}*
            Dibayar: ${rp(nota.paid)}
            ${nota.payMethod.label} · ${nota.pay.label}

            ${expand(template.closing)}
        """.trimIndent()
    }

    private fun quantity(value: Double): String =
        if (value % 1.0 == 0.0) value.toInt().toString() else value.toString().replace('.', ',')

    private fun normalizeLegacyItems(value: String): String =
        Regex("(\\d+)\\.0\\s*([A-Za-z]+)").replace(value) { match -> "${match.groupValues[1]} ${match.groupValues[2]}" }

    private fun mapReference(raw: String): String {
        if (raw.isBlank()) return "Belum disimpan"
        if (raw.startsWith("https://", ignoreCase = true)) return raw
        val query = java.net.URLEncoder.encode(raw, Charsets.UTF_8.name()).replace("+", "%20")
        return "https://www.google.com/maps/search/?api=1&query=$query"
    }
}
