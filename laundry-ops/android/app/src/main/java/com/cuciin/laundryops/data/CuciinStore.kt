package com.cuciin.laundryops.data

import com.cuciin.laundryops.BuildConfig
import android.app.Application
import android.net.Uri
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import java.util.UUID

object CuciinStore {
    /**
     * Nama Owner bawaan untuk instalasi baru.
     *
     * Sengaja bukan nama pribadi: aplikasi ini dipakai banyak laundry, jadi nama yang tampil
     * harus netral. Nama pemilik sebenarnya diambil dari data staff yang tersinkron.
     * Alamat email tetap dipakai apa adanya karena itu identitas akun Firebase.
     */
    val ownerName = "Cuciin"
    val ownerEmail = "tiftazani.khara@gmail.com"

    val branches = mutableStateListOf<Branch>()
    val staff = mutableStateListOf<Staff>()
    val customers = mutableStateListOf<Customer>()
    val services = mutableStateListOf<ServiceItem>()
    val products = mutableStateListOf<Product>()
    val branchStocks = mutableStateListOf<BranchStock>()
    val inventory = mutableStateListOf<InventoryItem>()
    /** Katalog jenis aset, dipakai sebagai filter dan pembentuk kode aset. */
    val assetTypes = mutableStateListOf<AssetType>()
    val expenses = mutableStateListOf<Expense>()
    val notas = mutableStateListOf<Nota>()
    val stockMoves = mutableStateListOf<StockMove>()
    val audit = mutableStateListOf<AuditRow>()
    val cashCloses = mutableStateListOf<CashClose>()
    val payments = mutableStateListOf<PaymentRecord>()
    val attendance = mutableStateListOf<AttendanceRecord>()
    val accessPolicies = mutableStateListOf<UserAccessPolicy>()
    /** Katalog role; pengguna melekat ke salah satunya. */
    val accessRoles = mutableStateListOf<AccessRole>()
    val whatsappTemplates = mutableStateListOf<WhatsAppTemplate>()
    private val deletedNotaIds = mutableStateListOf<String>()
    val cart = mutableStateListOf<CartLine>()

    val session = mutableStateOf<Session?>(null)
    val pendingName = mutableStateOf<String?>(null)
    val viewBranch = mutableStateOf("all")
    val viewKasir = mutableStateOf("all")
    val reportPeriod = mutableStateOf("hari")
    val reportBranchIds = mutableStateOf<Set<String>>(emptySet())
    val selectedCustomer = mutableStateOf<Customer?>(null)
    /** Cabang operasional untuk nota yang sedang disusun. Tidak ikut sinkronisasi. */
    val notaBranchId = mutableStateOf<String?>(null)
    val stockBranchId = mutableStateOf<String?>(null)
    val revision = mutableIntStateOf(0)

    private var app: Application? = null
    private var ready = false
    private var applyingCloud = false
    private var localUpdatedAt = 0L

    fun attach(application: Application) {
        if (ready) return
        app = application
        LocalJson.init(application)
        CloudSync.init(application)
        val snap = LocalJson.load()
        val loadedPersistedData = snap != null && snap.staff.isNotEmpty()
        val preserveLocalOnBootstrap = loadedPersistedData && !isPristineSeed(snap!!)
        if (!loadedPersistedData) {
            applySeed()
            persist()
        } else {
            applySnapshot(snap!!)
            localUpdatedAt = snap.updatedAt
        }
        ready = true
        CloudSync.initializeLocalState(cloudSnapshot(), preserveLocalOnBootstrap)?.let(::applyRecoveredCloud)
        revision.intValue++
        CloudSync.start()
    }

    private fun applySeed() {
        branches.clear()
        branches.addAll(
            listOf(
                Branch(
                    "bunayya",
                    "BNY",
                    "Bunayya",
                    "Jalan Cibeureum Rawa Ilat, Cileungsi Kidul, Cileungsi, Kabupaten Bogor, Jawa Barat 16820",
                    "https://maps.google.com/maps/place//data=!4m2!3m1!1s0x2e6995002659ac83:0x97836acda1141d3d?entry=s&sa=X&ved=2ahUKEwjpor2slPKWAxWeleEIHUYbIGsQ4kB6BAgWEAA&hl=en",
                ),
                Branch(
                    "laupay-kirab",
                    "LPK",
                    "Laupay Kirab",
                    "Cileungsi Kidul, Cileungsi, Kabupaten Bogor, Jawa Barat 16820",
                    "https://maps.google.com/maps/place//data=!4m2!3m1!1s0x2e6995005dfaa28f:0xfd6a4729e6bc1203?entry=s&sa=X&ved=2ahUKEwifxbTLlPKWAxXt-DgGHZPhIyYQ4kB6BAgEEAA&hl=en",
                ),
                Branch(
                    "laupay-dayeuh",
                    "LPD",
                    "Laupay Dayeuh",
                    "Jalan Cibeureum Rawa Ilat, Dayeuh, Cileungsi, Kabupaten Bogor, Jawa Barat 16820",
                    "https://maps.google.com/maps/place//data=!4m2!3m1!1s0x2e6995004d56ad6b:0xcd7900f039b63334?entry=s&sa=X&ved=2ahUKEwjB-YvAlPKWAxVn3TgGHeHiM_wQ4kB6BAgEEAA&hl=en",
                ),
                Branch("shelly", "SHL", "Shelly", "Alamat belum tersedia", ""),
            ),
        )
        staff.clear()
        staff.addAll(
            listOf(
                Staff(ownerName, ownerEmail, Role.Owner, branches.map(Branch::id), passwordHash = Passwords.hash("test1234")),
                Staff("Ustutifa", "Us.archuleta1207@gmail.com", Role.Owner, branches.map(Branch::id), passwordHash = Passwords.hash("test1234")),
                Staff("titahdamaiteratera243", "titahdamaiteratera243@gmail.com", Role.Kasir, listOf("bunayya"), passwordHash = Passwords.hash("test1234")),
                Staff("fiasvia2301", "fiasvia2301@gmail.com", Role.Kasir, listOf("bunayya"), passwordHash = Passwords.hash("test1234")),
                Staff("widadalhusaini10", "widadalhusaini10@gmail.com", Role.Kasir, listOf("laupay-kirab"), passwordHash = Passwords.hash("test1234")),
                Staff("aidanurita25", "aidanurita25@gmail.com", Role.Kasir, listOf("laupay-kirab"), passwordHash = Passwords.hash("test1234")),
                Staff("deccintaaulia180", "deccintaaulia180@gmail.com", Role.Kasir, listOf("laupay-dayeuh"), passwordHash = Passwords.hash("test1234")),
                Staff("salsabilayumna2006", "salsabilayumna2006@gmail.com", Role.Kasir, listOf("shelly"), passwordHash = Passwords.hash("test1234")),
            ),
        )
        customers.clear()
        services.clear()
        services.addAll(
            listOf(
                ServiceItem("cuci", "Cuci", "kg", 7000, retail = false, dropOut = false),
                ServiceItem("curing", "Cuci kering (Curing)", "kg", 9000, retail = false, dropOut = false),
                ServiceItem("do", "Curing DO", "kg", 10000, retail = false, dropOut = true),
                ServiceItem("do-lipat", "Curing DO Lipat", "kg", 12000, retail = false, dropOut = true),
                ServiceItem("self-load", "Cuci mandiri", "Load", 25000, retail = false, dropOut = false, selfService = true),
                ServiceItem("sabun", "Sabun", "pcs", 8000, retail = true, dropOut = false, productKey = "sabun"),
                ServiceItem("softener", "Softener", "pcs", 10000, retail = true, dropOut = false, productKey = "softener"),
                ServiceItem("parfum", "Parfum uk 100", "pcs", 15000, retail = true, dropOut = false, productKey = "parfum"),
            ),
        )
        products.clear()
        products.addAll(
            listOf(
                Product("Sabun", 0, 8, "sabun", ProductKind.BarangJual),
                Product("Softener", 0, 6, "softener", ProductKind.BarangJual),
                Product("Parfum uk 100", 0, 5, "parfum", ProductKind.BarangJual),
            ),
        )
        branchStocks.clear()
        branches.forEach { branch ->
            products.forEach { product -> branchStocks.add(BranchStock(branch.id, product.key, product.stock)) }
        }
        inventory.clear()
        expenses.clear()
        notas.clear()
        deletedNotaIds.clear()
        stockMoves.clear()
        audit.clear()
        cashCloses.clear()
        payments.clear()
        attendance.clear()
        accessPolicies.clear()
        whatsappTemplates.clear()
        whatsappTemplates.add(WhatsAppTemplate())
        val t = Clock.nowMs()
        localUpdatedAt = t
        audit.add(AuditRow(Clock.nowLabel(t), t, ownerName, "bunayya", "Data awal: 4 cabang, antrian kosong. Isi stok dan pelanggan sebelum Service pertama.", null, syncEventId()))
    }

    private fun isPristineSeed(snapshot: Snapshot): Boolean =
        snapshot.customers.isEmpty() && snapshot.notas.isEmpty() && snapshot.deletedNotaIds.isEmpty() &&
            snapshot.stockMoves.isEmpty() && snapshot.inventory.isEmpty() && snapshot.expenses.isEmpty() &&
            snapshot.cashCloses.isEmpty() && snapshot.payments.isEmpty() && snapshot.attendance.isEmpty() &&
            snapshot.branchStocks.all { it.stock == 0 } &&
            snapshot.audit.all { it.action.startsWith("Data awal:") }

    private fun applySnapshot(s: Snapshot) {
        fun <T> fill(dest: MutableList<T>, src: List<T>) {
            dest.clear()
            dest.addAll(src)
        }
        fill(branches, s.branches)
        fill(staff, s.staff)
        ensureInitialPasswords()
        fill(customers, s.customers)
        fill(services, s.services)
        fill(products, s.products)
        ensureServiceDefaults()
        fill(branchStocks, s.branchStocks)
        fill(inventory, s.inventory)
        migrateLegacyInventoryProducts()
        fill(expenses, s.expenses)
        fill(notas, s.notas)
        deletedNotaIds.clear()
        deletedNotaIds.addAll(s.deletedNotaIds)
        notas.removeAll { it.id in deletedNotaIds }
        fill(stockMoves, s.stockMoves)
        ensureBranchStocks()
        fill(audit, s.audit)
        fill(cashCloses, s.cashCloses)
        fill(payments, s.payments)
        fill(attendance, s.attendance)
        fill(accessPolicies, s.accessPolicies)
        fill(accessRoles, s.accessRoles.ifEmpty { AccessCatalog.builtInRoles() })
        fill(whatsappTemplates, s.whatsappTemplates.ifEmpty { listOf(WhatsAppTemplate()) })
        viewBranch.value = s.viewBranch
        viewKasir.value = s.viewKasir
        reportPeriod.value = s.reportPeriod
        s.sessionEmail?.let { login(it, skipPassword = true) }
    }

