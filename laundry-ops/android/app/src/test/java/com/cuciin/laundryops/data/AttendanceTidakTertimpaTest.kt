package com.cuciin.laundryops.data

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Aturan pemilik: absen pagi dan sore adalah SATU catatan harian. Data masuk ke data sekarang
 * dan historis. Tidak boleh ada yang menimpa.
 *
 * Dua perangkat bisa memegang baris absensi yang sama (id deterministik per karyawan+tanggal+
 * cabang). Bila salah satu perangkat sudah mencatat jam pulang dan perangkat lain belum, maka
 * penggabungan TIDAK BOLEH mengosongkan jam pulang yang sudah ada.
 */
class AttendanceTidakTertimpaTest {

    private val email = "uji@contoh.id"
    private val tanggal = "2026-09-29"
    private val cabang = "bunayya"

    private fun row(masuk: Long, pulang: Long?) = AttendanceRecord(
        id = AttendanceScope.idFor(cabang, tanggal, email),
        staffEmail = email,
        staffName = "Uji",
        branchId = cabang,
        workDate = tanggal,
        checkInAtMs = masuk,
        checkInAt = "07.00",
        checkOutAtMs = pulang,
        checkOutAt = pulang?.let { "17.00" } ?: "",
    )

    @Test
    fun bootstrapTidakMengosongkanJamPulangYangSudahTercatat() {
        val remote = Snapshot(branches = emptyList(), staff = emptyList(), attendance = listOf(row(1_000, 2_000)))
        val lokal = Snapshot(branches = emptyList(), staff = emptyList(), attendance = listOf(row(1_000, null)))

        val hasil = SyncProjection.bootstrapSnapshot(remote, lokal, preserveLocal = true, updatedAt = 5L)

        assertEquals(
            "jam pulang yang sudah tercatat di server tidak boleh dikosongkan oleh perangkat yang belum punya",
            2_000L,
            hasil.attendance.single().checkOutAtMs,
        )
    }

    @Test
    fun pullChangesTidakMengosongkanJamPulangYangSudahTercatat() {
        val snapshot = Snapshot(branches = emptyList(), staff = emptyList(), attendance = listOf(row(1_000, 2_000)))
        val perubahan = listOf(
            SyncChange(
                entityType = "attendance",
                entityId = AttendanceScope.idFor(cabang, tanggal, email),
                operation = "upsert",
                payload = LocalJson.json.encodeToJsonElement(AttendanceRecord.serializer(), row(1_000, null)),
            ),
        )

        val hasil = SyncProjection.apply(snapshot, perubahan, updatedAt = 6L)

        assertEquals(
            "perubahan masuk tanpa jam pulang tidak boleh mengosongkan jam pulang yang sudah ada",
            2_000L,
            hasil.attendance.single().checkOutAtMs,
        )
    }

    @Test
    fun kirimanIdBerbedaUntukCatatanYangSamaTetapSatuBarisDanTidakKehilanganJamPulang() {
        // Perangkat 1.10.37 ke bawah memakai id acak; perangkat 1.10.38 memakai id deterministik.
        // Keduanya catatan yang sama: (karyawan, tanggal, cabang). Kiriman dari perangkat lama
        // tidak boleh menyisakan baris kembar, dan tidak boleh mengosongkan jam pulang.
        val snapshot = Snapshot(
            branches = emptyList(),
            staff = emptyList(),
            attendance = listOf(row(1_000, 2_000)),
        )
        val perubahan = listOf(
            SyncChange(
                entityType = "attendance",
                entityId = "att-acak-dari-perangkat-lama",
                operation = "upsert",
                payload = LocalJson.json.encodeToJsonElement(
                    AttendanceRecord.serializer(),
                    row(1_000, null).copy(id = "att-acak-dari-perangkat-lama"),
                ),
            ),
        )

        val hasil = SyncProjection.apply(snapshot, perubahan, updatedAt = 7L)

        assertEquals("satu karyawan, satu tanggal, satu cabang tetap satu baris", 1, hasil.attendance.size)
        assertEquals(
            "jam pulang yang sudah tercatat tidak boleh hilang karena id barisnya berbeda",
            2_000L,
            hasil.attendance.single().checkOutAtMs,
        )
    }

    @Test
    fun jamMasukYangSudahTercatatTidakDigantiKirimanBerikutnya() {
        // "Tidak boleh ada yang menimpa" juga berlaku untuk jam masuk: jam masuk pertama yang
        // tercatat dipertahankan walau kiriman berikutnya membawa angka berbeda.
        val snapshot = Snapshot(branches = emptyList(), staff = emptyList(), attendance = listOf(row(1_000, null)))
        val perubahan = listOf(
            SyncChange(
                entityType = "attendance",
                entityId = AttendanceScope.idFor(cabang, tanggal, email),
                operation = "upsert",
                payload = LocalJson.json.encodeToJsonElement(AttendanceRecord.serializer(), row(9_999, null)),
            ),
        )

        val hasil = SyncProjection.apply(snapshot, perubahan, updatedAt = 8L)

        assertEquals(
            "jam masuk pertama harus dipertahankan, bukan diganti kiriman berikutnya",
            1_000L,
            hasil.attendance.single().checkInAtMs,
        )
    }
}
