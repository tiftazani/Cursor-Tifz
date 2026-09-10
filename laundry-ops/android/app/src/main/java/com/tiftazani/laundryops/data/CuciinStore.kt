package com.tiftazani.laundryops.data

import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import java.text.NumberFormat
import java.util.Locale

fun rp(n: Int): String = "Rp " + NumberFormat.getIntegerInstance(Locale("id", "ID")).format(n)

object CuciinStore {
    val ownerName = "Tiftazani Khara"
    val ownerEmail = "tiftazani.khara@gmail.com"

    val branches = listOf(
        Branch("melati", "MEL", "Cuciin Melati", "Jl. Melati 12, Bandung", "-6.9175,107.6191"),
        Branch("cibaduyut", "CIB", "Cuciin Cibaduyut", "Jl. Cibaduyut Raya 88, Bandung", "-6.9590,107.5920"),
    )

    val staff = mutableStateListOf(
        Staff(ownerName, ownerEmail, Role.Owner, listOf("melati", "cibaduyut")),
        Staff("Rina", "rina@cuciin.id", Role.Kasir, listOf("melati")),
        Staff("Dedi", "dedi@cuciin.id", Role.Kasir, listOf("melati")),
        Staff("Andi", "andi@cuciin.id", Role.Supervisor, listOf("melati")),
        Staff("Salsa", "salsa@cuciin.id", Role.Kasir, listOf("cibaduyut")),
        Staff("Yoga", "yoga@cuciin.id", Role.Supervisor, listOf("cibaduyut")),
        Staff("Fajar Putra", "fajar@cuciin.id", Role.Kasir, listOf("melati"), approved = false),
    )

    val customers = listOf(
        Customer("c1", "Siti Rahma", "Jl. Melati 12, Bandung", "0812-3301-8890"),
        Customer("c2", "Budi Santoso", "Komplek Cempaka Blok B2", "0857-1120-4455"),
        Customer("c3", "Dewi Lestari", "Jl. Anggrek No. 8", "0813-7788-2210"),
    )

    val services = listOf(
        ServiceItem("cuci", "Cuci", "kg", 7000, retail = false, dropOut = false),
        ServiceItem("curing", "Cuci kering (Curing)", "kg", 9000, retail = false, dropOut = false),
        ServiceItem("do", "Curing DO", "kg", 10000, retail = false, dropOut = true),
        ServiceItem("do-lipat", "Curing DO Lipat", "kg", 12000, retail = false, dropOut = true),
        ServiceItem("sabun", "Sabun", "pcs", 8000, retail = true, dropOut = false),
        ServiceItem("softener", "Softener", "pcs", 10000, retail = true, dropOut = false),
        ServiceItem("parfum", "Parfum uk 100", "pcs", 15000, retail = true, dropOut = false),
    )

    val products = mutableStateListOf(
        Product("Sabun", 24, 8),
        Product("Softener", 18, 6),
        Product("Parfum uk 100", 9, 5),
    )

    val notas = mutableStateListOf(
        Nota("MEL-2409-0042", "melati", "Rina", "Siti Rahma", "0812-3301-8890", "Curing DO 3 kg + Sabun 1", 38000, 38000, PayStatus.Lunas, LaundryStatus.Progress, "10 Sep 2026, 09.12", "10 Sep 2026, 17.00", waSent = false, photos = mutableListOf("nota-siti.jpg"), dropOut = true),
        Nota("MEL-2409-0041", "melati", "Dedi", "Budi Santoso", "0857-1120-4455", "Cuci 5 kg", 54000, 20000, PayStatus.Belum, LaundryStatus.Selesai, "09 Sep 2026, 14.03", "09 Sep 2026, 16.00", waSent = true, waAt = "09 Sep 2026, 14.08"),
        Nota("MEL-2409-0040", "melati", "Rina", "Dewi Lestari", "0813-7788-2210", "Curing DO Lipat 2 kg", 28000, 0, PayStatus.Belum, LaundryStatus.Masuk, "10 Sep 2026, 08.41", "10 Sep 2026, 18.00", waSent = false, dropOut = true),
        Nota("CIB-2409-0018", "cibaduyut", "Salsa", "Agus Wijaya", "0812-9000-1122", "Cuci 4 kg", 28000, 28000, PayStatus.Lunas, LaundryStatus.Selesai, "10 Sep 2026, 07.55", "10 Sep 2026, 15.00", waSent = true, waAt = "10 Sep 2026, 08.01", photos = mutableListOf("bukti-transfer.jpg")),
    )

