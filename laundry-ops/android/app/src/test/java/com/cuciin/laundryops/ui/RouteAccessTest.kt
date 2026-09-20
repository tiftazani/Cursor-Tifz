package com.cuciin.laundryops.ui

import com.cuciin.laundryops.data.AccessCatalog
import com.cuciin.laundryops.data.AccessPolicy
import com.cuciin.laundryops.data.Role
import com.cuciin.laundryops.data.Staff
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Setiap modul di katalog izin harus benar-benar diperiksa di suatu tempat.
 *
 * Katalog `AccessCatalog` menyatakan dirinya sebagai satu sumber untuk layar Kontrol Akses Role
 * dan untuk pemeriksaan izin. Pernah terjadi dua modul, `analytics` dan `audit`, terdaftar di
 * katalog dan bisa dicentang di layar, tetapi tidak pernah diperiksa saat menu dibuka. Akibatnya:
 *
 * 1. Mencentang modul itu tidak mengubah apa pun, dan mengosongkannya juga tidak.
 * 2. Role bawaan Supervisor sudah memuat modul `analytics` beserta fungsi `analytics.view`,
 *    tetapi menu Laporan transaksi dan Laporan analitik tetap terkunci untuknya karena menu
 *    memeriksa modul `owner`. Izin yang diberikan katalog tidak pernah berlaku.
 *
 * Test ini membandingkan modul di katalog dengan modul yang dipakai rute menu, supaya
 * ketidakcocokan itu ketahuan sebelum sampai ke pengguna.
 */
class RouteAccessTest {

    private val appDir: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    private fun baca(relatif: String): String = File(appDir, relatif).readText()

    private val katalog: Set<String> = AccessCatalog.moduleKeys

    @Test
    fun setiapModulKatalogDiperiksaDiSuatuTempat() {
        // Semua modul katalog harus diperiksa lewat gerbang rute; `stock` diperiksa di dua
        // tempat sekaligus (tab Stok dan menu Produk stok), jadi himpunannya tetap satu.
        val diperiksa = RouteAccess.modulesInUse

        val mati = katalog - diperiksa
        assertTrue(
            "Modul ini ada di katalog izin tetapi tidak pernah diperiksa, sehingga mencentangnya " +
                "di Kontrol Akses Role tidak berpengaruh apa pun:\n" +
                mati.sorted().joinToString("\n") { "  $it" },
            mati.isEmpty(),
        )
    }

    @Test
    fun ruteLaporanMemakaiModulLaporanBukanModulOwner() {
        // Inti bug yang dikunci: dua menu laporan memakai modul `analytics`, bukan `owner`.
        assertEquals("analytics", RouteAccess.moduleOf("analytics"))
        assertEquals("analytics", RouteAccess.moduleOf("analyticsReport"))
        assertEquals("audit", RouteAccess.moduleOf("audit"))
    }

    @Test
    fun supervisorBolehMembukaLaporanSesuaiRoleBawaannya() {
        // Role bawaan Supervisor memuat modul analytics dan fungsi analytics.view. Menu laporan
        // harus mengikuti itu, bukan modul owner yang tidak dimilikinya.
        val supervisor = AccessCatalog.builtInRoles().first { it.id == "role-supervisor" }
        assertTrue("Supervisor memuat modul analytics", "analytics" in supervisor.modules)
        assertTrue("Supervisor memuat fungsi analytics.view", "analytics.view" in supervisor.functions)

        val modulLaporan = listOf("analytics", "analyticsReport").mapNotNull { RouteAccess.moduleOf(it) }
        assertTrue(
            "Supervisor harus lolos untuk menu laporan",
            modulLaporan.all { it in supervisor.modules },
        )
    }

    @Test
    fun ruteMasterDataMemakaiModulSendiri() {
        // Sejak 1.10.30 modul `owner` dipecah, supaya "boleh mengubah produk" tidak lagi menuntut
        // "boleh menghapus cabang". Setiap menu master data punya modulnya sendiri.
        assertEquals("branch", RouteAccess.moduleOf("branches"))
        assertEquals("staff", RouteAccess.moduleOf("users"))
        assertEquals("serviceCatalog", RouteAccess.moduleOf("services"))
        assertEquals("stock", RouteAccess.moduleOf("products"))
        assertEquals("access", RouteAccess.moduleOf("accessRoles"))
        assertEquals("whatsapp", RouteAccess.moduleOf("ownerSettings"))
    }

