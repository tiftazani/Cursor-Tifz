package com.cuciin.laundryops.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Kompatibilitas kunci katalog lama.
 *
 * Versi 1.10.30 memerinci katalog: modul `owner` dipecah menjadi `branch`, `staff`,
 * `serviceCatalog`, dan `access`, sedangkan `attendance.write` dipisah menjadi
 * `attendance.self`, `attendance.view`, dan `attendance.correct`.
 *
 * Role yang sudah tersimpan di server masih memakai kunci LAMA sampai perangkat yang
 * memegangnya tersinkron, dan APK 1.10.29 yang masih dipakai cabang juga menulis kunci lama.
 * Tanpa penerjemahan, pembaruan aplikasi akan mencabut seluruh akses master data milik role
 * yang sudah ada: centangnya masih tersimpan, tetapi tidak ada satu pun pemeriksaan yang
 * mengenali kuncinya.
 */
class AccessCatalogMigrationTest {

    private fun boleh(modules: Set<String>, functions: Set<String>, module: String, function: String?): Boolean {
        val (m, f) = AccessCatalog.migrate(modules, functions)
        return module in m && (function == null || function in f)
    }

    @Test
    fun ownerManageLamaTetapMembukaSeluruhMasterData() {
        // `owner.manage` dulu menaungi cabang, user, layanan, produk, jenis aset, dan template WA.
        val modul = setOf("owner")
        val fungsi = setOf("owner.manage")
        val harusBisa = listOf(
            "branch" to "branch.manage",
            "staff" to "staff.manage",
            "serviceCatalog" to "serviceCatalog.manage",
            "stock" to "stock.product",
            "inventory" to "inventory.type",
            "whatsapp" to "whatsapp.template",
        )
        harusBisa.forEach { (module, function) ->
            assertTrue(
                "Kunci lama owner.manage harus tetap membuka $module/$function",
                boleh(modul, fungsi, module, function),
            )
        }
    }

    @Test
    fun ownerAccessLamaTetapMembukaKontrolAkses() {
        assertTrue(boleh(setOf("owner"), setOf("owner.access"), "access", "access.role"))
        assertTrue(boleh(setOf("owner"), setOf("owner.access"), "access", "access.assign"))
    }

    @Test
    fun attendanceWriteLamaTetapBolehAbsenSendiri() {
        assertTrue(boleh(setOf("attendance"), setOf("attendance.write"), "attendance", "attendance.self"))
    }

    @Test
    fun migrasiTidakMengarangFungsiYangTidakDimilikiRole() {
        // Role dengan modul `owner` TETAPI tanpa `owner.manage` (mis. role kustom yang hanya
        // memegang modulnya) tidak boleh tiba-tiba mendapat hak menambah cabang.
        val (modul, fungsi) = AccessCatalog.migrate(setOf("owner"), setOf("owner.access"))
        assertTrue("access" in modul)
        assertFalse("Fungsi yang tidak dimiliki tidak boleh muncul", "branch.manage" in fungsi)
        assertFalse("Fungsi yang tidak dimiliki tidak boleh muncul", "staff.manage" in fungsi)
    }

    @Test
    fun migrasiTidakMencabutKunciBaruYangSudahBenar() {
        val modul = setOf("stock", "inventory", "customer")
        val fungsi = setOf("stock.write", "inventory.write", "customer.write", "stock.view")
        val (m, f) = AccessCatalog.migrate(modul, fungsi)
        assertEquals(modul, m)
        assertEquals(fungsi, f)
    }

    @Test
    fun hasLegacyKeysMenandaiRoleYangPerluDitulisUlang() {
        assertTrue(AccessCatalog.hasLegacyKeys(setOf("owner"), setOf("owner.manage")))
        assertTrue(AccessCatalog.hasLegacyKeys(setOf("attendance"), setOf("attendance.write")))
        assertFalse(AccessCatalog.hasLegacyKeys(setOf("stock"), setOf("stock.write")))
    }

    @Test
    fun modulLamaOwnerTidakLagiDianggapModulSahSetelahMigrasi() {
        // Sesudah diterjemahkan, `owner` tidak boleh tersisa sebagai modul: layar Kontrol Akses
        // Role menampilkan katalog sekarang, dan modul hantu akan muncul sebagai centang kosong.
        val (modul, _) = AccessCatalog.migrate(setOf("owner"), setOf("owner.manage"))
        assertFalse("Modul owner sudah dipecah dan tidak boleh tersisa", "owner" in modul)
        assertTrue(modul.all { it in AccessCatalog.moduleKeys })
    }

