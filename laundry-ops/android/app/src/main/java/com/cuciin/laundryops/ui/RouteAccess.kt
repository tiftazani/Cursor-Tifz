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
     * Dua rute laporan memeriksa FUNGSI, bukan hanya modul. Sebelumnya keduanya hanya memeriksa
     * modul `analytics` dan `audit`, sehingga fungsi `analytics.view` dan `audit.view` di
     * katalog tidak pernah diperiksa: mencabut centangnya tidak menyembunyikan apa pun.
     */
    private val gateByRoute: Map<String, Gate> = mapOf(
        // Pekerjaan harian
        "queue" to Gate("queue"),
        "service" to Gate("service"),
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
        // Master data
        "branches" to Gate("owner"),
        "users" to Gate("owner"),
        "services" to Gate("owner"),
        "products" to Gate("owner"),
        "accessRoles" to Gate("owner"),
        "ownerSettings" to Gate("owner"),
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