    private fun applyBusiness(s: Snapshot) {
        fun <T> fill(dest: MutableList<T>, src: List<T>) {
            dest.clear()
            dest.addAll(src)
        }
        val localPasswordHashes = staff.associate { it.email.lowercase() to it.passwordHash }
        fill(branches, s.branches)
        fill(staff, s.staff.map { remote -> remote.copy(passwordHash = localPasswordHashes[remote.email.lowercase()].orEmpty()) })
        ensureInitialPasswords()
        fill(customers, s.customers)
        fill(services, s.services)
        fill(products, s.products)
        ensureServiceDefaults()
        fill(branchStocks, s.branchStocks)
        val localAssetPhotos = inventory.associate { it.id to it.photoPath }
        fill(inventory, s.inventory.map { remote -> remote.copy(photoPath = localAssetPhotos[remote.id].orEmpty()) })
        fill(assetTypes, s.assetTypes.ifEmpty { defaultAssetTypes() })
        migrateLegacyInventoryProducts()
        fill(expenses, s.expenses)
        val localPhotos = notas.associate { it.id to it.photos.toMutableList() }
        deletedNotaIds.addAll(s.deletedNotaIds.filterNot { it in deletedNotaIds })
        fill(notas, s.notas.filterNot { it.id in deletedNotaIds }.map { remote -> remote.copy(photos = localPhotos[remote.id] ?: mutableListOf()) })
        fill(stockMoves, s.stockMoves)
        ensureBranchStocks()
        fill(audit, s.audit)
        fill(cashCloses, s.cashCloses)
        fill(payments, s.payments)
        val localAttendancePhotos = attendance.associate { it.id to (it.checkInPhotoPath to it.checkOutPhotoPath) }
        fill(attendance, s.attendance.map { remote ->
            val local = localAttendancePhotos[remote.id]
            remote.copy(checkInPhotoPath = local?.first.orEmpty(), checkOutPhotoPath = local?.second.orEmpty())
        })
        fill(accessPolicies, s.accessPolicies)
        fill(accessRoles, s.accessRoles.ifEmpty { AccessCatalog.builtInRoles() })
        fill(whatsappTemplates, s.whatsappTemplates.ifEmpty { listOf(WhatsAppTemplate()) })
    }

    fun applyCloud(s: Snapshot, onPersisted: (() -> Unit)? = null) {
        if (s.updatedAt < localUpdatedAt && !CloudSync.hasPreparedRemote()) {
            onPersisted?.invoke()
            return
        }
        if (s.staff.isEmpty() && branches.isNotEmpty()) {
            CloudSync.push(cloudSnapshot())
            revision.intValue++
            onPersisted?.invoke()
            return
        }
        val prepared = CloudSync.hasPreparedRemote()
        var localSnapshot: Snapshot? = null
        var remoteSnapshot: Snapshot? = null
        applyingCloud = true
        try {
            applyBusiness(s)
            localUpdatedAt = s.updatedAt
            localSnapshot = snapshot()
            remoteSnapshot = cloudSnapshot()
            revision.intValue++
        } finally {
            applyingCloud = false
        }
        if (prepared || onPersisted != null) {
            CloudSync.persistAppliedRemote(localSnapshot!!, remoteSnapshot!!, onPersisted)
        } else {
            LocalJson.save(localSnapshot!!)
            CloudSync.acceptRemoteSnapshot(remoteSnapshot!!)
            onPersisted?.invoke()
        }
    }

    private fun applyRecoveredCloud(s: Snapshot) {
        applyingCloud = true
        try {
            applyBusiness(s)
            localUpdatedAt = maxOf(localUpdatedAt, s.updatedAt)
            persist()
            CloudSync.completeRecoveredRemote(cloudSnapshot())
            revision.intValue++
        } finally {
            applyingCloud = false
        }
    }

    fun cloudSnapshot(): Snapshot = snapshot().copy(
        staff = staff.map { it.copy(passwordHash = "") },
        notas = notas.map { it.copy(photos = mutableListOf()) },
        attendance = attendance.map { it.copy(checkInPhotoPath = "", checkOutPhotoPath = "") },
        // Foto aset hanya ada di perangkat ini; path-nya tidak ikut ke server.
        inventory = inventory.map { it.copy(photoPath = "") },
        sessionEmail = null,
        updatedAt = localUpdatedAt,
    )

    fun syncUpdatedAt(): Long = localUpdatedAt

    private fun snapshot(): Snapshot = Snapshot(
        branches = branches.toList(),
        staff = staff.toList(),
        customers = customers.toList(),
        services = services.toList(),
        products = products.map { it.copy() },
        branchStocks = branchStocks.map { it.copy() },
        inventory = inventory.toList(),
        assetTypes = assetTypes.toList(),
        expenses = expenses.toList(),
        notas = notas.map { it.copy(photos = it.photos.toMutableList()) },
        stockMoves = stockMoves.toList(),
        audit = audit.toList(),
        cashCloses = cashCloses.toList(),
        payments = payments.toList(),
        attendance = attendance.toList(),
        accessPolicies = accessPolicies.toList(),
        accessRoles = accessRoles.toList(),
        whatsappTemplates = whatsappTemplates.toList(),
        deletedNotaIds = deletedNotaIds.toList(),
        sessionEmail = session.value?.email,
        viewBranch = viewBranch.value,
        viewKasir = viewKasir.value,
        reportPeriod = reportPeriod.value,
        updatedAt = localUpdatedAt,
    )

    private fun persist() {
        LocalJson.save(snapshot())
    }

    private fun bump() {
        revision.intValue++
        localUpdatedAt = maxOf(Clock.nowMs(), localUpdatedAt + 1)
        persist()
        if (!applyingCloud) CloudSync.push(cloudSnapshot())
    }

    fun bumpPublic() = bump()

    fun touchStatus() {
        revision.intValue++
    }

    private fun log(action: String, branchId: String, notaId: String? = null): AuditRow {
        val t = Clock.nowMs()
        val row = AuditRow(Clock.nowLabel(t), t, session.value?.name ?: ownerName, branchId, action, notaId, syncEventId())
        audit.add(0, row)
        return row
    }

    /**
     * Cabang untuk ditampilkan.
     *
     * Selalu mengembalikan nilai, tidak pernah melempar. Katalog cabang bisa kosong sesaat
     * (basis data baru, impor belum jalan) atau memuat id yang belum tersinkron, dan versi
     * sebelumnya memakai `first()` sehingga aplikasi berhenti pada dua keadaan itu. Ada 29
     * pemanggil di seluruh kode utama, jadi satu id asing cukup untuk menutup aplikasi.
     */
    fun branch(id: String = session.value?.branchId ?: viewBranch.value): Branch {
        if (id == "all") return branches.firstOrNull() ?: missingBranch
        return branches.firstOrNull { it.id == id } ?: branches.firstOrNull() ?: missingBranch
    }

    /** Cabang netral saat katalog benar-benar kosong. Kode dan namanya tidak menyesatkan. */
    private val missingBranch = Branch("", "", "Cabang belum tersedia", "", "")

    private fun ensureBranchStocks() {
        val legacyMigration = branchStocks.isEmpty()
        branches.forEach { branch ->
            products.forEach { product ->
                if (branchStocks.none { it.branchId == branch.id && it.productKey == product.key }) {
                    val opening = if (legacyMigration) legacyBranchBalance(product, branch.id) else 0
                    branchStocks.add(BranchStock(branch.id, product.key, opening))
                }
            }
        }
        branchStocks.removeAll { row ->
            branches.none { it.id == row.branchId } || products.none { it.key == row.productKey }
        }
    }

    /** Barang jual dan bahan habis pakai lama dipindahkan ke katalog Produk stok tanpa menghapus aset mesin. */
    private fun migrateLegacyInventoryProducts() {
        val legacy = inventory.filter { it.category == InventoryCategory.BarangJual || it.category == InventoryCategory.BahanHabisPakai }
        legacy.forEach { row ->
            val product = productForName(row.name) ?: Product(
                name = row.name,
                stock = 0,
                min = 0,
                id = "legacy-${row.id}",
                kind = if (row.category == InventoryCategory.BarangJual) ProductKind.BarangJual else ProductKind.BahanHabisPakai,
                unit = row.unit,
            ).also { products.add(it) }
            val balance = branchStocks.firstOrNull { it.branchId == row.branchId && it.productKey == product.key }
            if (balance == null) branchStocks.add(BranchStock(row.branchId, product.key, row.quantity))
        }
        inventory.removeAll(legacy)
    }

    private fun legacyBranchBalance(product: Product, branchId: String): Int {
        val moves = stockMoves.filter {
            it.branchId == branchId && (it.product == product.key || it.product == product.name)
        }.sortedBy { it.atMs }
        if (moves.isEmpty()) return if (branchId == branches.firstOrNull()?.id) product.stock.coerceAtLeast(0) else 0
        var balance = 0
        moves.forEach { move ->
            balance = if (move.kind == StockKind.Update) move.qty.coerceAtLeast(0)
            else (balance + move.qty).coerceAtLeast(0)
        }
        return balance
    }

    fun stockOf(productKey: String, branchId: String): Int =
        branchStocks.firstOrNull { it.branchId == branchId && it.productKey == productKey }?.stock ?: 0

    fun productForKey(key: String): Product? = products.firstOrNull { it.key == key || it.name == key }

    private fun productForName(name: String): Product? = products.firstOrNull { it.name.equals(name.trim(), true) }

    fun linkedProduct(service: ServiceItem): Product? =
        productForKey(service.productKey).takeIf { service.productKey.isNotBlank() } ?: productForName(service.name)

    fun canAccess(module: String, function: String? = null): Boolean {
        val s = session.value ?: return false
        val me = staff.firstOrNull { it.email.equals(s.email, true) }
        val policy = accessPolicies.firstOrNull { it.email.equals(s.email, true) }
        return AccessPolicy.can(me, accessRoles, policy, module, function)
    }

    /**
     * Penjaga fungsi tulis yang sensitif.
     *
     * Layar Kontrol Akses Role menjanjikan "Fungsi tanpa centang berarti tidak diizinkan".
     * Janji itu hanya benar bila setiap fungsi katalog benar-benar diperiksa. Sebelumnya yang
     * menentukan hanyalah modul dan [Role] lama, sehingga mencabut centang sebuah fungsi tidak
     * mengubah apa pun: seorang Kasir yang role-nya sudah dicabut fungsi `service.correct` tetap
     * bisa mengoreksi dan menghapus transaksi.
     *
     * Dua lapis tetap berlaku dan tidak saling menggantikan:
     * 1. [Role] menjaga batas lama yang tidak dapat diubah dari layar (Supervisor tidak mengoreksi,
     *    cabang sendiri saja, nota yang sudah dikirim hanya Owner).
     * 2. Fungsi katalog menjaga centang di Kontrol Akses Role, dan inilah lapis yang bisa diatur.
     */
    private fun boleh(modul: String, fungsi: String): Boolean = canAccess(modul, fungsi)