    val stockMoves = mutableStateListOf(
        StockMove("10 Sep 09.22", "Sabun", StockKind.Jual, -1, "Rina", "melati", "Jual via nota", "MEL-2409-0042"),
        StockMove("09 Sep 16.20", "Parfum uk 100", StockKind.Kurang, -1, "Rina", "melati", "Rusak"),
        StockMove("08 Sep 09.15", "Softener", StockKind.Update, 18, "Dedi", "melati", "Hitung ulang rak"),
        StockMove("05 Sep 11.02", "Sabun", StockKind.Jual, -2, "Rina", "melati", "Jual via nota", "MEL-2409-0038"),
        StockMove("03 Sep 08.40", "Sabun", StockKind.Tambah, 20, "Rina", "melati", "Manual restock"),
    )

    val audit = mutableStateListOf(
        AuditRow("10 Sep 09.22", "Rina", "melati", "Nota MEL-2409-0042 disimpan · Tunai lunas", "MEL-2409-0042"),
        AuditRow("10 Sep 09.22", "Rina", "melati", "Stok Sabun −1 (jual via nota)", "MEL-2409-0042"),
        AuditRow("10 Sep 08.41", "Rina", "melati", "Nota MEL-2409-0040 masuk · Belum lunas", "MEL-2409-0040"),
        AuditRow("10 Sep 08.01", "Salsa", "cibaduyut", "WA nota CIB-2409-0018 terkirim", "CIB-2409-0018"),
        AuditRow("09 Sep 16.40", "Dedi", "melati", "Laundry MEL-2409-0041 → Selesai, bayar masih Belum lunas", "MEL-2409-0041"),
    )

    val session = mutableStateOf<Session?>(null)
    val pendingName = mutableStateOf<String?>(null)
    val viewBranch = mutableStateOf("melati")
    val viewKasir = mutableStateOf("all")
    val reportPeriod = mutableStateOf("minggu")
    val revision = mutableIntStateOf(0)

    private fun bump() {
        revision.intValue++
    }

    fun bumpPublic() = bump()

