package com.cuciin.laundryops.ui

/**
 * Susunan menu layar Modul.
 *
 * Sebelumnya menu dirakit sebagai satu daftar lalu dikelompokkan ulang memakai `setOf`,
 * sehingga urutan isinya mengikuti urutan penambahan dan beberapa menu jatuh ke bagian yang
 * keliru: "Theme Aplikasi" dan "Riwayat versi" ikut masuk ke bagian laporan.
 *
 * Berkas ini memegang dua hal:
 *
 * 1. [catalog], katalog menu bawaan: rute, label, ikon, ringkasan, dan bagian asalnya.
 * 2. [MenuLayout], susunan yang benar-benar dipakai layar, yang boleh diubah pengguna.
 *
 * Keduanya murni tanpa Compose dan tanpa Android supaya urutannya bisa diperiksa unit test.
 * Ikon dan ringkasan disimpan sebagai nama; layar yang memetakannya ke ikon sungguhan.
 */
internal object MenuOrder {

    /** Bagian pengaturan aplikasi di HP ini, bukan laporan operasional. */
    const val APPLICATION_SECTION = "Aplikasi"

    class Spec(val route: String, val label: String, val section: String, val icon: String, val summary: String)

    private const val DAILY = "Pekerjaan harian"
    private const val MONEY = "Keuangan"
    private const val PEOPLE = "Pelanggan"
    private const val REPORTS = "Laporan"
    private const val MASTER = "Master data"

    /**
     * Urutan bagian bawaan, dari yang paling sering dipakai sampai pengaturan.
     * Urutan ini boleh diubah pengguna lewat layar Atur urutan menu.
     */
    val sections: List<String> = listOf(DAILY, MONEY, PEOPLE, REPORTS, MASTER, APPLICATION_SECTION)

    /** Label menu bagian Aplikasi, berurutan. Dipakai test dan layar Atur urutan menu. */
    val applicationEntries: List<String> = listOf("Akun & profil", "Theme Aplikasi", "Riwayat versi")

    /**
     * Katalog menu dalam urutan bawaan.
     *
     * Urutan di dalam tiap bagian juga disengaja: mengikuti alur kerja, bukan abjad.
     */
    val catalog: List<Spec> = listOf(
        // Pekerjaan harian: yang paling sering dibuka saat melayani pelanggan.
        Spec("queue", "Antrian laundry", DAILY, "ListAlt", "Pesanan yang sedang dikerjakan"),
        Spec("service", "Service baru", DAILY, "AddCircleOutline", "Membuat nota transaksi"),
        Spec("attendance", "Absensi karyawan", DAILY, "Fingerprint", "Jam masuk dan pulang per cabang"),
        Spec("inventory", "Daftar Aset Cabang", DAILY, "PrecisionManufacturing", "Mesin, alat, dan barang"),

        // Keuangan: pengeluaran lebih dulu karena dicatat harian, tutup kas di akhir giliran.
        Spec("expenses", "Biaya operasional", MONEY, "ReceiptLong", "Pengeluaran per cabang"),
        Spec("cash", "Tutup kas", MONEY, "AccountBalanceWallet", "Rekap akhir giliran"),

        // Pelanggan: kontak dulu, baru pengiriman nota.
        Spec("customers", "Pelanggan", PEOPLE, "PeopleOutline", "Kontak pelanggan"),
        Spec("wa", "WA menunggu", PEOPLE, "ScheduleSend", "Nota yang menunggu dikirim"),
        Spec("waArchive", "Arsip WA", PEOPLE, "Forum", "Riwayat pengiriman nota"),

        // Laporan: ringkasan transaksi dulu, lalu analitik, jejak audit paling bawah.
        Spec("analytics", "Laporan transaksi", REPORTS, "BarChart", "Periode, rincian, dan keuangan"),
        Spec("analyticsReport", "Laporan analitik", REPORTS, "Insights", "Tren, komposisi, dan kasir"),
        Spec("audit", "Riwayat aktivitas", REPORTS, "History", "Jejak perubahan data"),

        // Master data: referensi yang dipakai menu lain, lalu hak akses, terakhir pengaturan.
        Spec("branches", "Cabang", MASTER, "Storefront", "Lokasi dan tim cabang"),
        Spec("users", "Daftar User", MASTER, "Badge", "Peran dan persetujuan"),
        Spec("services", "Layanan & harga", MASTER, "LocalLaundryService", "Layanan dan tarif"),
        Spec("products", "Produk stok", MASTER, "Inventory2", "Katalog persediaan"),
        Spec("accessRoles", "Kontrol Akses Role", MASTER, "AdminPanelSettings", "Role, modul, dan fungsi tiap pengguna"),
        Spec("ownerSettings", "Pengaturan Owner", MASTER, "Settings", "Pesan WhatsApp operasional"),

        // Aplikasi: pengaturan yang hanya berlaku di HP ini.
        Spec("profil", "Akun & profil", APPLICATION_SECTION, "AccountCircle", "Informasi akun dan kata sandi"),
        Spec("theme", "Theme Aplikasi", APPLICATION_SECTION, "Colorize", "Light, Dark, dan warna custom"),
        Spec("versions", "Riwayat versi", APPLICATION_SECTION, "Info", "Pembaruan Cuciin"),
    )

    val allRoutes: List<String> = catalog.map { it.route }