    /**
     * Penanda penolakan izin untuk fungsi yang mengembalikan Int.
     *
     * Nilai negatif tidak mungkin muncul dari perhitungan sah (jumlah perubahan selalu >= 0), jadi
     * UI dapat membedakan "izin dicabut" dari "tidak ada yang berubah" tanpa mengubah tipe
     * kembalian dan tanpa melempar pengecualian.
     */
    const val TOLAK_STOK: Int = -1

    /** Pesan penolakan yang menyebut fungsi mana yang dicabut, supaya tidak membingungkan. */
    private fun tolak(fungsi: String): String =
        "Akses ${AccessCatalog.functionLabel(fungsi)} dicabut untuk role akun ini"

    /** Pesan untuk pemeriksaan gabungan Role dan fungsi. */
    private fun tolak(fungsi: String, alasan: String): String =
        if (boleh(AccessCatalog.moduleOf(fungsi).orEmpty(), fungsi)) alasan else tolak(fungsi)

    /** Role yang melekat pada pengguna yang sedang masuk, dipakai untuk menampilkan hak aksesnya. */
    fun currentAccessRole(): AccessRole? {
        val s = session.value ?: return null
        return AccessPolicy.effectiveRole(staff.firstOrNull { it.email.equals(s.email, true) }, accessRoles)
    }

    fun accessFor(email: String): UserAccessPolicy =
        accessPolicies.firstOrNull { it.email.equals(email, true) } ?: UserAccessPolicy(email = "")

    fun roles(): List<AccessRole> = AccessPolicy.rolesFor(accessRoles)

    fun roleById(id: String): AccessRole? = AccessPolicy.roleById(accessRoles, id)

    /**
     * Memastikan katalog role tersedia dan role bawaan mengikuti katalog terbaru.
     *
     * Katalog bisa bertambah seiring versi aplikasi (misalnya fungsi "Ubah harga Service").
     * Role bawaan yang sudah tersimpan di server tidak otomatis memuat fungsi baru itu, karena
     * isinya dibekukan saat pertama dibuat. Tanpa penambalan ini, fitur baru tidak akan pernah
     * berlaku walaupun kodenya sudah ada.
     *
     * Hanya fungsi yang ditandai bawaan untuk role itu yang ditambahkan, dan hanya bila
     * modulnya memang sudah dimiliki role tersebut. Fungsi yang sudah dicabut Owner tidak
     * dihidupkan kembali: yang ditambal hanya fungsi yang belum pernah ada di versi mana pun,
     * yaitu yang ditandai di [AccessCatalog.builtInFunctionsFor].
     */
    fun ensureAccessRoles() {
        if (accessRoles.isEmpty()) {
            accessRoles.addAll(AccessCatalog.builtInRoles())
            return
        }
        var berubah = false
        val hasil = accessRoles.map { role ->
            val tambahan = AccessCatalog.builtInFunctionsFor(role.id).filter { fn ->
                fn !in role.functions && AccessCatalog.moduleOf(fn) in role.modules
            }
            if (tambahan.isEmpty()) role
            else {
                berubah = true
                role.copy(functions = role.functions + tambahan)
            }
        }
        if (berubah) {
            accessRoles.clear()
            accessRoles.addAll(hasil)
        }
    }

    fun saveAccessRole(role: AccessRole): String? {
        if (session.value?.role != Role.Owner) return "Hanya Owner yang dapat mengatur role"
        val name = role.name.trim()
        if (name.isBlank()) return "Nama role wajib diisi"
        if (accessRoles.any { it.id != role.id && it.name.equals(name, true) }) return "Nama role $name sudah dipakai"
        val (modules, functions) = AccessCatalog.sanitize(role.modules, role.functions)
        if (modules.isEmpty()) return "Pilih minimal satu modul"
        val cleaned = role.copy(name = name, modules = modules, functions = functions)
        val index = accessRoles.indexOfFirst { it.id == role.id }
        if (index >= 0) accessRoles[index] = cleaned else accessRoles.add(cleaned)
        log("Role ${cleaned.name} disimpan · ${cleaned.modules.size} modul · ${cleaned.functions.size} fungsi", branches.firstOrNull()?.id.orEmpty())
        bump()
        return null
    }

    fun createAccessRole(name: String): AccessRole? {
        if (session.value?.role != Role.Owner) return null
        val role = AccessRole(id = "role-${newId()}", name = name.trim(), builtIn = false)
        accessRoles.add(role)
        return role
    }

    /** Role yang masih dipakai pengguna tidak dihapus supaya tidak ada pengguna tanpa akses. */
    fun deleteAccessRole(id: String): String? {
        if (session.value?.role != Role.Owner) return "Hanya Owner yang dapat menghapus role"
        val role = accessRoles.firstOrNull { it.id == id } ?: return "Role tidak ditemukan"
        if (role.builtIn) return "Role bawaan ${role.name} tidak dapat dihapus"
        val members = AccessPolicy.memberCount(staff, id)
        if (members > 0) return "$members pengguna masih memakai role ${role.name}"
        accessRoles.removeAll { it.id == id }
        log("Role ${role.name} dihapus", branches.firstOrNull()?.id.orEmpty())
        bump()
        return null
    }

    /** Memindahkan pengguna ke role lain; aksesnya langsung mengikuti role tersebut. */
    fun assignAccessRole(email: String, roleId: String): String? {
        if (session.value?.role != Role.Owner) return tolak("owner.access", "Hanya Owner yang dapat mengubah role pengguna")
        val index = staff.indexOfFirst { it.email.equals(email, true) }
        if (index < 0) return "Pengguna tidak ditemukan"
        if (roleId.isNotBlank() && accessRoles.none { it.id == roleId }) return "Role tidak ditemukan"
        staff[index] = staff[index].copy(accessRoleId = roleId)
        // Kebijakan per pengguna dibuang supaya hasilnya murni mengikuti role.
        accessPolicies.removeAll { it.email.equals(email, true) }
        val role = accessRoles.firstOrNull { it.id == roleId }
        log("${staff[index].name} memakai role ${role?.name ?: "bawaan"}", staff[index].branchIds.firstOrNull() ?: branches.firstOrNull()?.id.orEmpty())
        bump()
        return null
    }

    fun saveAccessPolicy(email: String, modules: Set<String>, functions: Set<String>): String? {
        if (session.value?.role != Role.Owner) return "Hanya Owner yang dapat mengatur akses"
        val user = staff.firstOrNull { it.email.equals(email, true) } ?: return "Pengguna tidak ditemukan"
        if (user.role == Role.Owner) return "Owner selalu memiliki semua akses"
        accessPolicies.removeAll { it.email.equals(email, true) }
        accessPolicies.add(UserAccessPolicy(user.email, modules, functions))
        log("Akses ${user.name} diperbarui", user.branchIds.firstOrNull() ?: branches.firstOrNull()?.id.orEmpty())
        bump()
        return null
    }

    fun clearAccessPolicy(email: String): String? {
        if (session.value?.role != Role.Owner) return "Hanya Owner yang dapat mengatur akses"
        accessPolicies.removeAll { it.email.equals(email, true) }
        val user = staff.firstOrNull { it.email.equals(email, true) }
        log("Akses ${user?.name ?: email} dipulihkan ke role dasar", user?.branchIds?.firstOrNull() ?: branches.firstOrNull()?.id.orEmpty())
        bump()
        return null
    }

    fun whatsappTemplate(): WhatsAppTemplate = whatsappTemplates.firstOrNull() ?: WhatsAppTemplate()

    fun saveWhatsAppTemplate(opening: String, content: String, closing: String): String? {
        if (!boleh("owner", "owner.manage")) return tolak("owner.manage", "Akun ini tidak dapat mengubah pesan WhatsApp")
        if (opening.isBlank() || content.isBlank() || closing.isBlank()) return "Pesan pembuka, isi, dan penutup wajib diisi"
        whatsappTemplates.clear()
        whatsappTemplates.add(WhatsAppTemplate(opening = opening.trim(), content = content.trim(), closing = closing.trim()))
        log("Template WhatsApp diperbarui", branches.firstOrNull()?.id.orEmpty())
        bump()
        return null
    }

    fun selectedStockBranch(): String {
        val s = session.value ?: return branches.firstOrNull()?.id.orEmpty()
        if (s.role != Role.Owner) return s.branchId
        return stockBranchId.value
            ?.takeIf { id -> branches.any { it.id == id } }
            ?: branches.firstOrNull()?.id.orEmpty().also { stockBranchId.value = it }
    }

    fun visibleNotas(): List<Nota> {
        val s = session.value ?: return emptyList()
        return notas.filter { n ->
            when (s.role) {
                Role.Owner -> (viewBranch.value == "all" || n.branchId == viewBranch.value) &&
                    (viewKasir.value == "all" || n.kasir == viewKasir.value)
                else -> n.branchId == s.branchId
            }
        }
    }

    fun periodNotas(): List<Nota> {
        val start = Clock.periodStartMs(reportPeriod.value)
        val s = session.value ?: return emptyList()
        val selected = reportBranchIds.value
        return notas.filter {
            it.createdAtMs >= start && when (s.role) {
                Role.Owner -> selected.isEmpty() || it.branchId in selected
                else -> it.branchId == s.branchId
            }
        }
    }

    fun periodExpenses(): List<Expense> {
        val start = Clock.periodStartMs(reportPeriod.value)
        val s = session.value ?: return emptyList()
        val selected = reportBranchIds.value
        return expenses.filter {
            it.occurredAtMs >= start && when (s.role) {
                Role.Owner -> selected.isEmpty() || it.branchId in selected
                else -> it.branchId == s.branchId
            }
        }
    }

    private fun ensureInitialPasswords() {
        val initialHash = Passwords.hash("test1234")
        staff.indices.filter { staff[it].passwordHash.isBlank() }.forEach { index ->
            staff[index] = staff[index].copy(passwordHash = initialHash)
        }
    }

    private fun ensureServiceDefaults() {
        if (services.none { it.selfService }) {
            services.add(ServiceItem("self-load", "Cuci mandiri", "Load", 25000, retail = false, dropOut = false, selfService = true))
        }
        services.indices.filter { services[it].retail && services[it].productKey.isBlank() }.forEach { index ->
            productForName(services[index].name)?.let { product -> services[index] = services[index].copy(productKey = product.key) }
        }
    }

