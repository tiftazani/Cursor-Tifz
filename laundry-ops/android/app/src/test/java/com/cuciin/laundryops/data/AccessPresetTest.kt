package com.cuciin.laundryops.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Preset peran dan pemisahan hak yang diperkenalkan 1.10.30.
 *
 * Katalog diperinci dari 12 modul/17 fungsi menjadi 15 modul/41 fungsi, dengan tiga pemisahan:
 * baca dari tulis (`stock.view` vs `stock.write`), ubah dari hapus (`service.correct` vs
 * `service.delete`), dan modul `owner` dipecah menjadi `branch`, `staff`, `serviceCatalog`,
 * `access`.
 *
 * Yang dijaga test ini bukan jumlahnya, melainkan dua hal yang mudah rusak saat katalog
 * bertambah:
 *
 * 1. Preset tidak boleh memberi hak lebih dari yang dimaksud namanya. Preset "Kasir" yang
 *    diam-diam memuat `service.price` akan membuka ubah harga untuk semua kasir baru.
 * 2. Setiap fungsi katalog harus terjangkau setidaknya satu preset, supaya tidak ada fungsi
 *    yang hanya bisa dicentang manual dan tidak pernah muncul di alur kerja nyata.
 */
class AccessPresetTest {

    private val katalog = AccessCatalog.allFunctionKeys()
    private val modul = AccessCatalog.moduleKeys

    private fun preset(key: String) = AccessCatalog.presets.first { it.key == key }

    @Test
    fun setiapPresetHanyaMemakaiKunciKatalog() {
        AccessCatalog.presets.forEach { p ->
            val modulAsing = p.modules - modul
            val fungsiAsing = p.functions - katalog
            assertTrue("Preset ${p.label} memuat modul asing: $modulAsing", modulAsing.isEmpty())
            assertTrue("Preset ${p.label} memuat fungsi asing: $fungsiAsing", fungsiAsing.isEmpty())
            assertEquals(
                "Preset ${p.label} memuat fungsi yang modulnya tidak dimilikinya, sehingga " +
                    "sanitasi katalog akan membuangnya diam-diam",
                p.functions,
                AccessCatalog.sanitize(p.modules, p.functions).second,
            )
        }
    }

    @Test
    fun presetOwnerSamaDenganSeluruhKatalog() {
        val owner = preset("owner")
        assertEquals(modul, owner.modules)
        assertEquals(katalog, owner.functions)
    }

    @Test
    fun presetKasirTidakMemberiHakYangTerkunciOwner() {
        // Inti janji preset: "Kasir" berarti kasir, bukan Owner dengan nama lain. Yang diuji
        // [AccessCatalog.ownerLocked], bukan [AccessCatalog.ownerOnlyByDefault]: fungsi yang
        // terkunci Owner akan DITOLAK SERVER, jadi mencentangnya hanya menghasilkan kegagalan
        // sinkronisasi yang tidak dapat dipahami pengguna.
        val kasir = preset("kasir")
        val terlarang = kasir.functions.intersect(AccessCatalog.ownerLocked)
        assertTrue(
            "Preset Kasir memberi hak yang terkunci Owner: $terlarang",
            terlarang.isEmpty(),
        )
    }

    @Test
    fun fungsiTerkunciOwnerTidakAdaDiPresetSelainOwner() {
        // Preset apa pun selain Owner tidak boleh memuat fungsi yang server tolak untuk non-Owner.
        AccessCatalog.presets.filter { it.key != "owner" }.forEach { p ->
            val terlarang = p.functions.intersect(AccessCatalog.ownerLocked)
            assertTrue("Preset ${p.label} memuat fungsi terkunci Owner: $terlarang", terlarang.isEmpty())
        }
    }

