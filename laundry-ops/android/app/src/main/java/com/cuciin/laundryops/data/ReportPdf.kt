package com.cuciin.laundryops.data

import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.graphics.Rect
import android.graphics.RectF
import com.cuciin.laundryops.R
import java.io.File
import java.util.Locale
import kotlin.math.cos
import kotlin.math.sin

/**
 * Tata letak PDF laporan transaksi, laporan analitik, dan nota pelanggan.
 *
 * Dipisah dari `FileExports` supaya aturan desain laporan hidup di satu tempat. Prinsip yang
 * dipegang:
 *
 * - Laporan dibangun dari modul; hanya modul yang diminta filter yang dicetak, dan tabel
 *   kosong tidak dipertahankan hanya demi tata letak.
 * - Satu transaksi tidak pernah terpotong antarhalaman, dan kepala tabel diulang.
 * - Setiap halaman memuat periode, nomor halaman, dan footer.
 * - Status selalu memakai teks; warna hanya memperkuat arti.
 *
 * Nomor halaman memakai dua lintasan: lintasan pertama menghitung jumlah halaman pada
 * dokumen sekali pakai, lintasan kedua menggambar dengan nomor yang sudah pasti. Tanpa itu
 * halaman terakhir bisa berbunyi "Halaman 1 / 1" pada dokumen yang isinya dua halaman.
 */
internal object ReportPdf {

    // ------------------------------------------------------------------ palet

    private val navy = Color.rgb(8, 58, 114)
    private val blue = Color.rgb(7, 91, 175)
    private val sky = Color.rgb(230, 244, 251)
    private val zebra = Color.rgb(242, 249, 253)
    private val line = Color.rgb(222, 235, 244)
    private val ink = Color.rgb(15, 38, 59)
    private val muted = Color.rgb(103, 120, 134)
    private val barLight = Color.rgb(178, 205, 232)
    private val cyan = Color.rgb(24, 174, 233)
    private val warnBg = Color.rgb(255, 248, 232)
    private val warn = Color.rgb(150, 100, 8)
    private val warnMark = Color.rgb(244, 158, 10)
    private val okBg = Color.rgb(232, 246, 239)
    private val ok = Color.rgb(15, 120, 100)
    private val badBg = Color.rgb(253, 238, 236)
    private val bad = Color.rgb(185, 60, 50)

    private const val PAGE_W = 842
    private const val PAGE_H = 595
    private const val LEFT = 24f
    private const val RIGHT = 818f
    private const val FOOTER_LINE = 552f

    private fun paint(size: Float, bold: Boolean = false, color: Int = ink, align: Paint.Align = Paint.Align.LEFT) =
        Paint().apply {
            this.color = color
            textSize = size
            isFakeBoldText = bold
            textAlign = align
            isAntiAlias = true
        }

    private fun fill(color: Int) = Paint().apply { this.color = color; style = Paint.Style.FILL; isAntiAlias = true }

    private fun stroke(color: Int = line, width: Float = .8f) =
        Paint().apply { this.color = color; style = Paint.Style.STROKE; strokeWidth = width; isAntiAlias = true }

    private fun Canvas.put(text: String, x: Float, y: Float, p: Paint) {
        if (text.isNotEmpty()) drawText(text, x, y, p)
    }

    /** Menggambar teks yang boleh membungkus; mengembalikan tinggi yang terpakai. */
    private fun Canvas.block(text: String, x: Float, y: Float, width: Float, p: Paint, lineHeight: Float, maxLines: Int = 2): Float {
        val rows = wrapMeasuredText(text, width, maxLines) { p.measureText(it) }
        rows.forEachIndexed { index, row -> drawText(row, x, y + index * lineHeight, p) }
        return rows.size * lineHeight
    }

    private fun decimal(value: Int, total: Int): String =
        if (total <= 0) "0,0%" else String.format(Locale.forLanguageTag("id-ID"), "%.1f", value * 100.0 / total) + "%"

    private fun quantity(value: Double): String =
        if (value % 1.0 == 0.0) value.toInt().toString() else value.toString().replace('.', ',')

    private fun branchName(id: String): String =
        CuciinStore.branches.firstOrNull { it.id == id }?.name?.removePrefix("Cuciin ") ?: id

    private fun cashierName(nota: Nota): String =
        staffDisplayName(CuciinStore.staff, nota.kasirEmail.ifBlank { nota.kasir }, nota.kasir)

    private fun serviceDetail(nota: Nota): String =
        nota.lines.takeIf { it.isNotEmpty() }
            ?.joinToString(" · ") { "${it.name} ${quantity(it.qty)} ${it.unit}" }
            ?: Regex("(\\d+)\\.0\\s*([A-Za-z]+)").replace(nota.items) { "${it.groupValues[1]} ${it.groupValues[2]}" }

    // ------------------------------------------------------------------ penulis halaman

