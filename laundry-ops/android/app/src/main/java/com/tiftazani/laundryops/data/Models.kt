package com.tiftazani.laundryops.data

enum class Role { Owner, Kasir, Supervisor }

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

enum class PayStatus(val label: String) {
    Belum("Belum lunas"),
    Lunas("Lunas"),
}

enum class StockKind(val label: String) { Tambah("Tambah"), Kurang("Kurang"), Update("Update"), Jual("Jual") }

data class Branch(
    val id: String,
    val code: String,
    val name: String,
    val location: String,
    val mapsQuery: String,
)

data class Staff(
    val name: String,
    val email: String,
    val role: Role,
    val branchIds: List<String>,
    val approved: Boolean = true,
)

data class Customer(
    val id: String,
    val name: String,
    val address: String,
    val phone: String,
)

data class ServiceItem(
    val id: String,
    val name: String,
    val unit: String,
    val price: Int,
    val retail: Boolean,
    val dropOut: Boolean,
)

data class CartLine(val service: ServiceItem, var qty: Double)

data class Nota(
    val id: String,
    val branchId: String,
    val kasir: String,
    val customer: String,
    val phone: String,
    val items: String,
    val total: Int,
    val paid: Int,
    var pay: PayStatus,
    var laundry: LaundryStatus,
    val createdAt: String,
    val pickupAt: String,
    var waSent: Boolean,
    var waAt: String? = null,
    val photos: MutableList<String> = mutableListOf(),
    val dropOut: Boolean = false,
) {
    val hanging: Boolean get() = laundry != LaundryStatus.Selesai || pay != PayStatus.Lunas
}

data class Product(val name: String, var stock: Int, val min: Int)

data class StockMove(
    val at: String,
    val product: String,
    val kind: StockKind,
    val qty: Int,
    val by: String,
    val branchId: String,
    val note: String,
    val notaId: String? = null,
)

data class AuditRow(
    val at: String,
    val user: String,
    val branchId: String,
    val action: String,
    val notaId: String? = null,
)

data class Session(
    val role: Role,
    val name: String,
    val email: String,
    val branchId: String,
)