    fun omzet(rows: List<Nota> = periodNotas()): Int = rows.sumOf { it.total }

    /**
     * Pembayaran lama tanpa jurnal diperlakukan sebagai penerimaan pada waktu nota dibuat.
     *
     * Sebagian nota dibayar SEBELUM jurnal pembayaran ada, lalu menerima pembayaran berikutnya
     * setelah jurnal aktif. Untuk nota seperti itu, jurnalnya hanya memuat pembayaran yang baru;
     * bagian lamanya tidak punya entri sendiri. Karena itu yang dicatat sebagai penerimaan lama
     * adalah SELISIH antara `paid` nota dan jumlah jurnalnya, bukan seluruh `paid` dan bukan nol.
     *
     * Versi sebelumnya membuang seluruh `paid` nota begitu nota itu punya SATU entri jurnal,
     * sehingga uang yang diterima sebelum jurnal ada hilang dari laporan kas dan tutup kas.
     */
    fun paymentRecords(rows: List<Nota> = visibleNotas()): List<PaymentRecord> {
        val byNota = rows.associateBy { it.id }
        val recorded = payments.filter { it.notaId in byNota }
        val recordedPerNota = recorded.groupBy { it.notaId }
        val legacy = rows.mapNotNull { nota ->
            val sumJurnal = recordedPerNota[nota.id]?.sumOf { it.amount } ?: 0
            val selisih = PaymentTally.legacyAmount(nota.paid, sumJurnal)
            if (selisih <= 0) null
            else PaymentRecord("legacy-${nota.id}", nota.id, nota.branchId, selisih, nota.payMethod, nota.createdAtMs, nota.createdAt, nota.kasir)
        }
        return (recorded + legacy).filter { it.amount > 0 }
    }

    fun collected(rows: List<Nota> = periodNotas()): Int = rows.sumOf { it.paid }

    fun piutang(rows: List<Nota> = visibleNotas()): Int =
        rows.sumOf { (it.total - it.paid).coerceAtLeast(0) }

    fun todayCollected(branchId: String? = null): Int {
        val start = Clock.todayStartMs()
        return paymentRecords(notas).filter { it.atMs >= start && (branchId == null || branchId == "all" || it.branchId == branchId) }.sumOf { it.amount }
    }

    fun todayByMethod(method: PayMethod, branchId: String): Int {
        val start = Clock.todayStartMs()
        return paymentRecords(notas).filter { it.atMs >= start && (branchId == "all" || it.branchId == branchId) && it.method == method }.sumOf { it.amount }
    }

    fun login(email: String, password: String = "", skipPassword: Boolean = false): Boolean {
        val userIndex = staff.indexOfFirst { it.email.equals(email.trim(), ignoreCase = true) }
        val u = staff.getOrNull(userIndex)
        if (u == null) {
            pendingName.value = null
            return false
        }
        if (!u.approved) {
            pendingName.value = u.name
            session.value = null
            persist()
            return false
        }
        val passwordMatches = skipPassword || (u.passwordHash.isNotBlank() && Passwords.matches(password, u.passwordHash))
        if (!LoginPolicy.permits(
                debug = BuildConfig.DEBUG,
                approved = u.approved,
                hasBranches = u.branchIds.isNotEmpty(),
                hasPassword = u.passwordHash.isNotBlank(),
                trustedRestore = skipPassword,
                passwordMatches = passwordMatches,
            )) {
            pendingName.value = null
            return false
        }
        if (!skipPassword && passwordMatches && Passwords.needsUpgrade(u.passwordHash)) {
            staff[userIndex] = u.copy(passwordHash = Passwords.hash(password))
        }
        pendingName.value = null
        session.value = Session(u.role, u.name, u.email, u.branchIds.first())
        viewBranch.value = if (u.role == Role.Owner) "all" else u.branchIds.first()
        persist()
        return true
    }

    fun logout() {
        if (FirebaseCloud.enabled) {
            FirebaseCloud.signOut()
            CloudSync.onSignedOut()
        }
        session.value = null
        persist()
        revision.intValue++
    }

    fun markRegistrationPending(name: String) {
        pendingName.value = name.trim()
        revision.intValue++
    }

    fun register(name: String, email: String, role: Role, branchId: String, password: String = "") {
        val hash = Passwords.hash(password.ifBlank { "test1234" })
        staff.add(Staff(name.trim(), email.trim(), role, listOf(branchId), approved = false, passwordHash = hash))
        pendingName.value = name.trim()
        bump()
    }

    fun approve(name: String, ok: Boolean) {
        val i = staff.indexOfFirst { it.name == name }
        if (i >= 0) staff[i] = staff[i].copy(approved = ok)
        // Cabang audit diambil dari data nyata. Sebelumnya ada nilai tetap "melati" yang sudah
        // tidak ada di katalog cabang, sehingga entri audit ini tidak pernah lolos filter
        // per-cabang di pullChanges dan tidak sampai ke perangkat mana pun.
        val auditBranch = session.value?.branchId
            ?: staff.getOrNull(i)?.branchIds?.firstOrNull()
            ?: branches.firstOrNull()?.id.orEmpty()
        log("${if (ok) "Setujui" else "Tolak"} $name", auditBranch)
        bump()
    }

    fun addBranch(name: String, code: String, location: String, maps: String): Branch? {
        if (!boleh("owner", "owner.manage")) return null
        val id = uniqueBranchId(name)
        val b = Branch(id, code.uppercase().take(4).ifBlank { "CAB" }, name.trim(), location.trim(), maps.trim())
        branches.add(b)
        products.forEach { branchStocks.add(BranchStock(b.id, it.key, 0)) }
        grantOwnerBranch(b.id)
        log("Cabang ${b.name} ditambah", b.id)
        bump()
        return b
    }

    fun updateBranch(id: String, name: String, code: String, location: String, maps: String): String? {
        if (!boleh("owner", "owner.manage")) return tolak("owner.manage", "Akun ini tidak dapat mengubah cabang")
        val i = branches.indexOfFirst { it.id == id }
        if (i < 0) return null
        branches[i] = branches[i].copy(
            name = name.trim(),
            code = code.uppercase().take(4).ifBlank { branches[i].code },
            location = location.trim(),
            mapsQuery = maps.trim(),
        )
        log("Cabang ${name.trim()} diubah", id)
        bump()
        return null
    }

    fun updateBranchMap(id: String, maps: String): String? {
        if (!boleh("owner", "owner.manage")) return tolak("owner.manage", "Akun ini tidak dapat mengubah lokasi cabang")
        val i = branches.indexOfFirst { it.id == id }
        if (i < 0 || maps.isBlank()) return null
        branches[i] = branches[i].copy(mapsQuery = maps.trim())
        log("Lokasi peta ${branches[i].name} diperbarui", id)
        bump()
        return null
    }

    fun deleteBranch(id: String): String? {
        if (!boleh("owner", "owner.manage")) return tolak("owner.manage", "Akun ini tidak dapat menghapus cabang")
        if (branches.size <= 1) return "Minimal satu cabang harus tersisa"
        if (notas.any { it.branchId == id }) return "Cabang memiliki riwayat Service dan tidak dapat dihapus"
        if (inventory.any { it.branchId == id } || expenses.any { it.branchId == id } ||
            stockMoves.any { it.branchId == id } || cashCloses.any { it.branchId == id } ||
            payments.any { it.branchId == id } || attendance.any { it.branchId == id }
        ) return "Cabang memiliki riwayat operasional dan tidak dapat dihapus"
        val gone = branches.find { it.id == id } ?: return "Cabang tidak ketemu"
        branches.removeAll { it.id == id }
        branchStocks.removeAll { it.branchId == id }
        val relocated = staff.map { u ->
            u.copy(branchIds = u.branchIds.filter { it != id }.ifEmpty { listOfNotNull(branches.firstOrNull()?.id) })
        }
        staff.clear()
        staff.addAll(relocated)
        if (viewBranch.value == id) viewBranch.value = "all"
        log("Cabang ${gone.name} dihapus", branches.firstOrNull()?.id.orEmpty())
        bump()
        return null
    }

    fun addCustomer(name: String, phone: String, address: String): Customer? {
        if (!boleh("customer", "customer.write")) return null
        val c = Customer("c-${newId()}", name.trim(), address.trim(), phone.trim())
        customers.add(0, c)
        selectedCustomer.value = c
        log("Pelanggan ${c.name} ditambah", session.value?.branchId ?: branches.firstOrNull()?.id.orEmpty())
        bump()
        return c
    }

    fun updateCustomer(id: String, name: String, phone: String, address: String): String? {
        if (!boleh("customer", "customer.write")) return tolak("customer.write", "Akun ini tidak dapat mengubah pelanggan")
        val i = customers.indexOfFirst { it.id == id }
        if (i < 0) return null
        customers[i] = customers[i].copy(name = name.trim(), phone = phone.trim(), address = address.trim())
        if (selectedCustomer.value?.id == id) selectedCustomer.value = customers[i]
        log("Pelanggan ${name.trim()} diubah", session.value?.branchId ?: branches.firstOrNull()?.id.orEmpty())
        bump()
        return null
    }

    fun deleteCustomer(id: String): String? {
        if (session.value?.role != Role.Owner) return tolak("customer.write", "Hanya Owner yang dapat menghapus pelanggan")
        val c = customers.find { it.id == id } ?: return "Pelanggan tidak ketemu"
        customers.removeAll { it.id == id }
        if (selectedCustomer.value?.id == id) selectedCustomer.value = null
        log("Pelanggan ${c.name} dihapus", session.value?.branchId ?: branches.firstOrNull()?.id.orEmpty())
        bump()
        return null
    }

    fun addStaff(name: String, email: String, role: Role, branchIds: List<String>, password: String = "", approved: Boolean = true): String? {
        if (!boleh("owner", "owner.manage")) return tolak("owner.manage", "Akun ini tidak dapat menambah user")
        val em = email.trim()
        if (name.isBlank() || em.isBlank()) return "Nama dan email wajib"
        if (staff.any { it.email.equals(em, ignoreCase = true) }) return "Email sudah dipakai"
        val bids = branchIds.ifEmpty { listOfNotNull(branches.firstOrNull()?.id) }
        val hash = if (password.isBlank()) "" else Passwords.hash(password)
        staff.add(Staff(name.trim(), em, role, bids, approved = approved, passwordHash = hash))
        log("User ${name.trim()} (${role.name}) ditambah", bids.first())
        bump()
        return null
    }