    @Test
    fun ruteTanpaModulSelaluBoleh() {
        // Akun, tema, dan riwayat versi tidak butuh izin modul.
        listOf("profil", "theme", "versions", "menuOrder").forEach { route ->
            assertEquals("Rute $route tidak punya modul", null, RouteAccess.moduleOf(route))
        }
    }

    @Test
    fun setiapModulYangDipakaiRuteAdaDiKatalog() {
        val asing = RouteAccess.modulesInUse - katalog
        assertTrue(
            "Rute memakai modul yang tidak ada di katalog, sehingga izinnya tidak dapat diatur:\n" +
                asing.sorted().joinToString("\n") { "  $it" },
            asing.isEmpty(),
        )
    }

    @Test
    fun setiapRuteMenuPunyaKeputusanIzin() {
        // Setiap menu di katalog layar Modul harus punya modul, kecuali yang memang selalu boleh.
        val selaluBoleh = setOf("profil", "theme", "versions")
        val tanpaKeputusan = MenuOrder.allRoutes.filter { route ->
            RouteAccess.moduleOf(route) == null && route !in selaluBoleh
        }
        assertTrue(
            "Menu ini tidak punya modul izin dan tidak terdaftar sebagai selalu boleh:\n" +
                tanpaKeputusan.joinToString("\n") { "  $it" },
            tanpaKeputusan.isEmpty(),
        )
    }

    @Test
    fun layarMemakaiRouteAccessBukanDaftarSendiri() {
        // Layar harus membaca pemetaan ini, bukan menyimpan daftar izinnya sendiri.
        val kode = baca("src/main/java/com/cuciin/laundryops/ui/MoreScreens.kt")
        assertTrue(
            "MoreScreens harus memakai RouteAccess.gateOf",
            kode.contains("RouteAccess.gateOf"),
        )
        assertNotNull(RouteAccess.gateOf("analytics"))
    }

    @Test
    fun tidakAdaModulGandaDiPemetaan() {
        // Satu modul boleh dipakai beberapa rute (analytics untuk dua menu laporan,
        // whatsapp untuk dua menu WA), tetapi pemetaannya harus lengkap dan konsisten.
        val semuaRute = MenuOrder.allRoutes
        val tanpaModul = semuaRute.filter { RouteAccess.moduleOf(it) == null }
        assertFalse(
            "Tidak boleh ada rute menu yang tidak dikenal pemetaan",
            tanpaModul.any { it !in setOf("profil", "theme", "versions") },
        )
    }

    /**
     * Gerbang rute tidak boleh lebih longgar dari penjaga yang dipanggil saat menyimpan.
     *
     * Bug yang dikunci: rute "Service baru" hanya memeriksa modul `service`, sedangkan
     * `saveNota` memeriksa fungsi `service.create`. Role kustom dengan modul `service` tanpa
     * fungsi `service.create` melihat menunya, mengisi formulirnya, lalu aplikasi MATI saat
     * menekan Simpan karena `saveNota` memakai `require`.
     *
     * Aturan yang diuji: setiap fungsi yang diperiksa store pada alur utama sebuah rute harus
     * juga diperiksa gerbang rute itu.
     */
    @Test
    fun gerbangRuteTidakLebihLonggarDariPenjagaStore() {
        // Fungsi yang diperiksa saat menyimpan pada alur utama rute.
        val penjagaAlurUtama = mapOf(
            "service" to "service.create",      // saveNota
            "branches" to "branch.manage",       // addBranch + updateBranch
            "users" to "staff.manage",           // addStaff + updateStaff
            "services" to "serviceCatalog.manage", // addService + updateService
            "products" to "stock.product",       // addProduct + updateProduct
            "ownerSettings" to "whatsapp.template", // saveWhatsAppTemplate
            "accessRoles" to "access.role",      // saveAccessRole
            "cash" to "cash.close",              // closeCash
        )
        val longgar = penjagaAlurUtama.filter { (rute, fungsi) ->
            RouteAccess.gateOf(rute)?.function != fungsi
        }
        assertTrue(
            "Gerbang rute ini lebih longgar dari penjaga saat menyimpan, sehingga pengguna bisa " +
                "membuka layarnya lalu gagal atau aplikasi mati saat menekan Simpan:\n" +
                longgar.entries.joinToString("\n") { "  ${it.key} harus memeriksa ${it.value}" },
            longgar.isEmpty(),
        )
    }

