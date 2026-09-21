package com.cuciin.laundryops.data

/**
 * Katalog modul dan fungsi yang dapat diberikan ke sebuah role.
 *
 * Satu tempat untuk seluruh daftar: layar Kontrol Akses Role membaca katalog ini, dan
 * pemeriksaan izin memakai kunci yang sama supaya tidak ada modul yang tampil di layar
 * tetapi tidak pernah diperiksa, atau sebaliknya.
 *
 * Versi 1.10.30 memerinci katalog dari 12 modul/17 fungsi menjadi 15 modul/41 fungsi. Tiga
 * pemisahan yang paling berpengaruh:
 *
 * 1. BACA dipisah dari TULIS. Sebelumnya satu-satunya cara memberi "lihat stok" adalah
 *    memberi "ubah stok". Sekarang ada `stock.view` di samping `stock.write`.
 * 2. UBAH dipisah dari HAPUS. Menghapus lebih berisiko daripada mengubah, tetapi keduanya
 *    dulu menumpang satu centang (`service.correct` untuk koreksi DAN hapus).
 * 3. Modul `owner` dipecah menjadi `branch`, `staff`, `serviceCatalog`, dan `access`, supaya
 *    "boleh menambah user" tidak lagi menuntut "boleh mengubah cabang".
 *
 * Angka 15 modul dan 41 fungsi itu bukan tulisan bebas: keduanya adalah jumlah entri di
 * [modules] dan [allFunctionKeys], dan test penegakan membandingkannya dengan kenyataan kode
 * sehingga komentar ini tidak bisa menyimpang tanpa ada test yang gagal.
 *
 * Aturan kunci: setiap fungsi WAJIB berawalan kunci modulnya (`stock.write` milik `stock`).
 * Konvensi ini yang membuat [sanitize] aman: fungsi dari modul yang tidak dimiliki dapat
 * dibuang karena awalannya menunjukkan pemiliknya.
 */
object AccessCatalog {

    /**
     * Versi katalog. Naikkan setiap kali fungsi baru ditambahkan ke [builtInFunctionsFor].
     *
     * Dipakai [AccessCatalog] untuk menambal role bawaan yang sudah tersimpan di server TEPAT
     * SEKALI per versi. Tanpa penanda ini, fungsi yang sengaja dicabut Owner akan hidup kembali
     * setiap aplikasi dibuka.
     */
    const val VERSION: Int = 2

    data class FunctionDef(val key: String, val label: String, val detail: String)
    data class ModuleDef(val key: String, val label: String, val detail: String, val functions: List<FunctionDef>)

    private fun fn(key: String, label: String, detail: String) = FunctionDef(key, label, detail)