    @Test
    fun cerminKunciLamaDitulisUntukPerangkatYangBelumPindah() {
        // Perangkat ber-APK 1.10.29 hanya mengenal kunci lama, dan sanitasi di sana membuang kunci
        // baru. Tanpa cermin, role yang disimpan Owner tampil sebagai centang KOSONG di cabang
        // yang belum pindah, dan aksesnya hilang.
        val (modul, fungsi) = AccessCatalog.withLegacyMirror(
            setOf("attendance", "branch", "staff"),
            setOf("attendance.self", "branch.manage", "staff.manage"),
        )
        assertTrue("attendance.write harus ikut ditulis", "attendance.write" in fungsi)
        assertFalse(
            "owner.manage hanya boleh ditulis bila SELURUH anggotanya dimiliki",
            "owner.manage" in fungsi,
        )
        assertTrue("modul aslinya tetap ada", "attendance" in modul && "branch" in modul)
    }

    @Test
    fun cerminLengkapMenulisOwnerManageBesertaModulnya() {
        val lengkap = setOf(
            "branch.manage", "staff.manage", "serviceCatalog.manage",
            "stock.product", "inventory.type", "whatsapp.template",
        )
        val (modul, fungsi) = AccessCatalog.withLegacyMirror(setOf("branch", "staff", "stock", "inventory", "whatsapp", "serviceCatalog"), lengkap)
        assertTrue("owner.manage harus ditulis bila seluruh anggotanya dimiliki", "owner.manage" in fungsi)
        assertTrue("modul owner harus ikut agar perangkat lama mengenalinya", "owner" in modul)
    }

    @Test
    fun cerminTidakMenggandakanHakSaatDibacaKembali() {
        // Simpan lalu baca kembali harus menghasilkan hak yang sama, bukan bertambah.
        val asliModul = setOf("attendance", "queue")
        val asliFungsi = setOf("attendance.self", "queue.view", "queue.status")
        val (simpanModul, simpanFungsi) = AccessCatalog.withLegacyMirror(asliModul, asliFungsi)
        val (bacaModul, bacaFungsi) = AccessCatalog.migrate(simpanModul, simpanFungsi)
        assertEquals(asliModul, bacaModul)
        assertEquals(asliFungsi, bacaFungsi)
    }

    @Test
    fun roleKosongTetapKosong() {
        val (modul, fungsi) = AccessCatalog.withLegacyMirror(emptySet(), emptySet())
        assertTrue(modul.isEmpty())
        assertTrue(fungsi.isEmpty())
    }

    @Test
    fun kebijakanBenarBenarMemakaiMigrasiSaatMemeriksaIzin() {
        // Test ini sengaja menembak AccessPolicy, bukan AccessCatalog.migrate: kalau migrasi
        // dilepas dari resolver izin, kunci lama tetap tidak dikenali dan seluruh hak master data
        // role yang sudah tersimpan hilang. Tanpa test ini, pelepasan itu lolos tanpa suara.
        val role = AccessRole(
            id = "role-lama",
            name = "Role Lama",
            builtIn = false,
            modules = setOf("owner", "queue", "attendance"),
            functions = setOf("owner.manage", "owner.access", "attendance.write", "queue.status"),
        )
        val kasir = Staff("Uji", "uji@contoh.com", Role.Kasir, listOf("b1"), accessRoleId = "role-lama")
        val daftar = listOf(role)
        listOf(
            "branch" to "branch.manage",
            "staff" to "staff.manage",
            "serviceCatalog" to "serviceCatalog.manage",
            "stock" to "stock.product",
            "inventory" to "inventory.type",
            "whatsapp" to "whatsapp.template",
            "access" to "access.role",
            "access" to "access.assign",
            "attendance" to "attendance.self",
        ).forEach { (module, function) ->
            assertTrue(
                "AccessPolicy harus menerjemahkan kunci lama: $module/$function",
                AccessPolicy.can(kasir, daftar, null, module, function),
            )
        }
        // Fungsi yang tidak dimiliki role tetap ditolak: migrasi tidak boleh melebarkan hak.
        assertFalse(AccessPolicy.can(kasir, daftar, null, "staff", "staff.delete"))
        assertFalse(AccessPolicy.can(kasir, daftar, null, "branch", "branch.delete"))
    }

