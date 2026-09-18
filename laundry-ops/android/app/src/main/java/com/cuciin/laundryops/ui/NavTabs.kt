package com.cuciin.laundryops.ui

import com.cuciin.laundryops.data.Role

/**
 * Tab navigasi bawah beserta izinnya.
 *
 * Dipisah dari `CuciinNav.kt` supaya rute, label, dan aturan tampilnya dapat diuji tanpa
 * Android. Ikon tetap di layar karena butuh Compose.
 *
 * Rute yang menampilkan bar navigasi SELALU diturunkan dari daftar ini. Sebelumnya daftar itu
 * disalin ulang di layar dan "nota" tertinggal, sehingga bar menghilang hanya di layar Service.
 */
internal object NavTabs {

    class Spec(val route: String, val label: String, val module: String, val hiddenForSupervisor: Boolean = false)

    val all: List<Spec> = listOf(
        Spec("home", "Antrian", "queue"),
        Spec("nota", "Service", "service", hiddenForSupervisor = true),
        Spec("wa", "WA", "whatsapp", hiddenForSupervisor = true),
        Spec("stok", "Stok", "stock"),
        Spec("more", "Modul", ""),
    )

    /** Rute yang menampilkan bar navigasi. */
    val routes: Set<String> = all.map { it.route }.toSet()

    fun routeOf(route: String): Spec? = all.firstOrNull { it.route == route }

    /**
     * Tab yang benar-benar tampil untuk sebuah peran.
     *
     * [canAccess] menerima kunci modul; tab dengan modul kosong selalu tampil (mis. Modul).
     */
    fun visibleFor(role: String, canAccess: (String) -> Boolean): List<Spec> =
        all.filter { spec ->
            val supervisorHidden = spec.hiddenForSupervisor && role == Role.Supervisor.name
            !supervisorHidden && (spec.module.isEmpty() || canAccess(spec.module))
        }
}