    val modules: List<ModuleDef> = listOf(
        ModuleDef("queue", "Antrian", "Daftar pesanan yang sedang dikerjakan", listOf(
            fn("queue.view", "Lihat antrian", "Membuka daftar pesanan dan rinciannya"),
            fn("queue.status", "Ubah status kerja", "Memindahkan pesanan antar tahap pengerjaan"),
            fn("queue.handover", "Serahkan ke pelanggan", "Menandai pesanan sudah diambil pelanggan"),
        )),
        ModuleDef("service", "Service", "Membuat dan mengoreksi transaksi", listOf(
            fn("service.create", "Buat Service", "Mencatat transaksi baru"),
            fn("service.payment", "Catat pembayaran", "Menerima pembayaran dan mengubah status bayar"),
            fn("service.price", "Ubah harga Service", "Mengganti harga layanan pada satu transaksi dari harga katalog"),
            fn("service.correct", "Koreksi Service", "Mengubah layanan dan jumlah pada transaksi yang sudah tercatat"),
            fn("service.delete", "Hapus Service", "Menghapus transaksi beserta pengembalian stoknya"),
            fn("service.correctSent", "Koreksi Service yang sudah dikirim", "Mengubah atau menghapus nota yang sudah dikirim ke pelanggan"),
        )),
        ModuleDef("customer", "Pelanggan", "Kontak pelanggan laundry", listOf(
            fn("customer.view", "Lihat pelanggan", "Membuka daftar dan rincian pelanggan"),
            fn("customer.write", "Ubah pelanggan", "Menambah dan mengubah kontak pelanggan"),
            fn("customer.delete", "Hapus pelanggan", "Menghapus kontak pelanggan"),
        )),
        ModuleDef("stock", "Produk & stok", "Katalog persediaan dan saldo cabang", listOf(
            fn("stock.view", "Lihat stok", "Membuka saldo stok dan riwayat pergerakannya"),
            fn("stock.write", "Ubah stok", "Mencatat perubahan saldo stok"),
            fn("stock.product", "Kelola produk", "Menambah dan mengubah produk pada katalog"),
            fn("stock.productDelete", "Hapus produk", "Menghapus produk dari katalog"),
        )),
        ModuleDef("inventory", "Daftar Aset Cabang", "Mesin dan peralatan operasional", listOf(
            fn("inventory.view", "Lihat aset", "Membuka daftar dan rincian aset cabang"),
            fn("inventory.write", "Ubah aset", "Mendaftarkan dan mengubah aset cabang"),
            fn("inventory.delete", "Hapus aset", "Menghapus aset cabang"),
            fn("inventory.type", "Kelola jenis aset", "Menambah, mengubah, dan menghapus jenis aset"),
        )),
        ModuleDef("attendance", "Absensi", "Jam masuk dan pulang karyawan", listOf(
            fn("attendance.self", "Absen sendiri", "Mencatat absen masuk dan pulang milik sendiri"),
            fn("attendance.view", "Lihat absensi semua", "Melihat absensi karyawan lain, bukan hanya milik sendiri"),
            fn("attendance.correct", "Koreksi absensi karyawan", "Mengubah catatan absensi milik karyawan lain"),
        )),
        ModuleDef("whatsapp", "WhatsApp", "Pengiriman nota ke pelanggan", listOf(
            fn("whatsapp.send", "Kirim WhatsApp", "Mengirim nota melalui WhatsApp"),
            fn("whatsapp.archive", "Lihat arsip WA", "Membuka riwayat pengiriman nota"),
            // Template pesan ikut modul ini karena isinya memang pesan WhatsApp yang dikirim,
            // bukan pengaturan aplikasi.
            fn("whatsapp.template", "Ubah template WA", "Mengubah pesan pembuka, isi, dan penutup nota"),
        )),
        ModuleDef("expense", "Biaya operasional", "Pengeluaran per cabang", listOf(
            fn("expense.write", "Catat biaya", "Mencatat pengeluaran baru"),
            fn("expense.delete", "Hapus biaya", "Menghapus pengeluaran yang sudah tercatat"),
        )),
        // Modul kas sengaja hanya punya satu fungsi. Rekap kas dibaca dari layar Tutup kas yang
        // sama, jadi fungsi "lihat kas" yang terpisah hanya akan menambah centang tanpa mengubah
        // apa pun. Fungsi tanpa pemeriksa dilarang: ia membuat janji Kontrol Akses Role bohong.
        ModuleDef("cash", "Kas", "Tutup kas harian per cabang", listOf(
            fn("cash.close", "Tutup kas", "Menutup kas harian"),
        )),
        ModuleDef("analytics", "Laporan", "Laporan transaksi dan analitik", listOf(
            fn("analytics.view", "Lihat laporan", "Membuka laporan dan analitik"),
            fn("analytics.export", "Ekspor laporan", "Mengunduh laporan dan mengekspor seluruh data"),
        )),
        ModuleDef("audit", "Riwayat aktivitas", "Jejak tindakan operasional", listOf(
            fn("audit.view", "Lihat riwayat", "Membuka riwayat aktivitas"),
        )),
        ModuleDef("branch", "Cabang", "Lokasi usaha dan peta cabang", listOf(
            fn("branch.manage", "Kelola cabang", "Menambah dan mengubah cabang beserta lokasinya"),
            fn("branch.delete", "Hapus cabang", "Menghapus cabang"),
        )),
        ModuleDef("staff", "Daftar User", "Akun karyawan dan perannya", listOf(
            fn("staff.manage", "Kelola user", "Menambah dan mengubah akun karyawan"),
            fn("staff.approve", "Setujui pendaftar", "Menyetujui atau menolak akun yang mendaftar sendiri"),
            fn("staff.delete", "Hapus user", "Menghapus akun karyawan"),
        )),
        ModuleDef("serviceCatalog", "Layanan & harga", "Katalog layanan dan tarifnya", listOf(
            fn("serviceCatalog.manage", "Kelola layanan", "Menambah dan mengubah layanan beserta tarifnya"),
            fn("serviceCatalog.delete", "Hapus layanan", "Menghapus layanan dari katalog"),
        )),
        ModuleDef("access", "Kontrol Akses", "Role dan hak aksesnya", listOf(
            fn("access.role", "Atur role", "Menambah, mengubah, dan menghapus role beserta haknya"),
            fn("access.assign", "Tetapkan role user", "Memilih role yang melekat pada seorang pengguna"),
        )),
    )

