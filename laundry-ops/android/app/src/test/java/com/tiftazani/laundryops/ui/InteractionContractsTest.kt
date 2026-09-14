package com.tiftazani.laundryops.ui

import com.tiftazani.laundryops.data.Clock
import com.tiftazani.laundryops.data.Branch
import com.tiftazani.laundryops.data.LaundryStatus
import com.tiftazani.laundryops.data.Nota
import com.tiftazani.laundryops.data.PayStatus
import com.tiftazani.laundryops.data.ReceiptText
import com.tiftazani.laundryops.data.NotaLine
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDateTime
import java.time.Instant

class InteractionContractsTest {
    @Test fun dateAndTimeRoundTripPreservesUserSelection() {
        val leapDay = LocalDateTime.of(2028, 2, 29, 23, 45)
        assertEquals(leapDay, DisplayDates.parse(DisplayDates.encode(leapDay)))
        assertNull(DisplayDates.parse("besok sore"))
        val midnightJakarta = Instant.parse("2026-09-10T17:05:00Z").toEpochMilli()
        assertEquals(LocalDateTime.of(2026, 9, 11, 0, 5), DisplayDates.fromMillis(midnightJakarta))
        assertTrue(DisplayDates.full(midnightJakarta).startsWith("Jumat, 11 September 2026"))
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
        assertTrue(text.contains("Cuci 3 kg × Rp 8.000 = Rp 24.000"))
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
