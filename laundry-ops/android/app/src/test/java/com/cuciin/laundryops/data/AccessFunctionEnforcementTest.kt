package com.cuciin.laundryops.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Setiap fungsi di katalog izin harus benar-benar ditegakkan.
 *
 * Layar Kontrol Akses Role menjanjikan "Fungsi tanpa centang berarti tidak diizinkan". Janji itu
 * hanya benar bila setiap fungsi di [AccessCatalog] benar-benar diperiksa di suatu tempat.
 *
 * Keterbatasan yang harus diketahui pembaca test ini: [diperiksa] dan [ditegakkanDiStore] adalah
 * daftar yang ditulis TANGAN di dalam test. Dua test di sini yang benar-benar membaca kode adalah
 * [setiapTitikJagaFungsiMasihAdaDiStore] (menghitung titik jaga di CuciinStore.kt),
 * [tidakAdaFungsiKatalogYangBelumDiperiksa] dan [daftarPemeriksaSesuaiKenyataanKode] (membaca
 * seluruh sumber kode utama), serta [mencabutFungsiMenolakTindakannyaUntukSetiapFungsi]
 * (menguji AccessPolicy). Daftar tangan itu sendiri dikunci oleh test yang membaca kode, supaya
 * klaimnya tidak bisa menyimpang dari kenyataan.
 *
 * Keadaan per 1.10.26 setelah perbaikan, diukur langsung ke kode: SELURUH 17 fungsi diperiksa,
 * 15 di antaranya lewat titik jaga di CuciinStore.kt dan 2 lewat gerbang rute di RouteAccess.kt.
 */
class AccessFunctionEnforcementTest {

    /**
     * Fungsi katalog yang sudah punya pemeriksa di kode utama.
     *
     * Dipisah sebagai daftar eksplisit supaya penambahan fungsi baru tanpa pemeriksa langsung
     * terlihat sebagai kegagalan test, bukan lolos diam-diam.
     */
    private val diperiksa: Set<String> = setOf(
        // antrian
        "queue.view", "queue.status", "queue.handover",
        // service
        "service.create", "service.payment", "service.price",
        "service.correct", "service.delete", "service.correctSent",
        // pelanggan
        "customer.view", "customer.write", "customer.delete",
        // produk & stok
        "stock.view", "stock.write", "stock.product", "stock.productDelete",
        // aset cabang
        "inventory.view", "inventory.write", "inventory.delete", "inventory.type",
        // absensi
        "attendance.self", "attendance.view", "attendance.correct",
        // WhatsApp
        "whatsapp.send", "whatsapp.archive", "whatsapp.template",
        // keuangan
        "expense.write", "expense.delete", "cash.close",
        // laporan
        "analytics.view", "analytics.export", "audit.view",
        // master data
        "branch.manage", "branch.delete",
        "staff.manage", "staff.approve", "staff.delete",
        "serviceCatalog.manage", "serviceCatalog.delete",
        "access.role", "access.assign",
    )

    /**
     * Fungsi yang diperiksa lewat gerbang rute, bukan lewat titik jaga di store.
     *
     * Tiga pertama adalah hak BACA yang pintunya memang rutenya: membuka daftar antrian,
     * daftar pelanggan, dan layar Kontrol Akses Role. Menambahkannya sebagai titik jaga store
     * akan memaksakan pemeriksaan yang tidak punya arti di sana.
     */
    private val diperiksaLewatRute: Set<String> = setOf(
        "analytics.view", "audit.view",
        "queue.view", "customer.view", "access.role",
    )