    val moduleKeys: Set<String> = modules.map { it.key }.toSet()

    /**
     * Fungsi yang SERVER tolak untuk siapa pun selain Owner.
     *
     * Bukan sekadar nilai bawaan: Worker memeriksa daftar ini di `commandPermission` dan menolak
     * commandnya dengan alasan "owner". Mencentang fungsi ini untuk role lain hanya menghasilkan
     * penolakan sinkronisasi yang tidak dapat dipahami pengguna, jadi layar Kontrol Akses Role
     * menandainya dan tidak mengizinkannya dicentang.
     *
     * Daftar ini harus mengikuti `OWNER_ONLY` dan daftar perintah khusus Owner di
     * `cloudflare/src/command-sync.ts`. Test [AccessPresetTest] mengunci kecocokannya.
     */
    val ownerLocked: Set<String> = setOf(
        "branch.manage", "branch.delete",
        "staff.manage", "staff.delete",
        "serviceCatalog.manage", "serviceCatalog.delete",
        "stock.product", "stock.productDelete",
        "inventory.type",
        "service.delete",
        "customer.delete",
        "attendance.correct",
        "access.role", "access.assign",
        "whatsapp.template",
    )

    /**
     * Fungsi yang secara bawaan hanya boleh dilakukan Owner.
     *
     * Dipakai untuk menyembunyikan tombolnya di layar, dan menolak perubahannya di store
     * walaupun tombolnya berhasil ditekan. Owner tetap boleh memberikan fungsi ini ke role lain
     * lewat Kontrol Akses Role; daftar ini hanya nilai bawaan, bukan larangan keras.
     *
     * Isinya = [ownerLocked] ditambah fungsi yang memang berisiko tinggi tetapi server masih
     * mengizinkannya untuk peran lain (hapus pelanggan, hapus biaya, hapus aset, ekspor data).
     */
    val ownerOnlyByDefault: Set<String> = ownerLocked + setOf(
        // Server masih mengizinkan peran lain melakukan ini, jadi centangnya sah walau bawaannya
        // hanya Owner.
        "service.price",
        "expense.delete",
        "inventory.delete",
        "analytics.export",
    )

    /** Modul yang memuat sebuah fungsi, atau null bila fungsinya tidak dikenal. */
    fun moduleOf(function: String): String? =
        modules.firstOrNull { module -> module.functions.any { it.key == function } }?.key

    // ------------------------------------------------- kompatibilitas kunci lama

    /**
     * Modul lama yang dipecah pada versi 1.10.30, dipetakan ke modul penggantinya.
     *
     * Role tersimpan di server masih memakai kunci lama sampai perangkat yang memegangnya
     * tersinkron. APK 1.10.29 yang masih dipakai cabang juga menulis kunci lama. Peta ini yang
     * membuat keduanya tetap hidup, jadi JANGAN dihapus sebelum semua perangkat pindah.
     */
    private val modulLama: Set<String> = setOf("owner")