    /**
     * Penulis halaman berulang: mengurus banner, nomor halaman, dan footer supaya tiap
     * laporan tidak mengulang logika yang sama.
     */
    private class Pager(
        private val pdf: PdfDocument,
        private val ctx: Context,
        private val title: String,
        private val period: String,
        private val created: String,
        var total: Int,
    ) {
        var pageNumber = 0
            private set
        private var page: PdfDocument.Page? = null
        var canvas: Canvas = Canvas()
            private set
        var y = 0f
            private set

        fun open() {
            pageNumber += 1
            val started = pdf.startPage(PdfDocument.PageInfo.Builder(PAGE_W, PAGE_H, pageNumber).create())
            page = started
            canvas = started.canvas
            canvas.drawColor(Color.WHITE)
            banner()
            y = 118f
        }

        fun next(subtitle: String) {
            footer()
            page?.let { pdf.finishPage(it) }
            pageNumber += 1
            val started = pdf.startPage(PdfDocument.PageInfo.Builder(PAGE_W, PAGE_H, pageNumber).create())
            page = started
            canvas = started.canvas
            canvas.drawColor(Color.WHITE)
            compactBanner(subtitle)
            y = 96f
        }

        fun close(): Int {
            footer()
            page?.let { pdf.finishPage(it) }
            page = null
            return pageNumber
        }

        /** Menyisakan ruang; bila tidak cukup, isi yang panjang pindah halaman lebih dulu. */
        fun ensure(space: Float, subtitle: String) {
            if (y + space > FOOTER_LINE) next(subtitle)
        }

        fun advance(by: Float) {
            y += by
        }

        fun moveTo(value: Float) {
            y = value
        }

        private fun banner() {
            canvas.drawRect(LEFT, 20f, RIGHT, 102f, fill(navy))
            BitmapFactory.decodeResource(ctx.resources, R.drawable.cuciin_logo)
                ?.let { canvas.drawBitmap(it, null, Rect(38, 34, 95, 88), null) }
            canvas.put(title, 112f, 54f, paint(18f, bold = true, color = Color.WHITE))
            canvas.put("Periode: $period", 112f, 78f, paint(10.3f, color = Color.WHITE))
            canvas.put("Dibuat $created WIB", RIGHT - 8f, 52f, paint(9.5f, color = Color.WHITE, align = Paint.Align.RIGHT))
            canvas.put("Halaman $pageNumber / $total", RIGHT - 8f, 76f, paint(9.5f, bold = true, color = Color.WHITE, align = Paint.Align.RIGHT))
            val barLeft = RIGHT - 160f
            canvas.drawRect(barLeft, 86f, RIGHT - 6f, 90f, fill(Color.rgb(60, 100, 150)))
            val filled = (RIGHT - 6f - barLeft) * pageNumber / total.coerceAtLeast(1)
            canvas.drawRect(barLeft, 86f, barLeft + filled, 90f, fill(cyan))
        }

        private fun compactBanner(subtitle: String) {
            canvas.drawRect(LEFT, 20f, RIGHT, 78f, fill(navy))
            BitmapFactory.decodeResource(ctx.resources, R.drawable.cuciin_logo)
                ?.let { canvas.drawBitmap(it, null, Rect(38, 28, 82, 70), null) }
            canvas.put(title, 100f, 46f, paint(15f, bold = true, color = Color.WHITE))
            canvas.put(subtitle, 100f, 66f, paint(9.6f, color = Color.WHITE))
            canvas.put("Halaman $pageNumber / $total", RIGHT - 8f, 66f, paint(9.5f, bold = true, color = Color.WHITE, align = Paint.Align.RIGHT))
        }

        private fun footer() {
            canvas.drawLine(LEFT, FOOTER_LINE + 10f, RIGHT, FOOTER_LINE + 10f, stroke())
            canvas.put("Dibuat oleh Cuciin · $created", LEFT, FOOTER_LINE + 26f, paint(8.3f, color = muted))
            canvas.put("Nominal dalam rupiah", RIGHT, FOOTER_LINE + 26f, paint(8.3f, color = muted, align = Paint.Align.RIGHT))
        }
    }

    // ------------------------------------------------------------------ potongan bersama

    private class Cell(val text: String, val bg: Int? = null, val fg: Int? = null)

    private fun statusCell(text: String): Cell = when {
        text.startsWith("Lunas", ignoreCase = true) -> Cell(text, okBg, ok)
        text.startsWith("Belum lunas", ignoreCase = true) -> Cell(text, warnBg, warn)
        else -> Cell(text)
    }

    private fun metricCards(pager: Pager, cards: List<Pair<String, String>>) {
        val top = pager.y
        val gap = 9f
        val width = (RIGHT - LEFT - gap * 3) / 4f
        cards.take(4).forEachIndexed { index, (label, value) ->
            val left = LEFT + index * (width + gap)
            val highlight = index == cards.lastIndex
            pager.canvas.drawRect(left, top, left + width, top + 54f, fill(if (highlight) navy else sky))
            pager.canvas.put(label.uppercase(), left + 12f, top + 21f, paint(8.2f, bold = true, color = if (highlight) Color.WHITE else blue))
            pager.canvas.put(value, left + 12f, top + 43f, paint(13f, bold = true, color = if (highlight) Color.WHITE else ink))
        }
        pager.moveTo(top + 54f)
    }

    /** Tinggi tabel tanpa menggambar apa pun, dipakai untuk memutuskan tata letak. */
    private fun measuredHeight(rows: List<List<Cell>>, widths: List<Float>, maxLines: Int = 2): Float {
        if (rows.isEmpty()) return 18f + 22f + 22f + 14f
        var total = 18f + 22f
        rows.forEach { total += rowHeight(it, widths, maxLines) }
        return total + 14f
    }

    private fun headRow(canvas: Canvas, top: Float, x: Float, header: List<String>, widths: List<Float>): Float {
        var cx = x
        header.forEachIndexed { index, label ->
            canvas.drawRect(cx, top, cx + widths[index], top + 22f, fill(blue))
            canvas.drawRect(cx, top, cx + widths[index], top + 22f, stroke())
            if (index == 0) {
                canvas.block(label, cx + 6f, top + 15f, widths[index] - 12f, paint(8.2f, bold = true, color = Color.WHITE), 10f, 1)
            } else {
                canvas.block(label, cx + widths[index] - 6f, top + 15f, widths[index] - 12f, paint(8.2f, bold = true, color = Color.WHITE, align = Paint.Align.RIGHT), 10f, 1)
            }
            cx += widths[index]
        }
        return top + 22f
    }

    /**
     * Tinggi satu baris dihitung dari jumlah baris teks terpanjang setelah dibungkus, jadi
     * tidak ada sel yang dipotong dengan elipsis.
     */
    private fun rowHeight(cells: List<Cell>, widths: List<Float>, maxLines: Int): Float {
        var lines = 1
        cells.forEachIndexed { index, cell ->
            val p = paint(8.2f, bold = cell.fg != null)
            lines = maxOf(lines, wrapMeasuredText(cell.text, widths[index] - 12f, maxLines) { p.measureText(it) }.size)
        }
        return maxOf(18f, lines * 10.5f + 7f)
    }

