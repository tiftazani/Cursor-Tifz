package com.tiftazani.laundryops.data

import android.app.Application
import android.net.Uri
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf

object CuciinStore {
    val ownerName = "Tiftazani Khara"
    val ownerEmail = "tiftazani.khara@gmail.com"

    val branches = mutableStateListOf<Branch>()
    val staff = mutableStateListOf<Staff>()
    val customers = mutableStateListOf<Customer>()
    val services = mutableStateListOf<ServiceItem>()
    val products = mutableStateListOf<Product>()
    val notas = mutableStateListOf<Nota>()
    val stockMoves = mutableStateListOf<StockMove>()
    val audit = mutableStateListOf<AuditRow>()
    val cashCloses = mutableStateListOf<CashClose>()
    val cart = mutableStateListOf<CartLine>()

    val session = mutableStateOf<Session?>(null)
    val pendingName = mutableStateOf<String?>(null)
    val viewBranch = mutableStateOf("all")
    val viewKasir = mutableStateOf("all")
    val reportPeriod = mutableStateOf("hari")
    val selectedCustomer = mutableStateOf<Customer?>(null)
    val revision = mutableIntStateOf(0)

    private var app: Application? = null
    private var ready = false
    private var applyingCloud = false
    private var localUpdatedAt = 0L

    fun attach(application: Application) {
        if (ready) return
        app = application
        LocalJson.init(application)
        val snap = LocalJson.load()
        if (snap == null || snap.staff.isEmpty()) {
            applySeed()
            persist()
        } else {
            applySnapshot(snap)
            localUpdatedAt = snap.updatedAt
        }
        ready = true
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
                Staff(ownerName, ownerEmail, Role.Owner, listOf("melati", "cibaduyut")),
                Staff("Rina", "rina@cuciin.id", Role.Kasir, listOf("melati")),
                Staff("Dedi", "dedi@cuciin.id", Role.Kasir, listOf("melati")),
                Staff("Andi", "andi@cuciin.id", Role.Supervisor, listOf("melati")),
                Staff("Salsa", "salsa@cuciin.id", Role.Kasir, listOf("cibaduyut")),
                Staff("Yoga", "yoga@cuciin.id", Role.Supervisor, listOf("cibaduyut")),
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
        notas.clear()
        stockMoves.clear()
        audit.clear()
        cashCloses.clear()
        val t = Clock.nowMs()
        localUpdatedAt = t
        audit.add(AuditRow(Clock.nowLabel(t), t, ownerName, "melati", "Data awal: 2 cabang, antrian kosong. Isi stok & pelanggan sebelum nota pertama.", null))
    }

    private fun applySnapshot(s: Snapshot) {
        fun <T> fill(dest: MutableList<T>, src: List<T>) {
            dest.clear()
            dest.addAll(src)
        }
        fill(branches, s.branches)
        fill(staff, s.staff)
        fill(customers, s.customers)
        fill(services, s.services)
        fill(products, s.products)
        fill(notas, s.notas)
        fill(stockMoves, s.stockMoves)
        fill(audit, s.audit)
        fill(cashCloses, s.cashCloses)
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
        fill(branches, s.branches)
        fill(staff, s.staff)
        fill(customers, s.customers)
        fill(services, s.services)
        fill(products, s.products)
        fill(notas, s.notas)
        fill(stockMoves, s.stockMoves)
        fill(audit, s.audit)
        fill(cashCloses, s.cashCloses)
    }

    fun applyCloud(s: Snapshot) {
        if (s.updatedAt < localUpdatedAt) return
        if (s.staff.isEmpty() && branches.isNotEmpty()) {
            CloudSync.push(cloudSnapshot())
            revision.intValue++
            return
        }
        applyingCloud = true
        try {
            applyBusiness(s)
            localUpdatedAt = s.updatedAt
            persist()
            revision.intValue++
        } finally {
            applyingCloud = false
        }
    }