    fun branch(id: String = session.value?.branchId ?: viewBranch.value): Branch =
        branches.first { it.id == id || (id == "all" && it.id == "melati") }.let {
            if (id == "all") it else branches.first { b -> b.id == id }
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

    fun login(email: String): Boolean {
        val u = staff.firstOrNull { it.email.equals(email.trim(), ignoreCase = true) }
        if (u == null) {
            pendingName.value = null
            return false
        }
        if (!u.approved) {
            pendingName.value = u.name
            session.value = null
            return false
        }
        pendingName.value = null
        session.value = Session(u.role, u.name, u.email, u.branchIds.first())
        viewBranch.value = if (u.role == Role.Owner) "all" else u.branchIds.first()
        return true
    }

    fun demoLogin(role: Role) {
        when (role) {
            Role.Owner -> login(ownerEmail)
            Role.Kasir -> login("rina@cuciin.id")
            Role.Supervisor -> login("andi@cuciin.id")
        }
    }

    fun register(name: String, email: String, role: Role, branchId: String) {
        staff.add(Staff(name, email, role, listOf(branchId), approved = false))
        pendingName.value = name
    }

    fun approve(name: String, ok: Boolean) {
        val i = staff.indexOfFirst { it.name == name }
        if (i >= 0) staff[i] = staff[i].copy(approved = ok)
        val row = AuditRow("10 Sep 09.50", ownerName, "melati", "${if (ok) "Setujui" else "Tolak"} $name", null)
        audit.add(0, row)
        bump()
        FirebaseCloud.pushApprove(name, ok)
        FirebaseCloud.pushAudit(row)
    }

    fun nextNotaId(branchId: String): String {
        val b = branches.first { it.id == branchId }
        val n = notas.count { it.branchId == branchId } + 43
        return "${b.code}-2409-${n.toString().padStart(4, '0')}"
    }

    fun saveNota(
        customer: Customer,
        cart: List<CartLine>,
        paid: Int,
        pickup: String,
        sendWa: Boolean,
    ): Nota {
        val s = session.value!!
        val total = cart.sumOf { (it.qty * it.service.price).toInt() }
        val nota = Nota(
            id = nextNotaId(s.branchId),
            branchId = s.branchId,
            kasir = s.name,
            customer = customer.name,
            phone = customer.phone,
            items = cart.joinToString { "${it.service.name} ${it.qty}${it.service.unit}" },
            total = total,
            paid = paid,
            pay = if (paid >= total) PayStatus.Lunas else PayStatus.Belum,
            laundry = LaundryStatus.Masuk,
            createdAt = "10 Sep 2026, 09.41",
            pickupAt = pickup,
            waSent = false,
            dropOut = cart.any { it.service.dropOut },
        )
        notas.add(0, nota)
        bump()
        cart.filter { it.service.retail }.forEach { line ->
            products.find { it.name == line.service.name }?.let { it.stock = (it.stock - line.qty.toInt()).coerceAtLeast(0) }
            stockMoves.add(0, StockMove("10 Sep 09.41", line.service.name, StockKind.Jual, -line.qty.toInt(), s.name, s.branchId, "Jual via nota", nota.id))
        }
        val row = AuditRow("10 Sep 09.41", s.name, s.branchId, "Nota ${nota.id} disimpan · ${nota.pay.label}", nota.id)
        audit.add(0, row)
        FirebaseCloud.pushNota(nota)
        FirebaseCloud.pushAudit(row)
        if (sendWa) markWaSent(nota.id)
        return nota
    }

    fun markWaSent(id: String) {
        val n = notas.find { it.id == id } ?: return
        n.waSent = true
        n.waAt = "10 Sep 2026, 09.41"
        bump()
        val row = AuditRow("10 Sep 09.41", session.value?.name ?: "—", n.branchId, "WA nota ${n.id} terkirim → archive", n.id)
        audit.add(0, row)
        FirebaseCloud.pushNota(n)
        FirebaseCloud.pushAudit(row)
    }

    fun advanceLaundry(id: String) {
        val n = notas.find { it.id == id } ?: return
        n.laundry.next?.let { n.laundry = it }
        bump()
        val row = AuditRow("10 Sep 09.41", session.value?.name ?: "—", n.branchId, "${n.id} → ${n.laundry.label}", n.id)
        audit.add(0, row)
        FirebaseCloud.pushNota(n)
        FirebaseCloud.pushAudit(row)
    }

    fun markLunas(id: String) {
        val n = notas.find { it.id == id } ?: return
        n.pay = PayStatus.Lunas
        bump()
        val row = AuditRow("10 Sep 09.41", session.value?.name ?: "—", n.branchId, "${n.id} ditandai Lunas", n.id)
        audit.add(0, row)
        FirebaseCloud.pushNota(n)
        FirebaseCloud.pushAudit(row)
    }

    fun addLocalProof(id: String, fileName: String) {
        val n = notas.find { it.id == id } ?: return
        n.photos.add(fileName)
        bump()
        val row = AuditRow("10 Sep 09.41", session.value?.name ?: "—", n.branchId, "Bukti $fileName disimpan di HP (bukan cloud)", n.id)
        audit.add(0, row)
        FirebaseCloud.pushNota(n)
        FirebaseCloud.pushAudit(row)
    }

    fun editStock(product: String, kind: StockKind, qty: Int) {
        val s = session.value ?: return
        val p = products.find { it.name == product } ?: return
        val delta = when (kind) {
            StockKind.Tambah -> qty.also { p.stock += qty }
            StockKind.Kurang -> (-qty).also { p.stock = (p.stock - qty).coerceAtLeast(0) }
            StockKind.Update -> qty.also { p.stock = qty }
            StockKind.Jual -> -qty
        }
        stockMoves.add(0, StockMove("10 Sep 09.41", product, kind, if (kind == StockKind.Update) qty else delta, s.name, s.branchId, "Edit manual kasir"))
        val row = AuditRow("10 Sep 09.41", s.name, s.branchId, "Stok $product ${kind.label} $qty", null)
        audit.add(0, row)
        bump()
        FirebaseCloud.pushAudit(row)
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
