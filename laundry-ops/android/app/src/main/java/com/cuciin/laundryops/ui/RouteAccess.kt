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

    /** Rute yang tidak punya modul sendiri selalu boleh: akun, tema, dan riwayat versi. */
    private val moduleByRoute: Map<String, String> = mapOf(
        // Pekerjaan harian
        "queue" to "queue",
        "service" to "service",
        "attendance" to "attendance",
        "inventory" to "inventory",
        // Keuangan
        "expenses" to "expense",
        "cash" to "cash",
        // Pelanggan
        "customers" to "customer",
        "wa" to "whatsapp",
        "waArchive" to "whatsapp",
        // Laporan: dua menu laporan memakai modul yang sama, riwayat aktivitas modulnya sendiri.
        "analytics" to "analytics",
        "analyticsReport" to "analytics",
        "audit" to "audit",
        // Master data
        "branches" to "owner",
        "users" to "owner",
        "services" to "owner",
        "products" to "owner",
        "accessRoles" to "owner",
        "ownerSettings" to "owner",
    )

    /** Modul yang diperiksa sebuah rute, atau null bila rute itu selalu boleh. */
    fun moduleOf(route: String): String? = moduleByRoute[route]

    /** Modul katalog yang dipakai setidaknya satu rute di layar Modul. */
    val modulesInUse: Set<String> = moduleByRoute.values.toSet()
}