    private fun drawRow(
        canvas: Canvas,
        top: Float,
        x: Float,
        widths: List<Float>,
        cells: List<Cell>,
        height: Float,
        shade: Boolean,
        maxLines: Int,
    ) {
        var cx = x
        cells.forEachIndexed { cellIndex, cell ->
            val width = widths[cellIndex]
            if (cell.bg != null) {
                canvas.drawRect(cx, top, cx + width, top + height, fill(cell.bg))
            } else if (shade) {
                canvas.drawRect(cx, top, cx + width, top + height, fill(zebra))
            }
            canvas.drawRect(cx, top, cx + width, top + height, stroke())
            val p = paint(8.2f, bold = cell.fg != null, color = cell.fg ?: ink)
            if (cellIndex == 0) {
                canvas.block(cell.text, cx + 6f, top + 12f, width - 12f, p, 10.5f, maxLines)
            } else {
                canvas.block(cell.text, cx + width - 6f, top + 12f, width - 12f, paint(8.2f, bold = cell.fg != null, color = cell.fg ?: ink, align = Paint.Align.RIGHT), 10.5f, maxLines)
            }
            cx += width
        }
    }

    /**
     * Tabel yang sadar halaman: baris yang tidak muat dipindah ke halaman baru bersama kepala
     * tabel yang diulang, jadi tidak ada baris yang terpotong.
     */
    private fun pagedTable(
        pager: Pager,
        title: String,
        header: List<String>,
        widths: List<Float>,
        rows: List<List<Cell>>,
        maxLines: Int = 2,
        continueLabel: String,
    ) {
        val tableWidth = widths.sum()
        pager.ensure(18f + 22f + 34f + 14f, continueLabel)
        pager.canvas.put(title, LEFT, pager.y + 11f, paint(11f, bold = true, color = navy))
        pager.canvas.put("${rows.size} baris", LEFT + tableWidth, pager.y + 11f, paint(8.2f, color = muted, align = Paint.Align.RIGHT))
        pager.moveTo(pager.y + 18f)
        pager.moveTo(headRow(pager.canvas, pager.y, LEFT, header, widths))
        if (rows.isEmpty()) {
            pager.canvas.put("Tidak ada data pada filter ini.", LEFT + 6f, pager.y + 15f, paint(8.4f, color = muted))
            pager.advance(22f)
            return
        }
        rows.forEachIndexed { index, cells ->
            val height = rowHeight(cells, widths, maxLines)
            if (pager.y + height > FOOTER_LINE) {
                pager.next("$continueLabel · $title")
                pager.canvas.put("$title (lanjutan)", LEFT, pager.y + 11f, paint(11f, bold = true, color = navy))
                pager.moveTo(pager.y + 18f)
                pager.moveTo(headRow(pager.canvas, pager.y, LEFT, header, widths))
            }
            drawRow(pager.canvas, pager.y, LEFT, widths, cells, height, shade = index % 2 == 0, maxLines = maxLines)
            pager.advance(height)
        }
        pager.advance(14f)
    }

    /** Tabel pada kotak terbatas: tidak memecah halaman, dipakai untuk area agregat. */
    private fun blockTable(
        canvas: Canvas,
        top: Float,
        x: Float,
        width: Float,
        title: String,
        header: List<String>,
        rows: List<List<Cell>>,
    ): Float {
        val ratios = header.map { 1f }
        val totalRatio = ratios.sum()
        val widths = ratios.map { width * it / totalRatio }
        canvas.put(title, x, top + 11f, paint(10.4f, bold = true, color = navy))
        var y = headRow(canvas, top + 18f, x, header, widths)
        if (rows.isEmpty()) {
            canvas.put("Tidak ada data pada filter ini.", x + 6f, y + 15f, paint(8.4f, color = muted))
            return y + 24f
        }
        rows.forEachIndexed { index, cells ->
            val height = rowHeight(cells, widths, 2)
            drawRow(canvas, y, x, widths, cells, height, shade = index % 2 == 0, maxLines = 2)
            y += height
        }
        return y + 14f
    }

    // ------------------------------------------------------------------ laporan transaksi

    private class TransaksiRow(
        val no: Int,
        val id: String,
        val time: String,
        val branch: String,
        val cashier: String,
        val detail: String,
        val omzet: Int,
        val diterima: Int,
        val komisi: Int,
        val payLabel: String,
        val laundryLabel: String,
    )

    private fun sectionLabels(sections: Set<String>): String {
        val order = listOf(
            "ringkasan" to "Ringkasan",
            "cabang" to "Per cabang",
            "kasir" to "Per kasir",
            "petugas" to "Komisi petugas",
            "rincian" to "Rincian transaksi",
        )
        return order.filter { it.first in sections }.map { it.second }.joinToString(", ").ifBlank { "Ringkasan" }
    }

    fun transaksi(ctx: Context, notas: List<Nota>, expenses: List<Expense>, periodLabel: String, sections: Set<String>): File {
        val probe = PdfDocument()
        val total = renderTransaksi(ctx, probe, 1, notas, expenses, periodLabel, sections)
        probe.close()
        val pdf = PdfDocument()
        renderTransaksi(ctx, pdf, total, notas, expenses, periodLabel, sections)
        return write(ctx, pdf, "laporan-transaksi-${Clock.nowMs()}.pdf")
    }

