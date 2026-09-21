package com.cuciin.laundryops.data

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Bootstrap tidak boleh mengangkat hak istimewa dari perangkat ke server.
 *
 * Kejadian nyata yang memicu berkas ini: akun `aidanurita25@gmail.com` berperan **Kasir** di
 * server, tetapi di satu perangkat pernah dinaikkan menjadi **Supervisor** untuk pengujian.
 * Perangkat itu lalu memuat ulang data dan `reconcileBootstrap` melihat entitas `staff` yang
 * berbeda dari server, sehingga perangkat itu mengirim UPSERT dan **menimpanya ke server**.
 * Server tetap Kasir karena perintah itu ditolak, tetapi selama perangkat belum menerima
 * penolakan, ia memakai Supervisor: menu supervisor terbuka dan absennya lolos gerbang.
 *
 * Aturan yang benar: pada bootstrap, perbedaan entitas **hak akses** (`staff`, `accessRole`,
 * `accessPolicy`) tidak boleh diangkat dari perangkat ke server. Server adalah pemilik data itu.
 * Entitas milik perangkat (Service, pelanggan, absensi, stok) tetap boleh direkonsiliasi, karena
 * itu justru tujuan bootstrap: pekerjaan yang belum terkirim harus naik.
 */
class BootstrapPrivilegeTest {

    private fun staff(email: String, role: Role) =
        Staff(email.substringBefore('@'), email, role, listOf("bunayya"))

    private fun snapshotWith(staffList: List<Staff>) = Snapshot(
        branches = listOf(Branch("bunayya", "BNY", "Bunayya", "Alamat uji", "")),
        staff = staffList,
    )

    @Test fun roleYangLebihTinggiDiPerangkatTidakDiangkatKeServer() {
        val server = snapshotWith(listOf(staff("aida@contoh.test", Role.Kasir)))
        val perangkat = snapshotWith(listOf(staff("aida@contoh.test", Role.Supervisor)))

        val hasil = SyncProjection.bootstrapSnapshot(server, perangkat, preserveLocal = true, updatedAt = 100)

        assertEquals(
            "Role dari perangkat tidak boleh menang atas role server",
            Role.Kasir,
            hasil.staff.single().role,
        )
    }

    @Test fun namaDanCabangServerJugaMenangUntukEntitasHakAkses() {
        val server = snapshotWith(listOf(staff("aida@contoh.test", Role.Kasir)))
        val perangkat = snapshotWith(
            listOf(Staff("Nama Diubah Di Hp", "aida@contoh.test", Role.Kasir, listOf("laupay-kirab"))),
        )

        val hasil = SyncProjection.bootstrapSnapshot(server, perangkat, preserveLocal = true, updatedAt = 100)

        assertEquals("aida", hasil.staff.single().name)
        assertEquals(listOf("bunayya"), hasil.staff.single().branchIds)
    }

    @Test fun pekerjaanPerangkatTetapNaikSaatBootstrap() {
        val server = snapshotWith(listOf(staff("aida@contoh.test", Role.Kasir)))
        val perangkatKerja = server.copy(
            customers = listOf(
                Customer("c-1", "Pelanggan Uji", "Alamat uji", "08123"),
            ),
        )

        val hasil = SyncProjection.bootstrapSnapshot(server, perangkatKerja, preserveLocal = true, updatedAt = 100)

        assertEquals(
            "Pelanggan yang hanya ada di perangkat harus tetap naik ke snapshot hasil",
            1,
            hasil.customers.count { it.id == "c-1" },
        )
    }

    @Test fun akunUjiYangSudahTidakAdaDiServerDibuangDariPerangkat() {
        val server = snapshotWith(listOf(staff("aida@contoh.test", Role.Kasir)))
        val perangkat = snapshotWith(
            listOf(
                staff("aida@contoh.test", Role.Kasir),
                staff("gudang-uji@contoh.test", Role.Supervisor),
            ),
        )

        val hasil = SyncProjection.bootstrapSnapshot(server, perangkat, preserveLocal = true, updatedAt = 100)

        assertEquals(
            "Akun yang tidak ada di server tidak boleh bertahan di perangkat",
            listOf("aida@contoh.test"),
            hasil.staff.map { it.email },
        )
    }

    @Test fun roleUjiYangSudahTidakAdaDiServerDibuangDariPerangkat() {
        val server = snapshotWith(listOf(staff("aida@contoh.test", Role.Kasir))).copy(
            accessRoles = listOf(AccessRole(id = "role-kasir", name = "Kasir", modules = setOf("queue"))),
        )
        val perangkat = server.copy(
            accessRoles = listOf(
                AccessRole(id = "role-kasir", name = "Kasir", modules = setOf("queue")),
                AccessRole(id = "role-uji", name = "Gudang", modules = setOf("stock")),
            ),
        )

        val hasil = SyncProjection.bootstrapSnapshot(server, perangkat, preserveLocal = true, updatedAt = 100)

        assertEquals(
            "Role yang tidak ada di server tidak boleh bertahan di perangkat",
            listOf("role-kasir"),
            hasil.accessRoles.map { it.id },
        )
    }

    @Test fun kursorPerangkatDiDepanServerHarusTurun() {
        val outbox = SyncOutbox(SyncClientState(revision = 1018, bootstrapped = true))

        outbox.acceptRemote(emptyList(), revision = 409)

        assertEquals(
            "Kursor harus mengikuti server; kalau tertinggal di depan, jurnal server tidak pernah dibaca",
            409L,
            outbox.state.revision,
        )
    }

    @Test fun penyelarasanHakAksesMembuangPeranLamaDariPerangkat() {
        val server = snapshotWith(listOf(staff("aida@contoh.test", Role.Kasir)))
        val hasilTarikan = snapshotWith(
            listOf(
                staff("aida@contoh.test", Role.Supervisor),
                staff("gudang-uji@contoh.test", Role.Supervisor),
            ),
        )

        val hasil = SyncProjection.samakanHakAkses(hasilTarikan, server)

        assertEquals(listOf("aida@contoh.test"), hasil.staff.map { it.email })
        assertEquals(Role.Kasir, hasil.staff.single().role)
    }
}
