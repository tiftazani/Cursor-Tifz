package com.cuciin.laundryops.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Kasir yang ditugaskan ke lebih dari satu cabang harus bisa absen di setiap cabangnya.
 *
 * Kejadian nyata 24 Sep 2026: `aidanurita25@gmail.com` ditugaskan ke dua cabang di D1
 * (`staff_branches`), tetapi di layar Absensi hanya muncul satu cabang — Bunayya — dan absen di
 * cabang kedua selalu ditolak.
 *
 * Penyebabnya dua lapis:
 *
 *  1. `Session` hanya menyimpan SATU cabang, yaitu cabang pertama. Seluruh layar menyaring dengan
 *     `it.id == session.branchId`, jadi cabang kedua tidak pernah tampil.
 *  2. `checkIn` membandingkan cabang pilihan dengan `s.branchId` yang sama, sehingga absen di
 *     cabang kedua ditolak walau server mengizinkannya. `checkOut` lebih buruk lagi: ia menutup
 *     baris pertama hari itu yang belum pulang tanpa melihat cabang.
 *
 * Test ini menguji [AttendanceScope], fungsi murni yang benar-benar dipakai [CuciinStore].
 * Sengaja bukan test yang membaca berkas sumber: yang perlu dikunci adalah perilakunya.
 */
class AttendanceMultiBranchTest {

    private val email = "aidanurita25@gmail.com"
    private val tanggal = "2026-09-24"
    private val bunayya = "bunayya"
    private val kirab = "laupay-kirab"
    private val cabangPenugasan = listOf(bunayya, kirab)

    private fun row(
        id: String,
        branchId: String,
        checkIn: Long,
        checkOut: Long? = null,
        workDate: String = tanggal,
    ) = AttendanceRecord(
        id = id,
        staffEmail = email,
        staffName = "Aida",
        branchId = branchId,
        workDate = workDate,
        checkInAtMs = checkIn,
        checkInAt = "07.00",
        checkOutAtMs = checkOut,
        checkOutAt = checkOut?.let { "17.00" } ?: "",
    )

    // --- cabang penugasan -------------------------------------------------

    @Test
    fun kasirDuaCabangBolehAbsenDiCabangKedua() {
        assertNull(
            "Cabang penugasan kedua harus diterima, bukan hanya yang pertama",
            AttendanceScope.rejection(Role.Kasir, cabangPenugasan, cabangPenugasan, kirab),
        )
    }

    @Test
    fun kasirTetapDitolakDiCabangYangBukanPenugasannya() {
        assertEquals(
            "Cabang di luar penugasan tetap harus ditolak",
            "Cabang absensi tidak sesuai akun",
            AttendanceScope.rejection(Role.Kasir, cabangPenugasan, listOf(bunayya, kirab, "shelly"), "shelly"),
        )
    }

    @Test
    fun ownerBolehDiCabangManaPunYangAdaDiKatalog() {
        assertNull(AttendanceScope.rejection(Role.Owner, emptyList(), listOf(bunayya, kirab, "shelly"), "shelly"))
        assertEquals(
            "Cabang yang tidak ada di katalog tetap ditolak",
            "Cabang tidak ditemukan",
            AttendanceScope.rejection(Role.Owner, emptyList(), listOf(bunayya), "shelly"),
        )
    }

    @Test
    fun akunTanpaCabangTidakBisaAbsen() {
        assertEquals(
            "Tanpa cabang penugasan, absensi harus ditolak dengan pesan yang jelas",
            "Cabang absensi tidak sesuai akun",
            AttendanceScope.rejection(Role.Kasir, emptyList(), listOf(bunayya), bunayya),
        )
    }

    // --- satu catatan per cabang per hari ---------------------------------

    @Test
    fun absenDiDuaCabangMenghasilkanDuaCatatanTerpisah() {
        val rows = listOf(
            row("att-a", bunayya, checkIn = 1_000, checkOut = 2_000),
            row("att-b", kirab, checkIn = 5_000),
        )

        // Inti bug: sebelum perbaikan, pencarian tanpa cabang mengembalikan baris pertama dan
        // cabang kedua dianggap "sudah absen".
        val diBunayya = AttendanceScope.rowFor(rows, email, tanggal, bunayya)
        val diKirab = AttendanceScope.rowFor(rows, email, tanggal, kirab)
        assertEquals("att-a", diBunayya?.id)
        assertEquals("att-b", diKirab?.id)
        assertNotEquals("Dua cabang tidak boleh berbagi satu catatan", diBunayya?.id, diKirab?.id)
    }

