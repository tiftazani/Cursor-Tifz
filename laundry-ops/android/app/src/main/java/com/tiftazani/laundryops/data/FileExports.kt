package com.tiftazani.laundryops.data

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.core.content.FileProvider
import com.tiftazani.laundryops.BuildConfig
import java.io.File

object FileExports {
    private fun csv(value: Any?): String = "\"${value?.toString().orEmpty().replace("\"", "\"\"")}\""

    fun copyProof(ctx: Context, notaId: String, uri: Uri): String? {
        val dir = File(ctx.filesDir, "proofs/$notaId").apply { mkdirs() }
        val name = "bukti-${Clock.nowMs()}.jpg"
        val dest = File(dir, name)
        return try {
            ctx.contentResolver.openInputStream(uri)?.use { input ->
                dest.outputStream().use { input.copyTo(it) }
            } ?: return null
            dest.absolutePath
        } catch (_: Exception) {
            null
        }
    }

    fun shareText(ctx: Context, text: String) {
        ctx.startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                },
                "Kirim nota",
            ),
        )
    }

    fun shareCsv(ctx: Context, n: Nota) {
        val dir = File(ctx.cacheDir, "share").apply { mkdirs() }
        val file = File(dir, "${n.id}.csv")
        file.writeText(buildString {
            appendLine("ID,Cabang,Waktu Masuk,Estimasi Waktu Keluar,Kasir,Pelanggan,Telepon,Layanan,Jumlah,Satuan,Harga Satuan,Subtotal,Petugas Layanan,Komisi,Total Service,Dibayar,Metode,Status Pembayaran,Status Pengerjaan")
            val lines = n.lines.ifEmpty { listOf(NotaLine("", n.items, 1.0, "Service", n.total, n.kasirEmail, n.kasir, 0)) }
            lines.forEach { line ->
                appendLine(listOf(
                    n.id, n.branchId, n.createdAt, n.pickupAt, n.kasir, n.customer, n.phone,
                    line.name, line.qty, line.unit, line.unitPrice, (line.qty * line.unitPrice).toInt(),
                    line.handledByName.ifBlank { n.kasir }, (line.qty * line.commissionPerUnit).toInt(),
                    n.total, n.paid, n.payMethod.label, n.pay.label, n.laundry.label,
                ).joinToString(",", transform = ::csv))
            }
        })
        shareFile(ctx, file, "text/csv")
    }

    fun shareAllData(ctx: Context, snapshot: Snapshot) {
        val safe = snapshot.copy(staff = snapshot.staff.map { it.copy(passwordHash = "") }, sessionEmail = null)
        shareGenerated(ctx, "cuciin-semua-data-${Clock.nowMs()}.json", "application/json", LocalJson.json.encodeToString(Snapshot.serializer(), safe))
    }

    fun shareFinancial(ctx: Context, notas: List<Nota>, expenses: List<Expense>) {
        val body = buildString {
            appendLine("No,Jenis,ID Service,Waktu,Cabang,Kasir,Pelanggan,Layanan,Jumlah,Satuan,Harga Satuan,Omzet Baris,Diterima Service,Petugas Layanan,Email Petugas,Komisi,Biaya,Metode,Status Pembayaran,Status Pengerjaan")
            var number = 1
            notas.sortedByDescending { it.createdAtMs }.forEach { n ->
                val branch = CuciinStore.branches.firstOrNull { it.id == n.branchId }?.name ?: n.branchId
                val lines = n.lines.ifEmpty { listOf(NotaLine("", n.items, 1.0, "Service", n.total, n.kasirEmail, n.kasir, 0)) }
                lines.forEachIndexed { lineIndex, line ->
                    appendLine(listOf(
                        number++, "Transaksi", n.id, n.createdAt, branch, n.kasir, n.customer,
                        line.name, line.qty, line.unit, line.unitPrice, (line.qty * line.unitPrice).toInt(),
                        if (lineIndex == 0) n.paid else 0,
                        line.handledByName.ifBlank { n.kasir }, line.handledByEmail.ifBlank { n.kasirEmail },
                        (line.qty * line.commissionPerUnit).toInt(), 0, n.payMethod.label, n.pay.label, n.laundry.label,
                    ).joinToString(",", transform = ::csv))
                }
            }
            expenses.sortedByDescending { it.occurredAtMs }.forEach { e ->
                val branch = CuciinStore.branches.firstOrNull { it.id == e.branchId }?.name ?: e.branchId
                appendLine(listOf(number++, "Biaya", e.id, e.occurredAt, branch, e.by, "", "${e.category.label} · ${e.note}", "", "", "", 0, 0, e.by, "", 0, e.amount, "", "", "").joinToString(",", transform = ::csv))
            }
        }
        shareGenerated(ctx, "laporan-keuangan-${Clock.nowMs()}.csv", "text/csv", body)
    }

    fun shareFinancialPdf(ctx: Context, notas: List<Nota>, expenses: List<Expense>, periodLabel: String) {
        val dir = File(ctx.cacheDir, "share").apply { mkdirs() }
        val file = File(dir, "laporan-transaksi-${Clock.nowMs()}.pdf")
        val pdf = PdfDocument()
        val ink = Color.rgb(19, 43, 55)
        val teal = Color.rgb(8, 117, 137)
        val muted = Color.rgb(92, 112, 122)
        val line = Color.rgb(211, 224, 228)
        val titlePaint = Paint().apply { color = Color.WHITE; textSize = 19f; isFakeBoldText = true; isAntiAlias = true }
        val bodyPaint = Paint().apply { color = ink; textSize = 8.2f; isAntiAlias = true }
        val mutedPaint = Paint(bodyPaint).apply { color = muted; textSize = 8.5f }
        val headerPaint = Paint(bodyPaint).apply { color = Color.WHITE; isFakeBoldText = true }
        val gridPaint = Paint().apply { color = line; style = Paint.Style.STROKE; strokeWidth = 0.8f }
        val omzet = notas.sumOf { it.total }
        val received = notas.sumOf { it.paid }
        val cost = expenses.sumOf { it.amount }
        data class ReportRow(val no: Int, val type: String, val id: String, val time: String, val branch: String, val officer: String, val description: String, val qty: String, val revenue: Int, val received: Int, val commission: Int, val expense: Int, val status: String)
        fun itemSummary(nota: Nota): String = nota.lines.takeIf { it.isNotEmpty() }?.joinToString { row ->
            val qty = if (row.qty % 1.0 == 0.0) row.qty.toInt().toString() else row.qty.toString().replace('.', ',')
            "${row.name} $qty ${row.unit}"
        } ?: Regex("(\\d+)\\.0\\s*([A-Za-z]+)").replace(nota.items) { match ->
            "${match.groupValues[1]} ${match.groupValues[2]}"
        }
        var number = 1
        val records = buildList {
            notas.sortedByDescending { it.createdAtMs }.forEach { n ->
                val branch = CuciinStore.branches.firstOrNull { it.id == n.branchId }?.name?.removePrefix("Cuciin ") ?: n.branchId
                val lines = n.lines.ifEmpty { listOf(NotaLine("", itemSummary(n), 1.0, "Service", n.total, n.kasirEmail, n.kasir, 0)) }
                lines.forEachIndexed { index, line ->
                    val qty = if (line.qty % 1.0 == 0.0) line.qty.toInt().toString() else line.qty.toString().replace('.', ',')
                    add(ReportRow(number++, "Transaksi", n.id, n.createdAt, branch, "${n.kasir} / ${line.handledByName.ifBlank { n.kasir }}", "${n.customer} · ${line.name}", "$qty ${line.unit}", (line.qty * line.unitPrice).toInt(), if (index == 0) n.paid else 0, (line.qty * line.commissionPerUnit).toInt(), 0, "${n.pay.label} · ${n.laundry.label}"))
                }
            }
            expenses.sortedByDescending { it.occurredAtMs }.forEach { e ->
                val branch = CuciinStore.branches.firstOrNull { it.id == e.branchId }?.name?.removePrefix("Cuciin ") ?: e.branchId
                add(ReportRow(number++, "Biaya", e.id, e.occurredAt, branch, e.by, "${e.category.label} · ${e.note}", "", 0, 0, 0, e.amount, "Tercatat"))
            }
        }
        val columns = listOf(
            "No" to 24f, "Jenis" to 42f, "ID" to 74f, "Waktu" to 78f, "Cabang" to 58f,
            "Kasir / Petugas" to 85f, "Rincian" to 100f, "Jml" to 42f, "Omzet" to 58f,
            "Diterima" to 58f, "Komisi" to 55f, "Biaya" to 55f, "Status" to 75f,
        )
        fun fit(text: String, paint: Paint, width: Float): String {
            if (paint.measureText(text) <= width - 8f) return text
            var value = text
            while (value.isNotEmpty() && paint.measureText("$value…") > width - 8f) value = value.dropLast(1)
            return "$value…"
        }
        val rowsPerPage = 12
        val pages = records.chunked(rowsPerPage).ifEmpty { listOf(emptyList()) }
        pages.forEachIndexed { pageIndex, pageRows ->
            val page = pdf.startPage(PdfDocument.PageInfo.Builder(842, 595, pageIndex + 1).create())
            val canvas = page.canvas
            canvas.drawColor(Color.WHITE)
            canvas.drawRoundRect(24f, 20f, 818f, 98f, 14f, 14f, Paint().apply { color = teal })
            canvas.drawText("CUCIIN · LAPORAN TRANSAKSI", 42f, 50f, titlePaint)
            canvas.drawText(periodLabel, 42f, 73f, Paint(headerPaint).apply { textSize = 10.5f })
            canvas.drawText("Halaman ${pageIndex + 1} / ${pages.size}", 741f, 76f, Paint(headerPaint))
            if (pageIndex == 0) {
                val kpi = Paint(bodyPaint).apply { textSize = 10f; isFakeBoldText = true }
                canvas.drawText("Omzet  ${rp(omzet)}", 30f, 121f, kpi)
                canvas.drawText("Kas masuk  ${rp(received)}", 220f, 121f, kpi)
                canvas.drawText("Biaya  ${rp(cost)}", 427f, 121f, kpi)
                canvas.drawText("Hasil kas  ${rp(received - cost)}", 600f, 121f, kpi)
                canvas.drawText("${notas.size} transaksi · ${notas.map { it.branchId }.distinct().size} cabang · ${notas.map { it.kasir }.distinct().size} kasir", 30f, 140f, mutedPaint)
            }

            var y = if (pageIndex == 0) 158f else 118f
            var x = 24f
            columns.forEach { (label, width) ->
                canvas.drawRect(x, y, x + width, y + 26f, Paint().apply { color = Color.rgb(31, 91, 110) })
                canvas.drawRect(x, y, x + width, y + 26f, gridPaint)
                canvas.drawText(fit(label, headerPaint, width), x + 4f, y + 17f, headerPaint)
                x += width
            }
            y += 26f
            pageRows.forEachIndexed { rowIndex, row ->
                val cells = listOf(row.no.toString(), row.type, row.id, row.time, row.branch, row.officer, row.description, row.qty, rp(row.revenue), rp(row.received), rp(row.commission), rp(row.expense), row.status)
                x = 24f
                columns.forEachIndexed { columnIndex, (_, width) ->
                    if (rowIndex % 2 == 0) canvas.drawRect(x, y, x + width, y + 29f, Paint().apply { color = Color.rgb(244, 249, 250) })
                    canvas.drawRect(x, y, x + width, y + 29f, gridPaint)
                    canvas.drawText(fit(cells[columnIndex], bodyPaint, width), x + 4f, y + 18f, bodyPaint)
                    x += width
                }
                y += 29f
            }
            if (records.isEmpty()) canvas.drawText("Belum ada transaksi atau biaya pada periode ini.", 34f, y + 24f, mutedPaint)
            canvas.drawLine(24f, 564f, 818f, 564f, Paint().apply { color = line; strokeWidth = 1f })
            canvas.drawText("Dibuat oleh Cuciin · ${Clock.nowLabel()} · nominal dalam rupiah", 24f, 580f, mutedPaint)
            pdf.finishPage(page)
        }
        file.outputStream().use { pdf.writeTo(it) }
        pdf.close()
        shareFile(ctx, file, "application/pdf")
    }

    fun shareAudit(ctx: Context, rows: List<AuditRow>) {
        val body = buildString {
            appendLine("Waktu,User,Cabang,Aktivitas,ID Service")
            rows.forEach { a -> appendLine(listOf(a.at, a.user, a.branchId, a.action, a.notaId.orEmpty()).joinToString(",", transform = ::csv)) }
        }
        shareGenerated(ctx, "audit-trail-${Clock.nowMs()}.csv", "text/csv", body)
    }

    fun shareInventory(ctx: Context, rows: List<InventoryItem>) {
        val body = buildString {
            appendLine("ID,Cabang,Nama,Kategori,Merek,Nomor Seri,Jumlah,Satuan,Status,Tanggal Beli,Dijual,Catatan")
            rows.forEach { i -> appendLine(listOf(i.id, i.branchId, i.name, i.category.label, i.brand, i.serialNumber, i.quantity, i.unit, i.status.label, i.purchaseAt, if (i.sellable) "Ya" else "Tidak", i.notes).joinToString(",", transform = ::csv)) }
        }
        shareGenerated(ctx, "inventory-${Clock.nowMs()}.csv", "text/csv", body)
    }

    fun shareExpenses(ctx: Context, rows: List<Expense>) {
        val body = buildString {
            appendLine("ID,Cabang,Kategori,Jumlah,Waktu,Petugas,Catatan")
            rows.forEach { e -> appendLine(listOf(e.id, e.branchId, e.category.label, e.amount, e.occurredAt, e.by, e.note).joinToString(",", transform = ::csv)) }
        }
        shareGenerated(ctx, "biaya-${Clock.nowMs()}.csv", "text/csv", body)
    }

    fun shareAttendance(ctx: Context, rows: List<AttendanceRecord>) {
        val body = buildString {
            appendLine("No,ID,Tanggal Kerja,Cabang,Nama Karyawan,Email,Jam Masuk,Jam Pulang,Durasi Menit,Catatan")
            rows.forEachIndexed { index, row ->
                val duration: Any = row.checkOutAtMs?.let { ((it - row.checkInAtMs).coerceAtLeast(0) / 60_000) } ?: ""
                val branch = CuciinStore.branches.firstOrNull { it.id == row.branchId }?.name ?: row.branchId
                appendLine(listOf(index + 1, row.id, row.workDate, branch, row.staffName, row.staffEmail, row.checkInAt, row.checkOutAt.orEmpty(), duration, row.note).joinToString(",", transform = ::csv))
            }
        }
        shareGenerated(ctx, "absensi-${Clock.nowMs()}.csv", "text/csv", body)
    }

    private fun shareGenerated(ctx: Context, name: String, type: String, body: String) {
        val dir = File(ctx.cacheDir, "share").apply { mkdirs() }
        val file = File(dir, name).apply { writeText(body) }
        shareFile(ctx, file, type)
    }

    fun sharePdf(ctx: Context, n: Nota) {
        val dir = File(ctx.cacheDir, "share").apply { mkdirs() }
        val file = File(dir, "${n.id}.pdf")
        val pdf = PdfDocument()
        val page = pdf.startPage(PdfDocument.PageInfo.Builder(595, 842, 1).create())
        val canvas = page.canvas
        val title = Paint().apply {
            color = Color.BLACK
            textSize = 18f
            isFakeBoldText = true
            isAntiAlias = true
        }
        val body = Paint().apply {
            color = Color.BLACK
            textSize = 12f
            isAntiAlias = true
        }
        var y = 56f
        canvas.drawText("Cuciin — Nota ${n.id}", 48f, y, title)
        y += 28f
        CuciinStore.notaText(n).lines().forEach { line ->
            if (y > 800f) return@forEach
            canvas.drawText(line, 48f, y, body)
            y += 16f
        }
        pdf.finishPage(page)
        file.outputStream().use { pdf.writeTo(it) }
        pdf.close()
        shareFile(ctx, file, "application/pdf")
    }

    private fun shareFile(ctx: Context, file: File, type: String) {
        val uri = FileProvider.getUriForFile(ctx, "${BuildConfig.APPLICATION_ID}.files", file)
        ctx.startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND).apply {
                    this.type = type
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                },
                "Kirim file",
            ),
        )
    }
}
