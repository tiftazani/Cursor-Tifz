package com.cuciin.laundryops.ui

import com.cuciin.laundryops.data.AccessCatalog

/**
 * Pemetaan rute menu ke modul dan fungsi izin yang diperiksa.
 *
 * Dipisah dari layar supaya dapat diuji tanpa Android, dan supaya setiap modul di
 * [AccessCatalog] benar-benar diperiksa di suatu tempat.
 *
 * Sebelumnya pemetaan ini hidup di dalam fungsi layar dan dua modul tidak pernah diperiksa:
 * `analytics` dan `audit`. Akibatnya mencentang modul itu di Kontrol Akses Role tidak
 * mengubah apa pun, sementara role bawaan Supervisor yang sudah memuat `analytics` beserta
 * fungsi `analytics.view` tetap tidak bisa membuka laporan. Katalog izin menyatakan dirinya
 * sebagai satu sumber untuk layar dan pemeriksaan izin, jadi keadaan itu melanggar aturannya
 * sendiri: modul tampil di layar tetapi tidak pernah diperiksa.
 *
 * Versi 1.10.30 memecah modul `owner` menjadi `branch`, `staff`, `serviceCatalog`, `access`,
 * dan `settings`, dan memberi modul `stock` rutenya sendiri. Sebelumnya seluruh menu master
 * data berbagi satu modul, sehingga "boleh mengubah produk" tidak dapat dibedakan dari
 * "boleh menghapus cabang".
 *
 * Rute yang punya fungsi WAJIB memeriksanya, bukan hanya modulnya. Modul dan fungsi adalah dua
 * lapis: memegang modul `service` tidak berarti boleh MEMBUAT Service. Gerbang yang lebih
 * longgar dari penjaganya bukan sekadar tidak rapi: ia membuka jalan menuju kegagalan yang
 * tidak dapat dipahami pengguna.
 */
internal object RouteAccess {

    /** Modul dan fungsi yang diperiksa sebuah rute. */
    data class Gate(val module: String, val function: String? = null)

    /**
     * Rute yang tidak punya modul sendiri selalu boleh: akun, tema, dan riwayat versi.
     *
     * Fungsi yang dipakai di sini harus fungsi yang benar-benar diperiksa saat MENYIMPAN pada
     * alur utama rute itu, bukan fungsi sekunder.
     */
    private val gateByRoute: Map<String, Gate> = mapOf(
        // Pekerjaan harian
        "queue" to Gate("queue", "queue.view"),
        "service" to Gate("service", "service.create"),
        "attendance" to Gate("attendance"),
        "inventory" to Gate("inventory", "inventory.view"),
        "stok" to Gate("stock", "stock.view"),
        // Keuangan
        "expenses" to Gate("expense"),
        // Tutup kas memeriksa fungsi `cash.close`, bukan hanya modulnya: role kustom bisa
        // memegang modul `cash` tanpa fungsi itu, dan `closeCash` menolak lewat `boleh`.
        "cash" to Gate("cash", "cash.close"),
        // Pelanggan
        "customers" to Gate("customer", "customer.view"),
        "wa" to Gate("whatsapp", "whatsapp.send"),
        "waArchive" to Gate("whatsapp", "whatsapp.archive"),
        // Laporan: dua menu laporan berbagi modul, riwayat aktivitas modulnya sendiri.
        "analytics" to Gate("analytics", "analytics.view"),
        "analyticsReport" to Gate("analytics", "analytics.view"),
        "audit" to Gate("audit", "audit.view"),
        // Master data: satu modul per jenis data, supaya haknya dapat diberikan terpisah.
        "branches" to Gate("branch", "branch.manage"),
        "users" to Gate("staff", "staff.manage"),
        "services" to Gate("serviceCatalog", "serviceCatalog.manage"),
        "products" to Gate("stock", "stock.product"),
        "accessRoles" to Gate("access", "access.role"),
        "ownerSettings" to Gate("whatsapp", "whatsapp.template"),
    )

    /** Gerbang izin sebuah rute, atau null bila rute itu selalu boleh. */
    fun gateOf(route: String): Gate? = gateByRoute[route]

    /** Modul yang diperiksa sebuah rute, atau null bila rute itu selalu boleh. */
    fun moduleOf(route: String): String? = gateByRoute[route]?.module

    /** Modul katalog yang dipakai setidaknya satu rute di layar Modul. */
    val modulesInUse: Set<String> = gateByRoute.values.map { it.module }.toSet()

    /** Fungsi katalog yang diperiksa lewat gerbang rute. */
    val functionsInUse: Set<String> = gateByRoute.values.mapNotNull { it.function }.toSet()
}
