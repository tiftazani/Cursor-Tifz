package com.cuciin.laundryops.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Urutan menu Modul dan pengaturannya.
 *
 * Menu ini sebelumnya dirakit sebagai satu daftar lalu dikelompokkan ulang memakai `setOf`,
 * sehingga urutan isinya mengikuti urutan penambahan dan beberapa menu jatuh ke bagian yang
 * keliru: "Theme Aplikasi" dan "Riwayat versi" ikut masuk ke bagian laporan.
 *
 * Test ini mengunci susunan bawaan sekaligus perilaku pengurutan yang dipakai layar
 * Atur urutan menu.
 */
class MenuOrderTest {

    // --------------------------------------------------------------- susunan bawaan

    @Test
    fun urutanBagianTetap() {
        assertEquals(
            listOf("Pekerjaan harian", "Keuangan", "Pelanggan", "Laporan", "Master data", "Aplikasi"),
            MenuOrder.sections,
        )
    }

    @Test
    fun riwayatVersiDanThemeTidakMasukBagianLaporan() {
        assertEquals("Aplikasi", MenuOrder.specOf("theme")?.section)
        assertEquals("Aplikasi", MenuOrder.specOf("versions")?.section)
    }

    @Test
    fun aplikasiAdalahBagianTerakhir() {
        assertEquals("Aplikasi", MenuOrder.APPLICATION_SECTION)
        assertEquals(MenuOrder.APPLICATION_SECTION, MenuOrder.sections.last())
        assertTrue(
            "Aplikasi harus setelah Master data",
            MenuOrder.sections.indexOf(MenuOrder.APPLICATION_SECTION) > MenuOrder.sections.indexOf("Master data"),
        )
    }

    @Test
    fun bagianAplikasiBerisiTigaMenuTerurut() {
        assertEquals(
            listOf("Akun & profil", "Theme Aplikasi", "Riwayat versi"),
            MenuOrder.applicationEntries,
        )
        assertEquals(MenuOrder.applicationEntries, MenuOrder.defaultLayout().entriesOf("Aplikasi"))
    }

    @Test
    fun urutanPekerjaanHarianMengikutiAlurKerja() {
        // Antrian paling atas karena itu yang paling sering dibuka kasir.
        assertEquals(
            listOf("Antrian laundry", "Service baru", "Absensi karyawan", "Daftar Aset Cabang"),
            MenuOrder.defaultLayout().entriesOf("Pekerjaan harian"),
        )
    }

    @Test
    fun urutanKeuanganDanPelangganMasukAkal() {
        val layout = MenuOrder.defaultLayout()
        assertEquals(listOf("Biaya operasional", "Tutup kas"), layout.entriesOf("Keuangan"))
        assertEquals(listOf("Pelanggan", "WA menunggu", "Arsip WA"), layout.entriesOf("Pelanggan"))
    }

    @Test
    fun laporanDisusunDariRingkasanKeJejak() {
        assertEquals(
            listOf("Laporan transaksi", "Laporan analitik", "Riwayat aktivitas"),
            MenuOrder.defaultLayout().entriesOf("Laporan"),
        )
    }

    @Test
    fun masterDataDisusunDariReferensiKePengaturan() {
        assertEquals(
            listOf("Cabang", "Daftar User", "Layanan & harga", "Produk stok", "Kontrol Akses Role", "Pengaturan Owner"),
            MenuOrder.defaultLayout().entriesOf("Master data"),
        )
    }

    @Test
    fun setiapRuteHanyaMunculSekali() {
        val routes = MenuOrder.allRoutes
        assertEquals("Tidak boleh ada rute ganda", routes.size, routes.toSet().size)
    }

    @Test
    fun setiapMenuPunyaIkonDanRingkasan() {
        MenuOrder.catalog.forEach { spec ->
            assertTrue("Ikon ${spec.label} tidak boleh kosong", spec.icon.isNotBlank())
            assertTrue("Ringkasan ${spec.label} tidak boleh kosong", spec.summary.isNotBlank())
            assertTrue("Bagian ${spec.label} harus dikenal", spec.section in MenuOrder.sections)
        }
    }

