package com.cuciin.laundryops.ui

import com.cuciin.laundryops.data.AccessCatalog

/**
 * Pemetaan rute menu ke modul izin yang diperiksa.
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
 * Modul `stock` tidak ada di sini karena diperiksa lewat katalog tab di [NavTabs].
 */
internal object RouteAccess {

    /** Modul dan fungsi yang diperiksa sebuah rute. */
    data class Gate(val module: String, val function: String? = null)

    /**
     * Rute yang tidak punya modul sendiri selalu boleh: akun, tema, dan riwayat versi.
     *
     * Rute yang punya fungsi WAJIB memeriksanya, bukan hanya modulnya. Modul dan fungsi adalah
     * dua lapis: memegang modul `service` tidak berarti boleh MEMBUAT Service. Sebelumnya rute
     * "Service baru" hanya memeriksa modul `service`, sedangkan `saveNota` memeriksa fungsi
     * `service.create`. Role kustom yang dicentang modul `service` tanpa fungsi `service.create`
     * melihat menunya, mengisi formulirnya, lalu aplikasi MATI saat menekan Simpan karena
     * `saveNota` memakai `require`. Gerbang yang lebih longgar dari penjaganya bukan sekadar
     * tidak rapi: ia membuka jalan menuju kegagalan yang tidak dapat dipahami pengguna.
     *
     * Fungsi yang dipakai di sini harus fungsi yang benar-benar diperiksa saat MENYIMPAN pada
     * alur utama rute itu, bukan fungsi sekunder.
     */
    private val gateByRoute: Map<String, Gate> = mapOf(
        // Pekerjaan harian
        "queue" to Gate("queue"),
        "service" to Gate("service", "service.create"),
        "attendance" to Gate("attendance"),
        "inventory" to Gate("inventory"),
        // Keuangan
        "expenses" to Gate("expense"),
        "cash" to Gate("cash"),
        // Pelanggan
        "customers" to Gate("customer"),
        "wa" to Gate("whatsapp"),
        "waArchive" to Gate("whatsapp"),
        // Laporan: dua menu laporan berbagi modul, riwayat aktivitas modulnya sendiri.
        "analytics" to Gate("analytics", "analytics.view"),
        "analyticsReport" to Gate("analytics", "analytics.view"),
        "audit" to Gate("audit", "audit.view"),
        // Master data: seluruh menu di sini menulis data induk, dan store memeriksa owner.manage
        // untuk menambah, mengubah, maupun menghapus. Memeriksa modul saja tidak cukup: role
        // kustom bisa saja diberi modul `owner` tanpa fungsi `owner.manage`.
        "branches" to Gate("owner", "owner.manage"),
        "users" to Gate("owner", "owner.manage"),
        "services" to Gate("owner", "owner.manage"),
        "products" to Gate("owner", "owner.manage"),
        "accessRoles" to Gate("owner", "owner.access"),
        "ownerSettings" to Gate("owner", "owner.manage"),
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