    /**
     * Fungsi lama yang dipecah, dipetakan ke fungsi penggantinya.
     *
     * `owner.manage` adalah kunci paling berpengaruh di sini: ia dulu menaungi cabang, user,
     * layanan, produk, jenis aset, dan template WA sekaligus. Tanpa peta ini, role yang sudah
     * tersimpan dengan `owner.manage` kehilangan seluruh akses master data pada pembaruan.
     */
    private val fungsiLama: Map<String, Set<String>> = mapOf(
        "owner.manage" to setOf(
            "branch.manage", "staff.manage", "serviceCatalog.manage",
            "stock.product", "inventory.type", "whatsapp.template",
        ),
        "owner.access" to setOf("access.role", "access.assign"),
        "attendance.write" to setOf("attendance.self"),
    )

    /**
     * Menerjemahkan modul dan fungsi dari versi katalog lama ke kunci versi sekarang.
     *
     * Hasilnya digabung dengan kunci yang sudah berbentuk baru, lalu disaring [sanitize]. Dipakai
     * saat membaca role dari server, bukan saat menyimpannya: role yang sudah diterjemahkan
     * ditulis ulang dalam bentuk baru pada sinkronisasi berikutnya.
     */
    fun migrate(modules: Set<String>, functions: Set<String>): Pair<Set<String>, Set<String>> {
        val fungsiBaru = functions.flatMap { fungsiLama[it] ?: setOf(it) }.toSet()
        // Modul lama `owner` tidak punya padanan tunggal, jadi modul penggantinya diturunkan dari
        // FUNGSI LAMA yang benar-benar dimiliki role. Hanya fungsi lama yang menambah modul:
        // role yang modulnya sudah dikosongkan Owner harus tetap kosong, bukan hidup lagi karena
        // fungsinya masih tersimpan.
        val modulDariFungsiLama = functions
            .filter { it in fungsiLama }
            .flatMap { fungsiLama.getValue(it) }
            .mapNotNull { moduleOf(it) }
        val modulBaru = modules.filterNot { it in modulLama }.toSet() + modulDariFungsiLama
        return sanitize(modulBaru, fungsiBaru)
    }

    /** Apakah ada kunci lama yang perlu ditulis ulang. Dipakai untuk memutuskan perlu-tidaknya simpan. */
    fun hasLegacyKeys(modules: Set<String>, functions: Set<String>): Boolean =
        modules.any { it in modulLama } || functions.any { it in fungsiLama }

    /**
     * Kelompok fungsi baru beserta kunci lama yang mewakilinya, dipakai untuk menulis CERMIN.
     *
     * Cermin dibutuhkan selama APK 1.10.29 masih dipakai cabang: perangkat itu hanya mengenal
     * kunci lama, dan `sanitize()` di sana MEMBUANG kunci yang tidak dikenal. Role yang disimpan
     * dalam bentuk kunci baru saja akan tampil sebagai centang KOSONG di perangkat lama, dan
     * aksesnya hilang.
     *
     * Cermin ditambahkan hanya bila SELURUH anggota kelompok dimiliki. Role yang dipotong
     * sebagian (mis. hanya boleh kelola cabang) tidak mendapat cermin `owner.manage`, karena
     * perangkat lama tidak bisa menyatakan "hanya cabang": memberinya cermin berarti MELEBARKAN
     * haknya ke user, layanan, produk, dan template WA sekaligus. Kehilangan akses di perangkat
     * lama lebih dapat diterima daripada penambahan hak yang tidak diminta.
     */
    private val kelompokLama: Map<String, Set<String>> = mapOf(
        "owner.manage" to setOf(
            "branch.manage", "staff.manage", "serviceCatalog.manage",
            "stock.product", "inventory.type", "whatsapp.template",
        ),
        "owner.access" to setOf("access.role", "access.assign"),
        "attendance.write" to setOf("attendance.self"),
    )