    /**
     * Rute menu ke rute yang benar-benar terdaftar di graf navigasi.
     *
     * Sebagian menu memakai nama yang berbeda dari rutenya, karena rute itu dipakai bersama
     * tab bawah. Contoh: "Antrian laundry" adalah tab `home`, dan "Service baru" adalah `nota`
     * yang juga menerima argumen saat dibuka dari daftar antrian.
     *
     * Sebelumnya katalog mengirim nama menunya sendiri, dan `nav.navigate("queue")` melempar
     * `IllegalArgumentException` sehingga aplikasi langsung keluar saat menu itu diklik.
     */
    private val routeTargets: Map<String, String> = mapOf(
        "queue" to "home",
        "service" to "nota",
    )

    /** Rute graf untuk sebuah menu. Menu yang tidak dipetakan memakai namanya sendiri. */
    fun destinationOf(route: String): String = routeTargets[route] ?: route

    fun specOf(route: String): Spec? = catalog.firstOrNull { it.route == route }

    /** Susunan bawaan, sebelum pengguna mengubah apa pun. */
    fun defaultLayout(): MenuLayout = MenuLayout(sections, allRoutes, emptyMap())

    /** Susunan dari preferensi tersimpan, dirapikan terhadap katalog yang ada sekarang. */
    fun layoutOf(sectionOrder: List<String>, routeOrder: List<String>, routeSection: Map<String, String>): MenuLayout =
        MenuLayout(sectionOrder, routeOrder, routeSection)
}

/**
 * Susunan menu yang sedang berlaku.
 *
 * Menyimpan tiga hal: urutan bagian, urutan menu, dan bagian tempat setiap menu berada.
 * Bagian disimpan terpisah dari urutan supaya memindahkan menu ke bagian lain tidak
 * mengacak urutan menu lainnya.
 *
 * Selalu dirapikan terhadap katalog: rute yang tidak dikenal dibuang, bagian yang tidak
 * dikenal dibuang, dan menu yang belum ada di susunan tersimpan (misalnya menu baru dari
 * pembaruan aplikasi) ditempatkan di akhir bagian bawaannya. Dengan begitu susunan lama
 * tetap jalan setelah aplikasi diperbarui.
 */
internal class MenuLayout(
    sectionOrder: List<String>,
    routeOrder: List<String>,
    private val routeSection: Map<String, String>,
) {
    val sections: List<String> = buildList {
        sectionOrder.filter { it in MenuOrder.sections }.forEach { add(it) }
        MenuOrder.sections.forEach { if (it !in this) add(it) }
    }

    private val routes: List<String> = buildList {
        routeOrder.filter { MenuOrder.specOf(it) != null }.forEach { add(it) }
        MenuOrder.allRoutes.forEach { if (it !in this) add(it) }
    }

    /** Bagian tempat sebuah menu berada: pilihan pengguna, atau bagian bawaannya. */
    fun sectionOf(route: String): String? {
        val spec = MenuOrder.specOf(route) ?: return null
        val picked = routeSection[route]
        return if (picked != null && picked in MenuOrder.sections) picked else spec.section
    }

    /** Bagian yang tampil, lengkap dengan isinya, tanpa menu yang tidak diizinkan. */
    fun render(allowed: (String) -> Boolean): List<Pair<String, List<MenuOrder.Spec>>> =
        sections.map { section ->
            section to routes
                .filter { sectionOf(it) == section }
                .mapNotNull { MenuOrder.specOf(it) }
                .filter { allowed(it.route) }
        }.filter { it.second.isNotEmpty() }

    /** Menu dalam satu bagian, berurutan. Dipakai test. */
    fun entriesOf(section: String): List<String> =
        routes.filter { sectionOf(it) == section }.mapNotNull { MenuOrder.specOf(it)?.label }

    fun isDefault(): Boolean =
        sections == MenuOrder.sections && routes == MenuOrder.allRoutes && routeSection.isEmpty()

    /** Memindahkan satu menu satu langkah di dalam bagiannya. */
    fun moveRoute(route: String, delta: Int): MenuLayout {
        val section = sectionOf(route) ?: return this
        val inSection = routes.filter { sectionOf(it) == section }
        val index = inSection.indexOf(route)
        val target = index + delta
        if (index < 0 || target < 0 || target >= inSection.size) return this
        val reordered = inSection.toMutableList().apply { add(target, removeAt(index)) }
        var cursor = 0
        val next = routes.map { if (sectionOf(it) == section) reordered[cursor++] else it }
        return MenuLayout(sections, next, routeSection)
    }

    /** Memindahkan satu menu ke bagian lain, di akhir bagian tujuan. */
    fun moveRouteToSection(route: String, section: String): MenuLayout {
        if (section !in MenuOrder.sections) return this
        if (sectionOf(route) == section) return this
        return MenuLayout(sections, routes, routeSection + (route to section))
    }

    /** Memindahkan satu bagian satu langkah. */
    fun moveSection(section: String, delta: Int): MenuLayout {
        val index = sections.indexOf(section)
        val target = index + delta
        if (index < 0 || target < 0 || target >= sections.size) return this
        val next = sections.toMutableList().apply { add(target, removeAt(index)) }
        return MenuLayout(next, routes, routeSection)
    }

    /** Susunan tersimpan, dipakai lapisan penyimpanan preferensi. */
    fun storedSectionOrder(): List<String> = sections

    fun storedRouteOrder(): List<String> = routes

    fun storedSections(): Map<String, String> = routeSection
}
