package com.tiftazani.laundryops.data

import com.tiftazani.laundryops.BuildConfig
import android.app.Application
import android.net.Uri
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import java.util.UUID

object CuciinStore {
    val ownerName = "Tiftazani Khara"
    val ownerEmail = "tiftazani.khara@gmail.com"

    val branches = mutableStateListOf<Branch>()
    val staff = mutableStateListOf<Staff>()
    val customers = mutableStateListOf<Customer>()
    val services = mutableStateListOf<ServiceItem>()
    val products = mutableStateListOf<Product>()
    val branchStocks = mutableStateListOf<BranchStock>()
    val inventory = mutableStateListOf<InventoryItem>()
    val expenses = mutableStateListOf<Expense>()
    val notas = mutableStateListOf<Nota>()
    val stockMoves = mutableStateListOf<StockMove>()
    val audit = mutableStateListOf<AuditRow>()
    val cashCloses = mutableStateListOf<CashClose>()
    val attendance = mutableStateListOf<AttendanceRecord>()
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
                Branch("melati", "MEL", "Cuciin Melati", "Jl. Melati 12, Bandung", "-6.9175,107.6191"),
                Branch("cibaduyut", "CIB", "Cuciin Cibaduyut", "Jl. Cibaduyut Raya 88, Bandung", "-6.9590,107.5920"),
            ),
        )
        staff.clear()
        staff.addAll(
            listOf(
                Staff(ownerName, ownerEmail, Role.Owner, listOf("melati", "cibaduyut"), passwordHash = Passwords.hash("test1234")),
                Staff("Rina", "rina@cuciin.id", Role.Kasir, listOf("melati"), passwordHash = Passwords.hash("test1234")),
                Staff("Dedi", "dedi@cuciin.id", Role.Kasir, listOf("melati"), passwordHash = Passwords.hash("test1234")),
                Staff("Andi", "andi@cuciin.id", Role.Supervisor, listOf("melati"), passwordHash = Passwords.hash("test1234")),
                Staff("Salsa", "salsa@cuciin.id", Role.Kasir, listOf("cibaduyut"), passwordHash = Passwords.hash("test1234")),
                Staff("Yoga", "yoga@cuciin.id", Role.Supervisor, listOf("cibaduyut"), passwordHash = Passwords.hash("test1234")),
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
                ServiceItem("sabun", "Sabun", "pcs", 8000, retail = true, dropOut = false),
                ServiceItem("softener", "Softener", "pcs", 10000, retail = true, dropOut = false),
                ServiceItem("parfum", "Parfum uk 100", "pcs", 15000, retail = true, dropOut = false),
            ),
        )
        products.clear()
        products.addAll(
            listOf(
                Product("Sabun", 0, 8),
                Product("Softener", 0, 6),
                Product("Parfum uk 100", 0, 5),
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
        attendance.clear()
        val t = Clock.nowMs()
        localUpdatedAt = t
        audit.add(AuditRow(Clock.nowLabel(t), t, ownerName, "melati", "Data awal: 2 cabang, antrian kosong. Isi stok & pelanggan sebelum nota pertama.", null, syncEventId()))
    }

    private fun isPristineSeed(snapshot: Snapshot): Boolean =
        snapshot.customers.isEmpty() && snapshot.notas.isEmpty() && snapshot.deletedNotaIds.isEmpty() &&
            snapshot.stockMoves.isEmpty() && snapshot.inventory.isEmpty() && snapshot.expenses.isEmpty() &&
            snapshot.cashCloses.isEmpty() && snapshot.attendance.isEmpty() &&
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
        ensureServiceDefaults()
        fill(products, s.products)
        fill(branchStocks, s.branchStocks)
        fill(inventory, s.inventory)
        fill(expenses, s.expenses)
        fill(notas, s.notas)
        deletedNotaIds.clear()
        deletedNotaIds.addAll(s.deletedNotaIds)
        notas.removeAll { it.id in deletedNotaIds }
        fill(stockMoves, s.stockMoves)
        ensureBranchStocks()
        fill(audit, s.audit)
        fill(cashCloses, s.cashCloses)
        fill(attendance, s.attendance)
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
        ensureServiceDefaults()
        fill(products, s.products)
        fill(branchStocks, s.branchStocks)
        fill(inventory, s.inventory)
        fill(expenses, s.expenses)
        val localPhotos = notas.associate { it.id to it.photos.toMutableList() }
        deletedNotaIds.addAll(s.deletedNotaIds.filterNot { it in deletedNotaIds })
        fill(notas, s.notas.filterNot { it.id in deletedNotaIds }.map { remote -> remote.copy(photos = localPhotos[remote.id] ?: mutableListOf()) })
        fill(stockMoves, s.stockMoves)
        ensureBranchStocks()
        fill(audit, s.audit)
        fill(cashCloses, s.cashCloses)
        fill(attendance, s.attendance)
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
        expenses = expenses.toList(),
        notas = notas.map { it.copy(photos = it.photos.toMutableList()) },
        stockMoves = stockMoves.toList(),
        audit = audit.toList(),
        cashCloses = cashCloses.toList(),
        attendance = attendance.toList(),
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

    fun branch(id: String = session.value?.branchId ?: viewBranch.value): Branch {
        if (id == "all") return branches.first()
        return branches.first { it.id == id }
    }

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

    fun selectedStockBranch(): String {
        val s = session.value ?: return branches.first().id
        if (s.role != Role.Owner) return s.branchId
        return stockBranchId.value
            ?.takeIf { id -> branches.any { it.id == id } }
            ?: branches.first().id.also { stockBranchId.value = it }
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
    }

    fun omzet(rows: List<Nota> = periodNotas()): Int = rows.sumOf { it.total }

    fun collected(rows: List<Nota> = periodNotas()): Int = rows.sumOf { it.paid }

    fun piutang(rows: List<Nota> = visibleNotas()): Int =
        rows.filter { it.pay == PayStatus.Belum }.sumOf { (it.total - it.paid).coerceAtLeast(0) }

    fun todayCollected(branchId: String? = null): Int {
        val start = Clock.todayStartMs()
        return notas.filter {
            it.createdAtMs >= start && (branchId == null || branchId == "all" || it.branchId == branchId)
        }.sumOf { it.paid }
    }

    fun todayByMethod(method: PayMethod, branchId: String): Int {
        val start = Clock.todayStartMs()
        return notas.filter {
            it.createdAtMs >= start &&
                (branchId == "all" || it.branchId == branchId) &&
                it.payMethod == method
        }.sumOf { it.paid }
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

    fun demoLogin(role: Role) {
        if (!BuildConfig.DEBUG) return
        when (role) {
            Role.Owner -> login(ownerEmail, skipPassword = true)
            Role.Kasir -> login("rina@cuciin.id", skipPassword = true)
            Role.Supervisor -> login("andi@cuciin.id", skipPassword = true)
        }
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

    fun register(name: String, email: String, role: Role, branchId: String, password: String = "") {
        val hash = Passwords.hash(password.ifBlank { "test1234" })
        staff.add(Staff(name.trim(), email.trim(), role, listOf(branchId), approved = false, passwordHash = hash))
        pendingName.value = name.trim()
        bump()
    }

    fun approve(name: String, ok: Boolean) {
        val i = staff.indexOfFirst { it.name == name }
        if (i >= 0) staff[i] = staff[i].copy(approved = ok)
        log("${if (ok) "Setujui" else "Tolak"} $name", session.value?.branchId ?: "melati")
        bump()
    }

    fun addBranch(name: String, code: String, location: String, maps: String): Branch {
        val id = uniqueBranchId(name)
        val b = Branch(id, code.uppercase().take(4).ifBlank { "CAB" }, name.trim(), location.trim(), maps.trim())
        branches.add(b)
        products.forEach { branchStocks.add(BranchStock(b.id, it.key, 0)) }
        grantOwnerBranch(b.id)
        log("Cabang ${b.name} ditambah", b.id)
        bump()
        return b
    }

    fun updateBranch(id: String, name: String, code: String, location: String, maps: String) {
        val i = branches.indexOfFirst { it.id == id }
        if (i < 0) return
        branches[i] = branches[i].copy(
            name = name.trim(),
            code = code.uppercase().take(4).ifBlank { branches[i].code },
            location = location.trim(),
            mapsQuery = maps.trim(),
        )
        log("Cabang ${name.trim()} diubah", id)
        bump()
    }

    fun updateBranchMap(id: String, maps: String) {
        val i = branches.indexOfFirst { it.id == id }
        if (i < 0 || maps.isBlank()) return
        branches[i] = branches[i].copy(mapsQuery = maps.trim())
        log("Lokasi peta ${branches[i].name} diperbarui", id)
        bump()
    }

    fun deleteBranch(id: String): String? {
        if (branches.size <= 1) return "Minimal satu cabang harus tersisa"
        if (notas.any { it.branchId == id }) return "Cabang memiliki riwayat Service dan tidak dapat dihapus"
        if (inventory.any { it.branchId == id } || expenses.any { it.branchId == id } ||
            stockMoves.any { it.branchId == id } || cashCloses.any { it.branchId == id } ||
            attendance.any { it.branchId == id }
        ) return "Cabang memiliki riwayat operasional dan tidak dapat dihapus"
        val gone = branches.find { it.id == id } ?: return "Cabang tidak ketemu"
        branches.removeAll { it.id == id }
        branchStocks.removeAll { it.branchId == id }
        val relocated = staff.map { u ->
            u.copy(branchIds = u.branchIds.filter { it != id }.ifEmpty { listOf(branches.first().id) })
        }
        staff.clear()
        staff.addAll(relocated)
        if (viewBranch.value == id) viewBranch.value = "all"
        log("Cabang ${gone.name} dihapus", branches.first().id)
        bump()
        return null
    }

    fun addCustomer(name: String, phone: String, address: String): Customer {
        val c = Customer("c-${Clock.nowMs()}", name.trim(), address.trim(), phone.trim())
        customers.add(0, c)
        selectedCustomer.value = c
        log("Pelanggan ${c.name} ditambah", session.value?.branchId ?: branches.first().id)
        bump()
        return c
    }

    fun updateCustomer(id: String, name: String, phone: String, address: String) {
        val i = customers.indexOfFirst { it.id == id }
        if (i < 0) return
        customers[i] = customers[i].copy(name = name.trim(), phone = phone.trim(), address = address.trim())
        if (selectedCustomer.value?.id == id) selectedCustomer.value = customers[i]
        log("Pelanggan ${name.trim()} diubah", session.value?.branchId ?: branches.first().id)
        bump()
    }

    fun deleteCustomer(id: String): String? {
        val c = customers.find { it.id == id } ?: return "Pelanggan tidak ketemu"
        customers.removeAll { it.id == id }
        if (selectedCustomer.value?.id == id) selectedCustomer.value = null
        log("Pelanggan ${c.name} dihapus", session.value?.branchId ?: branches.first().id)
        bump()
        return null
    }

    fun addStaff(name: String, email: String, role: Role, branchIds: List<String>, password: String = "", approved: Boolean = true): String? {
        val em = email.trim()
        if (name.isBlank() || em.isBlank()) return "Nama dan email wajib"
        if (staff.any { it.email.equals(em, ignoreCase = true) }) return "Email sudah dipakai"
        val bids = branchIds.ifEmpty { listOf(branches.first().id) }
        val hash = if (password.isBlank()) "" else Passwords.hash(password)
        staff.add(Staff(name.trim(), em, role, bids, approved = approved, passwordHash = hash))
        log("User ${name.trim()} (${role.name}) ditambah", bids.first())
        bump()
        return null
    }

    fun updateStaff(email: String, name: String, role: Role, branchIds: List<String>, password: String? = null, approved: Boolean? = null, newEmail: String = email): String? {
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
        val u = staff.find { it.email.equals(email, ignoreCase = true) } ?: return "User tidak ketemu"
        if (u.role == Role.Owner && staff.count { it.role == Role.Owner } <= 1) return "Owner terakhir tidak bisa dihapus"
        if (session.value?.email.equals(email, ignoreCase = true) == true) return "Tidak bisa hapus akun yang sedang login. Pakai Hapus akun saya."
        staff.removeAll { it.email.equals(email, ignoreCase = true) }
        log("User ${u.name} dihapus", u.branchIds.firstOrNull() ?: branches.first().id)
        bump()
        return null
    }

    fun addService(name: String, unit: String, price: Int, retail: Boolean, dropOut: Boolean, selfService: Boolean = false, commissionPerUnit: Int = 0): ServiceItem {
        val id = name.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-').ifBlank { "svc-${Clock.nowMs()}" }
        val unique = if (services.any { it.id == id }) "$id-${Clock.nowMs()}" else id
        val finalUnit = if (selfService) "Load" else unit.trim().ifBlank { "pcs" }
        val s = ServiceItem(unique, name.trim(), finalUnit, price.coerceAtLeast(0), retail && !selfService, dropOut && !selfService, selfService, commissionPerUnit.coerceAtLeast(0))
        services.add(s)
        log("Layanan ${s.name} ditambah", session.value?.branchId ?: branches.first().id)
        bump()
        return s
    }

    fun updateService(id: String, name: String, unit: String, price: Int, retail: Boolean, dropOut: Boolean, selfService: Boolean = false, commissionPerUnit: Int = 0) {
        val i = services.indexOfFirst { it.id == id }
        if (i < 0) return
        services[i] = services[i].copy(
            name = name.trim(),
            unit = if (selfService) "Load" else unit.trim().ifBlank { services[i].unit },
            price = price.coerceAtLeast(0),
            retail = retail && !selfService,
            dropOut = dropOut && !selfService,
            selfService = selfService,
            commissionPerUnit = commissionPerUnit.coerceAtLeast(0),
        )
        log("Layanan ${name.trim()} diubah", session.value?.branchId ?: branches.first().id)
        bump()
    }

    fun deleteService(id: String): String? {
        val s = services.find { it.id == id } ?: return "Layanan tidak ketemu"
        services.removeAll { it.id == id }
        cart.removeAll { it.service.id == id }
        log("Layanan ${s.name} dihapus", session.value?.branchId ?: branches.first().id)
        bump()
        return null
    }

    fun addProduct(name: String, stock: Int, min: Int, initialBranchId: String): Product {
        val p = Product(name.trim(), 0, min.coerceAtLeast(0), "p-${Clock.nowMs()}")
        products.add(p)
        branches.forEach { branch ->
            branchStocks.add(BranchStock(branch.id, p.key, if (branch.id == initialBranchId) stock.coerceAtLeast(0) else 0))
        }
        log("Produk ${p.name} ditambah", session.value?.branchId ?: branches.first().id)
        bump()
        return p
    }

    fun updateProduct(key: String, name: String, min: Int) {
        val i = products.indexOfFirst { it.key == key || it.name == key }
        if (i < 0) return
        val old = products[i]
        val updated = old.copy(name = name.trim(), min = min.coerceAtLeast(0), id = old.id.ifBlank { "p-${Clock.nowMs()}" })
        products[i] = updated
        branchStocks.indices.filter { branchStocks[it].productKey == old.key }.forEach { index ->
            branchStocks[index] = branchStocks[index].copy(productKey = updated.key)
        }
        log("Produk ${name.trim()} diubah", session.value?.branchId ?: branches.first().id)
        bump()
    }

    fun deleteProduct(key: String): String? {
        val p = products.find { it.key == key || it.name == key } ?: return "Produk tidak ketemu"
        products.removeAll { it.key == key || it.name == key }
        branchStocks.removeAll { it.productKey == p.key }
        log("Produk ${p.name} dihapus", session.value?.branchId ?: branches.first().id)
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
    ): InventoryItem {
        val row = InventoryItem(
            id = "inv-${Clock.nowMs()}", branchId = branchId, name = name.trim(), category = category,
            brand = brand.trim(), serialNumber = serialNumber.trim(), quantity = quantity.coerceAtLeast(0),
            unit = unit.trim().ifBlank { "unit" }, status = status, purchaseAt = purchaseAt,
            notes = notes.trim(), sellable = sellable,
        )
        inventory.add(0, row)
        log("Inventory ${row.name} ditambah · ${row.quantity} ${row.unit} · ${row.status.label}", branchId)
        bump()
        return row
    }

    fun updateInventory(row: InventoryItem) {
        val index = inventory.indexOfFirst { it.id == row.id }
        if (index < 0) return
        inventory[index] = row.copy(name = row.name.trim(), quantity = row.quantity.coerceAtLeast(0), unit = row.unit.trim().ifBlank { "unit" })
        log("Inventory ${row.name.trim()} diubah · ${row.status.label}", row.branchId)
        bump()
    }

    fun deleteInventory(id: String): String? {
        val row = inventory.firstOrNull { it.id == id } ?: return "Inventory tidak ditemukan"
        inventory.removeAll { it.id == id }
        log("Inventory ${row.name} dihapus", row.branchId)
        bump()
        return null
    }

    fun addExpense(branchId: String, category: ExpenseCategory, amount: Int, occurredAtMs: Long, note: String): Expense {
        val s = session.value!!
        val row = Expense(
            id = "cost-${Clock.nowMs()}", branchId = branchId, category = category,
            amount = amount.coerceAtLeast(0), occurredAtMs = occurredAtMs,
            occurredAt = Clock.nowLabel(occurredAtMs), note = note.trim(), by = s.name,
        )
        expenses.add(0, row)
        log("Biaya ${category.label} ${rp(row.amount)} · ${row.note}", branchId)
        bump()
        return row
    }

    fun deleteExpense(id: String): String? {
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

    fun checkIn(branchId: String, note: String = ""): String? {
        val s = session.value ?: return "Silakan masuk kembali"
        if (s.role != Role.Owner && branchId != s.branchId) return "Cabang absensi tidak sesuai akun"
        if (s.role == Role.Owner && branches.none { it.id == branchId }) return "Cabang tidak ditemukan"
        if (todayAttendance(s.email) != null) return "Anda sudah absen masuk hari ini"
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
        )
        attendance.add(0, row)
        log("Absen masuk ${s.name}", branchId)
        bump()
        return null
    }

    fun checkOut(note: String = ""): String? {
        val s = session.value ?: return "Silakan masuk kembali"
        val index = attendance.indexOfFirst {
            it.staffEmail.equals(s.email, true) && it.workDate == Clock.dateKey() && it.checkOutAtMs == null
        }
        if (index < 0) return "Absen masuk hari ini belum ditemukan"
        val now = Clock.nowMs()
        val old = attendance[index]
        attendance[index] = old.copy(
            checkOutAtMs = now,
            checkOutAt = Clock.nowLabel(now),
            note = note.trim().ifBlank { old.note },
        )
        log("Absen pulang ${s.name}", old.branchId)
        bump()
        return null
    }

    fun exportSnapshot(): Snapshot = snapshot().copy(sessionEmail = null)

    private fun uniqueBranchId(name: String): String {
        val base = name.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-').ifBlank { "cabang" }
        if (branches.none { it.id == base }) return base
        return "$base-${Clock.nowMs()}"
    }

    private fun grantOwnerBranch(id: String) {
        val ownerIdx = staff.indexOfFirst { it.role == Role.Owner }
        if (ownerIdx >= 0) {
            val o = staff[ownerIdx]
            staff[ownerIdx] = o.copy(branchIds = (o.branchIds + id).distinct())
        }
    }

    fun nextNotaId(branchId: String): String {
        val b = branches.first { it.id == branchId }
        val prefix = "${b.code}-${Clock.yearMonth()}-"
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

    fun setCartPrice(svcId: String, price: Int) {
        cart.find { it.service.id == svcId }?.unitPrice = price.coerceAtLeast(0)
        revision.intValue++
    }

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
            val product = products.firstOrNull { it.name == line.service.name } ?: return@mapNotNull null
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
        val permittedBranch = when (s.role) {
            Role.Owner -> branches.any { it.id == branchId }
            else -> branchId == s.branchId
        }
        require(permittedBranch) { "Cabang transaksi tidak tersedia untuk akun ini" }
        require(retailStockShortages(cartLines, branchId).isEmpty()) { "Stok retail cabang tidak mencukupi" }
        val total = cartLines.sumOf { (it.qty * it.unitPrice).toInt() }
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
                )
            },
        )
        notas.add(0, nota)
        cartLines.filter { it.service.retail }.forEach { line ->
            val qty = line.qty.toInt()
            var balanceAfter: Int? = null
            products.find { it.name == line.service.name }?.let { product ->
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
        if (s.role == Role.Supervisor || (s.role != Role.Owner && s.branchId != old.branchId)) {
            return "Akun ini tidak dapat mengoreksi Service tersebut"
        }
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

        val oldQty = old.lines.groupBy { it.serviceId }.mapValues { (_, rows) -> rows.sumOf { it.qty }.toInt() }
        val newQty = clean.groupBy { it.serviceId }.mapValues { (_, rows) -> rows.sumOf { it.qty }.toInt() }
        val retailProducts = (old.lines + clean).mapNotNull { line ->
            products.firstOrNull { it.name == line.name }?.let { line.serviceId to it }
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

        val total = clean.sumOf { (it.qty * it.unitPrice).toInt() }
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
        if (s.role == Role.Supervisor || (s.role != Role.Owner && s.branchId != old.branchId)) {
            return "Akun ini tidak dapat menghapus Service tersebut"
        }
        val now = Clock.nowMs()
        old.lines.forEach { line ->
            val product = products.firstOrNull { it.name == line.name } ?: return@forEach
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

    fun markWaSent(id: String) {
        val n = notas.find { it.id == id } ?: return
        val t = Clock.nowMs()
        n.waSent = true
        n.waAt = Clock.nowLabel(t)
        log("WA nota ${n.id} terkirim → archive", n.branchId, n.id)
        bump()
    }

    fun advanceLaundry(id: String) {
        val n = notas.find { it.id == id } ?: return
        n.laundry.next?.let {
            n.laundry = it
            if (it == LaundryStatus.Selesai && n.completedAt == null) n.completedAt = Clock.nowLabel()
        }
        log("${n.id} → ${n.laundry.label}", n.branchId, n.id)
        bump()
    }

    fun markLunas(id: String, method: PayMethod = PayMethod.Tunai) {
        val n = notas.find { it.id == id } ?: return
        n.pay = PayStatus.Lunas
        n.paid = n.total
        n.payMethod = method
        log("${n.id} ditandai Lunas · ${method.label}", n.branchId, n.id)
        bump()
    }

    fun markPickedUp(id: String): String? {
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

    fun editStock(product: String, branchId: String, kind: StockKind, qty: Int, occurredAtMs: Long = Clock.nowMs()) {
        editStocks(mapOf(product to qty), branchId, kind, occurredAtMs)
    }

    fun editStocks(changes: Map<String, Int>, branchId: String, kind: StockKind, occurredAtMs: Long = Clock.nowMs()): Int {
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

    private fun syncEventId(): String = UUID.randomUUID().toString()

    fun closeCash(): CashClose {
        val s = session.value!!
        val bid = if (s.role == Role.Owner) viewBranch.value else s.branchId
        val t = Clock.nowMs()
        val row = CashClose(
            id = "kas-$t",
            at = Clock.nowLabel(t),
            atMs = t,
            by = s.name,
            branchId = bid,
            tunai = todayByMethod(PayMethod.Tunai, bid),
            qris = todayByMethod(PayMethod.Qris, bid),
            transfer = todayByMethod(PayMethod.Transfer, bid),
            piutang = piutang(notas.filter { bid == "all" || it.branchId == bid }),
        )
        cashCloses.add(0, row)
        log(
            "Tutup kas ${row.at} · tunai ${rp(row.tunai)} · QRIS ${rp(row.qris)} · transfer ${rp(row.transfer)} · piutang ${rp(row.piutang)}",
            if (bid == "all") "melati" else bid,
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
        return ReceiptText.format(n, b)
    }

    fun waMe(phone: String): String {
        val d = phone.filter { it.isDigit() }
        val n = if (d.startsWith("0")) "62${d.drop(1)}" else d
        return "https://wa.me/$n"
    }
}