    @Test
    fun daftarTerkunciOwnerSesuaiKenyataanServer() {
        // Daftar ini harus mengikuti OWNER_ONLY dan daftar perintah khusus Owner di Worker.
        // Dibaca dari kode server supaya penyimpangannya ketahuan, bukan diulang di test.
        val sumber = daftarBerkasServer().joinToString("\n") { it.readText() }
        assertTrue("Sumber Worker tidak terbaca", sumber.length > 5000)

        val ownerOnly = Regex("""OWNER_ONLY\s*=\s*new Set\(\[(.*?)\]\)""", RegexOption.DOT_MATCHES_ALL)
            .find(sumber)?.groupValues?.get(1)
            ?: error("OWNER_ONLY tidak ditemukan di kode Worker")

        // Perintah server yang terkunci Owner, dipetakan ke fungsi katalog yang setara.
        val pasangan = mapOf(
            "branch.upsert" to "branch.manage",
            "branch.delete" to "branch.delete",
            "staff.upsert" to "staff.manage",
            "staff.delete" to "staff.delete",
            "service.upsert" to "serviceCatalog.manage",
            "product.upsert" to "stock.product",
            "product.delete" to "stock.productDelete",
            "assetType.upsert" to "inventory.type",
            "accessRole.upsert" to "access.role",
            "whatsappTemplate.upsert" to "whatsapp.template",
        )
        val hilang = pasangan.filter { (perintah, _) -> perintah !in ownerOnly && perintah !in sumber }
        assertTrue(
            "Fungsi ini ditandai terkunci Owner di katalog tetapi perintah servernya tidak " +
                "ditemukan, sehingga tanda di layar tidak sesuai kenyataan: $hilang",
            hilang.isEmpty(),
        )
        // Hapus Service dan hapus nota terkunci lewat pemeriksaan khusus, bukan OWNER_ONLY.
        assertTrue(
            "order.delete harus terkunci Owner di server",
            "\"order.delete\" && identity.role !== \"Owner\"" in sumber,
        )
        assertTrue("service.delete harus terkunci Owner di server", "\"service.delete\"" in sumber)
    }

    /**
     * Berkas sumber Worker.
     *
     * Dicari dengan menaiki folder dari direktori kerja test, bukan dengan jalur relatif tetap:
     * direktori kerja berbeda antara `./gradlew test` dan IDE, dan test yang gagal karena jalur
     * bukan test yang berguna.
     */
    private fun daftarBerkasServer(): List<java.io.File> {
        var dir: java.io.File? = java.io.File(System.getProperty("user.dir").orEmpty()).absoluteFile
        while (dir != null) {
            val src = java.io.File(dir, "cloudflare/src")
            if (src.isDirectory) {
                return src.listFiles { f -> f.extension == "ts" }?.toList().orEmpty()
            }
            dir = dir.parentFile
        }
        error("Folder cloudflare/src tidak ditemukan dari ${System.getProperty("user.dir")}")
    }

    @Test
    fun presetKasirDanSupervisorTidakMemberiUbahHarga() {
        // Ubah harga Service adalah hak yang paling sering diminta dicabut Owner.
        listOf("kasir", "supervisor", "viewer").forEach { key ->
            assertFalse(
                "Preset ${preset(key).label} tidak boleh memberi ubah harga",
                "service.price" in preset(key).functions,
            )
        }
    }

    @Test
    fun presetSupervisorTidakDapatMembuatService() {
        // Supervisor mengawasi, bukan melayani. Role bawaan Supervisor pun tidak memegang
        // `service.create`, dan preset tidak boleh menyimpang dari itu.
        assertFalse("service.create" in preset("supervisor").functions)
        assertFalse("service.payment" in preset("supervisor").functions)
        assertFalse("service.delete" in preset("supervisor").functions)
    }

    @Test
    fun presetHanyaLihatTidakMemuatSatuPunFungsiTulis() {
        // Pemisahan baca dari tulis inilah yang membuat preset ini mungkin. Sebelum 1.10.30
        // satu-satunya cara memberi "lihat stok" adalah memberi "ubah stok".
        val viewer = preset("viewer")
        val tulis = viewer.functions.filterNot { it.endsWith(".view") || it in FUNGSI_BACA_SAH }
        assertTrue(
            "Preset Hanya lihat memuat fungsi tulis: $tulis",
            tulis.isEmpty(),
        )
        assertTrue("Preset Hanya lihat harus memuat modul stock", "stock" in viewer.modules)
        assertTrue("Preset Hanya lihat harus bisa melihat stok", "stock.view" in viewer.functions)
        assertFalse("Preset Hanya lihat tidak boleh mengubah stok", "stock.write" in viewer.functions)
    }

    @Test
    fun presetKosongBenarBenarKosong() {
        val kosong = preset("kosong")
        assertTrue(kosong.modules.isEmpty())
        assertTrue(kosong.functions.isEmpty())
    }

    @Test
    fun setiapFungsiKatalogTerjangkauMinimalSatuPreset() {
        // Fungsi yang tidak ada di preset mana pun hanya bisa dicentang manual, dan itu berarti
        // tidak ada alur kerja nyata yang memakainya. Fungsi seperti itu harus dipertanyakan.
        val terjangkau = AccessCatalog.presets.flatMap { it.functions }.toSet()
        val yatim = katalog - terjangkau
        assertTrue(
            "Fungsi ini tidak ada di preset mana pun, jadi tidak ada peran bawaan yang " +
                "memakainya dan hanya bisa dicentang manual: $yatim",
            yatim.isEmpty(),
        )
    }