    private fun renderTransaksi(
        ctx: Context,
        pdf: PdfDocument,
        total: Int,
        notas: List<Nota>,
        expenses: List<Expense>,
        periodLabel: String,
        sections: Set<String>,
    ): Int {
        val rows = notas.sortedByDescending { it.createdAtMs }.mapIndexed { index, nota ->
            TransaksiRow(
                no = index + 1,
                id = nota.id,
                time = nota.createdAt,
                branch = branchName(nota.branchId),
                cashier = cashierName(nota),
                detail = serviceDetail(nota),
                omzet = nota.total,
                diterima = nota.paid,
                komisi = nota.lines.sumOf { (it.qty * it.commissionPerUnit).toInt() },
                payLabel = nota.pay.label,
                laundryLabel = nota.laundry.label,
            )
        }
        val omzet = rows.sumOf { it.omzet }
        val diterima = rows.sumOf { it.diterima }
        val piutang = rows.sumOf { maxOf(0, it.omzet - it.diterima) }
        val biaya = expenses.sumOf { it.amount }
        val belumLunas = rows.count { it.payLabel.startsWith("Belum", ignoreCase = true) }

        val pager = Pager(pdf, ctx, "LAPORAN TRANSAKSI", periodLabel, Clock.nowLabel(), total)
        pager.open()

        pager.canvas.put("FILTER AKTIF", LEFT, pager.y, paint(8.2f, bold = true, color = blue))
        pager.advance(14f)
        pager.canvas.put(
            "${rows.map { it.branch }.distinct().size} cabang · ${rows.map { it.cashier }.distinct().size} kasir · Bagian: ${sectionLabels(sections)}",
            LEFT, pager.y, paint(8.6f, color = muted),
        )
        pager.advance(18f)

        if ("ringkasan" in sections) {
            metricCards(
                pager,
                listOf(
                    "Omzet" to rp(omzet),
                    "Kas diterima" to rp(diterima),
                    "Piutang" to rp(piutang),
                    "Hasil kas" to rp(diterima - biaya),
                ),
            )
            pager.advance(18f)
        } else {
            pager.canvas.put("${rows.size} transaksi pada filter ini", LEFT, pager.y + 4f, paint(9.4f, bold = true, color = navy))
            pager.advance(20f)
        }

        // Area agregat: rekonsiliasi berdampingan dengan tabel pertama bila keduanya muat,
        // sisanya mengalir penuh supaya tidak ada tabel yang sempit dan terpotong.
        val half = (RIGHT - LEFT - 24f) / 2f
        val perCabang = rows.groupBy { it.branch }.entries
            .sortedByDescending { entry -> entry.value.sumOf { it.omzet } }
            .map { (name, group) ->
                val cost = expenses.filter { branchName(it.branchId) == name }.sumOf { it.amount }
                listOf(
                    Cell(name), Cell(group.size.toString()),
                    Cell(rp(group.sumOf { it.omzet })), Cell(rp(group.sumOf { it.diterima })),
                    Cell(rp(cost)), Cell(rp(group.sumOf { it.diterima } - cost), fg = navy),
                )
            }
        val perKasir = rows.groupBy { it.cashier }.entries
            .sortedByDescending { entry -> entry.value.sumOf { it.omzet } }
            .map { (name, group) ->
                listOf(
                    Cell(name), Cell(group.size.toString()),
                    Cell(rp(group.sumOf { it.omzet })), Cell(rp(group.sumOf { it.diterima })),
                    Cell(group.map { it.branch }.distinct().joinToString(", ")),
                )
            }
        val komisi = notas.flatMap { nota -> nota.lines.map { line -> Triple(nota, line, (line.qty * line.commissionPerUnit).toInt()) } }
            .groupBy { (nota, line, _) -> "${nota.branchId}|${line.handledByEmail.ifBlank { nota.kasirEmail }.ifBlank { nota.kasir }}" }
            .map { (_, group) ->
                val first = group.first()
                val email = first.second.handledByEmail.ifBlank { first.first.kasirEmail }.ifBlank { first.first.kasir }
                listOf(
                    Cell(staffDisplayName(CuciinStore.staff, email, first.second.handledByName.ifBlank { first.first.kasir })),
                    Cell(branchName(first.first.branchId)),
                    Cell("${group.map { it.first.id }.distinct().size}"),
                    Cell(rp(group.sumOf { it.third }), fg = navy),
                )
            }

        var placedAny = false
        if ("ringkasan" in sections) {
            val reconHeight = 18f + 92f + 14f
            val cabangHeader = listOf("Cabang", "Trx", "Omzet", "Diterima", "Biaya", "Hasil kas")
            val cabangWidths = cabangHeader.map { half / cabangHeader.size }
            val cabangHeight = measuredHeight(perCabang, cabangWidths)
            val sideBySide = "cabang" in sections && reconHeight + 20f + cabangHeight < FOOTER_LINE - pager.y
            drawReconciliation(pager.canvas, pager.y, if (sideBySide) half else RIGHT - LEFT, omzet, diterima, piutang, biaya, rows.size, belumLunas)
            if (sideBySide) {
                val bottom = blockTable(
                    pager.canvas, pager.y, LEFT + half + 24f, half, "Per cabang",
                    cabangHeader, perCabang,
                )
                pager.moveTo(maxOf(pager.y + reconHeight, bottom))
            } else {
                pager.advance(reconHeight)
                if ("cabang" in sections) {
                    pager.moveTo(
                        blockTable(pager.canvas, pager.y, LEFT, RIGHT - LEFT, "Per cabang", cabangHeader, perCabang),
                    )
                }
            }
            placedAny = true
        } else if ("cabang" in sections) {
            pager.moveTo(blockTable(pager.canvas, pager.y, LEFT, RIGHT - LEFT, "Per cabang", listOf("Cabang", "Trx", "Omzet", "Diterima", "Biaya", "Hasil kas"), perCabang))
            placedAny = true
        }
        if ("kasir" in sections) {
            pager.moveTo(blockTable(pager.canvas, pager.y, LEFT, RIGHT - LEFT, "Per kasir", listOf("Kasir", "Trx", "Omzet", "Diterima", "Cabang"), perKasir))
            placedAny = true
        }
        if ("petugas" in sections) {
            pager.moveTo(blockTable(pager.canvas, pager.y, LEFT, RIGHT - LEFT, "Komisi petugas", listOf("Petugas", "Cabang", "Trx", "Komisi"), komisi))
            placedAny = true
        }

        pager.ensure(46f, "Catatan · $periodLabel")
        pager.canvas.put("Catatan", LEFT, pager.y + 10f, paint(9.4f, bold = true, color = navy))
        pager.advance(18f)
        pager.canvas.block(
            if (placedAny) "Omzet direkonsiliasi menjadi kas diterima dan piutang. Biaya pada periode ini ${rp(biaya)}."
            else "Hanya rincian transaksi yang dipilih. Angka ringkasan tidak dicetak agar tidak ada tabel kosong.",
            LEFT, pager.y, RIGHT - LEFT, paint(8.4f, color = muted), 11f, 2,
        )
        pager.advance(24f)

        if ("rincian" in sections) {
            pagedTable(
                pager, "Rincian transaksi",
                listOf("No", "Nota", "Waktu", "Cabang / Kasir", "Rincian layanan", "Omzet", "Diterima", "Komisi", "Pembayaran", "Pengerjaan"),
                listOf(24f, 92f, 74f, 96f, 150f, 70f, 70f, 60f, 72f, 86f),
                rows.map { row ->
                    listOf(
                        Cell(row.no.toString()), Cell(row.id), Cell(row.time),
                        Cell("${row.branch} / ${row.cashier}"), Cell(row.detail),
                        Cell(rp(row.omzet)), Cell(rp(row.diterima)), Cell(rp(row.komisi)),
                        statusCell(row.payLabel), Cell(row.laundryLabel),
                    )
                },
                maxLines = 3,
                continueLabel = "Lanjutan rincian transaksi",
            )
        } else if (!placedAny) {
            pager.canvas.put("Tidak ada bagian laporan yang dipilih.", LEFT, pager.y + 12f, paint(9f, color = muted))
        }
        return pager.close()
    }

