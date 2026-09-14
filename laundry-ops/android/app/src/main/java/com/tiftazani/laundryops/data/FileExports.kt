package com.tiftazani.laundryops.data

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.core.content.FileProvider
import com.tiftazani.laundryops.BuildConfig
import java.io.File

object FileExports {
    private fun csv(value: Any?): String = "\"${value?.toString().orEmpty().replace("\"", "\"\"")}\""

    private fun wrapped(text: String, paint: Paint, width: Float, maxLines: Int = Int.MAX_VALUE): List<String> {
        if (text.isBlank()) return listOf("")
        val result = mutableListOf<String>()
        text.lines().forEach { paragraph ->
            var line = ""
            paragraph.split(Regex("\\s+")).filter(String::isNotBlank).forEach { word ->
                val candidate = if (line.isBlank()) word else "$line $word"
                if (paint.measureText(candidate) <= width) line = candidate
                else {
                    if (line.isNotBlank()) result += line
                    line = word
                }
            }
            if (line.isNotBlank()) result += line
        }
        if (result.size <= maxLines) return result.ifEmpty { listOf("") }
        val clipped = result.take(maxLines).toMutableList()
        var last = clipped.last()
        while (last.isNotEmpty() && paint.measureText("$last…") > width) last = last.dropLast(1)
        clipped[clipped.lastIndex] = "$last…"
        return clipped
    }

    private fun drawWrapped(canvas: Canvas, text: String, x: Float, y: Float, width: Float, paint: Paint, lineHeight: Float, maxLines: Int = Int.MAX_VALUE): Int {
        val lines = wrapped(text, paint, width, maxLines)
        lines.forEachIndexed { index, line -> canvas.drawText(line, x, y + index * lineHeight, paint) }
        return lines.size
    }

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
        val rowsPerPage = 8
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
                canvas.drawRect(x, y, x + width, y + 34f, Paint().apply { color = Color.rgb(31, 91, 110) })
                canvas.drawRect(x, y, x + width, y + 34f, gridPaint)
                drawWrapped(canvas, label, x + 4f, y + 14f, width - 8f, headerPaint, 11f, 2)
                x += width
            }
            y += 34f
            pageRows.forEachIndexed { rowIndex, row ->
                val cells = listOf(row.no.toString(), row.type, row.id, row.time, row.branch, row.officer, row.description, row.qty, rp(row.revenue), rp(row.received), rp(row.commission), rp(row.expense), row.status)
                x = 24f
                columns.forEachIndexed { columnIndex, (_, width) ->
                    if (rowIndex % 2 == 0) canvas.drawRect(x, y, x + width, y + 44f, Paint().apply { color = Color.rgb(244, 249, 250) })
                    canvas.drawRect(x, y, x + width, y + 44f, gridPaint)
                    drawWrapped(canvas, cells[columnIndex], x + 4f, y + 13f, width - 8f, bodyPaint, 11f, 3)
                    x += width
                }
                y += 44f
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

    fun shareStock(ctx: Context, rows: List<StockMove>) {
        val body = buildString {
            appendLine("No,Waktu,Cabang,Produk,Jenis Perubahan,Jumlah,Saldo Setelah,Akun Pelaksana,Catatan,ID Service")
            rows.forEachIndexed { index, move ->
                val branch = CuciinStore.branches.firstOrNull { it.id == move.branchId }?.name ?: move.branchId
                val product = CuciinStore.products.firstOrNull { it.key == move.product || it.name == move.product }?.name ?: move.product
                appendLine(listOf(index + 1, move.at, branch, product, move.kind.label, move.qty, move.balanceAfter ?: "", move.by, move.note, move.notaId.orEmpty()).joinToString(",", transform = ::csv))
            }
        }
        shareGenerated(ctx, "laporan-stok-${Clock.nowMs()}.csv", "text/csv", body)
    }

    fun shareStockPdf(ctx: Context, rows: List<StockMove>, periodLabel: String) {
        val dir = File(ctx.cacheDir, "share").apply { mkdirs() }
        val file = File(dir, "laporan-stok-${Clock.nowMs()}.pdf")
        val pdf = PdfDocument()
        val ink = Color.rgb(19, 43, 55)
        val teal = Color.rgb(8, 117, 137)
        val body = Paint().apply { color = ink; textSize = 8.5f; isAntiAlias = true }
        val head = Paint(body).apply { color = Color.WHITE; isFakeBoldText = true }
        val grid = Paint().apply { color = Color.rgb(211, 224, 228); style = Paint.Style.STROKE; strokeWidth = .8f }
        val columns = listOf("No" to 28f, "Waktu" to 102f, "Cabang" to 85f, "Produk" to 110f, "Perubahan" to 75f, "Jumlah" to 52f, "Saldo" to 48f, "Akun" to 100f, "Catatan" to 170f)
        val pages = rows.chunked(8).ifEmpty { listOf(emptyList()) }
        pages.forEachIndexed { pageIndex, pageRows ->
            val page = pdf.startPage(PdfDocument.PageInfo.Builder(842, 595, pageIndex + 1).create())
            val canvas = page.canvas
            canvas.drawColor(Color.WHITE)
            canvas.drawRoundRect(24f, 20f, 818f, 92f, 14f, 14f, Paint().apply { color = teal })
            canvas.drawText("CUCIIN · LAPORAN PERUBAHAN STOK", 42f, 48f, Paint(head).apply { textSize = 18f })
            canvas.drawText("$periodLabel · ${rows.size} transaksi · Halaman ${pageIndex + 1}/${pages.size}", 42f, 72f, Paint(head).apply { textSize = 10f })
            var y = 112f
            var x = 24f
            columns.forEach { (label, width) ->
                canvas.drawRect(x, y, x + width, y + 30f, Paint().apply { color = Color.rgb(31, 91, 110) })
                canvas.drawRect(x, y, x + width, y + 30f, grid)
                drawWrapped(canvas, label, x + 4f, y + 13f, width - 8f, head, 10f, 2)
                x += width
            }
            y += 30f
            pageRows.forEachIndexed { rowIndex, move ->
                val branch = CuciinStore.branches.firstOrNull { it.id == move.branchId }?.name ?: move.branchId
                val product = CuciinStore.products.firstOrNull { it.key == move.product || it.name == move.product }?.name ?: move.product
                val values = listOf((pageIndex * 8 + rowIndex + 1).toString(), move.at, branch, product, move.kind.label, move.qty.toString(), move.balanceAfter?.toString().orEmpty(), move.by, move.note)
                x = 24f
                columns.forEachIndexed { columnIndex, (_, width) ->
                    if (rowIndex % 2 == 0) canvas.drawRect(x, y, x + width, y + 46f, Paint().apply { color = Color.rgb(244, 249, 250) })
                    canvas.drawRect(x, y, x + width, y + 46f, grid)
                    drawWrapped(canvas, values[columnIndex], x + 4f, y + 13f, width - 8f, body, 11f, 3)
                    x += width
                }
                y += 46f
            }
            if (rows.isEmpty()) canvas.drawText("Belum ada perubahan stok pada periode ini.", 34f, y + 25f, body)
            canvas.drawText("Dibuat oleh Cuciin · ${Clock.nowLabel()}", 24f, 578f, Paint(body).apply { color = Color.rgb(92, 112, 122) })
            pdf.finishPage(page)
        }
        file.outputStream().use { pdf.writeTo(it) }
        pdf.close()
        shareFile(ctx, file, "application/pdf")
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
        val branch = CuciinStore.branch(n.branchId)
        val ink = Color.rgb(19, 43, 55)
        val teal = Color.rgb(8, 117, 137)
        val muted = Color.rgb(92, 112, 122)
        val body = Paint().apply { color = ink; textSize = 10.5f; isAntiAlias = true }
        val small = Paint(body).apply { color = muted; textSize = 9f }
        val bold = Paint(body).apply { isFakeBoldText = true }
        val white = Paint(bold).apply { color = Color.WHITE }
        val grid = Paint().apply { color = Color.rgb(211, 224, 228); style = Paint.Style.STROKE; strokeWidth = 1f }
        canvas.drawColor(Color.WHITE)
        canvas.drawRoundRect(32f, 28f, 563f, 132f, 16f, 16f, Paint().apply { color = teal })
        canvas.drawText(branch.name.uppercase(), 50f, 61f, Paint(white).apply { textSize = 21f })
        canvas.drawText("NOTA SERVICE · ${n.id}", 50f, 86f, Paint(white).apply { textSize = 11f })
        drawWrapped(canvas, branch.location.ifBlank { "Alamat cabang belum diisi" }, 50f, 108f, 480f, Paint(white).apply { textSize = 9f }, 11f, 2)

        canvas.drawText("INFORMASI SERVICE", 40f, 164f, Paint(bold).apply { color = teal; textSize = 10f })
        val info = listOf(
            "Kasir" to n.kasir,
            "Pelanggan" to n.customer,
            "Waktu Masuk" to n.createdAt,
            "Estimasi Waktu Keluar" to n.pickupAt,
        )
        var infoY = 186f
        info.chunked(2).forEach { pair ->
            pair.forEachIndexed { index, (label, value) ->
                val x = 40f + index * 260f
                canvas.drawText(label, x, infoY, small)
                drawWrapped(canvas, value, x, infoY + 16f, 230f, bold, 13f, 2)
            }
            infoY += 45f
        }

        var y = 286f
        val columns = listOf("No." to 42f, "Service" to 345f, "Harga" to 128f)
        var x = 40f
        columns.forEach { (label, width) ->
            canvas.drawRect(x, y, x + width, y + 32f, Paint().apply { color = Color.rgb(31, 91, 110) })
            canvas.drawRect(x, y, x + width, y + 32f, grid)
            canvas.drawText(label, x + 8f, y + 20f, white)
            x += width
        }
        y += 32f
        val legacyItems = Regex("(\\d+)\\.0\\s*([A-Za-z]+)").replace(n.items) { match -> "${match.groupValues[1]} ${match.groupValues[2]}" }
        val lines = n.lines.ifEmpty { listOf(NotaLine("", legacyItems, 1.0, "nota", n.total, n.kasirEmail, n.kasir, 0)) }
        lines.take(7).forEachIndexed { index, line ->
            val rowHeight = 52f
            x = 40f
            val qty = if (line.qty % 1.0 == 0.0) line.qty.toInt().toString() else line.qty.toString().replace('.', ',')
            val serviceText = if (line.serviceId.isBlank()) line.name else "${line.name}\n$qty ${line.unit} × ${rp(line.unitPrice)}"
            val values = listOf((index + 1).toString(), serviceText, rp((line.qty * line.unitPrice).toInt()))
            columns.forEachIndexed { cellIndex, (_, width) ->
                if (index % 2 == 0) canvas.drawRect(x, y, x + width, y + rowHeight, Paint().apply { color = Color.rgb(244, 249, 250) })
                canvas.drawRect(x, y, x + width, y + rowHeight, grid)
                drawWrapped(canvas, values[cellIndex], x + 8f, y + 18f, width - 16f, if (cellIndex == 2) bold else body, 15f, 2)
                x += width
            }
            y += rowHeight
        }
        if (lines.size > 7) canvas.drawText("+ ${lines.size - 7} layanan dilanjutkan pada halaman berikutnya.", 48f, y + 18f, small)
        canvas.drawRect(40f, y, 427f, y + 44f, Paint().apply { color = Color.rgb(232, 244, 246) })
        canvas.drawRect(427f, y, 555f, y + 44f, Paint().apply { color = teal })
        canvas.drawText("GRAND TOTAL", 300f, y + 27f, bold)
        canvas.drawText(rp(n.total), 437f, y + 27f, white)
        y += 66f
        canvas.drawText("Pembayaran", 40f, y, small)
        canvas.drawText("${n.payMethod.label} · ${n.pay.label} · Dibayar ${rp(n.paid)}", 40f, y + 18f, bold)
        canvas.drawText("Status Pengerjaan", 330f, y, small)
        canvas.drawText(n.laundry.label, 330f, y + 18f, bold)
        canvas.drawLine(40f, 790f, 555f, 790f, Paint().apply { color = Color.rgb(211, 224, 228) })
        canvas.drawText("Terima kasih telah mempercayakan laundry Anda kepada ${branch.name}.", 40f, 812f, small)
        pdf.finishPage(page)
        lines.drop(7).chunked(10).forEachIndexed { extraPageIndex, pageLines ->
            val extra = pdf.startPage(PdfDocument.PageInfo.Builder(595, 842, extraPageIndex + 2).create())
            val extraCanvas = extra.canvas
            extraCanvas.drawColor(Color.WHITE)
            extraCanvas.drawRoundRect(32f, 28f, 563f, 104f, 16f, 16f, Paint().apply { color = teal })
            extraCanvas.drawText(branch.name.uppercase(), 50f, 60f, Paint(white).apply { textSize = 18f })
            extraCanvas.drawText("NOTA ${n.id} · RINCIAN LANJUTAN", 50f, 84f, Paint(white).apply { textSize = 10f })
            var extraY = 132f
            var extraX = 40f
            columns.forEach { (label, width) ->
                extraCanvas.drawRect(extraX, extraY, extraX + width, extraY + 32f, Paint().apply { color = Color.rgb(31, 91, 110) })
                extraCanvas.drawRect(extraX, extraY, extraX + width, extraY + 32f, grid)
                extraCanvas.drawText(label, extraX + 8f, extraY + 20f, white)
                extraX += width
            }
            extraY += 32f
            pageLines.forEachIndexed { pageLineIndex, line ->
                val absoluteIndex = 7 + extraPageIndex * 10 + pageLineIndex
                val qty = if (line.qty % 1.0 == 0.0) line.qty.toInt().toString() else line.qty.toString().replace('.', ',')
                val serviceText = if (line.serviceId.isBlank()) line.name else "${line.name}\n$qty ${line.unit} × ${rp(line.unitPrice)}"
                val values = listOf((absoluteIndex + 1).toString(), serviceText, rp((line.qty * line.unitPrice).toInt()))
                extraX = 40f
                columns.forEachIndexed { cellIndex, (_, width) ->
                    if (pageLineIndex % 2 == 0) extraCanvas.drawRect(extraX, extraY, extraX + width, extraY + 52f, Paint().apply { color = Color.rgb(244, 249, 250) })
                    extraCanvas.drawRect(extraX, extraY, extraX + width, extraY + 52f, grid)
                    drawWrapped(extraCanvas, values[cellIndex], extraX + 8f, extraY + 18f, width - 16f, if (cellIndex == 2) bold else body, 15f, 2)
                    extraX += width
                }
                extraY += 52f
            }
            extraCanvas.drawRect(40f, extraY, 427f, extraY + 44f, Paint().apply { color = Color.rgb(232, 244, 246) })
            extraCanvas.drawRect(427f, extraY, 555f, extraY + 44f, Paint().apply { color = teal })
            extraCanvas.drawText("GRAND TOTAL", 300f, extraY + 27f, bold)
            extraCanvas.drawText(rp(n.total), 437f, extraY + 27f, white)
            extraCanvas.drawText("Halaman ${extraPageIndex + 2}", 40f, 812f, small)
            pdf.finishPage(extra)
        }
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