    @Test
    fun susunanBawaanMengenaliSemuaMenu() {
        val layout = MenuOrder.defaultLayout()
        assertTrue(layout.isDefault())
        MenuOrder.catalog.forEach { spec ->
            assertNotNull("Bagian ${spec.label} harus ada di susunan bawaan", layout.sectionOf(spec.route))
        }
    }

    // ------------------------------------------------------------- penyaringan izin

    @Test
    fun bagianKosongTidakDirender() {
        // Izin yang semuanya tertutup tidak boleh menyisakan judul bagian tanpa isi.
        assertTrue("Tidak ada bagian yang dirender bila tidak ada izin", MenuOrder.defaultLayout().render { false }.isEmpty())
    }

    @Test
    fun izinMenyaringTanpaMengubahUrutan() {
        // Menutup satu menu tidak mengubah urutan bagian; hanya isinya yang berkurang.
        val rendered = MenuOrder.defaultLayout().render { it != "expenses" }
        assertEquals(MenuOrder.sections, rendered.map { it.first })
        assertEquals(listOf("Tutup kas"), rendered.first { it.first == "Keuangan" }.second.map { it.label })
    }

    @Test
    fun bagianDenganIzinTertutupTidakMuncul() {
        // Menutup semua menu Keuangan membuat bagiannya hilang, bukan jadi judul kosong.
        val rendered = MenuOrder.defaultLayout().render { it != "expenses" && it != "cash" }
        assertTrue("Keuangan harus hilang", rendered.none { it.first == "Keuangan" })
        assertEquals("Bagian lain tetap ada", 5, rendered.size)
    }

    // ------------------------------------------------------- menggeser menu dan bagian

    @Test
    fun menuDapatDigeserNaikDanTurunDalamBagiannya() {
        val layout = MenuOrder.defaultLayout()
        val down = layout.moveRoute("queue", 1)
        assertEquals(
            listOf("Service baru", "Antrian laundry", "Absensi karyawan", "Daftar Aset Cabang"),
            down.entriesOf("Pekerjaan harian"),
        )

        val back = down.moveRoute("queue", -1)
        assertEquals(
            listOf("Antrian laundry", "Service baru", "Absensi karyawan", "Daftar Aset Cabang"),
            back.entriesOf("Pekerjaan harian"),
        )
    }

    @Test
    fun geserMelewatiUjungBagianTidakMengubahApaPun() {
        val layout = MenuOrder.defaultLayout()
        assertEquals(layout.entriesOf("Keuangan"), layout.moveRoute("expenses", -1).entriesOf("Keuangan"))
        assertEquals(layout.entriesOf("Keuangan"), layout.moveRoute("cash", 1).entriesOf("Keuangan"))
    }

    @Test
    fun geserTidakMengacakBagianLain() {
        val layout = MenuOrder.defaultLayout().moveRoute("products", 1)
        assertEquals(MenuOrder.defaultLayout().entriesOf("Keuangan"), layout.entriesOf("Keuangan"))
        assertEquals(MenuOrder.defaultLayout().entriesOf("Pelanggan"), layout.entriesOf("Pelanggan"))
        assertEquals(MenuOrder.defaultLayout().entriesOf("Aplikasi"), layout.entriesOf("Aplikasi"))
    }

    @Test
    fun themeDapatDipindahKeluarDariBagianAplikasi() {
        // Ini permintaan Owner: Theme Aplikasi tidak harus berada di bagian pengaturan.
        val layout = MenuOrder.defaultLayout().moveRouteToSection("theme", "Laporan")
        assertEquals("Laporan", layout.sectionOf("theme"))
        assertEquals(
            listOf("Laporan transaksi", "Laporan analitik", "Riwayat aktivitas", "Theme Aplikasi"),
            layout.entriesOf("Laporan"),
        )
        assertEquals(listOf("Akun & profil", "Riwayat versi"), layout.entriesOf("Aplikasi"))
    }