    fun updateStaff(email: String, name: String, role: Role, branchIds: List<String>, password: String? = null, approved: Boolean? = null, newEmail: String = email): String? {
        if (!boleh("owner", "owner.manage")) return tolak("owner.manage", "Akun ini tidak dapat mengubah user")
        val i = staff.indexOfFirst { it.email.equals(email, ignoreCase = true) }
        if (i < 0) return "User tidak ketemu"
        val old = staff[i]
        val targetEmail = newEmail.trim()
        if (targetEmail.isBlank()) return "Email wajib diisi"
        if (staff.any { it.email.equals(targetEmail, true) && !it.email.equals(email, true) }) return "Email sudah dipakai"
        if (old.role == Role.Owner && role != Role.Owner && staff.count { it.role == Role.Owner } <= 1) {
            return "Owner terakhir tidak bisa diturunkan"
        }
        val bids = branchIds.ifEmpty { old.branchIds }
        staff[i] = old.copy(
            name = name.trim().ifBlank { old.name },
            email = targetEmail,
            role = role,
            branchIds = bids,
            approved = approved ?: old.approved,
            passwordHash = if (password.isNullOrBlank()) old.passwordHash else Passwords.hash(password),
        )
        val s = session.value
        if (s != null && s.email.equals(email, ignoreCase = true)) {
            session.value = s.copy(name = staff[i].name, email = targetEmail, role = staff[i].role, branchId = staff[i].branchIds.first())
        }
        log("User ${staff[i].name} diubah", staff[i].branchIds.first())
        bump()
        return null
    }

    fun deleteStaff(email: String): String? {
        if (!boleh("owner", "owner.manage")) return tolak("owner.manage", "Akun ini tidak dapat menghapus user")
        val u = staff.find { it.email.equals(email, ignoreCase = true) } ?: return "User tidak ketemu"
        if (u.role == Role.Owner && staff.count { it.role == Role.Owner } <= 1) return "Owner terakhir tidak bisa dihapus"
        if (session.value?.email.equals(email, ignoreCase = true) == true) return "Tidak bisa hapus akun yang sedang login. Pakai Hapus akun saya."
        staff.removeAll { it.email.equals(email, ignoreCase = true) }
        log("User ${u.name} dihapus", u.branchIds.firstOrNull() ?: branches.firstOrNull()?.id.orEmpty())
        bump()
        return null
    }

    fun addService(name: String, unit: String, price: Int, retail: Boolean, dropOut: Boolean, selfService: Boolean = false, commissionPerUnit: Int = 0, productKey: String = ""): ServiceItem? {
        if (!boleh("owner", "owner.manage")) return null
        val id = name.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-').ifBlank { "svc-${newId()}" }
        val unique = if (services.any { it.id == id }) "$id-${newId()}" else id
        val finalUnit = if (selfService) "Load" else unit.trim().ifBlank { "pcs" }
        val linkedProduct = productForKey(productKey)?.key ?: if (retail) productForName(name)?.key.orEmpty() else ""
        val s = ServiceItem(unique, name.trim(), finalUnit, price.coerceAtLeast(0), retail && !selfService, dropOut && !selfService, selfService, commissionPerUnit.coerceAtLeast(0), linkedProduct)
        services.add(s)
        log("Layanan ${s.name} ditambah", session.value?.branchId ?: branches.firstOrNull()?.id.orEmpty())
        bump()
        return s
    }

    fun updateService(id: String, name: String, unit: String, price: Int, retail: Boolean, dropOut: Boolean, selfService: Boolean = false, commissionPerUnit: Int = 0, productKey: String = ""): String? {
        if (!boleh("owner", "owner.manage")) return tolak("owner.manage", "Akun ini tidak dapat mengubah layanan")
        val i = services.indexOfFirst { it.id == id }
        if (i < 0) return null
        services[i] = services[i].copy(
            name = name.trim(),
            unit = if (selfService) "Load" else unit.trim().ifBlank { services[i].unit },
            price = price.coerceAtLeast(0),
            retail = retail && !selfService,
            dropOut = dropOut && !selfService,
            selfService = selfService,
            commissionPerUnit = commissionPerUnit.coerceAtLeast(0),
            productKey = productForKey(productKey)?.key ?: if (retail) productForName(name)?.key.orEmpty() else "",
        )
        log("Layanan ${name.trim()} diubah", session.value?.branchId ?: branches.firstOrNull()?.id.orEmpty())
        bump()
        return null
    }

    fun deleteService(id: String): String? {
        if (!boleh("owner", "owner.manage")) return tolak("owner.manage", "Akun ini tidak dapat menghapus layanan")
        val s = services.find { it.id == id } ?: return "Layanan tidak ketemu"
        services.removeAll { it.id == id }
        cart.removeAll { it.service.id == id }
        log("Layanan ${s.name} dihapus", session.value?.branchId ?: branches.firstOrNull()?.id.orEmpty())
        bump()
        return null
    }

    fun addProduct(name: String, stock: Int, min: Int, initialBranchIds: Set<String>, kind: ProductKind = ProductKind.BahanHabisPakai, unit: String = "pcs"): Product? {
        if (!boleh("owner", "owner.manage")) return null
        val p = Product(name.trim(), 0, min.coerceAtLeast(0), "p-${newId()}", kind, unit.trim().ifBlank { "pcs" })
        products.add(p)
        branches.forEach { branch ->
            branchStocks.add(BranchStock(branch.id, p.key, if (branch.id in initialBranchIds) stock.coerceAtLeast(0) else 0))
        }
        log("Produk ${p.name} ditambah", session.value?.branchId ?: branches.firstOrNull()?.id.orEmpty())
        bump()
        return p
    }

    fun updateProduct(key: String, name: String, min: Int, kind: ProductKind, unit: String): String? {
        if (!boleh("owner", "owner.manage")) return tolak("owner.manage", "Akun ini tidak dapat mengubah produk")
        val i = products.indexOfFirst { it.key == key || it.name == key }
        if (i < 0) return null
        val old = products[i]
        val updated = old.copy(name = name.trim(), min = min.coerceAtLeast(0), id = old.id.ifBlank { "p-${newId()}" }, kind = kind, unit = unit.trim().ifBlank { old.unit })
        products[i] = updated
        branchStocks.indices.filter { branchStocks[it].productKey == old.key }.forEach { index ->
            branchStocks[index] = branchStocks[index].copy(productKey = updated.key)
        }
        log("Produk ${name.trim()} diubah", session.value?.branchId ?: branches.firstOrNull()?.id.orEmpty())
        bump()
        return null
    }

    fun deleteProduct(key: String): String? {
        if (!boleh("owner", "owner.manage")) return tolak("owner.manage", "Akun ini tidak dapat menghapus produk")
        val p = products.find { it.key == key || it.name == key } ?: return "Produk tidak ketemu"
        products.removeAll { it.key == key || it.name == key }
        branchStocks.removeAll { it.productKey == p.key }
        log("Produk ${p.name} dihapus", session.value?.branchId ?: branches.firstOrNull()?.id.orEmpty())
        bump()
        return null
    }

    fun addInventory(
        branchId: String,
        name: String,
        category: InventoryCategory,
        brand: String,
        serialNumber: String,
        quantity: Int,
        unit: String,
        status: InventoryStatus,
        purchaseAt: String,
        notes: String,
        sellable: Boolean,
        assetTypeId: String = "",
        photoPath: String = "",
    ): InventoryItem? {
        if (!boleh("inventory", "inventory.write")) return null
        val row = InventoryItem(
            id = "inv-${newId()}", branchId = branchId, name = name.trim(), category = category,
            brand = brand.trim(), serialNumber = serialNumber.trim(), quantity = quantity.coerceAtLeast(0),
            unit = unit.trim().ifBlank { "unit" }, status = status, purchaseAt = purchaseAt,
            notes = notes.trim(), sellable = sellable,
            assetTypeId = assetTypeId,
            assetCode = nextAssetCode(branchId, assetTypeId),
            photoPath = photoPath,
        )
        inventory.add(0, row)
        log("Aset ${row.assetCode} ${row.name} ditambah · ${row.quantity} ${row.unit} · ${row.status.label}", branchId)
        bump()
        return row
    }

    /**
     * Aset ID dibuat sistem dari kode cabang, kode jenis aset, lalu nomor urut pada cabang itu.
     * Nomor urut diambil dari kode tertinggi yang sudah ada, bukan jumlah baris, supaya kode
     * tidak terpakai ulang setelah sebuah aset dihapus.
     */
    fun nextAssetCode(branchId: String, assetTypeId: String): String {
        val branchCode = branches.firstOrNull { it.id == branchId }?.code.orEmpty()
        val type = assetTypes.firstOrNull { it.id == assetTypeId }
        val typeCode = type?.code.orEmpty()
            .ifBlank { defaultAssetTypes().firstOrNull { it.id == assetTypeId }?.code.orEmpty() }
        val head = AssetCodes.prefix(branchCode, typeCode)
        val codes = inventory.filter { it.branchId == branchId && it.assetCode.startsWith(head) }.map { it.assetCode }
        return AssetCodes.next(branchCode, typeCode, codes)
    }

    /** Jenis bawaan dipakai saat server belum punya katalog jenis aset. */
    fun defaultAssetTypes(): List<AssetType> = listOf(
        AssetType("at-mesin-cuci", "MC", "Mesin cuci"),
        AssetType("at-mesin-pengering", "MP", "Mesin pengering"),
        AssetType("at-setrika", "ST", "Setrika / steamer"),
        AssetType("at-timbangan", "TB", "Timbangan"),
        AssetType("at-peralatan", "PR", "Peralatan operasional"),
        AssetType("at-lainnya", "LN", "Lainnya"),
    )

    fun addAssetType(code: String, name: String): String? {
        if (!boleh("owner", "owner.manage")) return tolak("owner.manage", "Akun ini tidak dapat menambah jenis aset")
        val cleanCode = code.trim().uppercase().filter { it.isLetterOrDigit() }.take(4)
        val cleanName = name.trim()
        if (cleanName.isBlank()) return "Nama jenis aset wajib diisi"
        if (cleanCode.isBlank()) return "Kode jenis aset wajib diisi"
        if (assetTypes.any { it.code.equals(cleanCode, true) }) return "Kode $cleanCode sudah dipakai"
        if (assetTypes.any { it.name.equals(cleanName, true) }) return "Jenis $cleanName sudah ada"
        assetTypes.add(AssetType("at-${newId()}", cleanCode, cleanName))
        log("Jenis aset $cleanName ($cleanCode) ditambah", session.value?.branchId ?: branches.firstOrNull()?.id.orEmpty())
        bump()
        return null
    }

    fun updateAssetType(row: AssetType): String? {
        if (!boleh("owner", "owner.manage")) return tolak("owner.manage", "Akun ini tidak dapat mengubah jenis aset")
        val index = assetTypes.indexOfFirst { it.id == row.id }
        if (index < 0) return null
        assetTypes[index] = row.copy(code = row.code.trim().uppercase().take(4), name = row.name.trim())
        bump()
        return null
    }