    private fun drawReconciliation(
        canvas: Canvas,
        top: Float,
        width: Float,
        omzet: Int,
        diterima: Int,
        piutang: Int,
        biaya: Int,
        transaksi: Int,
        belumLunas: Int,
    ) {
        canvas.put("Rekonsiliasi", LEFT, top + 11f, paint(10.4f, bold = true, color = navy))
        val boxTop = top + 18f
        canvas.drawRect(LEFT, boxTop, LEFT + width, boxTop + 92f, fill(sky))
        val items = listOf(
            "Omzet" to rp(omzet),
            "Kas diterima + piutang" to "${rp(diterima)} + ${rp(piutang)}",
            "Biaya tercatat" to rp(biaya),
            "Jumlah transaksi" to "$transaksi transaksi · $belumLunas belum lunas",
        )
        var rowY = boxTop + 20f
        items.forEachIndexed { index, (label, value) ->
            if (index > 0) canvas.drawLine(LEFT + 10f, rowY - 15f, LEFT + width - 10f, rowY - 15f, stroke())
            canvas.put(label, LEFT + 12f, rowY, paint(8.4f, color = muted))
            canvas.put(value, LEFT + width - 12f, rowY, paint(8.6f, bold = true, color = ink, align = Paint.Align.RIGHT))
            rowY += 21f
        }
    }

    // ------------------------------------------------------------------ laporan analitik

    fun analytics(
        ctx: Context,
        notas: List<Nota>,
        expenses: List<Expense>,
        periodLabel: String,
        trend: List<Triple<String, Int, Int>>,
        filterSummary: String,
    ): File {
        val probe = PdfDocument()
        val total = renderAnalytics(ctx, probe, 1, notas, expenses, periodLabel, trend, filterSummary)
        probe.close()
        val pdf = PdfDocument()
        renderAnalytics(ctx, pdf, total, notas, expenses, periodLabel, trend, filterSummary)
        return write(ctx, pdf, "laporan-analitik-${Clock.nowMs()}.pdf")
    }