    /**
     * Supervisor bawaan tidak boleh lolos gerbang "Service baru".
     *
     * Role bawaan Supervisor memuat MODUL `service` tetapi TIDAK memuat fungsi `service.create`.
     * Kalau gerbangnya hanya memeriksa modul, Supervisor akan melihat menu yang membuatnya
     * menabrak penjaga saat menyimpan. Menu itu memang sudah disembunyikan lewat
     * `hiddenForSupervisor`, tetapi aturan izin tidak boleh bergantung pada pengecualian nama
     * peran: role kustom dengan bentuk izin yang sama akan tetap terkena.
     */
    @Test
    fun supervisorBawaanTidakLolosGerbangServiceBaru() {
        val supervisor = AccessCatalog.builtInRoles().first { it.id == "role-supervisor" }
        assertTrue("Supervisor memuat modul service", "service" in supervisor.modules)
        assertFalse("Supervisor tidak memuat fungsi service.create", "service.create" in supervisor.functions)

        val gerbang = RouteAccess.gateOf("service")
        assertNotNull("Rute service harus punya gerbang", gerbang)
        val lolos = AccessPolicy.can(
            staff = Staff("Uji", "uji@contoh.com", Role.Supervisor, listOf("b1"), accessRoleId = "role-supervisor"),
            roles = listOf(supervisor),
            policy = null,
            module = gerbang!!.module,
            function = gerbang.function,
        )
        assertFalse("Supervisor tidak boleh lolos gerbang Service baru", lolos)
    }

    @Test
    fun ownerTetapLolosSeluruhGerbangRute() {
        // Perbaikan ini tidak boleh mengunci Owner dari menunya sendiri.
        val owner = Staff("Owner", "owner@contoh.com", Role.Owner, listOf("b1"))
        val terkunci = MenuOrder.allRoutes.filter { rute ->
            val g = RouteAccess.gateOf(rute) ?: return@filter false
            !AccessPolicy.can(owner, emptyList(), null, g.module, g.function)
        }
        assertTrue(
            "Owner terkunci dari menu ini oleh gerbang rutenya sendiri:\n" +
                terkunci.joinToString("\n") { "  $it" },
            terkunci.isEmpty(),
        )
    }

