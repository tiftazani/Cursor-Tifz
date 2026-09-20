package com.cuciin.laundryops.ui

/**
 * Tab navigasi bawah beserta izinnya.
 *
 * Dipisah dari `CuciinNav.kt` supaya rute, label, dan aturan tampilnya dapat diuji tanpa
 * Android. Ikon tetap di layar karena butuh Compose.
 *
 * Rute yang menampilkan bar navigasi SELALU diturunkan dari daftar ini. Sebelumnya daftar itu
 * disalin ulang di layar dan "nota" tertinggal, sehingga bar menghilang hanya di layar Service.
 *
 * Tab diperiksa dengan MODUL dan FUNGSI, bukan nama peran. Sebelumnya ada penanda
 * `hiddenForSupervisor` yang mengunci tab dengan NAMA PERAN: Supervisor tidak melihat tab
 * Service dan WA karena namanya Supervisor, bukan karena fungsi `service.create` dan
 * `whatsapp.send` tidak dimilikinya. Akibatnya role kustom dengan bentuk izin yang sama tetap
 * melihat tab yang tidak bisa dipakainya, dan Owner tidak bisa membuka tab itu untuk SPV
 * walaupun fungsi itu dicentang. Sekarang aturannya satu: tab tampil bila fungsi utamanya
 * diizinkan, dan role bawaan Supervisor tetap tidak melihat kedua tab itu karena memang tidak
 * memegang fungsinya.
 */
internal object NavTabs {

    class Spec(val route: String, val label: String, val module: String, val function: String? = null)

    val all: List<Spec> = listOf(
        Spec("home", "Antrian", "queue", "queue.view"),
        Spec("nota", "Service", "service", "service.create"),
        Spec("wa", "WA", "whatsapp", "whatsapp.send"),
        Spec("stok", "Stok", "stock", "stock.view"),
        Spec("more", "Modul", ""),
    )

    /** Rute yang menampilkan bar navigasi. */
    val routes: Set<String> = all.map { it.route }.toSet()

    fun routeOf(route: String): Spec? = all.firstOrNull { it.route == route }

    /**
     * Tab yang benar-benar tampil.
     *
     * [canAccess] menerima kunci modul dan fungsi; tab dengan modul kosong selalu tampil (mis.
     * Modul). Tab yang punya fungsi wajib memeriksa fungsinya: memegang modul `service` tidak
     * berarti boleh MEMBUAT Service.
     */
    fun visibleFor(canAccess: (String, String?) -> Boolean): List<Spec> =
        all.filter { spec -> spec.module.isEmpty() || canAccess(spec.module, spec.function) }
}