    fun cloudSnapshot(): Snapshot = snapshot().copy(sessionEmail = null, updatedAt = localUpdatedAt)

    private fun snapshot(): Snapshot = Snapshot(
        branches = branches.toList(),
        staff = staff.toList(),
        customers = customers.toList(),
        services = services.toList(),
        products = products.toList(),
        notas = notas.toList(),
        stockMoves = stockMoves.toList(),
        audit = audit.toList(),
        cashCloses = cashCloses.toList(),
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
        localUpdatedAt = Clock.nowMs()
        persist()
        if (!applyingCloud) CloudSync.push(cloudSnapshot())
    }

    fun bumpPublic() = bump()

    fun touchStatus() {
        revision.intValue++
    }

    private fun log(action: String, branchId: String, notaId: String? = null): AuditRow {
        val t = Clock.nowMs()
        val row = AuditRow(Clock.nowLabel(t), t, session.value?.name ?: ownerName, branchId, action, notaId)
        audit.add(0, row)
        FirebaseCloud.pushAudit(row)
        return row
    }

    fun branch(id: String = session.value?.branchId ?: viewBranch.value): Branch {
        if (id == "all") return branches.first()
        return branches.first { it.id == id }
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
        return visibleNotas().filter { it.createdAtMs >= start }
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
        val u = staff.firstOrNull { it.email.equals(email.trim(), ignoreCase = true) }
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
        if (!skipPassword && u.passwordHash.isNotBlank() && !Passwords.matches(password, u.passwordHash)) {
            pendingName.value = null
            return false
        }
        pendingName.value = null
        session.value = Session(u.role, u.name, u.email, u.branchIds.first())
        viewBranch.value = if (u.role == Role.Owner) "all" else u.branchIds.first()
        persist()
        return true
    }

    fun demoLogin(role: Role) {
        when (role) {
            Role.Owner -> login(ownerEmail, skipPassword = true)
            Role.Kasir -> login("rina@cuciin.id", skipPassword = true)
            Role.Supervisor -> login("andi@cuciin.id", skipPassword = true)
        }
    }

    fun logout() {
        session.value = null
        persist()
        revision.intValue++
    }

    fun register(name: String, email: String, role: Role, branchId: String, password: String = "") {
        val hash = if (password.isBlank()) "" else Passwords.hash(password)
        staff.add(Staff(name.trim(), email.trim(), role, listOf(branchId), approved = false, passwordHash = hash))
        pendingName.value = name.trim()
        bump()
    }

    fun approve(name: String, ok: Boolean) {
        val i = staff.indexOfFirst { it.name == name }
        if (i >= 0) staff[i] = staff[i].copy(approved = ok)
        log("${if (ok) "Setujui" else "Tolak"} $name", session.value?.branchId ?: "melati")
        bump()
        FirebaseCloud.pushApprove(name, ok)
    }

