package com.cuciin.laundryops.data

import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.core.content.FileProvider
import com.cuciin.laundryops.BuildConfig
import com.cuciin.laundryops.R
import java.io.File

object FileExports {
    private fun csv(value: Any?): String = "\"${value?.toString().orEmpty().replace("\"", "\"\"")}\""

    private fun wrapped(text: String, paint: Paint, width: Float, maxLines: Int = Int.MAX_VALUE): List<String> =
        wrapMeasuredText(text, width, maxLines, paint::measureText)

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
        val navy = Color.rgb(8, 58, 114)
        val blue = Color.rgb(7, 91, 175)
        val sky = Color.rgb(232, 247, 253)
        val ink = Color.rgb(18, 43, 72)
        val muted = Color.rgb(80, 102, 122)
        val grid = Paint().apply { color = Color.rgb(202, 221, 233); style = Paint.Style.STROKE; strokeWidth = .8f }
        val body = Paint().apply { color = ink; textSize = 8.1f; isAntiAlias = true }
        val small = Paint(body).apply { color = muted; textSize = 8.3f }
        val tableHead = Paint(body).apply { color = Color.WHITE; isFakeBoldText = true }
        val title = Paint().apply { color = Color.WHITE; textSize = 18f; isFakeBoldText = true; isAntiAlias = true }
        data class ReportRow(val no: Int, val id: String, val time: String, val branch: String, val cashier: String, val detail: String, val omzet: Int, val received: Int, val commission: Int, val status: String)
        fun quantity(value: Double): String = if (value % 1.0 == 0.0) value.toInt().toString() else value.toString().replace('.', ',')
        fun detail(n: Nota): String = n.lines.takeIf { it.isNotEmpty() }?.joinToString("; ") { "${it.name} ${quantity(it.qty)} ${it.unit}" }
            ?: Regex("(\\d+)\\.0\\s*([A-Za-z]+)").replace(n.items) { "${it.groupValues[1]} ${it.groupValues[2]}" }
        val rows = notas.sortedByDescending { it.createdAtMs }.mapIndexed { index, n ->
            ReportRow(
                no = index + 1,
                id = n.id,
                time = n.createdAt,
                branch = CuciinStore.branches.firstOrNull { it.id == n.branchId }?.name?.removePrefix("Cuciin ") ?: n.branchId,
                cashier = n.kasir,
                detail = "${n.customer} · ${detail(n)}",
                omzet = n.total,
                received = n.paid,
                commission = n.lines.sumOf { (it.qty * it.commissionPerUnit).toInt() },
                status = "${n.pay.label} · ${n.laundry.label}",
            )
        }
        val columns = listOf("No" to 24f, "Nota" to 68f, "Waktu" to 68f, "Cabang" to 74f, "Kasir" to 75f, "Rincian layanan" to 176f, "Omzet" to 67f, "Diterima" to 67f, "Komisi" to 62f, "Status" to 91f)
        fun cells(row: ReportRow) = listOf(row.no.toString(), row.id, row.time, row.branch, row.cashier, row.detail, rp(row.omzet), rp(row.received), rp(row.commission), row.status)
        fun rowHeight(row: ReportRow): Float {
            val lines = columns.mapIndexed { index, (_, width) -> wrapped(cells(row)[index], body, width - 8f, 5).size }
            return maxOf(34f, lines.maxOrNull()!!.toFloat() * 11f + 12f)
        }
        val firstCapacity = 544f - 190f - 32f
        val nextCapacity = 544f - 132f - 32f
        val pages = mutableListOf<MutableList<ReportRow>>()
        var current = mutableListOf<ReportRow>()
        var used = 0f
        rows.forEach { row ->
            val capacity = if (pages.isEmpty()) firstCapacity else nextCapacity
            val height = rowHeight(row)
            if (current.isNotEmpty() && used + height > capacity) {
                pages += current
                current = mutableListOf()
                used = 0f
            }
            current += row
            used += height
        }
        if (current.isNotEmpty() || pages.isEmpty()) pages += current
        val omzet = notas.sumOf { it.total }
        val received = notas.sumOf { it.paid }
        val cost = expenses.sumOf { it.amount }
        pages.forEachIndexed { pageIndex, pageRows ->
            val page = pdf.startPage(PdfDocument.PageInfo.Builder(842, 595, pageIndex + 1).create())
            val canvas = page.canvas
            canvas.drawColor(Color.WHITE)
            canvas.drawRect(24f, 20f, 818f, 102f, Paint().apply { color = navy })
            BitmapFactory.decodeResource(ctx.resources, R.drawable.cuciin_logo)?.let { logo -> canvas.drawBitmap(logo, null, Rect(38, 34, 95, 88), null) }
            canvas.drawText("LAPORAN TRANSAKSI", 112f, 54f, title)
            canvas.drawText("Periode: $periodLabel", 112f, 78f, Paint(tableHead).apply { textSize = 10.3f })
            canvas.drawText("Halaman ${pageIndex + 1} / ${pages.size}", 718f, 78f, Paint(tableHead).apply { textSize = 9.5f })
            var y = if (pageIndex == 0) {
                val metric = Paint(body).apply { textSize = 9.3f; isFakeBoldText = true }
                val values = listOf("Omzet\n${rp(omzet)}", "Kas masuk\n${rp(received)}", "Biaya\n${rp(cost)}", "Hasil kas\n${rp(received - cost)}")
                values.forEachIndexed { index, value ->
                    val left = 24f + index * 198.5f
                    canvas.drawRect(left, 116f, left + 190f, 168f, Paint().apply { color = if (index == 3) navy else sky })
                    val paint = Paint(metric).apply { color = if (index == 3) Color.WHITE else ink }
                    value.split('\n').forEachIndexed { lineIndex, lineText -> canvas.drawText(lineText, left + 12f, 136f + lineIndex * 16f, paint) }
                }
                canvas.drawText("${rows.size} transaksi · ${notas.map { it.branchId }.distinct().size} cabang · ${notas.map { it.kasir }.distinct().size} kasir", 28f, 184f, small)
                190f
            } else 132f
            var x = 24f
            columns.forEach { (label, width) ->
                canvas.drawRect(x, y, x + width, y + 32f, Paint().apply { color = blue })
                canvas.drawRect(x, y, x + width, y + 32f, grid)
                drawWrapped(canvas, label, x + 4f, y + 13f, width - 8f, tableHead, 10f, 2)
                x += width
            }
            y += 32f
            pageRows.forEachIndexed { rowIndex, row ->
                val height = rowHeight(row)
                x = 24f
                cells(row).forEachIndexed { cellIndex, cell ->
                    val width = columns[cellIndex].second
                    if (rowIndex % 2 == 0) canvas.drawRect(x, y, x + width, y + height, Paint().apply { color = sky })
                    canvas.drawRect(x, y, x + width, y + height, grid)
                    drawWrapped(canvas, cell, x + 4f, y + 13f, width - 8f, body, 11f, 5)
                    x += width
                }
                y += height
            }
            if (rows.isEmpty()) canvas.drawText("Tidak ada transaksi pada periode ini.", 32f, y + 26f, small)
            canvas.drawLine(24f, 564f, 818f, 564f, Paint().apply { color = Color.rgb(202, 221, 233) })
            canvas.drawText("Dibuat oleh Cuciin · ${Clock.nowLabel()} · nominal dalam rupiah", 24f, 580f, small)
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
        val navy = Color.rgb(8, 58, 114)
        val blue = Color.rgb(7, 91, 175)
        val sky = Color.rgb(232, 247, 253)
        val ink = Color.rgb(18, 43, 72)
        val muted = Color.rgb(80, 102, 122)
        val body = Paint().apply { color = ink; textSize = 8.4f; isAntiAlias = true }
        val head = Paint(body).apply { color = Color.WHITE; isFakeBoldText = true }
        val grid = Paint().apply { color = Color.rgb(202, 221, 233); style = Paint.Style.STROKE; strokeWidth = .8f }
        val columns = listOf("No" to 28f, "Waktu" to 94f, "Cabang" to 84f, "Produk" to 112f, "Perubahan" to 74f, "Jumlah" to 54f, "Saldo" to 52f, "Akun" to 102f, "Catatan" to 160f)
        data class StockRow(val no: Int, val move: StockMove, val branch: String, val product: String)
        val reportRows = rows.mapIndexed { index, move ->
            StockRow(index + 1, move, CuciinStore.branches.firstOrNull { it.id == move.branchId }?.name?.removePrefix("Cuciin ") ?: move.branchId, CuciinStore.products.firstOrNull { it.key == move.product || it.name == move.product }?.name ?: move.product)
        }
        fun cells(row: StockRow) = listOf(row.no.toString(), row.move.at, row.branch, row.product, row.move.kind.label, row.move.qty.toString(), row.move.balanceAfter?.toString().orEmpty(), row.move.by, row.move.note)
        fun rowHeight(row: StockRow): Float = maxOf(34f, columns.mapIndexed { index, (_, width) -> wrapped(cells(row)[index], body, width - 8f, 5).size }.maxOrNull()!!.toFloat() * 11f + 12f)
        val pages = mutableListOf<MutableList<StockRow>>()
        var current = mutableListOf<StockRow>()
        var used = 0f
        reportRows.forEach { row ->
            val height = rowHeight(row)
            if (current.isNotEmpty() && used + height > 544f - 190f - 32f) {
                pages += current
                current = mutableListOf()
                used = 0f
            }
            current += row
            used += height
        }
        if (current.isNotEmpty() || pages.isEmpty()) pages += current
        val branchContext = reportRows.map { it.branch }.distinct().let { if (it.size == 1) it.first() else "Semua cabang" }
        val accounts = reportRows.map { it.move.by }.filter { it.isNotBlank() }.distinct().joinToString(", ").ifBlank { "Tidak ada petugas" }
        pages.forEachIndexed { pageIndex, pageRows ->
            val page = pdf.startPage(PdfDocument.PageInfo.Builder(842, 595, pageIndex + 1).create())
            val canvas = page.canvas
            canvas.drawColor(Color.WHITE)
            canvas.drawRect(24f, 20f, 818f, 102f, Paint().apply { color = navy })
            BitmapFactory.decodeResource(ctx.resources, R.drawable.cuciin_logo)?.let { logo -> canvas.drawBitmap(logo, null, Rect(38, 34, 95, 88), null) }
            canvas.drawText("LAPORAN PERUBAHAN STOK", 112f, 54f, Paint(head).apply { textSize = 17f })
            canvas.drawText("Periode: $periodLabel", 112f, 78f, Paint(head).apply { textSize = 10.2f })
            canvas.drawText("Halaman ${pageIndex + 1} / ${pages.size}", 718f, 78f, Paint(head).apply { textSize = 9.5f })
            val label = Paint(body).apply { textSize = 8f; color = muted }
            val value = Paint(body).apply { textSize = 9.2f; isFakeBoldText = true }
            listOf("Cabang" to branchContext, "Jumlah perubahan" to "${rows.size} perubahan", "Petugas" to accounts).forEachIndexed { index, (key, data) ->
                val left = 24f + index * 264.5f
                canvas.drawRect(left, 116f, left + 256f, 168f, Paint().apply { color = sky })
                canvas.drawText(key, left + 12f, 136f, label)
                drawWrapped(canvas, data, left + 12f, 153f, 232f, value, 11f, 2)
            }
            var y = 190f
            var x = 24f
            columns.forEach { (labelText, width) ->
                canvas.drawRect(x, y, x + width, y + 32f, Paint().apply { color = blue })
                canvas.drawRect(x, y, x + width, y + 32f, grid)
                drawWrapped(canvas, labelText, x + 4f, y + 13f, width - 8f, head, 10f, 2)
                x += width
            }
            y += 32f
            pageRows.forEachIndexed { rowIndex, row ->
                val height = rowHeight(row)
                x = 24f
                cells(row).forEachIndexed { index, cell ->
                    val width = columns[index].second
                    if (rowIndex % 2 == 0) canvas.drawRect(x, y, x + width, y + height, Paint().apply { color = sky })
                    canvas.drawRect(x, y, x + width, y + height, grid)
                    val kindPaint = if (index == 4) Paint(body).apply { color = when (row.move.kind.label) { "Tambah" -> Color.rgb(21, 112, 68); "Kurang" -> Color.rgb(169, 57, 57); else -> Color.rgb(135, 91, 16) }; isFakeBoldText = true } else body
                    drawWrapped(canvas, cell, x + 4f, y + 13f, width - 8f, kindPaint, 11f, 5)
                    x += width
                }
                y += height
            }
            if (reportRows.isEmpty()) canvas.drawText("Tidak ada perubahan stok pada periode ini.", 32f, y + 26f, label)
            canvas.drawLine(24f, 564f, 818f, 564f, Paint().apply { color = Color.rgb(202, 221, 233) })
            canvas.drawText("Dibuat oleh Cuciin · ${Clock.nowLabel()} · nominal dan saldo mengikuti data pada saat ekspor", 24f, 580f, label)
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
        val navy = Color.rgb(8, 58, 114)
        val blue = Color.rgb(7, 91, 175)
        val sky = Color.rgb(232, 247, 253)
        val ink = Color.rgb(18, 43, 72)
        val muted = Color.rgb(80, 102, 122)
        val body = Paint().apply { color = ink; textSize = 10.5f; isAntiAlias = true }
        val small = Paint(body).apply { color = muted; textSize = 9f }
        val bold = Paint(body).apply { isFakeBoldText = true }
        val white = Paint(bold).apply { color = Color.WHITE }
        val grid = Paint().apply { color = Color.rgb(211, 224, 228); style = Paint.Style.STROKE; strokeWidth = 1f }
        fun drawGrandTotal(target: Canvas, top: Float): Float {
            target.drawRect(40f, top, 427f, top + 44f, Paint().apply { color = sky })
            target.drawRect(427f, top, 555f, top + 44f, Paint().apply { color = navy })
            target.drawText("TOTAL", 328f, top + 27f, bold)
            target.drawText(rp(n.total), 437f, top + 27f, white)
            return top + 66f
        }
        fun drawPaymentAndStatus(target: Canvas, top: Float) {
            target.drawText("Pembayaran", 40f, top, small)
            target.drawText("${n.payMethod.label} · ${n.pay.label} · Dibayar ${rp(n.paid)}", 40f, top + 18f, bold)
            target.drawText("Status Pengerjaan", 330f, top, small)
            target.drawText(n.laundry.label, 330f, top + 18f, bold)
        }
        canvas.drawColor(Color.WHITE)
        canvas.drawRect(32f, 28f, 563f, 132f, Paint().apply { color = navy })
        canvas.drawRoundRect(42f, 40f, 87f, 85f, 8f, 8f, Paint().apply { color = Color.WHITE })
        BitmapFactory.decodeResource(ctx.resources, R.drawable.cuciin_logo)?.let { logo -> canvas.drawBitmap(logo, null, Rect(46, 44, 83, 81), null) }
        canvas.drawText(branch.name.uppercase(), 101f, 61f, Paint(white).apply { textSize = 21f })
        canvas.drawText("NOTA LAUNDRY · ${n.id}", 101f, 86f, Paint(white).apply { textSize = 11f })
        if (branch.location.isNotBlank()) drawWrapped(canvas, branch.location, 101f, 108f, 430f, Paint(white).apply { textSize = 9f }, 11f, 2)

        canvas.drawText("INFORMASI PESANAN", 40f, 164f, Paint(bold).apply { color = blue; textSize = 10f })
        val info = listOf(
            "Kasir" to n.kasir,
            "Pelanggan" to n.customer,
            "Waktu Masuk" to n.createdAt,
            "Estimasi selesai" to n.pickupAt,
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
        val columns = listOf("No." to 42f, "Layanan" to 345f, "Subtotal" to 128f)
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
        val pageLineCounts = receiptPageLineCounts(lines.size)
        lines.take(pageLineCounts.first()).forEachIndexed { index, line ->
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
        if (lines.size > 7) {
            canvas.drawText("+ ${lines.size - 7} layanan dilanjutkan pada halaman berikutnya.", 48f, y + 18f, small)
        } else {
            y = drawGrandTotal(canvas, y)
            drawPaymentAndStatus(canvas, y)
        }
        canvas.drawLine(40f, 790f, 555f, 790f, Paint().apply { color = Color.rgb(211, 224, 228) })
        canvas.drawText("Terima kasih telah mempercayakan laundry Anda kepada ${branch.name}.", 40f, 812f, small)
        pdf.finishPage(page)
        val continuationPages = lines.drop(pageLineCounts.first()).chunked(10)
        continuationPages.forEachIndexed { extraPageIndex, pageLines ->
            val extra = pdf.startPage(PdfDocument.PageInfo.Builder(595, 842, extraPageIndex + 2).create())
            val extraCanvas = extra.canvas
            extraCanvas.drawColor(Color.WHITE)
            extraCanvas.drawRect(32f, 28f, 563f, 104f, Paint().apply { color = navy })
            extraCanvas.drawRoundRect(42f, 40f, 79f, 77f, 7f, 7f, Paint().apply { color = Color.WHITE })
            BitmapFactory.decodeResource(ctx.resources, R.drawable.cuciin_logo)?.let { logo -> extraCanvas.drawBitmap(logo, null, Rect(45, 43, 76, 74), null) }
            extraCanvas.drawText(branch.name.uppercase(), 91f, 60f, Paint(white).apply { textSize = 18f })
            extraCanvas.drawText("NOTA LAUNDRY ${n.id} · RINCIAN LANJUTAN", 91f, 84f, Paint(white).apply { textSize = 10f })
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
            if (extraPageIndex == continuationPages.lastIndex) {
                extraY = drawGrandTotal(extraCanvas, extraY)
                drawPaymentAndStatus(extraCanvas, extraY)
            } else {
                extraCanvas.drawText("Rincian berlanjut ke halaman berikutnya.", 48f, extraY + 18f, small)
            }
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