    /**
     * Titik penjagaan yang harus ada di store, beserta pola dan jumlah minimalnya.
     *
     * Jumlahnya diperiksa, bukan sekadar keberadaan teks, supaya satu titik yang terhapus
     * benar-benar terlihat. Inilah bentuk bug yang pernah terjadi: jalur koreksi dan jalur hapus
     * memakai fungsi yang sama, dan satu di antaranya lolos penjagaan.
     *
     * Dua bentuk penjagaan yang sah: `boleh(...)` untuk pemeriksaan fungsi saja, dan
     * `tolak("fungsi", ...)` untuk pemeriksaan yang menggabungkan [Role] lama dengan fungsi.
     */
    private val titikJaga: Map<String, Pair<String, Int>> = mapOf(
        // antrian
        "queue.status" to ("boleh" to 1),      // advanceLaundry
        "queue.handover" to ("boleh" to 1),    // markPickedUp
        // service
        // `service.create` diperiksa lewat canCreateService(), yang dipanggil `notaReject` dan UI.
        // `saveNota` sendiri tidak lagi menyalin penolakannya; ia memanggil `notaReject` supaya
        // daftar penolakan hanya punya satu sumber.
        "service.create" to ("canAccess" to 1),
        "service.payment" to ("boleh" to 1),   // markLunas
        "service.price" to ("canAccess" to 2), // setCartPrice + canChangePrice
        "service.correct" to ("boleh" to 1),   // updateNotaLines
        "service.delete" to ("boleh" to 1),    // deleteNota
        "service.correctSent" to ("canAccess" to 1), // canCorrectSentNota
        // pelanggan
        "customer.write" to ("boleh" to 2),    // addCustomer + updateCustomer
        "customer.delete" to ("boleh" to 1),   // deleteCustomer
        // produk & stok
        "stock.write" to ("boleh" to 2),       // editStock + editStocks
        "stock.product" to ("boleh" to 2),     // addProduct + updateProduct
        "stock.productDelete" to ("boleh" to 1), // deleteProduct
        // aset cabang
        "inventory.write" to ("boleh" to 2),   // addInventory + updateInventory
        "inventory.delete" to ("boleh" to 1),  // deleteInventory
        "inventory.type" to ("boleh" to 3),    // addAssetType + updateAssetType + deleteAssetType
        // absensi
        "attendance.self" to ("boleh" to 2),   // checkIn + checkOut
        "attendance.view" to ("canAccess" to 1), // visibleAttendance
        "attendance.correct" to ("boleh" to 1), // correctAttendance
        // WhatsApp
        "whatsapp.send" to ("boleh" to 1),     // markWaSent
        "whatsapp.template" to ("boleh" to 1), // saveWhatsAppTemplate
        // keuangan
        "expense.write" to ("boleh" to 1),     // addExpense
        "expense.delete" to ("boleh" to 1),    // deleteExpense
        "cash.close" to ("boleh" to 1),        // closeCash
        // laporan & ekspor
        "analytics.export" to ("canAccess" to 1), // canExportData
        // master data: satu modul per jenis data sejak 1.10.30
        "branch.manage" to ("boleh" to 3),     // addBranch + updateBranch + updateBranchMap
        "branch.delete" to ("boleh" to 1),     // deleteBranch
        "staff.manage" to ("boleh" to 2),      // addStaff + updateStaff
        "staff.approve" to ("boleh" to 1),     // approve
        "staff.delete" to ("boleh" to 1),      // deleteStaff
        "serviceCatalog.manage" to ("boleh" to 2), // addService + updateService
        "serviceCatalog.delete" to ("boleh" to 1), // deleteService
        "access.assign" to ("boleh" to 1),     // assignAccessRole
    )