    @Test
    fun cabangKeduaBelumDianggapSudahAbsenSebelumDiabsen() {
        val rows = listOf(row("att-a", bunayya, checkIn = 1_000, checkOut = 2_000))

        assertNull(
            "Sudah absen di Bunayya tidak berarti sudah absen di Kirab",
            AttendanceScope.rowFor(rows, email, tanggal, kirab),
        )
    }

    @Test
    fun absenPulangMenutupCatatanCabangYangBenar() {
        val rows = listOf(
            row("att-a", bunayya, checkIn = 1_000),
            row("att-b", kirab, checkIn = 5_000),
        )

        val posisi = AttendanceScope.openRowIndex(rows, email, tanggal, kirab)
        assertEquals("Absen pulang harus menyasar catatan cabang Kirab", 1, posisi)
        assertEquals("att-a", rows[AttendanceScope.openRowIndex(rows, email, tanggal, bunayya)].id)
    }

    @Test
    fun absenPulangDiCabangTanpaAbsenMasukDitolak() {
        val rows = listOf(row("att-a", bunayya, checkIn = 1_000))

        assertEquals(
            "Tanpa absen masuk di cabang itu, tidak ada yang bisa ditutup",
            -1,
            AttendanceScope.openRowIndex(rows, email, tanggal, kirab),
        )
    }

    @Test
    fun catatanYangSudahPulangTidakDitutupDuaKali() {
        val rows = listOf(row("att-a", bunayya, checkIn = 1_000, checkOut = 2_000))

        assertEquals(-1, AttendanceScope.openRowIndex(rows, email, tanggal, bunayya))
    }

    @Test
    fun ringkasanHariIniMemuatSemuaCabangDanTidakMenyentuhHariLain() {
        val rows = listOf(
            row("att-b", kirab, checkIn = 5_000),
            row("att-a", bunayya, checkIn = 1_000),
            row("att-c", bunayya, checkIn = 9_000, workDate = "2026-09-23"),
        )

        val hariIni = AttendanceScope.rowsFor(rows, email, tanggal)
        assertEquals(
            "Kedua cabang hari ini harus tampil, urut jam masuk, tanpa baris hari lain",
            listOf("att-a", "att-b"),
            hariIni.map { it.id },
        )
    }

    @Test
    fun catatanKaryawanLainTidakIkutTerbaca() {
        val rows = listOf(
            row("att-a", bunayya, checkIn = 1_000),
            row("att-b", kirab, checkIn = 5_000).copy(staffEmail = "karyawan.lain@example.com"),
        )

        assertNull(AttendanceScope.rowFor(rows, email, tanggal, kirab))
        assertEquals(listOf("att-a"), AttendanceScope.rowsFor(rows, email, tanggal).map { it.id })
    }

    // --- id baris ---------------------------------------------------------

    @Test
    fun idBarisSamaUntukKaryawanTanggalCabangYangSama() {
        assertEquals(
            "Id harus stabil supaya dua perangkat tidak membuat baris kembar",
            AttendanceScope.idFor(bunayya, tanggal, email),
            AttendanceScope.idFor(bunayya, tanggal, email.uppercase()),
        )
    }

    @Test
    fun idBarisBerbedaAntarCabangDanAntarTanggal() {
        val dasar = AttendanceScope.idFor(bunayya, tanggal, email)
        assertNotEquals(dasar, AttendanceScope.idFor(kirab, tanggal, email))
        assertNotEquals(dasar, AttendanceScope.idFor(bunayya, "2026-09-25", email))
    }

    @Test
    fun idBarisTetapDiBawahBatasSeratusKarakter() {
        val panjang = AttendanceScope.idFor(
            "cabang-dengan-nama-panjang-sekali",
            tanggal,
            "nama.karyawan.yang.panjang.sekali@perusahaan.example.co.id",
        )
        assertTrue(
            "Id '$panjang' panjangnya ${panjang.length}, melebihi batas 100 karakter Worker",
            panjang.length <= 100,
        )
    }
}