    /**
     * Menambahkan cermin kunci lama ke kunci baru sebelum role disimpan.
     *
     * Dipanggil SESUDAH [sanitize], karena kunci lama memang tidak ada di katalog sekarang dan
     * akan dibuang oleh sanitasi. Saat dibaca kembali, [migrate] menerjemahkan cermin itu ke kunci
     * baru yang sudah ada, jadi hasilnya tidak berganda.
     *
     * Utang teknis: hapus fungsi ini beserta [fungsiLama] setelah seluruh cabang memakai 1.10.30.
     */
    fun withLegacyMirror(modules: Set<String>, functions: Set<String>): Pair<Set<String>, Set<String>> {
        val cermin = kelompokLama.filterValues { asal -> asal.all { it in functions } }.keys
        if (cermin.isEmpty()) return modules to functions
        val modulCermin = cermin.filter { it.startsWith("owner.") }.map { "owner" }.toSet()
        return (modules + modulCermin) to (functions + cermin)
    }

    /**
     * Fungsi BACA yang baru muncul dari pemisahan baca/tulis, beserta modul yang dulu membukanya.
     *
     * Sebelum 1.10.30 gerbang rute hanya memeriksa MODUL, jadi memegang modul `queue` sudah cukup
     * untuk membuka layar Antrian. Versi ini menuntut fungsi `queue.view`. Tanpa pemberian ini,
     * role yang sudah tersimpan kehilangan hak BACA yang tadinya dimilikinya: sapuan perangkat
     * menunjukkan Kasir turun dari 11 menu menjadi 3.
     *
     * `attendance.view` sengaja TIDAK ada di sini. Dulu modul `attendance` hanya membuka absensi
     * MILIK SENDIRI bagi non-Owner, jadi memberinya sekarang akan MELEBARKAN haknya menjadi boleh
     * melihat absensi karyawan lain.
     */
    private val bacaDariModul: Map<String, String> = mapOf(
        "queue" to "queue.view",
        "customer" to "customer.view",
        "stock" to "stock.view",
        "inventory" to "inventory.view",
        "whatsapp" to "whatsapp.archive",
    )

    /**
     * Menaikkan role dari format katalog lama ke format sekarang, SEKALI per [VERSION].
     *
     * Isinya HANYA dua hal: menerjemahkan kunci lama ([migrate]) dan mengembalikan hak BACA yang
     * dulu diberikan modul saja ([bacaDariModul]). Keduanya mengembalikan hak yang SUDAH dimiliki
     * role sebelum versi ini, jadi tidak ada hak baru yang muncul.
     *
     * Preset peran SENGAJA tidak ditambal di sini. Preset adalah titik awal saat Owner menyiapkan
     * role, bukan sumber hak: menambalnya ke role yang sudah ada akan memberi Kasir hak koreksi
     * Service dan hapus biaya yang belum pernah diberikan Owner. Pelebaran hak yang tidak diminta
     * lebih berbahaya daripada fungsi baru yang belum aktif.
     *
     * Penanda [AccessRole.catalogVersion] membuat semuanya hanya terjadi sekali: role yang sudah
     * disimpan Owner pada versi ini dikembalikan apa adanya, jadi centang yang sengaja dicabut
     * tidak hidup kembali.
     */
    fun upgrade(role: AccessRole): AccessRole {
        if (role.catalogVersion >= VERSION) return role
        // Role bawaan Owner selalu penuh. Catatan role-nya bisa tertinggal dari katalog (produksi
        // tercatat 16 fungsi dari 17 sebelum versi ini), dan kalau catatan itu yang ditampilkan
        // di layar Kontrol Akses Role, Owner melihat centangnya tidak penuh padahal haknya penuh.
        if (role.id == "role-owner") {
            return role.copy(modules = moduleKeys, functions = allFunctionKeys(), catalogVersion = VERSION)
        }
        val (modulBaru, fungsiBaru) = migrate(role.modules, role.functions)
        val bacaTambahan = modulBaru.mapNotNull { bacaDariModul[it] }
        return role.copy(
            modules = modulBaru,
            functions = fungsiBaru + bacaTambahan,
            catalogVersion = VERSION,
        )
    }