    @Test
    fun roleLamaTidakKehilanganHakBacaYangTadinyaDimiliki() {
        // Sebelum 1.10.30 gerbang rute hanya memeriksa MODUL, jadi memegang modul `queue` sudah
        // cukup untuk membuka layar Antrian. Versi ini menuntut fungsi `queue.view`. Tanpa
        // pemberian ulang, role tersimpan kehilangan hak baca: sapuan perangkat menunjukkan Kasir
        // turun dari 11 menu menjadi 3.
        val kasirLama = AccessRole(
            // Role KUSTOM, bukan bawaan: role bawaan sudah memuat fungsi baca di presetnya,
            // sehingga test yang memakai role bawaan lulus walau penerjemahannya dilepas.
            id = "role-lama-kasir",
            name = "Kasir Lama",
            builtIn = false,
            modules = setOf("attendance", "cash", "customer", "expense", "queue", "service", "stock", "whatsapp"),
            functions = setOf(
                "attendance.write", "cash.close", "customer.write", "expense.write",
                "queue.handover", "queue.status", "service.create", "service.payment",
                "stock.write", "whatsapp.send",
            ),
        )
        // Dipanggil lewat JALUR PEMAKAIANNYA, bukan lewat AccessCatalog.upgrade langsung: kalau
        // `ensureAccessRoles` berhenti memakai upgrade, test yang hanya menembak helper-nya akan
        // tetap hijau padahal perangkat kehilangan hak bacanya.
        CuciinStore.accessRoles.clear()
        CuciinStore.accessRoles.add(kasirLama)
        CuciinStore.ensureAccessRoles()
        val ids = CuciinStore.accessRoles.map { it.id }
        val sesudah = CuciinStore.accessRoles.firstOrNull { it.id == "role-lama-kasir" }
            ?: error("role hilang; isi accessRoles = $ids")
        listOf("queue.view", "customer.view", "stock.view", "whatsapp.archive").forEach { fungsi ->
            assertTrue("Hak baca $fungsi hilang sesudah naik versi katalog", fungsi in sesudah.functions)
        }
        assertTrue("Absen sendiri harus ikut diterjemahkan", "attendance.self" in sesudah.functions)
        // Bukan pelebaran: hak baca absensi karyawan lain TIDAK boleh muncul dengan sendirinya.
        assertFalse(
            "attendance.view TIDAK boleh diberikan otomatis: dulu modul attendance hanya membuka absensi sendiri",
            "attendance.view" in sesudah.functions,
        )
        assertFalse("Hak mengoreksi absensi orang lain tidak boleh muncul", "attendance.correct" in sesudah.functions)
    }

    @Test
    fun upgradeHanyaBerjalanSekaliPerVersi() {
        // Role yang sudah disimpan Owner pada versi katalog ini dikembalikan APA ADANYA, supaya
        // centang yang sengaja dicabut tidak hidup kembali setiap aplikasi dibuka.
        val dicabut = AccessRole(
            id = "role-kasir",
            name = "Kasir",
            builtIn = true,
            modules = setOf("queue"),
            functions = setOf("queue.view"),
            catalogVersion = AccessCatalog.VERSION,
        )
        assertEquals(dicabut, AccessCatalog.upgrade(dicabut))
    }

    @Test
    fun jalurSimpanRoleMenulisCerminKunciLamaUntukPerangkat1_10_29() {
        // Perangkat cabang yang masih memakai APK 1.10.29 hanya mengenal kunci LAMA, dan
        // `sanitize` di sana membuang kunci baru. Kalau role yang disimpan versi ini hanya berisi
        // kunci baru, role itu tampil dengan centang KOSONG di perangkat lama, lalu Owner di sana
        // menyimpannya kembali dan hak seluruh cabang hilang.
        //
        // Diperiksa sebagai BLOK KODE, bukan dengan memanggil saveAccessRole: fungsi itu menyentuh
        // Handler Android lewat bump()/CloudSync, jadi tidak dapat dijalankan di test JVM.
        val sumber = java.io.File("src/main/java/com/cuciin/laundryops/data/CuciinStore.kt").readText()
        val blok = sumber.substringAfter("fun saveAccessRole").substringBefore("fun createAccessRole")
        assertTrue(
            "saveAccessRole harus menulis cermin kunci lama supaya perangkat 1.10.29 tidak melihat centang kosong",
            blok.contains("withLegacyMirror"),
        )
        assertTrue(
            "Cermin harus ditulis SESUDAH sanitize, bukan sebelum: sanitize membuang kunci lama",
            blok.indexOf("sanitize") < blok.indexOf("withLegacyMirror"),
        )
    }

    @Test
    fun cerminKunciLamaTidakMelebarkanHakDanTidakMenghidupkanModul() {
        // Cermin hanya ditulis kalau SELURUH isi kelompok lama dimiliki role. Role yang hanya
        // memegang sebagian (mis. cuma kelola cabang) tidak mendapat cermin `owner.manage`, karena
        // perangkat lama tidak bisa menyatakan "hanya cabang" dan cermin itu akan memberinya hak
        // ke user, layanan, produk, dan template WA sekaligus.
        val sebagian = AccessCatalog.withLegacyMirror(setOf("branch"), setOf("branch.manage"))
        assertFalse("Cermin owner.manage TIDAK boleh muncul untuk role sebagian", "owner.manage" in sebagian.second)
        assertFalse("Modul cermin owner tidak boleh ikut ditulis", "owner" in sebagian.first)

        val penuh = AccessCatalog.withLegacyMirror(
            setOf("branch", "staff", "serviceCatalog", "stock", "inventory", "whatsapp"),
            setOf(
                "branch.manage", "staff.manage", "serviceCatalog.manage",
                "stock.product", "inventory.type", "whatsapp.template",
            ),
        )
        assertTrue("Role dengan seluruh isi kelompok lama mendapat cermin", "owner.manage" in penuh.second)

        // Dibaca ulang di versi ini, cermin tidak boleh menghidupkan modul yang tidak dipilih.
        val (modulBaca, _) = AccessCatalog.migrate(penuh.first, penuh.second)
        assertEquals(penuh.first - "owner", modulBaca)
    }
}
