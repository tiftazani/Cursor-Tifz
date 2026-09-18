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
 * daftar yang ditulis TANGAN di dalam test, bukan hasil membaca kode utama. Test di sini bisa
 * lulus walau tidak ada satu pun kode yang memeriksa fungsi tersebut. Yang benar-benar dikunci
 * hanyalah [setiapTitikJagaFungsiMasihAdaDiStore] (membaca CuciinStore.kt) dan
 * [mencabutFungsiMenolakTindakannyaUntukSetiapFungsi] (menguji AccessPolicy).
 *
 * Keadaan per 1.10.26, diukur langsung ke kode: 8 dari 17 fungsi diperiksa, 9 belum
 * (queue.status, queue.handover, service.create, stock.write, inventory.write, whatsapp.send,
 * owner.manage, analytics.view, audit.view).
 */
class AccessFunctionEnforcementTest {

    /**
     * Fungsi katalog yang sudah punya pemeriksa di kode utama.
     *
     * Dipisah sebagai daftar eksplisit supaya penambahan fungsi baru tanpa pemeriksa langsung
     * terlihat sebagai kegagalan test, bukan lolos diam-diam.
     */
    private val diperiksa: Set<String> = setOf(
        "service.price",
        "service.create",
        "service.correct",
        "service.payment",
        "queue.status",
        "queue.handover",
        "customer.write",
        "stock.write",
        "inventory.write",
        "attendance.write",
        "whatsapp.send",
        "expense.write",
        "cash.close",
        "owner.manage",
        "owner.access",
        "analytics.view",
        "audit.view",
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
        "service.correct" to ("boleh" to 2),   // updateNotaLines + deleteNota
        "service.payment" to ("boleh" to 1),   // markLunas
        "expense.write" to ("boleh" to 2),     // addExpense + deleteExpense
        "attendance.write" to ("boleh" to 2),  // checkIn + checkOut
        "cash.close" to ("boleh" to 1),        // closeCash
        "customer.write" to ("tolak" to 1),    // deleteCustomer
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

    /**
     * Fungsi katalog yang BELUM punya pemeriksa di kode utama.
     *
     * Daftar ini adalah utang yang diakui, bukan klaim bahwa semuanya beres. Diukur langsung
     * ke kode per 1.10.26. Bila salah satu diperbaiki, test akan gagal dan meminta daftar ini
     * diperbarui, sehingga jumlahnya tidak bisa diam-diam bertambah.
     */
    private val belumDiperiksa: Set<String> = setOf(
        "queue.status",
        "queue.handover",
        "service.create",
        "stock.write",
        "inventory.write",
        "whatsapp.send",
        "owner.manage",
        "analytics.view",
        "audit.view",
    )

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

    @Test
    fun daftarFungsiBelumDiperiksaSesuaiKenyataanKode() {
        val nyata = AccessCatalog.allFunctionKeys() - fungsiYangDipakaiDiKode()
        assertEquals(
            "Daftar fungsi yang belum diperiksa tidak lagi sesuai kode. Perbarui [belumDiperiksa] " +
                "bila ada fungsi yang baru diperiksa, atau tegakkan fungsi yang masih hilang.",
            belumDiperiksa,
            nyata,
        )
    }

    @Test
    fun fungsiYangSudahDitegakkanTidakKembaliKeDaftarBelumDiperiksa() {
        val tumpangTindih = belumDiperiksa intersect fungsiYangDipakaiDiKode()
        assertTrue(
            "Fungsi ini sudah diperiksa di kode, jadi tidak boleh lagi ada di daftar utang: $tumpangTindih",
            tumpangTindih.isEmpty(),
        )
    }

    /**
     * Fungsi yang benar-benar ditegakkan di store pada versi ini.
     *
     * Daftar ini adalah janji yang sudah dipenuhi: mencabut fungsi ini dari role membuat
     * tindakannya ditolak, bukan hanya tombolnya disembunyikan.
     */
    private val ditegakkanDiStore: Set<String> = setOf(
        "service.correct",
        "service.payment",
        "service.price",
        "expense.write",
        "attendance.write",
        "cash.close",
        "customer.write",
        "owner.access",
    )

    @Test
    fun fungsiYangDiklaimDitegakkanBenarBenarDiperiksaDiStore() {
        val sumber = java.io.File("src/main/java/com/cuciin/laundryops/data/CuciinStore.kt").readText()
        val hilang = ditegakkanDiStore.filterNot { sumber.contains("\"$it\"") }
        assertTrue(
            "Fungsi ini diklaim ditegakkan di store tetapi tidak diperiksa di sana: $hilang",
            hilang.isEmpty(),
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
}
