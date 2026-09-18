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
    // Semua PDF memakai kepala tabel, garis, dan zebra row yang sama.
    private val reportNavy = Color.rgb(8, 58, 114)
    private val reportBlue = Color.rgb(7, 91, 175)
    private val reportSky = Color.rgb(232, 247, 253)
    private val reportGrid = Color.rgb(202, 221, 233)

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

    fun shareFinancial(ctx: Context, notas: List<Nota>, expenses: List<Expense>, sections: Set<String> = emptySet()) {
        fun kasirName(n: Nota): String = staffDisplayName(CuciinStore.staff, n.kasirEmail.ifBlank { n.kasir }, n.kasir)
        val body = buildString {
            appendLine("LAPORAN TRANSAKSI CUCIIN")
            appendLine(listOf("Dibuat", Clock.nowLabel() + " WIB").joinToString(",", transform = ::csv))
            appendLine(listOf("Bagian", if (sections.isEmpty()) "Rincian" else sections.sorted().joinToString(", ")).joinToString(",", transform = ::csv))
            appendLine()
            // Bagian yang dipilih di filter Tampilan laporan ikut diekspor, bukan hanya rincian.
            if ("ringkasan" in sections) {
                val omzet = notas.sumOf { it.total }
                val masuk = notas.sumOf { it.paid }
                val biaya = expenses.sumOf { it.amount }
                appendLine("RINGKASAN")
                appendLine(listOf("Ukuran", "Nilai").joinToString(",", transform = ::csv))
                listOf(
                    "Omzet Service" to rp(omzet),
                    "Kas diterima" to rp(masuk),
                    "Piutang berjalan" to rp(notas.sumOf { maxOf(0, it.total - it.paid) }),
                    "Biaya tercatat" to rp(biaya),
                    "Hasil kas" to rp(masuk - biaya),
                    "Jumlah Service" to notas.size.toString(),
                    "Service belum lunas" to notas.count { it.pay != PayStatus.Lunas }.toString(),
                ).forEach { (label, value) -> appendLine(listOf(label, value).joinToString(",", transform = ::csv)) }
                appendLine()
            }
            if ("cabang" in sections) {
                appendLine("PER CABANG")
                appendLine(listOf("Cabang", "Service", "Omzet", "Masuk", "Biaya", "Hasil kas").joinToString(",", transform = ::csv))
                notas.groupBy { it.branchId }.forEach { (branchId, group) ->
                    val cost = expenses.filter { it.branchId == branchId }.sumOf { it.amount }
                    appendLine(listOf(
                        CuciinStore.branches.firstOrNull { it.id == branchId }?.name ?: branchId,
                        group.size, group.sumOf { it.total }, group.sumOf { it.paid }, cost, group.sumOf { it.paid } - cost,
                    ).joinToString(",", transform = ::csv))
                }
                appendLine()
            }
            if ("kasir" in sections) {
                appendLine("PER KASIR")
                appendLine(listOf("Kasir", "Email", "Service", "Omzet", "Masuk", "Cabang").joinToString(",", transform = ::csv))
                notas.groupBy { it.kasirEmail.ifBlank { it.kasir } }.forEach { (email, group) ->
                    appendLine(listOf(
                        staffDisplayName(CuciinStore.staff, email, group.first().kasir), email, group.size,
                        group.sumOf { it.total }, group.sumOf { it.paid },
                        group.map { CuciinStore.branches.firstOrNull { b -> b.id == it.branchId }?.name ?: it.branchId }.distinct().joinToString(" | "),
                    ).joinToString(",", transform = ::csv))
                }
                appendLine()
            }
            if ("petugas" in sections) {
                appendLine("KOMISI PETUGAS")
                appendLine(listOf("Petugas", "Email", "Cabang", "Service", "Komisi").joinToString(",", transform = ::csv))
                notas.flatMap { nota -> nota.lines.map { line -> Triple(nota, line, (line.qty * line.commissionPerUnit).toInt()) } }
                    .groupBy { (nota, line, _) -> "${nota.branchId}|${line.handledByEmail.ifBlank { nota.kasirEmail }.ifBlank { nota.kasir }}" }
                    .forEach { (_, group) ->
                        val first = group.first()
                        val email = first.second.handledByEmail.ifBlank { first.first.kasirEmail }.ifBlank { first.first.kasir }
                        appendLine(listOf(
                            staffDisplayName(CuciinStore.staff, email, first.second.handledByName.ifBlank { first.first.kasir }),
                            email,
                            CuciinStore.branches.firstOrNull { it.id == first.first.branchId }?.name ?: first.first.branchId,
                            group.map { it.first.id }.distinct().size,
                            group.sumOf { it.third },
                        ).joinToString(",", transform = ::csv))
                    }
                appendLine()
            }
            appendLine("RINCIAN TRANSAKSI")
            appendLine("No,Jenis,ID Service,Waktu,Cabang,Kasir,Pelanggan,Layanan,Jumlah,Satuan,Harga Satuan,Omzet Baris,Diterima Service,Petugas Layanan,Email Petugas,Komisi,Biaya,Metode,Status Pembayaran,Status Pengerjaan")
            var number = 1
            notas.sortedByDescending { it.createdAtMs }.forEach { n ->
                val branch = CuciinStore.branches.firstOrNull { it.id == n.branchId }?.name ?: n.branchId
                val lines = n.lines.ifEmpty { listOf(NotaLine("", n.items, 1.0, "Service", n.total, n.kasirEmail, n.kasir, 0)) }
                lines.forEachIndexed { lineIndex, line ->
                    appendLine(listOf(
                        number++, "Transaksi", n.id, n.createdAt, branch, kasirName(n), n.customer,
                        line.name, line.qty, line.unit, line.unitPrice, (line.qty * line.unitPrice).toInt(),
                        if (lineIndex == 0) n.paid else 0,
                        staffDisplayName(CuciinStore.staff, line.handledByEmail.ifBlank { n.kasirEmail }, line.handledByName.ifBlank { n.kasir }),
                        line.handledByEmail.ifBlank { n.kasirEmail },
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

    fun shareFinancialPdf(ctx: Context, notas: List<Nota>, expenses: List<Expense>, periodLabel: String, sections: Set<String> = emptySet()) {
        shareFile(ctx, ReportPdf.transaksi(ctx, notas, expenses, periodLabel, sections), "application/pdf")
    }

    /**
     * CSV laporan analitik: memuat seluruh baris yang tampil di layar, termasuk ringkasan,
     * tren bulanan, omzet per cabang, penerimaan per metode, peringkat kasir, dan rincian
     * tiap Service pada filter yang sedang aktif.
     */
    fun shareAnalyticsCsv(
        ctx: Context,
        notas: List<Nota>,
        expenses: List<Expense>,
        periodLabel: String,
        trend: List<Triple<String, Int, Int>>,
        filterSummary: String,
    ) {
        fun kasirName(n: Nota): String = staffDisplayName(CuciinStore.staff, n.kasirEmail.ifBlank { n.kasir }, n.kasir)
        val body = buildString {
            appendLine("LAPORAN ANALITIK CUCIIN")
            appendLine(listOf("Periode", periodLabel).joinToString(",", transform = ::csv))
            appendLine(listOf("Filter", filterSummary).joinToString(",", transform = ::csv))
            appendLine(listOf("Dibuat", Clock.nowLabel() + " WIB").joinToString(",", transform = ::csv))
            appendLine()
            val omzet = notas.sumOf { it.total }
            val masuk = notas.sumOf { it.paid }
            val biaya = expenses.sumOf { it.amount }
            val piutang = notas.sumOf { maxOf(0, it.total - it.paid) }
            appendLine("RINGKASAN")
            appendLine(listOf("Ukuran", "Nilai").joinToString(",", transform = ::csv))
            listOf(
                "Omzet Service" to rp(omzet),
                "Kas diterima" to rp(masuk),
                "Piutang berjalan" to rp(piutang),
                "Biaya tercatat" to rp(biaya),
                "Hasil kas" to rp(masuk - biaya),
                "Jumlah Service" to notas.size.toString(),
                "Rata-rata per Service" to rp(if (notas.isEmpty()) 0 else omzet / notas.size),
                "Service selesai" to notas.count { it.pickedUpAt != null }.toString(),
                "Service belum lunas" to notas.count { it.pay != PayStatus.Lunas }.toString(),
            ).forEach { (label, value) -> appendLine(listOf(label, value).joinToString(",", transform = ::csv)) }
            appendLine()
            appendLine("TREN BULANAN")
            appendLine(listOf("Bulan", "Omzet", "Service").joinToString(",", transform = ::csv))
            trend.forEach { (label, omzetBulan, count) -> appendLine(listOf(label, omzetBulan, count).joinToString(",", transform = ::csv)) }
            appendLine()
            appendLine("OMZET PER CABANG")
            appendLine(listOf("Cabang", "Service", "Omzet", "Masuk", "Biaya", "Hasil kas").joinToString(",", transform = ::csv))
            notas.groupBy { it.branchId }.map { (branchId, group) ->
                val cost = expenses.filter { it.branchId == branchId }.sumOf { it.amount }
                listOf(
                    CuciinStore.branches.firstOrNull { it.id == branchId }?.name ?: branchId,
                    group.size, group.sumOf { it.total }, group.sumOf { it.paid }, cost, group.sumOf { it.paid } - cost,
                )
            }.sortedByDescending { (it[2] as Int) }.forEach { row -> appendLine(row.joinToString(",", transform = ::csv)) }
            appendLine()
            appendLine("PENERIMAAN PER METODE")
            appendLine(listOf("Metode", "Diterima", "Service").joinToString(",", transform = ::csv))
            PayMethod.entries.forEach { method ->
                val group = notas.filter { it.payMethod == method }
                if (group.isNotEmpty()) appendLine(listOf(method.label, group.sumOf { it.paid }, group.size).joinToString(",", transform = ::csv))
            }
            appendLine()
            appendLine("PERINGKAT KASIR")
            appendLine(listOf("Kasir", "Email", "Service", "Omzet", "Masuk", "Cabang").joinToString(",", transform = ::csv))
            notas.groupBy { it.kasirEmail.ifBlank { it.kasir } }.map { (email, group) ->
                listOf(
                    staffDisplayName(CuciinStore.staff, email, group.first().kasir), email, group.size,
                    group.sumOf { it.total }, group.sumOf { it.paid },
                    group.map { CuciinStore.branches.firstOrNull { b -> b.id == it.branchId }?.name ?: it.branchId }.distinct().joinToString(" | "),
                )
            }.sortedByDescending { (it[3] as Int) }.forEach { row -> appendLine(row.joinToString(",", transform = ::csv)) }
            appendLine()
            appendLine("RINCIAN SERVICE")
            appendLine(
                listOf(
                    "No", "ID Service", "Waktu", "Cabang", "Kasir", "Email Kasir", "Pelanggan", "Layanan", "Jumlah", "Satuan",
                    "Harga Satuan", "Omzet Baris", "Petugas Layanan", "Email Petugas", "Komisi", "Metode", "Status Pembayaran", "Status Pengerjaan",
                ).joinToString(",", transform = ::csv),
            )
            var number = 1
            notas.sortedByDescending { it.createdAtMs }.forEach { n ->
                val branch = CuciinStore.branches.firstOrNull { it.id == n.branchId }?.name ?: n.branchId
                val lines = n.lines.ifEmpty { listOf(NotaLine("", n.items, 1.0, "Service", n.total, n.kasirEmail, n.kasir, 0)) }
                lines.forEachIndexed { lineIndex, line ->
                    appendLine(
                        listOf(
                            number++, n.id, n.createdAt, branch, kasirName(n), n.kasirEmail, n.customer,
                            line.name, line.qty, line.unit, line.unitPrice, (line.qty * line.unitPrice).toInt(),
                            if (lineIndex == 0) n.paid else 0,
                            staffDisplayName(CuciinStore.staff, line.handledByEmail.ifBlank { n.kasirEmail }, line.handledByName.ifBlank { n.kasir }),
                            line.handledByEmail.ifBlank { n.kasirEmail },
                            (line.qty * line.commissionPerUnit).toInt(), n.payMethod.label, n.pay.label, n.laundry.label,
                        ).joinToString(",", transform = ::csv),
                    )
                }
            }
        }
        shareGenerated(ctx, "laporan-analitik-${Clock.nowMs()}.csv", "text/csv", body)
    }

    /**
     * PDF laporan analitik: ringkasan, diagram batang tren bulanan, diagram donat komposisi,
     * tabel peringkat kasir, dan rincian Service. Diagram digambar langsung di kanvas PDF
     * supaya angka yang tampil di aplikasi juga terlihat di berkas.
     */
    fun shareAnalyticsPdf(
        ctx: Context,
        notas: List<Nota>,
        expenses: List<Expense>,
        periodLabel: String,
        trend: List<Triple<String, Int, Int>> = emptyList(),
        filterSummary: String = "",
    ) {
        shareFile(ctx, ReportPdf.analytics(ctx, notas, expenses, periodLabel, trend, filterSummary), "application/pdf")
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
        val navy = reportNavy
        val blue = reportBlue
        val sky = reportSky
        val ink = Color.rgb(18, 43, 72)
        val muted = Color.rgb(80, 102, 122)
        val body = Paint().apply { color = ink; textSize = 8.4f; isAntiAlias = true }
        val head = Paint(body).apply { color = Color.WHITE; isFakeBoldText = true }
        val grid = Paint().apply { color = reportGrid; style = Paint.Style.STROKE; strokeWidth = .8f }
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
            canvas.drawLine(24f, 564f, 818f, 564f, Paint().apply { color = reportGrid })
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
        shareFile(ctx, ReportPdf.nota(ctx, n), "application/pdf")
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