    private fun renderAnalytics(
        ctx: Context,
        pdf: PdfDocument,
        total: Int,
        notas: List<Nota>,
        expenses: List<Expense>,
        periodLabel: String,
        trend: List<Triple<String, Int, Int>>,
        filterSummary: String,
    ): Int {
        val omzet = notas.sumOf { it.total }
        val masuk = notas.sumOf { it.paid }
        val piutang = notas.sumOf { maxOf(0, it.total - it.paid) }
        val biaya = expenses.sumOf { it.amount }
        val perCabang = notas.groupBy { branchName(it.branchId) }
            .map { (name, group) -> Triple(name, group.sumOf { it.total }, group.size) }
            .sortedByDescending { it.second }
        val perKasir = notas.groupBy { cashierName(it) }
            .map { (name, group) -> Triple(name, group.sumOf { it.total }, group.size) }
            .sortedByDescending { it.second }
        val perMetode = PayMethod.entries.map { method ->
            Triple(method.label, notas.filter { it.payMethod == method }.sumOf { it.paid }, notas.count { it.payMethod == method })
        }.filter { it.second > 0 }.sortedByDescending { it.second }

        val pager = Pager(pdf, ctx, "LAPORAN ANALITIK", periodLabel, Clock.nowLabel(), total)
        pager.open()

        pager.canvas.put("FILTER AKTIF", LEFT, pager.y, paint(8.2f, bold = true, color = blue))
        pager.advance(14f)
        pager.canvas.put(filterSummary.ifBlank { "Semua cabang · Semua kasir · Semua jenis data" }, LEFT, pager.y, paint(8.6f, color = muted))
        pager.advance(18f)

        metricCards(
            pager,
            listOf(
                "Omzet" to rp(omzet),
                "Kas diterima" to rp(masuk),
                "Piutang" to rp(piutang),
                "Hasil kas" to rp(masuk - biaya),
            ),
        )
        pager.advance(18f)

        // Satu titik data bukan tren; kalau hanya satu periode, nilainya disebut langsung.
        pager.canvas.put("Omzet per bulan", LEFT, pager.y + 11f, paint(11f, bold = true, color = navy))
        pager.advance(16f)
        if (trend.size >= 2) {
            val maxValue = trend.maxOf { it.second }.coerceAtLeast(1)
            val average = trend.sumOf { it.second } / trend.size
            val chartHeight = 84f
            val baseline = pager.y + chartHeight
            val slot = (RIGHT - LEFT) / trend.size
            trend.forEachIndexed { index, (label, value, _) ->
                val barWidth = (slot * .52f).coerceAtMost(52f)
                val left = LEFT + index * slot + (slot - barWidth) / 2f
                val barHeight = (chartHeight * value / maxValue).coerceAtLeast(3f)
                pager.canvas.drawRect(left, baseline - barHeight, left + barWidth, baseline, fill(if (value >= average) blue else barLight))
                pager.canvas.put(rp(value).removePrefix("Rp "), left + barWidth / 2f, baseline - barHeight - 4f, paint(7.4f, color = ink, align = Paint.Align.CENTER))
                pager.canvas.put(label, left + barWidth / 2f, baseline + 11f, paint(7.6f, color = muted, align = Paint.Align.CENTER))
            }
            pager.canvas.drawLine(LEFT, baseline, RIGHT, baseline, stroke())
            pager.canvas.put("Puncak ${rp(maxValue)} · rata-rata ${rp(average)}", LEFT, baseline + 24f, paint(8f, color = muted))
            pager.moveTo(baseline + 32f)
        } else {
            val value = trend.firstOrNull()?.second ?: 0
            val label = trend.firstOrNull()?.first ?: periodLabel
            pager.canvas.drawRect(LEFT, pager.y, RIGHT, pager.y + 34f, fill(sky))
            pager.canvas.put(label, LEFT + 12f, pager.y + 22f, paint(9f, bold = true, color = ink))
            pager.canvas.drawRect(LEFT + 150f, pager.y + 10f, RIGHT - 150f, pager.y + 24f, fill(blue))
            pager.canvas.put(rp(value), RIGHT - 12f, pager.y + 22f, paint(10f, bold = true, color = navy, align = Paint.Align.RIGHT))
            pager.canvas.put("${trend.size} bulan tercatat. Belum cukup data untuk menilai tren.", LEFT, pager.y + 48f, paint(8f, color = muted))
            pager.advance(60f)
        }
        pager.advance(16f)

        val half = (RIGHT - LEFT - 24f) / 2f
        val donutTop = pager.y + 30f
        drawDonut(pager.canvas, "Omzet per cabang", "Total omzet", omzet, perCabang, LEFT, donutTop, 104f, half)
        drawDonut(pager.canvas, "Penerimaan per metode", "Kas diterima", masuk, perMetode, LEFT + half + 24f, donutTop, 104f, half)
        pager.canvas.put("Persentase dibulatkan satu angka desimal.", LEFT + half + 24f, donutTop + 146f, paint(7.6f, color = muted))
        pager.moveTo(donutTop + 162f)

        pagedTable(
            pager, "Omzet per cabang",
            listOf("Cabang", "Omzet", "Transaksi"),
            listOf(400f, 220f, 174f),
            perCabang.map { listOf(Cell(it.first), Cell(rp(it.second)), Cell(it.third.toString())) },
            maxLines = 2,
            continueLabel = "Tabel pendukung",
        )
        pagedTable(
            pager, "Peringkat kasir",
            listOf("Kasir", "Omzet", "Transaksi"),
            listOf(400f, 220f, 174f),
            perKasir.map { listOf(Cell(it.first), Cell(rp(it.second)), Cell(it.third.toString())) },
            maxLines = 2,
            continueLabel = "Tabel pendukung",
        )
        pagedTable(
            pager, "Rincian transaksi",
            listOf("ID transaksi", "Waktu", "Cabang", "Kasir", "Omzet"),
            listOf(180f, 140f, 160f, 150f, 164f),
            notas.sortedByDescending { it.createdAtMs }.map { nota ->
                listOf(Cell(nota.id), Cell(nota.createdAt), Cell(branchName(nota.branchId)), Cell(cashierName(nota)), Cell(rp(nota.total)))
            },
            maxLines = 2,
            continueLabel = "Lanjutan rincian transaksi",
        )
        return pager.close()
    }

    /**
     * Donut dengan total di tengah dan legenda yang selalu memuat swatch, nama, nominal, dan
     * persentase, sehingga warna bukan satu-satunya pembeda.
     */
    private fun drawDonut(
        canvas: Canvas,
        title: String,
        centerLabel: String,
        centerValue: Int,
        slices: List<Triple<String, Int, Int>>,
        left: Float,
        top: Float,
        size: Float,
        columnWidth: Float,
    ) {
        val ringWidth = size * .2f
        canvas.put(title, left, top - ringWidth / 2f - 8f, paint(11f, bold = true, color = navy))
        val total = slices.sumOf { it.second }
        val rect = RectF(left, top, left + size, top + size)
        if (slices.isEmpty() || total <= 0) {
            canvas.drawArc(rect, 0f, 360f, false, stroke(line, ringWidth))
            canvas.put("Belum ada data", left + size / 2f, top + size / 2f, paint(8.4f, color = muted, align = Paint.Align.CENTER))
            return
        }
        val colors = ChartPalette.categorical.map { (r, g, b) -> Color.rgb(r, g, b) }
        var angle = -90f
        slices.forEachIndexed { index, (_, value, _) ->
            val sweep = 360f * value / total
            canvas.drawArc(rect, angle, sweep, false, Paint().apply {
                color = colors[index % colors.size]
                style = Paint.Style.STROKE
                strokeWidth = ringWidth
                isAntiAlias = true
            })
            if (sweep >= 24f) {
                val mid = Math.toRadians((angle + sweep / 2f).toDouble())
                val radius = size / 2f
                val x = left + size / 2f + radius * cos(mid).toFloat()
                val y = top + size / 2f + radius * sin(mid).toFloat()
                canvas.put(decimal(value, total), x, y + 3f, paint(8f, bold = true, color = Color.WHITE, align = Paint.Align.CENTER))
            }
            angle += sweep
        }
        // Pemisah antarslice berupa garis tipis dari sisi dalam ke sisi luar cincin. Bentuknya
        // sengaja garis, bukan lingkaran, supaya tidak terlihat seperti lubang pada donat.
        angle = -90f
        val outerRadius = size / 2f + ringWidth / 2f
        val innerRadius = size / 2f - ringWidth / 2f
        slices.forEach { (_, value, _) ->
            val sweep = 360f * value / total
            val mid = Math.toRadians(angle.toDouble())
            val cosMid = cos(mid).toFloat()
            val sinMid = sin(mid).toFloat()
            canvas.drawLine(
                left + size / 2f + innerRadius * cosMid,
                top + size / 2f + innerRadius * sinMid,
                left + size / 2f + outerRadius * cosMid,
                top + size / 2f + outerRadius * sinMid,
                Paint().apply { color = Color.WHITE; strokeWidth = 1.6f; isAntiAlias = true },
            )
            angle += sweep
        }
        canvas.put(rp(centerValue), left + size / 2f, top + size / 2f - 1f, paint(11f, bold = true, color = ink, align = Paint.Align.CENTER))
        canvas.put(centerLabel.uppercase(), left + size / 2f, top + size / 2f + 14f, paint(7.2f, bold = true, color = muted, align = Paint.Align.CENTER))

        val legendX = left + size + 14f
        val legendWidth = columnWidth - size - 14f
        var legendY = top + 2f
        slices.take(7).forEachIndexed { index, (label, value, _) ->
            canvas.drawRect(legendX, legendY - 8f, legendX + 9f, legendY + 1f, fill(colors[index % colors.size]))
            canvas.drawRect(legendX, legendY - 8f, legendX + 9f, legendY + 1f, stroke())
            canvas.block(label, legendX + 14f, legendY, legendWidth - 90f, paint(8.2f, bold = true, color = ink), 10f, 1)
            canvas.put("${rp(value)} · ${decimal(value, total)}", legendX + legendWidth, legendY, paint(8.2f, color = muted, align = Paint.Align.RIGHT))
            legendY += 16f
        }
    }

