package com.tiftazani.laundryops.data

import kotlinx.serialization.Serializable
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

fun rp(n: Int): String = "Rp " + NumberFormat.getIntegerInstance(Locale("id", "ID")).format(n)

object Clock {
    val ZONE: ZoneId = ZoneId.of("Asia/Jakarta")
    private val labelFmt = DateTimeFormatter.ofPattern("d MMM yyyy, HH.mm", Locale("id", "ID"))
    private val ymFmt = DateTimeFormatter.ofPattern("yyMM")

    fun nowMs(): Long = System.currentTimeMillis()

    fun nowLabel(ms: Long = nowMs()): String =
        ZonedDateTime.ofInstant(Instant.ofEpochMilli(ms), ZONE).format(labelFmt)

    fun yearMonth(): String = ZonedDateTime.now(ZONE).format(ymFmt)

    fun todayStartMs(): Long = LocalDate.now(ZONE).atStartOfDay(ZONE).toInstant().toEpochMilli()

    fun periodStartMs(period: String): Long {
        val today = LocalDate.now(ZONE)
        val start = when (period) {
            "hari" -> today
            "minggu" -> today.minusDays(((today.dayOfWeek.value + 6) % 7).toLong())
            "bulan" -> today.withDayOfMonth(1)
            "tahun" -> today.withDayOfYear(1)
            else -> today.minusDays(((today.dayOfWeek.value + 6) % 7).toLong())
        }
        return start.atStartOfDay(ZONE).toInstant().toEpochMilli()
    }

    fun defaultPickup(): String {
        val t = LocalDate.now(ZONE).atTime(17, 0).atZone(ZONE)
        return t.format(labelFmt)
    }
}

@Serializable
enum class Role { Owner, Kasir, Supervisor }

@Serializable
enum class LaundryStatus(val label: String) {
    Masuk("Laundry Masuk"),
    Progress("Laundry In Progress"),
    Selesai("Laundry Selesai");

    val next: LaundryStatus?
        get() = when (this) {
            Masuk -> Progress
            Progress -> Selesai
            Selesai -> null
        }
}

@Serializable
enum class PayStatus(val label: String) {
    Belum("Belum lunas"),
    Lunas("Lunas"),
}

@Serializable
enum class PayMethod(val label: String) {
    Tunai("Tunai"),
    Qris("QRIS"),
    Transfer("Transfer"),
}

@Serializable
enum class StockKind(val label: String) { Tambah("Tambah"), Kurang("Kurang"), Update("Update"), Jual("Jual") }

@Serializable
data class Branch(
    val id: String,
    val code: String,
    val name: String,
    val location: String,
    val mapsQuery: String,
)

@Serializable
data class Staff(
    val name: String,
    val email: String,
    val role: Role,
    val branchIds: List<String>,
    val approved: Boolean = true,
    val passwordHash: String = "",
)

@Serializable
data class Customer(
    val id: String,
    val name: String,
    val address: String,
    val phone: String,
)

@Serializable
data class ServiceItem(
    val id: String,
    val name: String,
    val unit: String,
    val price: Int,
    val retail: Boolean,
    val dropOut: Boolean,
)

data class CartLine(val service: ServiceItem, var qty: Double)

@Serializable
data class Nota(
    val id: String,
    val branchId: String,
    val kasir: String,
    val customer: String,
    val phone: String,
    val items: String,
    val total: Int,
    var paid: Int,
    var pay: PayStatus,
    var laundry: LaundryStatus,
    val createdAt: String,
    val createdAtMs: Long = 0,
    val pickupAt: String,
    var waSent: Boolean,
    var waAt: String? = null,
    val photos: MutableList<String> = mutableListOf(),
    val dropOut: Boolean = false,
    var payMethod: PayMethod = PayMethod.Tunai,
) {
    val hanging: Boolean get() = laundry != LaundryStatus.Selesai || pay != PayStatus.Lunas
}

@Serializable
data class Product(val name: String, var stock: Int, val min: Int)

@Serializable
data class StockMove(
    val at: String,
    val atMs: Long = 0,
    val product: String,
    val kind: StockKind,
    val qty: Int,
    val by: String,
    val branchId: String,
    val note: String,
    val notaId: String? = null,
)

@Serializable
data class AuditRow(
    val at: String,
    val atMs: Long = 0,
    val user: String,
    val branchId: String,
    val action: String,
    val notaId: String? = null,
)

@Serializable
data class CashClose(
    val id: String,
    val at: String,
    val atMs: Long,
    val by: String,
    val branchId: String,
    val tunai: Int,
    val qris: Int,
    val transfer: Int,
    val piutang: Int,
)

data class Session(
    val role: Role,
    val name: String,
    val email: String,
    val branchId: String,
)

@Serializable
data class Snapshot(
    val branches: List<Branch> = emptyList(),
    val staff: List<Staff> = emptyList(),
    val customers: List<Customer> = emptyList(),
    val services: List<ServiceItem> = emptyList(),
    val products: List<Product> = emptyList(),
    val notas: List<Nota> = emptyList(),
    val stockMoves: List<StockMove> = emptyList(),
    val audit: List<AuditRow> = emptyList(),
    val cashCloses: List<CashClose> = emptyList(),
    val sessionEmail: String? = null,
    val viewBranch: String = "all",
    val viewKasir: String = "all",
    val reportPeriod: String = "hari",
    val updatedAt: Long = 0,
)