    /** Jenis yang sudah dipakai aset tidak dihapus supaya kode aset lama tetap terbaca. */
    fun deleteAssetType(id: String): String? {
        if (!boleh("owner", "owner.manage")) return tolak("owner.manage", "Akun ini tidak dapat menghapus jenis aset")
        if (inventory.any { it.assetTypeId == id }) return "Jenis ini masih dipakai aset. Nonaktifkan saja."
        assetTypes.removeAll { it.id == id }
        bump()
        return null
    }

    fun assetTypeName(id: String): String =
        (assetTypes + defaultAssetTypes()).firstOrNull { it.id == id }?.name.orEmpty()

    fun updateInventory(row: InventoryItem): String? {
        if (!boleh("inventory", "inventory.write")) return tolak("inventory.write", "Akun ini tidak dapat mengubah aset")
        val index = inventory.indexOfFirst { it.id == row.id }
        if (index < 0) return null
        inventory[index] = row.copy(name = row.name.trim(), quantity = row.quantity.coerceAtLeast(0), unit = row.unit.trim().ifBlank { "unit" })
        log("Aset ${row.assetCode.ifBlank { row.name }} diubah · ${row.status.label}", row.branchId)
        bump()
        return null
    }

    fun deleteInventory(id: String): String? {
        if (!boleh("inventory", "inventory.write")) return tolak("inventory.write", "Akun ini tidak dapat menghapus aset")
        val row = inventory.firstOrNull { it.id == id } ?: return "Aset tidak ditemukan"
        inventory.removeAll { it.id == id }
        AssetPhotos.delete(row.photoPath)
        log("Aset ${row.assetCode.ifBlank { row.name }} dihapus", row.branchId)
        bump()
        return null
    }

    fun addExpense(branchId: String, category: ExpenseCategory, amount: Int, occurredAtMs: Long, note: String): Expense? {
        val s = session.value ?: return null
        if (!boleh("expense", "expense.write")) return null
        val row = Expense(
            id = "cost-${newId()}", branchId = branchId, category = category,
            amount = amount.coerceAtLeast(0), occurredAtMs = occurredAtMs,
            occurredAt = Clock.nowLabel(occurredAtMs), note = note.trim(), by = s.name,
        )
        expenses.add(0, row)
        log("Biaya ${category.label} ${rp(row.amount)} · ${row.note}", branchId)
        bump()
        return row
    }

    fun deleteExpense(id: String): String? {
        if (!boleh("expense", "expense.write")) return tolak("expense.write")
        val row = expenses.firstOrNull { it.id == id } ?: return "Biaya tidak ditemukan"
        expenses.removeAll { it.id == id }
        log("Biaya ${row.category.label} ${rp(row.amount)} dihapus", row.branchId)
        bump()
        return null
    }

    fun todayAttendance(email: String = session.value?.email.orEmpty()): AttendanceRecord? =
        attendance.firstOrNull { it.staffEmail.equals(email, true) && it.workDate == Clock.dateKey() }

    fun visibleAttendance(fromMs: Long? = null, untilMs: Long? = null, branchIds: Set<String> = emptySet()): List<AttendanceRecord> {
        val s = session.value ?: return emptyList()
        return attendance.filter { row ->
            val maySee = if (s.role == Role.Owner) branchIds.isEmpty() || row.branchId in branchIds
            else row.staffEmail.equals(s.email, true) && row.branchId == s.branchId
            maySee && (fromMs == null || row.checkInAtMs >= fromMs) && (untilMs == null || row.checkInAtMs <= untilMs)
        }.sortedByDescending { it.checkInAtMs }
    }

    fun checkIn(branchId: String, note: String = "", photoPath: String = ""): String? {
        val s = session.value ?: return "Silakan masuk kembali"
        if (!boleh("attendance", "attendance.write")) return tolak("attendance.write")
        if (s.role != Role.Owner && branchId != s.branchId) return "Cabang absensi tidak sesuai akun"
        if (s.role == Role.Owner && branches.none { it.id == branchId }) return "Cabang tidak ditemukan"
        if (todayAttendance(s.email) != null) return "Anda sudah absen masuk hari ini"
        if (photoPath.isBlank()) return "Ambil foto absensi masuk terlebih dahulu"
        val now = Clock.nowMs()
        val row = AttendanceRecord(
            id = "att-${java.util.UUID.randomUUID()}",
            staffEmail = s.email,
            staffName = s.name,
            branchId = branchId,
            workDate = Clock.dateKey(now),
            checkInAtMs = now,
            checkInAt = Clock.nowLabel(now),
            note = note.trim(),
            checkInPhotoPath = photoPath,
        )
        attendance.add(0, row)
        log("Absen masuk ${s.name}", branchId)
        bump()
        return null
    }

    fun checkOut(note: String = "", photoPath: String = ""): String? {
        val s = session.value ?: return "Silakan masuk kembali"
        if (!boleh("attendance", "attendance.write")) return tolak("attendance.write")
        val index = attendance.indexOfFirst {
            it.staffEmail.equals(s.email, true) && it.workDate == Clock.dateKey() && it.checkOutAtMs == null
        }
        if (index < 0) return "Absen masuk hari ini belum ditemukan"
        if (photoPath.isBlank()) return "Ambil foto absensi pulang terlebih dahulu"
        val now = Clock.nowMs()
        val old = attendance[index]
        attendance[index] = old.copy(
            checkOutAtMs = now,
            checkOutAt = Clock.nowLabel(now),
            note = note.trim().ifBlank { old.note },
            checkOutPhotoPath = photoPath,
        )
        log("Absen pulang ${s.name}", old.branchId)
        bump()
        return null
    }

    fun exportSnapshot(): Snapshot = snapshot().copy(sessionEmail = null)

    private fun uniqueBranchId(name: String): String {
        val base = name.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-').ifBlank { "cabang" }
        if (branches.none { it.id == base }) return base
        return "$base-${newId()}"
    }

    private fun grantOwnerBranch(id: String) {
        val ownerIdx = staff.indexOfFirst { it.role == Role.Owner }
        if (ownerIdx >= 0) {
            val o = staff[ownerIdx]
            staff[ownerIdx] = o.copy(branchIds = (o.branchIds + id).distinct())
        }
    }

    fun nextNotaId(branchId: String): String {
        // Kode cabang diambil dengan firstOrNull: cabang bisa belum ada di katalog saat impor atau
        // sinkronisasi, dan first { } melempar sehingga pembuatan nota baru menutup aplikasi.
        val b = branches.firstOrNull { it.id == branchId } ?: branches.firstOrNull()
        val prefix = "${b?.code.orEmpty().ifBlank { "CAB" }}-${Clock.yearMonth()}-"
        val max = notas.filter { it.id.startsWith(prefix) }
            .mapNotNull { it.id.removePrefix(prefix).substringBefore('-').toIntOrNull() }
            .maxOrNull() ?: 0
        val deviceSafeSuffix = java.util.UUID.randomUUID().toString().take(5).uppercase()
        return prefix + (max + 1).toString().padStart(4, '0') + "-$deviceSafeSuffix"
    }

    fun addToCart(svc: ServiceItem) {
        val exist = cart.find { it.service.id == svc.id }
        if (exist != null) exist.qty += if (svc.unit == "kg") 1.0 else 1.0
        else {
            val current = session.value
            cart.add(CartLine(svc, if (svc.unit == "kg") 3.0 else 1.0, handledByEmail = current?.email.orEmpty(), handledByName = current?.name.orEmpty()))
        }
        revision.intValue++
    }

    fun cartDelta(svcId: String, delta: Double) {
        val line = cart.find { it.service.id == svcId } ?: return
        line.qty = (line.qty + delta).coerceAtLeast(0.0)
        if (line.qty == 0.0) cart.remove(line)
        revision.intValue++
    }

    /**
     * Mengubah harga layanan pada satu transaksi.
     *
     * Ditolak untuk siapa pun yang tidak punya fungsi `service.price`. Bawaannya hanya Owner,
     * tetapi Owner boleh memberikannya ke role lain lewat Kontrol Akses Role.
     *
     * Pemeriksaan ini wajib ada di sini, bukan hanya dengan menyembunyikan tombolnya. Tombol
     * yang disembunyikan tetap bisa dilewati lewat jalur lain, sedangkan data harga adalah
     * data uang yang tidak boleh berubah tanpa izin.
     */
    fun setCartPrice(svcId: String, price: Int): Boolean {
        if (!canAccess("service", "service.price")) return false
        cart.find { it.service.id == svcId }?.unitPrice = price.coerceAtLeast(0)
        revision.intValue++
        return true
    }

    /** Apakah pengguna yang sedang masuk boleh mengubah harga Service. */
    fun canChangePrice(): Boolean = canAccess("service", "service.price")

    /**
     * Apakah pengguna yang sedang masuk boleh membuat Service baru.
     *
     * Dipakai layar Service baru untuk menampilkan pesan penolakan SEBELUM memanggil [saveNota].
     * Sebelumnya layar hanya memeriksa modul `service`, sedangkan fungsi `service.create` tidak
     * pernah diperiksa di UI: Supervisor boleh membuka layarnya lalu aplikasi mati saat menekan
     * Simpan karena `saveNota` memakai `require`. Menyembunyikan menu saja bukan penjagaan.
     */
    fun canCreateService(): Boolean = canAccess("service", "service.create")

    /** Apakah pengguna yang sedang masuk boleh mengirim WhatsApp. */
    fun canSendWa(): Boolean = canAccess("whatsapp", "whatsapp.send")

    /** Apakah pengguna yang sedang masuk boleh mencatat perubahan stok. */
    fun canWriteStock(): Boolean = canAccess("stock", "stock.write")

    /** Apakah pengguna yang sedang masuk boleh mencatat pelunasan dan bukti cucian. */
    fun canTakePayment(): Boolean = canAccess("service", "service.payment")

    /** Apakah pengguna yang sedang masuk boleh menambah atau mengubah aset cabang. */
    fun canWriteInventory(): Boolean = canAccess("inventory", "inventory.write")

    /** Apakah pengguna yang sedang masuk boleh mengelola jenis aset (data induk). */
    fun canManageAssetTypes(): Boolean = canAccess("owner", "owner.manage")

    fun setCartHandler(svcId: String, email: String) {
        if (session.value?.role != Role.Owner) return
        val staffMember = staff.firstOrNull { it.email.equals(email, true) } ?: return
        cart.find { it.service.id == svcId }?.let {
            it.handledByEmail = staffMember.email
            it.handledByName = staffMember.name
        }
        revision.intValue++
    }