    // ------------------------------------------------------------------ nota pelanggan

    fun nota(ctx: Context, nota: Nota): File {
        val probe = PdfDocument()
        val total = renderNota(ctx, probe, 1, nota)
        probe.close()
        val pdf = PdfDocument()
        renderNota(ctx, pdf, total, nota)
        return write(ctx, pdf, "${nota.id}.pdf")
    }

    private fun renderNota(ctx: Context, pdf: PdfDocument, total: Int, nota: Nota): Int {
        val branch = CuciinStore.branch(nota.branchId)
        var pageNumber = 1
        var page = pdf.startPage(PdfDocument.PageInfo.Builder(595, 842, pageNumber).create())
        var canvas = page.canvas
        canvas.drawColor(Color.WHITE)

        // Blok header menyusut bila alamat cabang kosong, jadi tidak ada baris kosong.
        val hasAddress = branch.location.isNotBlank()
        val bannerHeight = if (hasAddress) 96f else 74f
        canvas.drawRect(32f, 28f, 563f, 28f + bannerHeight, fill(navy))
        BitmapFactory.decodeResource(ctx.resources, R.drawable.cuciin_logo)
            ?.let { canvas.drawBitmap(it, null, Rect(42, 40, 87, 85), null) }
        canvas.put(branch.name.uppercase(), 99f, 62f, paint(20f, bold = true, color = Color.WHITE))
        canvas.put("Nota laundry", 99f, 84f, paint(10.4f, color = Color.WHITE))
        if (hasAddress) canvas.block(branch.location, 99f, 104f, 420f, paint(8.6f, color = Color.WHITE), 11f, 2)
        canvas.put(nota.id, 555f, 52f, paint(9.6f, bold = true, color = Color.WHITE, align = Paint.Align.RIGHT))
        canvas.drawRect(32f, 28f + bannerHeight - 4f, 563f, 28f + bannerHeight, fill(cyan))
        canvas.drawRect(32f, 28f + bannerHeight - 4f, 190f, 28f + bannerHeight, fill(warnMark))

        var cursor = 28f + bannerHeight + 18f

        // Status pembayaran dan pengerjaan dipisah; keduanya menjawab pertanyaan berbeda.
        var capsuleX = 40f
        fun capsule(text: String, bg: Int, fg: Int) {
            val p = paint(9f, bold = true, color = fg)
            val width = p.measureText(text) + 26f
            canvas.drawRect(capsuleX, cursor, capsuleX + width, cursor + 26f, fill(bg))
            canvas.put(text, capsuleX + 13f, cursor + 17f, p)
            capsuleX += width + 8f
        }
        val waiting = nota.laundry != LaundryStatus.Selesai
        capsule(nota.laundry.label.uppercase(), if (waiting) warnBg else okBg, if (waiting) warn else ok)
        if (nota.pay == PayStatus.Lunas) capsule("LUNAS", okBg, ok) else capsule(nota.pay.label.uppercase(), badBg, bad)
        cursor += 42f

        canvas.put("Informasi pesanan", 40f, cursor, paint(10.4f, bold = true, color = navy))
        cursor += 22f
        val info = listOf(
            "Kasir" to cashierName(nota),
            "Pelanggan" to nota.customer,
            "Waktu masuk" to nota.createdAt,
            "Estimasi selesai" to nota.pickupAt,
        )
        info.chunked(2).forEach { pair ->
            val rowTop = cursor
            pair.forEachIndexed { index, (label, value) ->
                val x = 40f + index * 262f
                canvas.put(label, x, rowTop, paint(8.6f, color = muted))
                canvas.block(value.ifBlank { "Belum ditentukan" }, x, rowTop + 17f, 240f, paint(10.4f, bold = true, color = ink), 13f, 2)
            }
            cursor = rowTop + 46f
        }
        cursor += 6f

        val columns = listOf(44f, 343f, 128f)
        val header = listOf("No.", "Layanan", "Subtotal")
        fun tableHead(top: Float): Float {
            var x = 40f
            header.forEachIndexed { index, label ->
                canvas.drawRect(x, top, x + columns[index], top + 30f, fill(blue))
                canvas.drawRect(x, top, x + columns[index], top + 30f, stroke())
                canvas.put(label, x + 10f, top + 20f, paint(9.4f, bold = true, color = Color.WHITE))
                x += columns[index]
            }
            return top + 30f
        }
        cursor = tableHead(cursor)

        val legacy = Regex("(\\d+)\\.0\\s*([A-Za-z]+)").replace(nota.items) { "${it.groupValues[1]} ${it.groupValues[2]}" }
        val lines = nota.lines.ifEmpty { listOf(NotaLine("", legacy, 1.0, "nota", nota.total, nota.kasirEmail, nota.kasir, 0)) }
        val perPage = receiptPageLineCounts(lines.size)
        val firstCount = perPage.first()

        fun drawServiceRows(top: Float, items: List<NotaLine>, offset: Int): Float {
            var y = top
            items.forEachIndexed { index, item ->
                var x = 40f
                val values = listOf(
                    (offset + index + 1).toString(),
                    if (item.serviceId.isBlank()) item.name else "${item.name}\n${quantity(item.qty)} ${item.unit} × ${rp(item.unitPrice)}",
                    rp((item.qty * item.unitPrice).toInt()),
                )
                columns.forEachIndexed { cellIndex, width ->
                    if (index % 2 == 0) canvas.drawRect(x, y, x + width, y + 50f, fill(zebra))
                    canvas.drawRect(x, y, x + width, y + 50f, stroke())
                    if (cellIndex == 2) {
                        canvas.block(values[cellIndex], x + width - 10f, y + 20f, width - 20f, paint(10.2f, bold = true, color = ink, align = Paint.Align.RIGHT), 14f, 2)
                    } else {
                        canvas.block(values[cellIndex], x + 10f, y + 20f, width - 20f, paint(10.2f, bold = cellIndex == 0, color = ink), 14f, 2)
                    }
                    x += width
                }
                y += 50f
            }
            return y
        }

        cursor = drawServiceRows(cursor, lines.take(firstCount), 0)
        if (lines.size > firstCount) {
            canvas.put("${lines.size - firstCount} layanan dilanjutkan pada halaman berikutnya.", 48f, cursor + 18f, paint(8.6f, color = muted))
            cursor += 30f
        }

        fun summary(top: Float): Float {
            canvas.put("Ringkasan pembayaran", 40f, top, paint(10.4f, bold = true, color = navy))
            var boxTop = top + 12f
            canvas.drawRect(40f, boxTop, 555f, boxTop + 96f, fill(sky))
            canvas.put("Metode", 56f, boxTop + 24f, paint(8.8f, color = muted))
            canvas.put(nota.payMethod.label, 200f, boxTop + 24f, paint(9.6f, bold = true, color = ink))
            canvas.put("Dibayar", 56f, boxTop + 48f, paint(8.8f, color = muted))
            canvas.put(rp(nota.paid), 200f, boxTop + 48f, paint(9.6f, bold = true, color = ink))
            canvas.drawRect(40f, boxTop + 62f, 555f, boxTop + 96f, fill(navy))
            canvas.put("TOTAL", 56f, boxTop + 86f, paint(12f, bold = true, color = Color.WHITE))
            canvas.put(rp(nota.total), 543f, boxTop + 87f, paint(16f, bold = true, color = Color.WHITE, align = Paint.Align.RIGHT))
            boxTop += 106f
            canvas.drawRect(40f, boxTop, 555f, boxTop + 42f, fill(warnBg))
            canvas.drawCircle(58f, boxTop + 21f, 5f, fill(warnMark))
            canvas.put("Status pengerjaan", 74f, boxTop + 17f, paint(8.8f, color = warn))
            canvas.put(nota.laundry.label, 74f, boxTop + 33f, paint(10f, bold = true, color = ink))
            return boxTop + 42f
        }

        fun footer() {
            canvas.drawLine(40f, 792f, 555f, 792f, stroke())
            canvas.put("Terima kasih telah mempercayakan laundry Anda kepada ${branch.name}.", 40f, 810f, paint(8.6f, color = muted))
            canvas.put("Dibuat oleh Cuciin", 40f, 826f, paint(8f, color = muted))
            canvas.put(nota.id, 555f, 826f, paint(8f, bold = true, color = muted, align = Paint.Align.RIGHT))
        }

        if (lines.size <= firstCount) cursor = summary(cursor + 18f)
        footer()
        pdf.finishPage(page)

        val rest = lines.drop(firstCount)
        rest.chunked(11).forEachIndexed { extraIndex, pageLines ->
            pageNumber += 1
            page = pdf.startPage(PdfDocument.PageInfo.Builder(595, 842, pageNumber).create())
            canvas = page.canvas
            canvas.drawColor(Color.WHITE)
            canvas.drawRect(32f, 28f, 563f, 104f, fill(navy))
            BitmapFactory.decodeResource(ctx.resources, R.drawable.cuciin_logo)
                ?.let { canvas.drawBitmap(it, null, Rect(42, 40, 79, 77), null) }
            canvas.put(branch.name.uppercase(), 91f, 60f, paint(18f, bold = true, color = Color.WHITE))
            canvas.put("Nota laundry · rincian lanjutan", 91f, 84f, paint(10f, color = Color.WHITE))
            canvas.put(nota.id, 555f, 52f, paint(9.6f, bold = true, color = Color.WHITE, align = Paint.Align.RIGHT))
            canvas.put("Halaman $pageNumber / $total", 555f, 84f, paint(9.6f, bold = true, color = Color.WHITE, align = Paint.Align.RIGHT))
            cursor = tableHead(132f)
            cursor = drawServiceRows(cursor, pageLines, firstCount + extraIndex * 11)
            if (extraIndex == rest.chunked(11).lastIndex) {
                cursor = summary(cursor + 14f)
            } else {
                canvas.put("Rincian berlanjut ke halaman berikutnya.", 48f, cursor + 18f, paint(8.6f, color = muted))
            }
            footer()
            pdf.finishPage(page)
        }
        return pageNumber
    }

    private fun write(ctx: Context, pdf: PdfDocument, name: String): File {
        val file = File(File(ctx.cacheDir, "share").apply { mkdirs() }, name)
        file.outputStream().use { pdf.writeTo(it) }
        pdf.close()
        return file
    }
}