    /**
     * Tombol yang membuka alur TULIS tidak boleh dikunci dengan NAMA PERAN.
     *
     * Bug yang dikunci: tombol "Service baru" di beranda diperiksa dengan
     * `s.role != Role.Supervisor`, bukan dengan fungsi. Pengecualian nama peran hanya mengenal
     * peran bawaan: role kustom yang memuat modul `service` tanpa fungsi `service.create`
     * (mis. "Kasir" yang dicabut `service.create`) tetap melihat tombolnya, mengisi formulirnya,
     * lalu aplikasi MATI saat menekan Simpan. Aturan izin harus membaca fungsi, bukan nama peran.
     *
     * Pengecualian nama peran tetap sah untuk aturan TAMPIL (bar navigasi dan menu Modul),
     * karena itu memang kebijakan peran, bukan penegakan izin. Yang dilarang adalah memakai nama
     * peran sebagai pengganti pemeriksaan fungsi pada pintu yang MENULIS data.
     */
    @Test
    fun tombolAlurTulisTidakDikunciNamaPeran() {
        // Berkas layar yang memuat alur tulis dan tombolnya.
        val berkas = listOf("OpsScreens.kt", "AssetScreens.kt", "MasterScreens.kt", "MoreScreens.kt")
        // Pintu yang membuka alur TULIS.
        val pintu = listOf(
            "navigate(\"nota\")", "navigate(\"stokEdit\")", "navigate(\"assetNew\")",
            "navigate(\"assetTypes\")", "navigate(\"bayar\")", "navigate(\"assetEdit/",
            "navigate(\"accessRole/", "navigate(\"queueEdit/", "navigate(\"products\")",
        )
        // Kondisi dikunci dengan NAMA PERAN. Pengecualian nama peran tetap sah untuk aturan
        // TAMPIL (bar navigasi, menu Modul); yang dilarang adalah memakainya sebagai pengganti
        // pemeriksaan fungsi pada pintu yang MENULIS data.
        val kunciPeran = Regex("""\brole\s*(!=|==)\s*Role\.\w+""")
        val pelanggaran = mutableListOf<String>()
        for (nama in berkas) {
            val f = File("src/main/java/com/cuciin/laundryops/ui/$nama")
            if (!f.exists()) continue
            val baris = f.readLines()
            baris.forEachIndexed { i, isi ->
                val b = isi.trim()
                if (b.startsWith("//") || b.startsWith("*")) return@forEachIndexed
                if (pintu.none { it in b }) return@forEachIndexed
                // Kondisi peran biasanya ada di baris `if` tepat di atas tombolnya, jadi
                // periksa jendela beberapa baris ke belakang, bukan hanya baris itu sendiri.
                val jendela = baris.subList((i - 3).coerceAtLeast(0), i + 1)
                if (jendela.any { kunciPeran.containsMatchIn(it) }) {
                    pelanggaran.add("$nama:${i + 1}  ${b.take(90)}")
                }
            }
        }
        assertTrue(
            "Pintu alur tulis ini dikunci dengan NAMA PERAN, bukan fungsi izin:\n" +
                pelanggaran.joinToString("\n"),
            pelanggaran.isEmpty(),
        )
    }

    /**
     * Pintu MASUK alur tulis harus benar-benar diperiksa dengan fungsi izin.
     *
     * Test sebelumnya hanya melarang nama peran; itu belum cukup. Pintu bisa saja tidak diperiksa
     * sama sekali, dan itulah bentuk aslinya: "Daftarkan aset" selalu tampil, sehingga role yang
     * hanya memegang modul `inventory` tanpa `inventory.write` bisa membuka dan mengisi
     * formulirnya lalu ditolak saat menyimpan.
     *
     * Yang diperiksa hanya pintu dari layar DAFTAR/BERANDA. Pintu di dalam alur (mis. "bayar"
     * di layar Service baru, "queueEdit" di layar rincian) tidak perlu memeriksa ulang karena
     * layar induknya sudah dijaga gerbang rute.
     */
    @Test
    fun pintuMasukAlurTulisDiperiksaDenganFungsi() {
        val pintuMasuk = mapOf(
            "OpsScreens.kt" to listOf("navigate(\"nota\")", "navigate(\"stokEdit\")"),
            "AssetScreens.kt" to listOf(
                "navigate(\"assetNew\")", "navigate(\"assetTypes\")", "navigate(\"assetEdit/",
            ),
            // Tombol yang membuka form tulis di layar daftar. Layar ini gerbangnya memeriksa modul
            // supaya role kustom tetap bisa MEMBACA, jadi pintu MENULISnya harus diperiksa sendiri.
            "MasterScreens.kt" to listOf("PrimaryBtn(\"Pelanggan baru\""),
            "BusinessScreens.kt" to listOf("PrimaryBtn(\"Catat biaya\""),
        )
        val pemeriksaFungsi = Regex("""can[A-Z]\w*\(|canAccess\(|boleh\(""")
        val belumDiperiksa = mutableListOf<String>()
        for ((nama, pintu) in pintuMasuk) {
            val f = File("src/main/java/com/cuciin/laundryops/ui/$nama")
            if (!f.exists()) continue
            val baris = f.readLines()
            for (i in baris.indices) {
                val b = baris[i].trim()
                if (b.startsWith("//") || b.startsWith("*")) continue
                if (pintu.none { it in b }) continue
                // Pemeriksa boleh berada di baris yang sama atau beberapa baris di atasnya,
                // karena Compose sering menaruh `if (...)` di baris terpisah dari tombolnya.
                val jendela = baris.subList((i - 4).coerceAtLeast(0), i + 1)
                if (jendela.none { pemeriksaFungsi.containsMatchIn(it) }) {
                    belumDiperiksa.add("$nama:${i + 1}  ${b.take(90)}")
                }
            }
        }
        assertTrue(
            "Pintu masuk alur tulis ini tidak diperiksa dengan fungsi izin:\n" +
                belumDiperiksa.joinToString("\n"),
            belumDiperiksa.isEmpty(),
        )
    }