    @Test
    fun presetViewerHanyaMemuatModulYangFungsinyaDimiliki() {
        // Modul tanpa fungsi baca tidak boleh ikut masuk hanya karena ada di katalog.
        val viewer = preset("viewer")
        val fungsiModul = viewer.modules.flatMap { AccessCatalog.functionsOf(it) }.map { it.key }.toSet()
        assertTrue(
            "Preset Hanya lihat memuat modul yang tidak punya fungsi baca: " +
                "${viewer.modules - fungsiModul.mapNotNull { AccessCatalog.moduleOf(it) }.toSet()}",
            viewer.functions.all { AccessCatalog.moduleOf(it) in viewer.modules },
        )
    }

    @Test
    fun roleBawaanKasirDanSupervisorSesuaiPresetnya() {
        // Role bawaan dan preset dengan nama yang sama harus memberi hak yang sama, supaya
        // "reset ke bawaan" tidak mengubah apa pun secara mengejutkan.
        assertEquals(preset("kasir").modules, AccessCatalog.builtInRoles().first { it.id == "role-kasir" }.modules)
        assertEquals(preset("kasir").functions, AccessCatalog.builtInRoles().first { it.id == "role-kasir" }.functions)
        assertEquals(preset("supervisor").modules, AccessCatalog.builtInRoles().first { it.id == "role-supervisor" }.modules)
        assertEquals(preset("supervisor").functions, AccessCatalog.builtInRoles().first { it.id == "role-supervisor" }.functions)
    }

    @Test
    fun ownerOnlyByDefaultSeluruhnyaAdaDiKatalog() {
        val asing = AccessCatalog.ownerOnlyByDefault - katalog
        assertTrue("Fungsi bawaan khusus Owner tidak ada di katalog: $asing", asing.isEmpty())
    }

    @Test
    fun setiapFungsiBawaanKhususOwnerBeradaDiPresetOwner() {
        val hilang = AccessCatalog.ownerOnlyByDefault - preset("owner").functions
        assertTrue("Fungsi khusus Owner tidak ada di preset Owner: $hilang", hilang.isEmpty())
    }

    @Test
    fun pemisahanBacaTulisBenarBenarAda() {
        // Bukti bahwa pemisahan itu nyata, bukan sekadar nama: modul yang punya dua-duanya.
        listOf(
            "stock" to ("stock.view" to "stock.write"),
            "inventory" to ("inventory.view" to "inventory.write"),
            "customer" to ("customer.view" to "customer.write"),
            "queue" to ("queue.view" to "queue.status"),
        ).forEach { (m, pasangan) ->
            assertTrue("Modul $m harus punya ${pasangan.first}", pasangan.first in katalog)
            assertTrue("Modul $m harus punya ${pasangan.second}", pasangan.second in katalog)
        }
    }

    @Test
    fun pemisahanUbahDanHapusBenarBenarAda() {
        listOf(
            "service" to ("service.correct" to "service.delete"),
            "customer" to ("customer.write" to "customer.delete"),
            "expense" to ("expense.write" to "expense.delete"),
            "inventory" to ("inventory.write" to "inventory.delete"),
            "branch" to ("branch.manage" to "branch.delete"),
            "staff" to ("staff.manage" to "staff.delete"),
            "serviceCatalog" to ("serviceCatalog.manage" to "serviceCatalog.delete"),
        ).forEach { (m, pasangan) ->
            assertTrue("Modul $m harus punya ${pasangan.first}", pasangan.first in katalog)
            assertTrue("Modul $m harus punya ${pasangan.second}", pasangan.second in katalog)
        }
    }

    @Test
    fun modulOwnerSudahTidakAdaLagi() {
        // Kalau `owner` muncul kembali, pemecahannya batal dan satu centang lagi-lagi menaungi
        // cabang, user, layanan, produk, dan pengaturan sekaligus.
        assertFalse("Modul owner harus sudah dipecah", "owner" in modul)
        assertTrue("owner.manage" !in katalog)
        assertTrue("owner.access" !in katalog)
    }

    private companion object {
        /** Fungsi baca yang namanya bukan `*.view`. */
        val FUNGSI_BACA_SAH = setOf("attendance.self", "whatsapp.archive")
    }
}
