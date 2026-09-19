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
        "queue.status",
        "queue.handover",
        "service.create",
        "service.correct",
        "service.payment",
        "service.price",
        "customer.write",
        "stock.write",
        "inventory.write",
        "attendance.write",
        "whatsapp.send",
        "expense.write",
        "cash.close",
        "owner.manage",
        "owner.access",
        // Dua fungsi ini diperiksa lewat gerbang rute di RouteAccess.kt, bukan di store.
        "analytics.view",
        "audit.view",
    )

    /** Fungsi yang diperiksa lewat gerbang rute, bukan lewat titik jaga di store. */
    private val diperiksaLewatRute: Set<String> = setOf("analytics.view", "audit.view")

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
        // queue
        "queue.status" to ("boleh" to 1),      // advanceLaundry
        "queue.handover" to ("boleh" to 1),    // markPickedUp
        // service
        // `service.create` diperiksa lewat canCreateService(), yang dipanggil `notaReject` dan UI.
        // `saveNota` sendiri tidak lagi menyalin penolakannya; ia memanggil `notaReject` supaya
        // daftar penolakan hanya punya satu sumber.
        "service.create" to ("canAccess" to 1),
        "service.correct" to ("boleh" to 2),   // updateNotaLines + deleteNota
        "service.payment" to ("boleh" to 1),   // markLunas
        "service.price" to ("canAccess" to 2), // setCartPrice + canChangePrice
        // pelanggan
        "customer.write" to ("boleh" to 2),    // addCustomer + updateCustomer
        // produk & aset
        "stock.write" to ("boleh" to 2),       // editStock + editStocks
        "inventory.write" to ("boleh" to 3),   // addInventory + updateInventory + deleteInventory
        // absensi, WhatsApp, biaya, kas
        "attendance.write" to ("boleh" to 2),  // checkIn + checkOut
        "whatsapp.send" to ("boleh" to 1),     // markWaSent
        "expense.write" to ("boleh" to 2),     // addExpense + deleteExpense
        "cash.close" to ("boleh" to 1),        // closeCash
        // master data & kontrol akses
        "owner.manage" to ("boleh" to 17),     // cabang, user, layanan, produk, jenis aset, template WA
        "owner.access" to ("tolak" to 1),      // assignAccessRole
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

    /** Dua fungsi laporan harus benar-benar dijaga lewat gerbang rute, bukan hanya modulnya. */
    @Test
    fun fungsiLaporanDiperiksaLewatGerbangRute() {
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
