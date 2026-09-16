package com.cuciin.laundryops.ui

import com.cuciin.laundryops.data.Clock
import com.cuciin.laundryops.data.Branch
import com.cuciin.laundryops.data.LaundryStatus
import com.cuciin.laundryops.data.Nota
import com.cuciin.laundryops.data.PayStatus
import com.cuciin.laundryops.data.ReceiptText
import com.cuciin.laundryops.data.NotaLine
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDateTime
import java.time.Instant
import com.cuciin.laundryops.data.wrapMeasuredText
import com.cuciin.laundryops.data.receiptPageLineCounts

class InteractionContractsTest {
    @Test fun dateAndTimeRoundTripPreservesUserSelection() {
        val leapDay = LocalDateTime.of(2028, 2, 29, 23, 45)
        assertEquals(leapDay, DisplayDates.parse(DisplayDates.encode(leapDay)))
        assertNull(DisplayDates.parse("besok sore"))
        val midnightJakarta = Instant.parse("2026-09-10T17:05:00Z").toEpochMilli()
        assertEquals(LocalDateTime.of(2026, 9, 11, 0, 5), DisplayDates.fromMillis(midnightJakarta))
        assertTrue(DisplayDates.full(midnightJakarta).startsWith("Jumat, 11 September 2026"))
    }

    @Test fun reportRangeIncludesTheEntireSelectedEndMinute() {
        val from = LocalDateTime.of(2026, 9, 11, 0, 0)
        val until = LocalDateTime.of(2026, 9, 11, 23, 59)
        val lastMillisecond = Instant.parse("2026-09-11T16:59:59.999Z").toEpochMilli()
        val nextMidnight = Instant.parse("2026-09-11T17:00:00Z").toEpochMilli()
        assertTrue(DisplayDates.isInSelectedMinute(lastMillisecond, from, until))
        assertFalse(DisplayDates.isInSelectedMinute(nextMidnight, from, until))
    }

    @Test fun legacyReportTimestampFallsBackToStoredLabel() {
        val expected = Instant.parse("2026-09-11T01:05:00Z").toEpochMilli()
        assertEquals(expected, DisplayDates.reportTimestamp(0, "11 Sep 2026, 08.05"))
        assertNull(DisplayDates.reportTimestamp(0, "format lama tidak dikenal"))
    }

    @Test fun pdfWrappingSplitsLongTokensInsideCellWidth() {
        val lines = wrapMeasuredText("NOTA-TANPA-SPASI-1234567890", width = 8f, measure = { it.length.toFloat() })
        assertTrue(lines.size > 1)
        assertTrue(lines.all { it.length <= 8 })
        assertEquals("NOTA-TANPA-SPASI-1234567890", lines.joinToString(""))
    }

    @Test fun multiPageReceiptReservesGrandTotalForTheFinalPage() {
        assertEquals(listOf(7), receiptPageLineCounts(7))
        assertEquals(listOf(7, 1), receiptPageLineCounts(8))
        assertEquals(listOf(7, 10, 10), receiptPageLineCounts(27))
    }
    @Test fun existingWorkingStatesBothCompleteInOneStep() {
        assertEquals("Masuk Antrian, dan akan dikerjakan", LaundryStatus.Masuk.label)
        assertEquals("Masuk Antrian, dan akan dikerjakan", LaundryStatus.Progress.label)
        assertEquals(LaundryStatus.Selesai, LaundryStatus.Masuk.next)
        assertEquals(LaundryStatus.Selesai, LaundryStatus.Progress.next)
        assertNull(LaundryStatus.Selesai.next)
        val n = Nota("n", "b", "k", "c", "p", "i", 1000, 0, PayStatus.Belum, LaundryStatus.Selesai, "", pickupAt = "", waSent = false)
        assertTrue("Selesai dikerjakan belum berarti lunas", n.hanging)
        n.pay = PayStatus.Lunas
        assertTrue("Lunas belum berarti sudah diserahkan", n.hanging)
        n.pickedUpAt = "11 Sep 2026, 18.00"
        assertFalse(n.hanging)
    }
    @Test fun acceptsSharedMapLinksAndRejectsUntrustedUrls() {
        assertEquals("https://maps.app.goo.gl/abc", MapSelection.parseShared("Cabang\nhttps://maps.app.goo.gl/abc"))
        assertEquals("https://www.google.com/maps?q=-6.9,107.6", MapSelection.parseShared("https://www.google.com/maps?q=-6.9,107.6"))
        assertNotNull(MapSelection.parseShared("https://www.openstreetmap.org/?mlat=-6.9&mlon=107.6"))
        listOf("https://maps.app.goo.gl.attacker.test/a", "https://maps.app.goo.gl@evil.test/a", "intent://bad", "javascript:bad", "http://maps.app.goo.gl/a", "https://google.com/search?q=abc", "https://maps.app.goo.gl:444/a").forEach { assertNull(it, MapSelection.parseShared(it)) }
    }

    @Test fun whatsappReceiptUsesTheNotasBranchAndServiceDates() {
        val n = Nota("CIB-2609-0001", "cib", "Salsa", "Nadia", "0812", "Cuci 3kg", 24000, 0, PayStatus.Belum, LaundryStatus.Masuk, "11 Sep 2026, 08.00", 1, "12 Sep 2026, 17.00", false, lines = listOf(NotaLine("cuci", "Cuci", 3.0, "kg", 8000)))
        val branch = Branch("cib", "CIB", "Cuciin Cibaduyut", "Jl. Cibaduyut", "https://maps.app.goo.gl/cib")
        val text = ReceiptText.format(n, branch)
        assertTrue(text.contains("Cuciin Cibaduyut"))
        assertTrue(text.contains("Waktu Masuk: 11 Sep 2026, 08.00"))
        assertTrue(text.contains("Estimasi Waktu Keluar: 12 Sep 2026, 17.00"))
        assertTrue(text.contains("Status Pengerjaan: Masuk Antrian, dan akan dikerjakan"))
        assertFalse(text.contains("Waktu Pengambilan"))
        assertFalse(text.contains("\nPengerjaan:"))
        assertFalse(text.contains("Selesai dikerjakan"))
        assertTrue(text.contains("1. *Cuci*"))
        assertTrue(text.contains("3 kg × Rp 8.000"))
        assertTrue(text.contains("Subtotal: *Rp 24.000*"))
        assertTrue(text.contains("*GRAND TOTAL: Rp 24.000*"))
    }

    @Test fun analyticsBuildsRealDailyBarsAndOperationalAlerts() {
        val now = Instant.parse("2026-09-11T05:00:00Z").toEpochMilli() // 12.00 WIB
        val eight = Instant.parse("2026-09-11T01:00:00Z").toEpochMilli()
        val n = Nota("MEL-1", "mel", "Rina", "Nadia", "0812", "Cuci", 20000, 10000, PayStatus.Belum, LaundryStatus.Masuk, "", eight, "11 Sep 2026, 10.00", false)
        val points = AnalyticsSeries.build(listOf(n), "hari", now)
        assertEquals(20000, points[2].omzet)
        assertEquals(10000, points[2].collected)
        assertEquals(1, points[2].orders)
        val operations = operationalCounts(listOf(n), now)
        assertEquals(1, operations.overdue)
        assertEquals(1, operations.dueToday)
        assertEquals(1, operations.unpaid)
    }
}