    fun retailStockShortages(cartLines: List<CartLine>, branchId: String): List<String> =
        cartLines.filter { it.service.retail }.mapNotNull { line ->
            val product = linkedProduct(line.service) ?: return@mapNotNull "Produk untuk ${line.service.name} belum dihubungkan"
            val needed = line.qty.toInt()
            val available = stockOf(product.key, branchId)
            if (needed > available) "${product.name}: perlu $needed, tersedia $available" else null
        }

    fun saveNota(
        customer: Customer,
        cartLines: List<CartLine>,
        paid: Int,
        pickup: String,
        method: PayMethod,
        branchId: String,
        sendWa: Boolean,
    ): Nota {
        val s = session.value!!
        // UI memeriksa izin ini lebih dulu dan menampilkan pesan; ini penjaga lapis kedua.
        check(boleh("service", "service.create")) { tolak("service.create", "Akun ini tidak dapat membuat Service baru") }
        val permittedBranch = when (s.role) {
            Role.Owner -> branches.any { it.id == branchId }
            else -> branchId == s.branchId
        }
        require(permittedBranch) { "Cabang transaksi tidak tersedia untuk akun ini" }
        require(cartLines.isNotEmpty()) { "Service harus memiliki minimal satu layanan" }
        require(cartLines.all { it.qty.isFinite() && it.qty > 0.0 && it.qty <= 9999.0 && (it.service.unit == "kg" || it.qty % 1.0 == 0.0) }) { "Jumlah layanan belum valid" }
        require(retailStockShortages(cartLines, branchId).isEmpty()) { "Stok retail cabang tidak mencukupi" }
        val total = cartLines.sumOf { (it.qty * it.unitPrice.coerceAtLeast(0)).toInt() }
        require(paid in 0..total) { "Pembayaran harus berada antara Rp 0 dan total Service" }
        val t = Clock.nowMs()
        val nota = Nota(
            id = nextNotaId(branchId),
            branchId = branchId,
            kasir = s.name,
            kasirEmail = s.email,
            customer = customer.name,
            phone = customer.phone,
            items = cartLines.joinToString { "${it.service.name} ${displayQuantity(it.qty)} ${it.service.unit}" },
            total = total,
            paid = paid.coerceAtLeast(0),
            pay = if (paid >= total && total > 0) PayStatus.Lunas else PayStatus.Belum,
            laundry = LaundryStatus.Masuk,
            createdAt = Clock.nowLabel(t),
            createdAtMs = t,
            pickupAt = pickup,
            waSent = false,
            dropOut = cartLines.any { it.service.dropOut },
            payMethod = method,
            lines = cartLines.map {
                val handlerEmail = if (s.role == Role.Owner) it.handledByEmail.ifBlank { s.email } else s.email
                val handlerName = if (s.role == Role.Owner) it.handledByName.ifBlank { s.name } else s.name
                NotaLine(
                    serviceId = it.service.id,
                    name = it.service.name,
                    qty = it.qty,
                    unit = it.service.unit,
                    unitPrice = it.unitPrice,
                    handledByEmail = handlerEmail,
                    handledByName = handlerName,
                    commissionPerUnit = it.service.commissionPerUnit,
                    productKey = it.service.productKey.ifBlank { linkedProduct(it.service)?.key.orEmpty() },
                )
            },
        )
        notas.add(0, nota)
        if (paid > 0) {
            payments.add(0, PaymentRecord("pay-${syncEventId()}", nota.id, branchId, paid, method, t, Clock.nowLabel(t), s.name))
        }
        cartLines.filter { it.service.retail }.forEach { line ->
            val qty = line.qty.toInt()
            var balanceAfter: Int? = null
            linkedProduct(line.service)?.let { product ->
                val balance = branchStocks.firstOrNull { it.branchId == branchId && it.productKey == product.key }
                    ?: BranchStock(branchId, product.key, 0).also { branchStocks.add(it) }
                balance.stock = (balance.stock - qty).coerceAtLeast(0)
                balanceAfter = balance.stock
            }
            stockMoves.add(
                0,
                StockMove(Clock.nowLabel(t), t, line.service.name, StockKind.Jual, -qty, s.name, branchId, "Jual via nota", nota.id, balanceAfter, syncEventId()),
            )
        }
        log("Nota ${nota.id} disimpan · ${nota.pay.label} · ${method.label}", branchId, nota.id)
        cartLines.filter { it.unitPrice != it.service.price }.forEach { line ->
            log("Harga ${line.service.name} pada ${nota.id}: ${rp(line.service.price)} → ${rp(line.unitPrice)} per ${line.service.unit}", branchId, nota.id)
        }
        cart.clear()
        notaBranchId.value = null
        bump()
        if (sendWa) markWaSent(nota.id)
        return nota
    }

    /** Mengoreksi item Service yang sudah tersimpan sambil menjaga stok cabang dan audit trail. */
    fun updateNotaLines(id: String, newLines: List<NotaLine>): String? {
        val s = session.value ?: return "Silakan masuk kembali"
        val index = notas.indexOfFirst { it.id == id }
        if (index < 0) return "Service tidak ditemukan"
        val old = notas[index]
        if (!boleh("service", "service.correct")) {
            return tolak("service.correct", "Akun ini tidak dapat mengoreksi Service tersebut")
        }
        if (s.role == Role.Supervisor || (s.role != Role.Owner && s.branchId != old.branchId)) {
            return "Akun ini tidak dapat mengoreksi Service tersebut"
        }
        if (old.waSent && s.role != Role.Owner) return "Service sudah dikirim ke pelanggan; hanya Owner yang dapat mengoreksi"
        val clean = newLines.map {
            it.copy(
                qty = it.qty.coerceAtLeast(0.0),
                unitPrice = it.unitPrice.coerceAtLeast(0),
                handledByEmail = if (s.role == Role.Owner) it.handledByEmail else s.email,
                handledByName = if (s.role == Role.Owner) it.handledByName else s.name,
            )
        }.filter { it.qty > 0.0 }
        if (clean.isEmpty()) return "Service harus memiliki minimal satu layanan"
        if (clean.any { !it.qty.isFinite() || it.qty > 9999.0 || (it.unit != "kg" && it.qty % 1.0 != 0.0) }) {
            return "Jumlah layanan belum valid"
        }

        val total = clean.sumOf { (it.qty * it.unitPrice).toInt() }
        if (total < old.paid) return "Total koreksi tidak boleh lebih kecil dari pembayaran yang sudah diterima. Catat pengembalian dana terlebih dahulu."

        val oldQty = old.lines.groupBy { it.serviceId }.mapValues { (_, rows) -> rows.sumOf { it.qty }.toInt() }
        val newQty = clean.groupBy { it.serviceId }.mapValues { (_, rows) -> rows.sumOf { it.qty }.toInt() }
        val retailProducts = (old.lines + clean).mapNotNull { line ->
            val product = productForKey(line.productKey).takeIf { line.productKey.isNotBlank() }
                ?: services.firstOrNull { it.id == line.serviceId }?.let(::linkedProduct)
                ?: productForName(line.name)
            product?.let { line.serviceId to it }
        }.toMap()
        retailProducts.forEach { (serviceId, product) ->
            val availableAfterRestore = stockOf(product.key, old.branchId) + (oldQty[serviceId] ?: 0)
            val needed = newQty[serviceId] ?: 0
            if (needed > availableAfterRestore) return "Stok ${product.name} di cabang hanya tersedia $availableAfterRestore"
        }

        val now = Clock.nowMs()
        retailProducts.forEach { (serviceId, product) ->
            val delta = (oldQty[serviceId] ?: 0) - (newQty[serviceId] ?: 0)
            if (delta != 0) {
                val balance = branchStocks.firstOrNull { it.branchId == old.branchId && it.productKey == product.key }
                    ?: BranchStock(old.branchId, product.key, 0).also { branchStocks.add(it) }
                balance.stock = (balance.stock + delta).coerceAtLeast(0)
                stockMoves.add(
                    0,
                    StockMove(
                        Clock.nowLabel(now), now, product.name,
                        if (delta > 0) StockKind.Tambah else StockKind.Kurang,
                        delta, s.name, old.branchId, "Koreksi Service $id", id, balance.stock, syncEventId(),
                    ),
                )
            }
        }

        old.lines.forEach { before ->
            val after = clean.firstOrNull { it.serviceId == before.serviceId }
            if (after == null) log("${before.name} dihapus dari Service $id", old.branchId, id)
            else {
                if (before.qty != after.qty) log("Jumlah ${before.name} pada $id: ${before.qty} → ${after.qty} ${after.unit}", old.branchId, id)
                if (before.unitPrice != after.unitPrice) log("Harga ${before.name} pada $id: ${rp(before.unitPrice)} → ${rp(after.unitPrice)} per ${after.unit}", old.branchId, id)
                if (before.handledByEmail != after.handledByEmail) log("Petugas ${before.name} pada $id: ${before.handledByName.ifBlank { old.kasir }} → ${after.handledByName.ifBlank { old.kasir }}", old.branchId, id)
            }
        }
        clean.filter { after -> old.lines.none { it.serviceId == after.serviceId } }
            .forEach { log("${it.name} ditambahkan ke Service $id", old.branchId, id) }

        val correctedPaid = old.paid.coerceAtMost(total)
        val updated = old.copy(
            items = clean.joinToString { "${it.name} ${displayQuantity(it.qty)} ${it.unit}" },
            total = total,
            paid = correctedPaid,
            pay = if (total > 0 && correctedPaid >= total) PayStatus.Lunas else PayStatus.Belum,
            lines = clean,
        )
        notas[index] = updated
        log("Service $id dikoreksi · total ${rp(old.total)} → ${rp(total)}", old.branchId, id)
        bump()
        return null
    }

    private fun displayQuantity(qty: Double): String =
        if (qty % 1.0 == 0.0) qty.toInt().toString() else qty.toString().replace('.', ',')