    @Test
    fun pindahKeBagianYangSamaTidakMengubahApaPun() {
        val layout = MenuOrder.defaultLayout()
        val same = layout.moveRouteToSection("theme", "Aplikasi")
        assertEquals("Aplikasi", same.sectionOf("theme"))
        assertEquals(layout.entriesOf("Aplikasi"), same.entriesOf("Aplikasi"))
    }

    @Test
    fun bagianDapatDipindahNaikDanTurun() {
        val layout = MenuOrder.defaultLayout()
        assertEquals(listOf("Keuangan", "Pekerjaan harian"), layout.moveSection("Keuangan", -1).sections.take(2))
        assertEquals(listOf("Pekerjaan harian", "Pelanggan", "Keuangan"), layout.moveSection("Keuangan", 1).sections.take(3))
    }

    @Test
    fun geserBagianMelewatiUjungTidakMengubahApaPun() {
        val layout = MenuOrder.defaultLayout()
        assertEquals(MenuOrder.sections, layout.moveSection("Pekerjaan harian", -1).sections)
        assertEquals(MenuOrder.sections, layout.moveSection("Aplikasi", 1).sections)
    }

    // --------------------------------------------------------------- susunan tersimpan

    @Test
    fun susunanTersimpanMengembalikanPilihanPengguna() {
        val layout = MenuOrder.defaultLayout().moveRouteToSection("theme", "Keuangan").moveRoute("cash", -1)
        val reloaded = MenuOrder.layoutOf(layout.storedSectionOrder(), layout.storedRouteOrder(), layout.storedSections())
        assertEquals("Keuangan", reloaded.sectionOf("theme"))
        assertEquals(listOf("Tutup kas", "Biaya operasional", "Theme Aplikasi"), reloaded.entriesOf("Keuangan"))
    }

    @Test
    fun susunanKosongJatuhKeBawaan() {
        assertTrue(MenuOrder.layoutOf(emptyList(), emptyList(), emptyMap()).isDefault())
    }

    @Test
    fun menuBaruDariPembaruanTetapMunculWalauSusunanTersimpanLama() {
        // Susunan lama hanya mengenal sebagian menu; sisanya harus ikut tampil di bagian bawaannya.
        val layout = MenuOrder.layoutOf(
            sectionOrder = listOf("Keuangan", "Pekerjaan harian"),
            routeOrder = listOf("cash", "expenses"),
            routeSection = emptyMap(),
        )
        assertEquals(listOf("Keuangan", "Pekerjaan harian"), layout.sections.take(2))
        assertEquals(
            listOf("Antrian laundry", "Service baru", "Absensi karyawan", "Daftar Aset Cabang"),
            layout.entriesOf("Pekerjaan harian"),
        )
        assertEquals("Aplikasi", layout.sectionOf("theme"))
    }

    @Test
    fun ruteDanBagianAsingDibuangTanpaMenghilangkanMenuLain() {
        val layout = MenuOrder.layoutOf(
            sectionOrder = listOf("Bagian Lama", "Keuangan"),
            routeOrder = listOf("menuLama", "cash"),
            routeSection = mapOf("menuLama" to "Bagian Lama", "theme" to "Bagian Lama"),
        )
        assertTrue("Bagian asing dibuang", "Bagian Lama" !in layout.sections)
        assertEquals("Rute asing dibuang", null, MenuOrder.specOf("menuLama"))
        assertEquals("Menu yang dipindah ke bagian asing kembali ke bagian bawaannya", "Aplikasi", layout.sectionOf("theme"))
        assertEquals(MenuOrder.allRoutes.size, layout.storedRouteOrder().size)
    }

    @Test
    fun susunanBawaanTidakDianggapSudahDiubah() {
        assertTrue(MenuOrder.defaultLayout().isDefault())
        assertFalse(MenuOrder.defaultLayout().moveSection("Keuangan", -1).isDefault())
    }
}