    /**
     * Layar Pembayaran harus memakai [CuciinStore.notaReject] sebelum memanggil `saveNota`.
     *
     * `saveNota` memeriksa izin dan keabsahan data dengan `check`/`require`, yang MELEMPAR dan
     * mematikan aplikasi. Selama UI tidak memeriksa hal yang sama lebih dulu, setiap penolakan
     * baru di store menjadi crash baru di perangkat. Test ini mengunci urutannya.
     */
    @Test
    fun layarPembayaranMemakaiPemeriksaPenolakanLebihDulu() {
        val sumber = File("src/main/java/com/cuciin/laundryops/ui/OpsScreens.kt").readText()
        val mulai = sumber.indexOf("fun save(openWa: Boolean)")
        assertTrue("Fungsi save() tidak ditemukan di OpsScreens.kt", mulai >= 0)
        val badan = sumber.substring(mulai, (mulai + 1200).coerceAtMost(sumber.length))
        val posReject = badan.indexOf("notaReject(")
        val posSave = badan.indexOf("store.saveNota(")
        assertTrue("save() tidak memakai store.notaReject()", posReject >= 0)
        assertTrue("save() tidak memanggil store.saveNota()", posSave >= 0)
        assertTrue(
            "save() memanggil saveNota sebelum memeriksa notaReject, jadi penolakan menjadi crash",
            posReject < posSave,
        )
    }

    /**
     * Layar harus membaca pesan penolakan store lebih dulu, bukan menebak sendiri.
     *
     * `saveNota` dan `closeCash` memeriksa izin dengan `check`/`boleh` dan gagal secara diam
     * (`null`). Selama layar menebak sebabnya, penolakan izin dilaporkan sebagai hal lain:
     * "Pembayaran sudah lunas", atau "Kas cabang ini sudah ditutup hari ini" padahal kasnya tidak
     * ditutup. Test ini mengunci urutannya: pemeriksa penolakan dipanggil SEBELUM fungsinya.
     */
    @Test
    fun layarMembacaPesanPenolakanSebelumMemanggilFungsi() {
        val pasangan = listOf(
            Triple("OpsScreens.kt", "fun save(openWa: Boolean)", "notaReject(" to "store.saveNota("),
            Triple("MoreScreens.kt", "Tutup kas hari ini", "cashCloseReject()" to "store.closeCash()"),
        )
        val pelanggaran = mutableListOf<String>()
        for ((nama, penanda, pasang) in pasangan) {
            val sumber = File("src/main/java/com/cuciin/laundryops/ui/$nama").readText()
            val mulai = sumber.indexOf(penanda)
            if (mulai < 0) {
                pelanggaran.add("$nama: penanda '$penanda' tidak ditemukan")
                continue
            }
            val badan = sumber.substring(mulai, (mulai + 1200).coerceAtMost(sumber.length))
            val (tolak, simpan) = pasang
            val posTolak = badan.indexOf(tolak)
            val posSimpan = badan.indexOf(simpan)
            if (posTolak < 0) pelanggaran.add("$nama: tidak memanggil $tolak")
            else if (posSimpan < 0) pelanggaran.add("$nama: tidak memanggil $simpan")
            else if (posTolak > posSimpan) {
                pelanggaran.add("$nama: $simpan dipanggil sebelum $tolak, jadi penolakan tidak terbaca")
            }
        }
        assertTrue(
            "Layar memanggil fungsi yang bisa menolak tanpa membaca pesannya lebih dulu:\n" +
                pelanggaran.joinToString("\n"),
            pelanggaran.isEmpty(),
        )
    }

