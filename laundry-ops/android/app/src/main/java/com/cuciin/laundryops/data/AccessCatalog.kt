package com.cuciin.laundryops.data

/**
 * Katalog modul dan fungsi yang dapat diberikan ke sebuah role.
 *
 * Satu tempat untuk seluruh daftar: layar Kontrol Akses Role membaca katalog ini, dan
 * pemeriksaan izin memakai kunci yang sama supaya tidak ada modul yang tampil di layar
 * tetapi tidak pernah diperiksa, atau sebaliknya.
 */
object AccessCatalog {
    data class FunctionDef(val key: String, val label: String, val detail: String)
    data class ModuleDef(val key: String, val label: String, val detail: String, val functions: List<FunctionDef>)

    val modules: List<ModuleDef> = listOf(
        ModuleDef("queue", "Antrian", "Daftar pesanan yang sedang dikerjakan", listOf(
            FunctionDef("queue.status", "Ubah status kerja", "Memindahkan pesanan antar tahap pengerjaan"),
            FunctionDef("queue.handover", "Serahkan ke pelanggan", "Menandai pesanan sudah diambil pelanggan"),
        )),
        ModuleDef("service", "Service", "Membuat dan mengoreksi transaksi", listOf(
            FunctionDef("service.create", "Buat Service", "Mencatat transaksi baru"),
            FunctionDef("service.correct", "Koreksi Service", "Mengubah atau menghapus transaksi"),
            FunctionDef("service.payment", "Catat pembayaran", "Menerima pembayaran dan mengubah status bayar"),
        )),
        ModuleDef("customer", "Pelanggan", "Kontak pelanggan laundry", listOf(
            FunctionDef("customer.write", "Ubah pelanggan", "Menambah dan mengubah kontak pelanggan"),
        )),
        ModuleDef("stock", "Produk & stok", "Katalog persediaan dan saldo cabang", listOf(
            FunctionDef("stock.write", "Ubah stok", "Mencatat perubahan saldo stok"),
        )),
        ModuleDef("inventory", "Daftar Aset Cabang", "Mesin dan peralatan operasional", listOf(
            FunctionDef("inventory.write", "Ubah aset", "Mendaftarkan dan mengubah aset cabang"),
        )),
        ModuleDef("attendance", "Absensi", "Jam masuk dan pulang karyawan", listOf(
            FunctionDef("attendance.write", "Absen", "Mencatat absen masuk dan pulang"),
        )),
        ModuleDef("whatsapp", "WhatsApp", "Pengiriman nota ke pelanggan", listOf(
            FunctionDef("whatsapp.send", "Kirim WhatsApp", "Mengirim nota melalui WhatsApp"),
        )),
        ModuleDef("expense", "Biaya operasional", "Pengeluaran per cabang", listOf(
            FunctionDef("expense.write", "Catat biaya", "Menambah dan menghapus biaya"),
        )),
        ModuleDef("cash", "Kas", "Tutup kas harian per cabang", listOf(
            FunctionDef("cash.close", "Tutup kas", "Menutup kas harian"),
        )),
        ModuleDef("owner", "Master data & pengaturan", "Cabang, user, layanan, produk, dan pengaturan", listOf(
            FunctionDef("owner.manage", "Kelola master data", "Menambah dan mengubah data induk"),
            FunctionDef("owner.access", "Kontrol akses role", "Mengatur role dan hak aksesnya"),
        )),
        ModuleDef("analytics", "Laporan", "Laporan transaksi dan analitik", listOf(
            FunctionDef("analytics.view", "Lihat laporan", "Membuka laporan dan mengekspornya"),
        )),
        ModuleDef("audit", "Riwayat aktivitas", "Jejak tindakan operasional", listOf(
            FunctionDef("audit.view", "Lihat riwayat", "Membuka riwayat aktivitas"),
        )),
    )

    val moduleKeys: Set<String> = modules.map { it.key }.toSet()

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

    /** Role bawaan yang selalu tersedia dan tidak dapat dihapus. */
    fun builtInRoles(): List<AccessRole> = listOf(
        AccessRole(
            id = "role-owner",
            name = "Owner",
            builtIn = true,
            modules = moduleKeys,
            functions = allFunctionKeys(),
        ),
        AccessRole(
            id = "role-supervisor",
            name = "Supervisor",
            builtIn = true,
            modules = setOf("queue", "service", "stock", "inventory", "attendance", "analytics"),
            functions = setOf("queue.status", "queue.handover", "stock.write", "inventory.write", "attendance.write", "analytics.view"),
        ),
        AccessRole(
            id = "role-kasir",
            name = "Kasir",
            builtIn = true,
            modules = setOf("queue", "service", "customer", "stock", "attendance", "whatsapp", "expense", "cash"),
            functions = setOf("queue.status", "queue.handover", "service.create", "service.correct", "service.payment", "customer.write", "stock.write", "attendance.write", "whatsapp.send", "expense.write", "cash.close"),
        ),
    )

    /** Role bawaan yang cocok dengan peran lama, dipakai saat migrasi data. */
    fun builtInIdFor(role: Role): String = when (role) {
        Role.Owner -> "role-owner"
        Role.Supervisor -> "role-supervisor"
        Role.Kasir -> "role-kasir"
    }
}
