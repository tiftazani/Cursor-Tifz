package com.cuciin.laundryops.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlinx.serialization.json.JsonNull

/**
 * Sisa dari perangkat versi 1.10.37 ke bawah: baris absensi lama memakai id acak
 * (`att-<uuid>`), bukan id deterministik per (karyawan, tanggal, cabang).
 *
 * Bahayanya bukan pada pembacaan — layar mencari baris lewat kolom (email, tanggal, cabang),
 * jadi id acak tetap terbaca. Bahayanya pada penggabungan snapshot: bila server mengirim
 * perubahan untuk id deterministik, penerapan di perangkat hanya membuang baris dengan id yang
 * sama dan baris lama berid acak tetap tinggal. Bila keduanya ada, layar bisa melihat dua baris
 * untuk cabang dan tanggal yang sama.
 *
 * Tes ini mengunci perilaku yang diharapkan: penggabungan snapshot tidak menghapus baris yang
 * tidak disebut, sehingga absensi cabang lain tidak pernah ikut terbuang saat satu cabang
 * diperbarui.
 */
class AttendanceSnapshotMergeTest {

    private fun attendance(id: String, branch: String, email: String = "aida@contoh.id", date: String = "2026-09-24") =
        AttendanceRecord(
            id = id,
            staffEmail = email,
            staffName = "Aida",
            branchId = branch,
            workDate = date,
            checkInAtMs = 1_700_000_000_000,
            checkInAt = "2026-09-24T08:00:00+07:00",
        )

    @Test
    fun perubahanSatuCabangTidakMenghapusAbsensiCabangLain() {
        val snapshot = Snapshot(
            branches = emptyList(),
            staff = emptyList(),
            attendance = listOf(
                attendance("att-kirab", "laupay-kirab"),
                attendance("att-bunayya", "bunayya"),
            ),
        )

        val perubahan = listOf(
            SyncChange(
                entityType = "attendance",
                entityId = "att-kirab",
                operation = "upsert",
                payload = LocalJson.json.encodeToJsonElement(
                    AttendanceRecord.serializer(),
                    attendance("att-kirab", "laupay-kirab").copy(checkOutAtMs = 1_700_000_999_000),
                ),
            ),
        )

        val hasil = SyncProjection.apply(snapshot, perubahan, updatedAt = 42L)

        assertEquals("absensi cabang lain tidak boleh ikut terbuang", 2, hasil.attendance.size)
        assertTrue(
            "baris cabang bunayya harus tetap ada setelah cabang kirab diperbarui",
            hasil.attendance.any { it.id == "att-bunayya" },
        )
        assertEquals(
            "baris yang disebut perubahan harus memakai data baru",
            1_700_000_999_000,
            hasil.attendance.first { it.id == "att-kirab" }.checkOutAtMs,
        )
    }

    @Test
    fun idAcakLamaDanIdDeterministikBaruTidakSalingMenimpa() {
        // Perangkat baru memakai id deterministik; baris lama dari perangkat 1.10.37 memakai id acak.
        // Keduanya bisa berdampingan sampai baris lama dihapus. Yang penting: perubahan pada satu id
        // tidak menyentuh id lainnya.
        val snapshot = Snapshot(
            branches = emptyList(),
            staff = emptyList(),
            attendance = listOf(
                attendance("att-9f2c1a44-aaaa-bbbb-cccc-000000000001", "laupay-kirab"),
                attendance("att-2026-09-24-aida-contoh-id-laupay-kirab", "laupay-kirab"),
            ),
        )

        val perubahan = listOf(
            SyncChange(
                entityType = "attendance",
                entityId = "att-2026-09-24-aida-contoh-id-laupay-kirab",
                operation = "delete",
                payload = JsonNull,
            ),
        )

        val hasil = SyncProjection.apply(snapshot, perubahan, updatedAt = 43L)

        assertEquals("hanya baris lama yang tersisa", 1, hasil.attendance.size)
        assertEquals(
            "penghapusan id deterministik tidak boleh ikut menghapus baris lama berid acak",
            "att-9f2c1a44-aaaa-bbbb-cccc-000000000001",
            hasil.attendance.single().id,
        )
    }
}