    /**
     * Penolakan Service harus punya SATU sumber, bukan dua daftar yang harus dijaga sinkron.
     *
     * Sebelumnya `notaReject` (dipakai UI) dan `saveNota` (penjaga lapis kedua) masing-masing
     * menyalin daftar penolakan yang sama. Selama dua daftar hidup berdampingan, setiap penolakan
     * baru di `saveNota` yang lupa ditambahkan ke `notaReject` menjadi crash di perangkat: UI tidak
     * dapat menampilkannya lebih dulu. Sekarang `saveNota` memanggil `notaReject`, dan test ini
     * mengunci bentuk itu supaya daftarnya tidak pernah disalin ulang.
     */
    @Test
    fun penolakanServiceHanyaPunyaSatuSumber() {
        val sumber = File("src/main/java/com/cuciin/laundryops/data/CuciinStore.kt").readText()
        val awal = sumber.indexOf("fun saveNota(")
        assertTrue("saveNota tidak ditemukan", awal >= 0)
        val badan = sumber.substring(awal, (awal + 1500).coerceAtMost(sumber.length))
        assertTrue(
            "saveNota tidak memakai notaReject, jadi daftar penolakannya bisa berbeda dari yang " +
                "dapat ditampilkan UI dan penolakan baru menjadi crash",
            badan.contains("notaReject("),
        )
        assertFalse(
            "saveNota menyalin ulang daftar penolakan dengan require/check sendiri; pakai notaReject",
            Regex("""\brequire\(|\bcheck\(""").containsMatchIn(badan),
        )
    }

    /**
     * Layar yang gerbang rutenya memakai FUNGSI tidak boleh mengunci diri dengan NAMA peran.
     *
     * `RouteAccess` mengizinkan rute `users`/`ownerSettings` lewat fungsi `owner.manage`. Bila
     * layarnya lalu menolak semua yang bukan Owner, role kustom pemegang `owner.manage` masuk
     * lalu langsung terlempar keluar. Dua lapis harus memakai ukuran yang sama.
     */
    @Test
    fun layarBergerbangFungsiTidakMengunciNamaPeran() {
        val berkas = listOf("MasterScreens.kt", "OwnerSettingsScreen.kt")
        val pelanggaran = berkas.mapNotNull { nama ->
            val teks = File("src/main/java/com/cuciin/laundryops/ui/$nama").readText()
            val bukti = Regex("""role != Role\.Owner\)\s*\{\s*nav\.popBackStack\(\)""").find(teks)
            if (bukti == null) null else "$nama:${teks.take(bukti.range.first).count { c -> c == '\n' } + 1}"
        }
        assertTrue(
            "Layar ber-gerbang fungsi masih dikunci nama peran: $pelanggaran",
            pelanggaran.isEmpty(),
        )
    }

    /**
     * Setiap fungsi izin yang dipakai memfilter tombol harus benar-benar ada di katalog.
     *
     * Helper seperti `canWriteStock()` adalah pembungkus tipis; test ini memastikan pembungkus itu
     * tidak menyebut fungsi yang tidak dikenal, karena salah tulis nama fungsi akan membuat
     * pemeriksaannya selalu false dan tombolnya hilang untuk semua orang.
     */
    @Test
    fun helperIzinMemakaiFungsiYangAdaDiKatalog() {
        val sumber = File("src/main/java/com/cuciin/laundryops/data/CuciinStore.kt").readText()
        val dipanggil = Regex("""canAccess\("([^"]+)",\s*"([^"]+)"\)""")
            .findAll(sumber)
            .map { it.groupValues[1] to it.groupValues[2] }
            .toSet()
        val katalog = AccessCatalog.allFunctionKeys()
        val asing = dipanggil.filter { (_, fungsi) -> fungsi !in katalog }
        assertTrue(
            "Pemeriksaan izin memakai fungsi yang tidak ada di katalog, sehingga selalu false:\n" +
                asing.joinToString("\n") { "  ${it.first} / ${it.second}" },
            asing.isEmpty(),
        )
    }