    fun addBranch(name: String, code: String, location: String, maps: String): Branch {
        val id = uniqueBranchId(name)
        val b = Branch(id, code.uppercase().take(4).ifBlank { "CAB" }, name.trim(), location.trim(), maps.trim())
        branches.add(b)
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

    fun deleteBranch(id: String): String? {
        if (branches.size <= 1) return "Minimal satu cabang harus tersisa"
        if (notas.any { it.branchId == id && it.hanging }) return "Masih ada nota menggantung di cabang ini"
        val gone = branches.find { it.id == id } ?: return "Cabang tidak ketemu"
        branches.removeAll { it.id == id }
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

    fun updateStaff(email: String, name: String, role: Role, branchIds: List<String>, password: String? = null, approved: Boolean? = null): String? {
        val i = staff.indexOfFirst { it.email.equals(email, ignoreCase = true) }
        if (i < 0) return "User tidak ketemu"
        val old = staff[i]
        if (old.role == Role.Owner && role != Role.Owner && staff.count { it.role == Role.Owner } <= 1) {
            return "Owner terakhir tidak bisa diturunkan"
        }
        val bids = branchIds.ifEmpty { old.branchIds }
        staff[i] = old.copy(
            name = name.trim().ifBlank { old.name },
            role = role,
            branchIds = bids,
            approved = approved ?: old.approved,
            passwordHash = if (password.isNullOrBlank()) old.passwordHash else Passwords.hash(password),
        )
        val s = session.value
        if (s != null && s.email.equals(email, ignoreCase = true)) {
            session.value = s.copy(name = staff[i].name, role = staff[i].role, branchId = staff[i].branchIds.first())
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

    fun addService(name: String, unit: String, price: Int, retail: Boolean, dropOut: Boolean): ServiceItem {
        val id = name.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-').ifBlank { "svc-${Clock.nowMs()}" }
        val unique = if (services.any { it.id == id }) "$id-${Clock.nowMs()}" else id
        val s = ServiceItem(unique, name.trim(), unit.trim().ifBlank { "pcs" }, price.coerceAtLeast(0), retail, dropOut)
        services.add(s)
        log("Layanan ${s.name} ditambah", session.value?.branchId ?: branches.first().id)
        bump()
        return s
    }

    fun updateService(id: String, name: String, unit: String, price: Int, retail: Boolean, dropOut: Boolean) {
        val i = services.indexOfFirst { it.id == id }
        if (i < 0) return
        services[i] = services[i].copy(
            name = name.trim(),
            unit = unit.trim().ifBlank { services[i].unit },
            price = price.coerceAtLeast(0),
            retail = retail,
            dropOut = dropOut,
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

    fun addProduct(name: String, stock: Int, min: Int): Product {
        val p = Product(name.trim(), stock.coerceAtLeast(0), min.coerceAtLeast(0), "p-${Clock.nowMs()}")
        products.add(p)
        log("Produk ${p.name} ditambah", session.value?.branchId ?: branches.first().id)
        bump()
        return p
    }

    fun updateProduct(key: String, name: String, min: Int) {
        val i = products.indexOfFirst { it.key == key || it.name == key }
        if (i < 0) return
        val old = products[i]
        products[i] = old.copy(name = name.trim(), min = min.coerceAtLeast(0), id = old.id.ifBlank { "p-${Clock.nowMs()}" })
        log("Produk ${name.trim()} diubah", session.value?.branchId ?: branches.first().id)
        bump()
    }

    fun deleteProduct(key: String): String? {
        val p = products.find { it.key == key || it.name == key } ?: return "Produk tidak ketemu"
        products.removeAll { it.key == key || it.name == key }
        log("Produk ${p.name} dihapus", session.value?.branchId ?: branches.first().id)
        bump()
        return null
    }

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
            .mapNotNull { it.id.removePrefix(prefix).toIntOrNull() }
            .maxOrNull() ?: 0
        return prefix + (max + 1).toString().padStart(4, '0')
    }

    fun addToCart(svc: ServiceItem) {
        val exist = cart.find { it.service.id == svc.id }
        if (exist != null) exist.qty += if (svc.unit == "kg") 1.0 else 1.0
        else cart.add(CartLine(svc, if (svc.unit == "kg") 3.0 else 1.0))
        revision.intValue++
    }

    fun cartDelta(svcId: String, delta: Double) {
        val line = cart.find { it.service.id == svcId } ?: return
        line.qty = (line.qty + delta).coerceAtLeast(0.0)
        if (line.qty == 0.0) cart.remove(line)
        revision.intValue++
    }

    fun saveNota(
        customer: Customer,
        cartLines: List<CartLine>,
        paid: Int,
        pickup: String,
        method: PayMethod,
        sendWa: Boolean,
    ): Nota {
        val s = session.value!!
        val total = cartLines.sumOf { (it.qty * it.service.price).toInt() }
        val t = Clock.nowMs()
        val nota = Nota(
            id = nextNotaId(s.branchId),
            branchId = s.branchId,
            kasir = s.name,
            customer = customer.name,
            phone = customer.phone,
            items = cartLines.joinToString { "${it.service.name} ${it.qty}${it.service.unit}" },
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
        )
        notas.add(0, nota)
        cartLines.filter { it.service.retail }.forEach { line ->
            val qty = line.qty.toInt()
            products.find { it.name == line.service.name }?.let { it.stock = (it.stock - qty).coerceAtLeast(0) }
            stockMoves.add(
                0,
                StockMove(Clock.nowLabel(t), t, line.service.name, StockKind.Jual, -qty, s.name, s.branchId, "Jual via nota", nota.id),
            )
        }
        log("Nota ${nota.id} disimpan · ${nota.pay.label} · ${method.label}", s.branchId, nota.id)
        cart.clear()
        bump()
        FirebaseCloud.pushNota(nota)
        if (sendWa) markWaSent(nota.id)
        return nota
    }

    fun markWaSent(id: String) {
        val n = notas.find { it.id == id } ?: return
        val t = Clock.nowMs()
        n.waSent = true
        n.waAt = Clock.nowLabel(t)
        log("WA nota ${n.id} terkirim → archive", n.branchId, n.id)
        bump()
        FirebaseCloud.pushNota(n)
    }

    fun advanceLaundry(id: String) {
        val n = notas.find { it.id == id } ?: return
        n.laundry.next?.let { n.laundry = it }
        log("${n.id} → ${n.laundry.label}", n.branchId, n.id)
        bump()
        FirebaseCloud.pushNota(n)
    }

    fun markLunas(id: String, method: PayMethod = PayMethod.Tunai) {
        val n = notas.find { it.id == id } ?: return
        n.pay = PayStatus.Lunas
        n.paid = n.total
        n.payMethod = method
        log("${n.id} ditandai Lunas · ${method.label}", n.branchId, n.id)
        bump()
        FirebaseCloud.pushNota(n)
    }

    fun addLocalProof(id: String, uri: Uri): String? {
        val ctx = app ?: return null
        val path = FileExports.copyProof(ctx, id, uri) ?: return null
        val n = notas.find { it.id == id } ?: return null
        n.photos.add(path)
        log("Bukti disimpan di HP: ${path.substringAfterLast('/')}", n.branchId, n.id)
        bump()
        FirebaseCloud.pushNota(n)
        return path
    }

    fun editStock(product: String, kind: StockKind, qty: Int) {
        val s = session.value ?: return
        val p = products.find { it.key == product || it.name == product } ?: return
        val t = Clock.nowMs()
        val delta = when (kind) {
            StockKind.Tambah -> qty.also { p.stock += qty }
            StockKind.Kurang -> (-qty).also { p.stock = (p.stock - qty).coerceAtLeast(0) }
            StockKind.Update -> qty.also { p.stock = qty }
            StockKind.Jual -> -qty
        }
        stockMoves.add(
            0,
            StockMove(Clock.nowLabel(t), t, product, kind, if (kind == StockKind.Update) qty else delta, s.name, s.branchId, "Edit manual kasir"),
        )
        log("Stok $product ${kind.label} $qty → sisa ${p.stock}", s.branchId)
        bump()
    }

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
        val b = branches.first { it.id == n.branchId }
        return """
Cuciin — Nota ${n.id}
Cabang  ${b.name}
Lokasi  ${b.location}
Maps    ${b.mapsQuery}
Kasir   ${n.kasir}
Waktu   ${n.createdAt}

${n.customer}
WA ${n.phone}

${n.items}

Total     ${rp(n.total)}
Dibayar   ${rp(n.paid)}
Metode    ${n.payMethod.label}
Bayar     ${n.pay.label}
Laundry   ${n.laundry.label}
Selesai / pickup  ${n.pickupAt}
        """.trimIndent()
    }

    fun waMe(phone: String): String {
        val d = phone.filter { it.isDigit() }
        val n = if (d.startsWith("0")) "62${d.drop(1)}" else d
        return "https://wa.me/$n"
    }
}