    /** Menghapus Service dan mengembalikan stok barang jual ke cabang asal. */
    fun deleteNota(id: String): String? {
        val s = session.value ?: return "Silakan masuk kembali"
        val old = notas.firstOrNull { it.id == id } ?: return "Service tidak ditemukan"
        if (!boleh("service", "service.correct")) {
            return tolak("service.correct", "Akun ini tidak dapat menghapus Service tersebut")
        }
        if (s.role == Role.Supervisor || (s.role != Role.Owner && s.branchId != old.branchId)) {
            return "Akun ini tidak dapat menghapus Service tersebut"
        }
        if (old.waSent && s.role != Role.Owner) return "Service sudah dikirim ke pelanggan; hanya Owner yang dapat menghapus"
        if (old.paid > 0) return "Service yang sudah menerima pembayaran tidak dapat dihapus. Catat pengembalian dana terlebih dahulu."
        val now = Clock.nowMs()
        old.lines.forEach { line ->
            val product = productForKey(line.productKey).takeIf { line.productKey.isNotBlank() }
                ?: services.firstOrNull { it.id == line.serviceId }?.let(::linkedProduct)
                ?: productForName(line.name)
                ?: return@forEach
            val qty = line.qty.toInt()
            if (qty <= 0) return@forEach
            val balance = branchStocks.firstOrNull { it.branchId == old.branchId && it.productKey == product.key }
                ?: BranchStock(old.branchId, product.key, 0).also { branchStocks.add(it) }
            balance.stock += qty
            stockMoves.add(0, StockMove(Clock.nowLabel(now), now, product.name, StockKind.Tambah, qty, s.name, old.branchId, "Service $id dihapus", id, balance.stock, syncEventId(), requiresDeletedNota = true))
        }
        notas.removeAll { it.id == id }
        if (id !in deletedNotaIds) deletedNotaIds.add(id)
        log("Service $id dihapus · ${old.customer} · ${rp(old.total)}", old.branchId, id)
        bump()
        return null
    }

    fun markWaSent(id: String): String? {
        if (!boleh("whatsapp", "whatsapp.send")) return tolak("whatsapp.send", "Akun ini tidak dapat mengirim WhatsApp")
        val n = notas.find { it.id == id } ?: return null
        val t = Clock.nowMs()
        n.waSent = true
        n.waAt = Clock.nowLabel(t)
        log("WA nota ${n.id} terkirim → archive", n.branchId, n.id)
        bump()
        return null
    }

    fun advanceLaundry(id: String): String? {
        if (!boleh("queue", "queue.status")) return tolak("queue.status", "Akun ini tidak dapat mengubah status pengerjaan")
        val s = session.value ?: return "Silakan masuk kembali"
        val n = notas.find { it.id == id } ?: return "Service tidak ditemukan"
        if (s.role != Role.Owner && s.branchId != n.branchId) return "Cabang Service tidak sesuai akun"
        val next = n.laundry.next ?: return "Service sudah selesai"
        n.laundry = next
        if (next == LaundryStatus.Selesai && n.completedAt == null) n.completedAt = Clock.nowLabel()
        log("${n.id} → ${n.laundry.label}", n.branchId, n.id)
        bump()
        return null
    }

    fun markLunas(id: String, method: PayMethod = PayMethod.Tunai): String? {
        val s = session.value ?: return "Silakan masuk kembali"
        val n = notas.find { it.id == id } ?: return "Service tidak ditemukan"
        if (!boleh("service", "service.payment")) {
            return tolak("service.payment", "Akun ini tidak dapat mencatat pembayaran Service tersebut")
        }
        if (s.role == Role.Supervisor || (s.role != Role.Owner && s.branchId != n.branchId)) return "Akun ini tidak dapat mencatat pembayaran Service tersebut"
        val remaining = (n.total - n.paid).coerceAtLeast(0)
        if (remaining == 0 || n.pay == PayStatus.Lunas) return "Pembayaran Service sudah lunas"
        val now = Clock.nowMs()
        n.paid += remaining
        n.pay = PayStatus.Lunas
        n.payMethod = method
        payments.add(0, PaymentRecord("pay-${syncEventId()}", n.id, n.branchId, remaining, method, now, Clock.nowLabel(now), s.name))
        log("${n.id} menerima ${rp(remaining)} · ${method.label}", n.branchId, n.id)
        bump()
        return null
    }

    fun markPickedUp(id: String): String? {
        if (!boleh("queue", "queue.handover")) return tolak("queue.handover", "Akun ini tidak dapat menyerahkan pesanan ke pelanggan")
        val n = notas.find { it.id == id } ?: return "Nota tidak ditemukan"
        if (n.laundry != LaundryStatus.Selesai) return "Pesanan belum selesai dikerjakan"
        if (n.pay != PayStatus.Lunas) return "Lunasi pembayaran sebelum serah terima"
        if (n.pickedUpAt != null) return "Pesanan sudah diserahkan"
        n.pickedUpAt = Clock.nowLabel()
        log("${n.id} diserahkan kepada pelanggan", n.branchId, n.id)
        bump()
        return null
    }

    fun addLocalProof(id: String, uri: Uri): String? {
        val ctx = app ?: return null
        val path = FileExports.copyProof(ctx, id, uri) ?: return null
        val n = notas.find { it.id == id } ?: return null
        n.photos.add(path)
        log("Bukti disimpan di HP: ${path.substringAfterLast('/')}", n.branchId, n.id)
        bump()
        return path
    }

    fun editStock(product: String, branchId: String, kind: StockKind, qty: Int, occurredAtMs: Long = Clock.nowMs()): String? {
        if (!boleh("stock", "stock.write")) return tolak("stock.write", "Akun ini tidak dapat mencatat stok")
        editStocks(mapOf(product to qty), branchId, kind, occurredAtMs)
        return null
    }

    fun editStocks(changes: Map<String, Int>, branchId: String, kind: StockKind, occurredAtMs: Long = Clock.nowMs()): Int {
        if (!boleh("stock", "stock.write")) return TOLAK_STOK
        val s = session.value ?: return 0
        if (s.role != Role.Owner && branchId != s.branchId) return 0
        val t = occurredAtMs
        var saved = 0
        changes.forEach { (product, qty) ->
            val p = products.find { it.key == product || it.name == product } ?: return@forEach
            if (qty < 0 || (qty == 0 && kind != StockKind.Update)) return@forEach
            val balance = branchStocks.firstOrNull { it.branchId == branchId && it.productKey == p.key }
                ?: BranchStock(branchId, p.key, 0).also { branchStocks.add(it) }
            if (kind == StockKind.Kurang && qty > balance.stock) return@forEach
            val delta = when (kind) {
                StockKind.Tambah -> qty.also { balance.stock += qty }
                StockKind.Kurang -> (-qty).also { balance.stock -= qty }
                StockKind.Update -> qty.also { balance.stock = qty }
                StockKind.Jual -> -qty
            }
            stockMoves.add(0, StockMove(Clock.nowLabel(t), t, p.key, kind, if (kind == StockKind.Update) qty else delta, s.name, branchId, "Pencatatan stok massal", balanceAfter = balance.stock, syncId = syncEventId()))
            log("Stok ${p.name} ${kind.label} $qty → sisa ${balance.stock}", branchId)
            saved++
        }
        if (saved > 0) bump()
        return saved
    }

    /** Owner dapat menerapkan pencatatan fisik yang sama untuk beberapa cabang sekaligus. */
    fun editStocks(changes: Map<String, Int>, branchIds: Set<String>, kind: StockKind, occurredAtMs: Long = Clock.nowMs()): Int {
        val s = session.value ?: return 0
        val targets = if (s.role == Role.Owner) branchIds else setOf(s.branchId)
        return targets.sumOf { branchId -> editStocks(changes, branchId, kind, occurredAtMs) }
    }

    private fun syncEventId(): String = UUID.randomUUID().toString()

    /**
     * ID unik untuk baris baru.
     *
     * Sebelumnya ID memakai milidetik saja. Impor template bisa membuat puluhan baris dalam
     * satu milidetik, sehingga ID-nya bertabrakan dan baris saling menimpa saat disimpan.
     */
    internal fun newId(): String = UUID.randomUUID().toString().take(13)

    fun closeCash(): CashClose? {
        val s = session.value ?: return null
        if (!boleh("cash", "cash.close")) return null
        val bid = if (s.role == Role.Owner) viewBranch.value else s.branchId
        if (bid == "all") return null
        val t = Clock.nowMs()
        if (cashCloses.any { it.branchId == bid && Clock.dateKey(it.atMs) == Clock.dateKey(t) }) return null
        val received = paymentRecords(notas.filter { it.branchId == bid }).filter { it.atMs >= Clock.todayStartMs() }
        val row = CashClose(
            id = "kas-$bid-$t-${syncEventId().take(8)}",
            at = Clock.nowLabel(t),
            atMs = t,
            by = s.name,
            branchId = bid,
            tunai = received.filter { it.method == PayMethod.Tunai }.sumOf { it.amount },
            qris = received.filter { it.method == PayMethod.Qris }.sumOf { it.amount },
            transfer = received.filter { it.method == PayMethod.Transfer }.sumOf { it.amount },
            piutang = piutang(notas.filter { it.branchId == bid }),
        )
        cashCloses.add(0, row)
        // bid tidak mungkin "all" di sini karena baris di atasnya sudah mengembalikan null.
        // Sebelumnya ada cabang tetap "melati" untuk kasus itu, padahal cabang tersebut sudah
        // tidak ada sehingga entri auditnya tidak pernah sampai ke perangkat mana pun.
        log(
            "Tutup kas ${row.at} · tunai ${rp(row.tunai)} · QRIS ${rp(row.qris)} · transfer ${rp(row.transfer)} · piutang ${rp(row.piutang)}",
            bid,
        )
        bump()
        return row
    }

    fun changeMyPassword(currentPassword: String, newPassword: String): String? {
        val current = session.value ?: return "Silakan masuk kembali"
        val account = staff.firstOrNull { it.email.equals(current.email, true) } ?: return "Akun tidak ditemukan"
        if (account.passwordHash.isNotBlank() && !Passwords.matches(currentPassword, account.passwordHash)) return "Kata sandi saat ini tidak sesuai"
        if (newPassword.length < 8) return "Kata sandi minimal 8 karakter"
        return updateStaff(account.email, account.name, account.role, account.branchIds, password = newPassword)
    }

    fun changeMyEmail(newEmail: String, password: String): String? {
        val current = session.value ?: return "Silakan masuk kembali"
        val account = staff.firstOrNull { it.email.equals(current.email, true) } ?: return "Akun tidak ditemukan"
        if (!Passwords.matches(password, account.passwordHash)) return "Kata sandi tidak sesuai"
        return updateStaff(account.email, account.name, account.role, account.branchIds, newEmail = newEmail)
    }

    fun deleteMyAccount(): Boolean {
        val s = session.value ?: return false
        if (s.role == Role.Owner) return false
        staff.removeAll { it.email.equals(s.email, ignoreCase = true) }
        log("Hapus akun ${s.email}", s.branchId)
        logout()
        bump()
        return true
    }

    fun notaText(n: Nota): String {
        val b = branches.firstOrNull { it.id == n.branchId }
            ?: Branch(n.branchId, n.id.substringBefore('-'), "Cabang ${n.branchId}", "", "")
        return ReceiptText.format(n, b, whatsappTemplate())
    }

    fun waMe(phone: String): String {
        val d = phone.filter { it.isDigit() }
        val n = if (d.startsWith("0")) "62${d.drop(1)}" else d
        return "https://wa.me/$n"
    }
}