    /**
     * Hasil fungsi store yang bisa MENOLAK tidak boleh dibuang di layar.
     *
     * Kelas bug B: fungsi store mengembalikan pesan penolakan (`String?`), tetapi UI memanggilnya
     * sebagai pernyataan berdiri sendiri lalu menampilkan pesan SUKSES. Pengguna melihat
     * "WhatsApp dibuka untuk nota ini" padahal `markWaSent` menolak karena izin atau cabang, dan
     * datanya tidak berubah. Penolakan yang tidak pernah dibaca sama saja tidak ada.
     *
     * Aturan yang diuji, dihitung per panggilan dengan tanda kurung berimbang:
     * 1. hasilnya dibungkus dari DEPAN (`val x = `, `finish(...)`, `toast(...)`, `return ...`), atau
     * 2. hasilnya dirantai dari BELAKANG (`?.`, `.let`, `.also`, `?:`), atau
     * 3. panggilan itu sendiri adalah nilai blok (`else { store.foo(...) }`), yaitu berdiri sendiri
     *    tanpa pernyataan lain di belakangnya pada baris yang sama.
     *
     * Sisanya berarti hasilnya dibuang. Pemeriksaan dilakukan pada pernyataan, bukan seluruh baris,
     * supaya `toast(...)` yang kebetulan berada di belakang panggilan tidak dianggap memakai hasil.
     */
    @Test
    fun hasilFungsiYangBisaMenolakTidakDibuang() {
        val sumber = File("src/main/java/com/cuciin/laundryops/data/CuciinStore.kt").readText()
        val bisaMenolak = Regex("""\n    fun (\w+)\([^)]*\)\s*:\s*String\?""")
            .findAll(sumber).map { it.groupValues[1] }.toSet()
        assertTrue("Tidak ada fungsi String? yang terbaca di CuciinStore.kt", bisaMenolak.isNotEmpty())

        val berkas = listOf(
            "OpsScreens.kt", "AssetScreens.kt", "MasterScreens.kt", "MoreScreens.kt",
            "AccessScreens.kt", "OwnerSettingsScreen.kt",
        )
        // Hasil dibungkus dari depan.
        val dariDepan = Regex("""=\s|\bfinish\(|\btoast\(|\breturn\s|\?:""")
        // Hasil dirantai dari belakang.
        val dariBelakang = Regex("""^\s*\?\.|^\s*\.let|^\s*\.also|^\s*\?:""")
        // Sisa setelah panggilan yang hanya penutup, tanda panggilan itu nilai blok.
        val hanyaPenutup = Regex("""^[;)}]*$""")
        // Awalan yang hanya rangka blok (`} else `, `) { `), tanda panggilan itu nilai blok.
        val hanyaRangka = Regex("""^[\s}{);]*(else)?[\s}{);]*$""")
        val dibuang = mutableListOf<String>()
        for (nama in berkas) {
            val f = File("src/main/java/com/cuciin/laundryops/ui/$nama")
            if (!f.exists()) continue
            for ((i, baris) in f.readLines().withIndex()) {
                val b = baris.trim()
                if (b.startsWith("//") || b.startsWith("*")) continue
                for (fn in bisaMenolak) {
                    val panggil = Regex("""\b(?:store|assetStore|accessStore)\.$fn\(""").find(b) ?: continue
                    val buka = panggil.range.last
                    var d = 0
                    var tutup = b.length - 1
                    var j = buka
                    while (j < b.length) {
                        if (b[j] == '(') d++
                        if (b[j] == ')') { d--; if (d == 0) { tutup = j; break } }
                        j++
                    }
                    val depan = b.substring(0, panggil.range.first)
                        .lastIndexOfAny(charArrayOf(';', '{', '}')).let { if (it < 0) 0 else it + 1 }
                    val sebelum = b.substring(depan, panggil.range.first)
                    val sesudah = b.substring(tutup + 1)
                    val nilaiBlok = hanyaPenutup.matches(sesudah.trim()) && hanyaRangka.matches(sebelum)
                    val dipakai = dariDepan.containsMatchIn(sebelum) ||
                        dariBelakang.containsMatchIn(sesudah) ||
                        nilaiBlok
                    if (!dipakai) {
                        dibuang.add("$nama:${i + 1}  $fn()  ${b.substring(depan).take(95)}")
                    }
                }
            }
        }
        assertTrue(
            "Hasil fungsi yang bisa menolak dibuang, sehingga penolakan tidak pernah terlihat " +
                "oleh pengguna dan UI melaporkan sukses palsu:\n" + dibuang.joinToString("\n"),
            dibuang.isEmpty(),
        )
    }
}
