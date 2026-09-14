package com.tiftazani.laundryops.data

/** Format tunggal untuk teks nota, WhatsApp, dan PDF. */
object ReceiptText {
    fun format(nota: Nota, branch: Branch): String {
        val mapLine = mapReference(branch.mapsQuery)
        val serviceLines = nota.lines.takeIf { it.isNotEmpty() }?.joinToString("\n") {
            "${it.name} ${quantity(it.qty)} ${it.unit} × ${rp(it.unitPrice)} = ${rp((it.qty * it.unitPrice).toInt())}"
        } ?: nota.items
        return """
            *CUCIIN — NOTA ${nota.id}*

            *Cabang layanan*
            ${branch.name}
            ${branch.location.ifBlank { "Alamat belum diisi" }}
            Maps: $mapLine

            Kasir: ${nota.kasir}
            Waktu Masuk: ${nota.createdAt}
            Estimasi Waktu Keluar: ${nota.pickupAt}
            Status Pengerjaan: ${nota.laundry.label}

            *Pelanggan*
            ${nota.customer}
            WA ${nota.phone}

            *Layanan*
            $serviceLines

            Total: ${rp(nota.total)}
            Dibayar: ${rp(nota.paid)}
            Metode: ${nota.payMethod.label}
            Pembayaran: ${nota.pay.label}
        """.trimIndent()
    }

    private fun quantity(value: Double): String =
        if (value % 1.0 == 0.0) value.toInt().toString() else value.toString().replace('.', ',')

    private fun mapReference(raw: String): String {
        if (raw.isBlank()) return "Belum disimpan"
        if (raw.startsWith("https://", ignoreCase = true)) return raw
        val query = java.net.URLEncoder.encode(raw, Charsets.UTF_8.name()).replace("+", "%20")
        return "https://www.google.com/maps/search/?api=1&query=$query"
    }
}