    @Test
    fun setiapTitikJagaFungsiMasihAdaDiStore() {
        val sumber = java.io.File("src/main/java/com/cuciin/laundryops/data/CuciinStore.kt").readText()
        val kurang = titikJaga.filter { (fungsi, aturan) ->
            val (pemanggil, minimal) = aturan
            val pola = Regex("""$pemanggil\([^)]*"${Regex.escape(fungsi)}"""")
            pola.findAll(sumber).count() < minimal
        }
        assertTrue(
            "Titik penjagaan fungsi ini hilang dari store, sehingga centangnya di Kontrol Akses Role tidak lagi berpengaruh: $kurang",
            kurang.isEmpty(),
        )
    }

    /** Seluruh sumber kode utama digabung, supaya pencarian tidak bergantung pada satu berkas. */
    private fun sumberUtama(): String {
        val akar = java.io.File("src/main/java/com/cuciin/laundryops")
        check(akar.isDirectory) { "Sumber kode utama tidak ditemukan di ${akar.absolutePath}" }
        return akar.walkTopDown()
            .filter { it.isFile && it.extension == "kt" && it.name != "AccessCatalog.kt" }
            .joinToString("\n") { it.readText() }
    }

    /**
     * Fungsi yang benar-benar dipakai sebagai nama fungsi di luar katalog.
     *
     * Dihitung dari kode, bukan dari daftar di test ini. Inilah yang membedakan test yang
     * mengunci keadaan dari test yang hanya mengulang klaim penulisnya.
     */
    private fun fungsiYangDipakaiDiKode(): Set<String> {
        val sumber = sumberUtama()
        return AccessCatalog.allFunctionKeys()
            .filter { sumber.contains("\"$it\"") }
            .toSet()
    }

    /**
     * Tidak boleh ada fungsi katalog yang belum diperiksa sama sekali.
     *
     * Inilah janji layar Kontrol Akses Role: fungsi tanpa centang berarti tidak diizinkan.
     * Bila sebuah fungsi tidak dipakai di kode mana pun, mencabut centangnya tidak mengubah
     * apa pun dan janji itu bohong. Diukur dari sumber kode, bukan dari daftar di test ini.
     */
    @Test
    fun tidakAdaFungsiKatalogYangBelumDiperiksa() {
        val belum = AccessCatalog.allFunctionKeys() - fungsiYangDipakaiDiKode()
        assertTrue(
            "Fungsi ini belum diperiksa di kode mana pun, sehingga centangnya di Kontrol Akses " +
                "Role tidak berpengaruh: $belum",
            belum.isEmpty(),
        )
    }

    /** Fungsi baca yang tidak punya titik jaga store harus benar-benar dijaga gerbang rute. */
    @Test
    fun fungsiBacaDiperiksaLewatGerbangRute() {
        val gerbang = com.cuciin.laundryops.ui.RouteAccess
        val hilang = diperiksaLewatRute.filterNot { it in gerbang.functionsInUse }
        assertTrue("Fungsi ini tidak diperiksa gerbang rute mana pun: $hilang", hilang.isEmpty())
    }

    /**
     * Fungsi yang benar-benar ditegakkan di store pada versi ini.
     *
     * Daftar ini adalah janji yang sudah dipenuhi: mencabut fungsi ini dari role membuat
     * tindakannya ditolak, bukan hanya tombolnya disembunyikan.
     */
    private val ditegakkanDiStore: Set<String> = titikJaga.keys

    @Test
    fun fungsiYangDiklaimDitegakkanBenarBenarDiperiksaDiStore() {
        val sumber = java.io.File("src/main/java/com/cuciin/laundryops/data/CuciinStore.kt").readText()
        val hilang = ditegakkanDiStore.filterNot { sumber.contains("\"$it\"") }
        assertTrue(
            "Fungsi ini diklaim ditegakkan di store tetapi tidak diperiksa di sana: $hilang",
            hilang.isEmpty(),
        )
    }

    /** Daftar tangan di atas harus sama dengan apa yang benar-benar dipakai kode. */
    @Test
    fun daftarPemeriksaSesuaiKenyataanKode() {
        val nyata = fungsiYangDipakaiDiKode()
        assertEquals(
            "Daftar [diperiksa] menyimpang dari kenyataan kode. Fungsi yang tercatat tetapi tidak " +
                "dipakai di kode akan menutupi janji Kontrol Akses Role, dan sebaliknya.",
            diperiksa,
            nyata,
        )
    }

    @Test
    fun daftarPemeriksaTidakMemuatFungsiYangSudahTidakAda() {
        val asing = diperiksa - AccessCatalog.allFunctionKeys()
        assertTrue("Fungsi ini tidak ada lagi di katalog: $asing", asing.isEmpty())
    }

    /**
     * Inti bug: mencabut sebuah fungsi dari role harus benar-benar menolak tindakannya.
     *
     * Diuji untuk SEMUA fungsi yang modulnya tetap dimiliki, karena inilah bentuk nyata
     * pencabutan di layar: modul tetap dicentang, fungsinya yang dihapus.
     */
    @Test
    fun mencabutFungsiMenolakTindakannyaUntukSetiapFungsi() {
        val ditolak = mutableListOf<String>()
        AccessCatalog.allFunctionKeys().forEach { fungsi ->
            val modul = AccessCatalog.moduleOf(fungsi)
                ?: error("Fungsi $fungsi tidak punya modul, sanitasi katalog akan membuangnya")
            val role = AccessRole(
                id = "role-uji",
                name = "Uji",
                builtIn = false,
                modules = setOf(modul),
                functions = emptySet(),
            )
            val staff = Staff("Uji", "uji@contoh.com", Role.Kasir, listOf("b1"), accessRoleId = "role-uji")
            if (AccessPolicy.can(staff, listOf(role), null, modul, fungsi)) {
                ditolak += fungsi
            }
        }
        assertTrue(
            "Fungsi ini masih diizinkan walau centangnya dicabut: $ditolak",
            ditolak.isEmpty(),
        )
    }

    @Test
    fun modulTetapMenentukanAksesMasuk() {
        // Mencabut MODUL harus menutup aksesnya walau fungsinya masih dicentang. Tanpa aturan ini,
        // sanitasi katalog akan membuang fungsi dari modul yang tidak dimiliki.
        val role = AccessRole(
            id = "role-uji",
            name = "Uji",
            builtIn = false,
            modules = emptySet(),
            functions = setOf("service.create"),
        )
        val staff = Staff("Uji", "uji@contoh.com", Role.Kasir, listOf("b1"), accessRoleId = "role-uji")
        assertFalse(AccessPolicy.can(staff, listOf(role), null, "service", "service.create"))
        assertFalse(AccessPolicy.can(staff, listOf(role), null, "service", null))
    }

    @Test
    fun setiapFungsiBerawalanKunciModulnya() {
        // Konvensi ini yang membuat sanitasi katalog aman: fungsi dari modul yang tidak dimiliki
        // bisa dibuang karena awalan kuncinya menunjukkan modul pemiliknya.
        val salah = AccessCatalog.allFunctionKeys().filterNot { AccessCatalog.moduleOf(it) == it.substringBefore('.') }
        assertTrue("Fungsi ini tidak berawalan kunci modulnya: $salah", salah.isEmpty())
    }

    @Test
    fun setiapModulKatalogPunyaMinimalSatuFungsi() {
        val kosong = AccessCatalog.modules.filter { it.functions.isEmpty() }.map { it.key }
        assertTrue("Modul tanpa fungsi tidak dapat diperiksa sama sekali: $kosong", kosong.isEmpty())
    }

    @Test
    fun ownerSelaluLolosSeluruhFungsi() {
        val owner = Staff("Owner", "owner@contoh.com", Role.Owner, listOf("b1"))
        val gagal = AccessCatalog.allFunctionKeys().filterNot { fungsi ->
            AccessPolicy.can(owner, emptyList(), null, AccessCatalog.moduleOf(fungsi)!!, fungsi)
        }
        assertTrue("Owner harus lolos seluruh fungsi: $gagal", gagal.isEmpty())
    }

    /**
     * Penolakan izin tidak boleh mematikan aplikasi.
     *
     * `require(boleh(...))` melempar IllegalArgumentException. Supervisor punya MODUL `service`
     * (jadi menu "Service baru" tampil) tetapi tidak punya fungsi `service.create`, sehingga
     * menekan Simpan mematikan aplikasi. Bentuk penolakan yang benar: kembalikan pesan atau null,
     * atau pakai `check` yang hanya melempar bila ada bug program (bukan karena role pengguna).
     *
     * Pelajaran umum: penolakan izin adalah kejadian NORMAL, bukan kesalahan program. Jangan
     * pakai `require`/`error` untuk keadaan yang bisa dicapai pengguna sah.
     */
    @Test
    fun penolakanIzinTidakMemakaiRequireYangMelempar() {
        val sumber = java.io.File("src/main/java/com/cuciin/laundryops/data/CuciinStore.kt").readText()
        val pelanggar = Regex("""require\(\s*(boleh|canAccess)\(""")
            .findAll(sumber)
            .map { it.value }
            .toList()
        assertTrue(
            "Penolakan izin memakai require() yang melempar sehingga aplikasi mati saat izin dicabut: $pelanggar",
            pelanggar.isEmpty(),
        )
    }

    /**
     * Penolakan izin harus terlihat oleh pengguna, bukan diam-diam.
     *
     * `if (!boleh(...)) return` pada fungsi yang mengembalikan Unit membuat UI tetap menampilkan
     * "tersimpan" padahal store tidak menulis apa pun. Itu laporan palsu: pengguna mengira datanya
     * tersimpan, dan bug tersembunyi karena layar tampak bekerja. Setiap titik jaga harus
     * mengembalikan pesan penolakan (`tolak(...)`) atau `null`, bukan `return` telanjang.
     */
    @Test
    fun penolakanIzinSelaluMembawaPesan() {
        val sumber = java.io.File("src/main/java/com/cuciin/laundryops/data/CuciinStore.kt").readText()
        val diam = Regex("""if \(!\s*(?:boleh|canAccess)\([^)]*\)\)\s*return\s*$""", RegexOption.MULTILINE)
            .findAll(sumber)
            .map { it.value.trim() }
            .toList()
        assertTrue(
            "Penolakan izin ini tidak membawa pesan, sehingga UI bisa melaporkan 'tersimpan' padahal tidak: $diam",
            diam.isEmpty(),
        )
    }

    /**
     * Setiap call site di UI harus memakai pesan penolakan yang dikembalikan store.
     *
     * Menambah pesan di store tidak berguna bila UI mengabaikan hasilnya. Tiga bentuk yang sah:
     * menangkap `String?`-nya (`val tolak = ...`), memakai `?.let`, atau menjaga dengan pemeriksa
     * izin di UI (`canSendWa()`/`canCreateService()`/`canChangePrice()`) supaya jalur penolakan
     * tidak pernah dipanggil.
     */
    @Test
    fun uiMemakaiPesanPenolakanDariStore() {
        val ui = java.io.File("src/main/java/com/cuciin/laundryops/ui")
        val berkas = ui.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
        val lalai = mutableListOf<String>()
        val wajibDicek = listOf(
            "updateBranch(", "updateBranchMap(", "updateCustomer(", "updateService(",
            "updateProduct(", "updateInventory(", "markWaSent(",
        )
        val bentukSah = listOf("val tolak", "?.let", "canSendWa()", "canCreateService()", "canChangePrice()")
        berkas.forEach { f ->
            f.readText().lines().forEachIndexed { i, baris ->
                wajibDicek.forEach { panggil ->
                    if (baris.contains(panggil) && bentukSah.none { baris.contains(it) }) {
                        lalai += "${f.name}:${i + 1} $panggil"
                    }
                }
            }
        }
        assertTrue(
            "Pemanggil ini mengabaikan pesan penolakan izin sehingga UI bisa melaporkan sukses palsu: $lalai",
            lalai.isEmpty(),
        )
    }
}