    /**
     * Modul dan fungsi yang berlaku untuk role ini SESUDAH kunci lama diterjemahkan.
     *
     * Dipakai untuk menghitung tampilan. Tanpa terjemahan ini, cermin kunci lama yang ditulis
     * [withLegacyMirror] ikut terhitung sebagai fungsi, sehingga role dengan 9 fungsi tampil
     * "10 fungsi" dan angka di kartu role tidak cocok dengan centang di dalamnya.
     */
    fun berlaku(role: AccessRole): Pair<Set<String>, Set<String>> =
        if (role.id == "role-owner") moduleKeys to allFunctionKeys() else migrate(role.modules, role.functions)

    fun functionsOf(module: String): List<FunctionDef> = modules.firstOrNull { it.key == module }?.functions.orEmpty()

    fun allFunctionKeys(): Set<String> = modules.flatMap { it.functions }.map { it.key }.toSet()

    fun moduleLabel(key: String): String = modules.firstOrNull { it.key == key }?.label ?: key

    fun functionLabel(key: String): String =
        modules.flatMap { it.functions }.firstOrNull { it.key == key }?.label ?: key

    /** Hanya fungsi yang modulnya juga dipilih; fungsi tanpa modul tidak berarti apa pun. */
    fun sanitize(modules: Set<String>, functions: Set<String>): Pair<Set<String>, Set<String>> {
        val keptModules = modules.intersect(moduleKeys)
        val allowedFunctions = keptModules.flatMap { functionsOf(it) }.map { it.key }.toSet()
        return keptModules to functions.intersect(allowedFunctions)
    }

    /** Semua fungsi dari modul-modul tertentu. Dipakai preset peran dan preset "hanya lihat". */
    fun functionsIn(modules: Set<String>): Set<String> = modules.flatMap { functionsOf(it) }.map { it.key }.toSet()

    // ---------------------------------------------------------------- preset peran

    /**
     * Preset peran: susunan modul dan fungsi yang bisa diterapkan sekali tekan di layar
     * Kontrol Akses Role.
     *
     * Preset adalah titik AWAL, bukan larangan. Setelah diterapkan, Owner tetap bebas
     * mencentang atau mencabut satu per satu; preset hanya menghemat puluhan ketukan saat
     * menyiapkan role baru.
     */
    data class Preset(
        val key: String,
        val label: String,
        val detail: String,
        val modules: Set<String>,
        val functions: Set<String>,
    )

    /** Modul yang dibaca saja: semua fungsi `*.view` beserta fungsi baca lain. */
    private val readOnlyFunctions: Set<String> = setOf(
        "queue.view", "customer.view", "stock.view", "inventory.view",
        "attendance.self", "attendance.view", "whatsapp.archive",
        "analytics.view", "audit.view",
    )

    private val supervisorModules: Set<String> =
        setOf("queue", "service", "stock", "inventory", "attendance", "analytics")

    private val supervisorFunctions: Set<String> = setOf(
        "queue.view", "queue.status", "queue.handover",
        "stock.view", "stock.write",
        "inventory.view", "inventory.write",
        "attendance.self", "attendance.view",
        "analytics.view",
    )

    private val kasirModules: Set<String> =
        setOf("queue", "service", "customer", "stock", "attendance", "whatsapp", "expense", "cash")

    private val kasirFunctions: Set<String> = setOf(
        "queue.view", "queue.status", "queue.handover",
        "service.create", "service.payment", "service.correct",
        "customer.view", "customer.write",
        "stock.view", "stock.write",
        "attendance.self",
        "whatsapp.send", "whatsapp.archive",
        "expense.write", "expense.delete",
        "cash.close",
    )

    val presets: List<Preset> = listOf(
        Preset(
            key = "owner",
            label = "Owner (penuh)",
            detail = "Seluruh ${modules.size} modul dan ${allFunctionKeys().size} fungsi",
            modules = moduleKeys,
            functions = allFunctionKeys(),
        ),
        Preset("supervisor", "Supervisor", "Kerja harian cabang tanpa transaksi dan keuangan", supervisorModules, supervisorFunctions),
        Preset("kasir", "Kasir", "Melayani pelanggan, mencatat transaksi, dan menutup kas", kasirModules, kasirFunctions),
        Preset(
            key = "viewer",
            label = "Hanya lihat",
            detail = "Membaca laporan dan daftar, tanpa hak mengubah apa pun",
            modules = readOnlyFunctions.mapNotNull { moduleOf(it) }.toSet(),
            functions = readOnlyFunctions,
        ),
        Preset("kosong", "Kosongkan", "Cabut semua modul dan fungsi", emptySet(), emptySet()),
    )

    /**
     * Fungsi yang ditambahkan otomatis ke role bawaan tertentu pada versi katalog ini.
     *
     * Dipakai untuk menambal role bawaan yang sudah tersimpan di server: isinya dibekukan saat
     * pertama dibuat, sehingga fungsi yang baru muncul di katalog tidak akan pernah masuk
     * tanpa daftar ini. Owner sendiri tidak perlu ditambal karena selalu dianggap penuh.
     *
     * Hanya berlaku sampai [VERSION] tercatat di role itu, supaya fungsi yang sengaja dicabut
     * Owner tidak hidup kembali.
     */
    fun builtInFunctionsFor(roleId: String): Set<String> = when (roleId) {
        "role-kasir" -> kasirFunctions
        "role-supervisor" -> supervisorFunctions
        else -> emptySet()
    }

    /**
     * Menambal satu role bawaan dengan fungsi baru dari katalog versi ini.
     *
     * Penambalan hanya terjadi SEKALI per [VERSION], ditandai [AccessRole.catalogVersion]. Tanpa
     * penanda itu, penambal tidak dapat membedakan fungsi yang "belum pernah ada" dari fungsi yang
     * "sengaja dicabut Owner", sehingga centang yang dicabut akan hidup kembali setiap aplikasi
     * dibuka. Hanya fungsi yang belum ada DAN modulnya sudah dimiliki yang ditambahkan.
     *
     * Mengembalikan role apa adanya bila tidak ada yang perlu ditambal.
     */
    fun patchBuiltIn(role: AccessRole): AccessRole {
        if (role.catalogVersion >= VERSION) return role
        val tambahan = builtInFunctionsFor(role.id).filter { fn ->
            fn !in role.functions && moduleOf(fn) in role.modules
        }
        return role.copy(functions = role.functions + tambahan, catalogVersion = VERSION)
    }

    /** Role bawaan yang selalu tersedia dan tidak dapat dihapus. */
    fun builtInRoles(): List<AccessRole> = listOf(
        AccessRole(
            id = "role-owner",
            name = "Owner",
            builtIn = true,
            modules = moduleKeys,
            functions = allFunctionKeys(),
            catalogVersion = VERSION,
        ),
        AccessRole(
            id = "role-supervisor",
            name = "Supervisor",
            builtIn = true,
            modules = supervisorModules,
            functions = supervisorFunctions,
            catalogVersion = VERSION,
        ),
        AccessRole(
            id = "role-kasir",
            name = "Kasir",
            builtIn = true,
            modules = kasirModules,
            functions = kasirFunctions,
            catalogVersion = VERSION,
        ),
    )

    /** Role bawaan yang cocok dengan peran lama, dipakai saat migrasi data. */
    fun builtInIdFor(role: Role): String = when (role) {
        Role.Owner -> "role-owner"
        Role.Supervisor -> "role-supervisor"
        Role.Kasir -> "role-kasir"
    }
}
