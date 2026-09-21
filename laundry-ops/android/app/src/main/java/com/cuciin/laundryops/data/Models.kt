package com.cuciin.laundryops.data

import kotlinx.serialization.Serializable
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

fun rp(n: Int): String = "Rp " + NumberFormat.getIntegerInstance(Locale.forLanguageTag("id-ID")).format(n)

object Clock {
    val ZONE: ZoneId = ZoneId.of("Asia/Jakarta")
    private val labelFmt = DateTimeFormatter.ofPattern("d MMM yyyy, HH.mm", Locale.forLanguageTag("id-ID"))
    private val ymFmt = DateTimeFormatter.ofPattern("yyMM")
    private val dateKeyFmt = DateTimeFormatter.ISO_LOCAL_DATE

    fun nowMs(): Long = System.currentTimeMillis()

    fun nowLabel(ms: Long = nowMs()): String =
        ZonedDateTime.ofInstant(Instant.ofEpochMilli(ms), ZONE).format(labelFmt)

    fun yearMonth(): String = ZonedDateTime.now(ZONE).format(ymFmt)

    fun todayStartMs(): Long = LocalDate.now(ZONE).atStartOfDay(ZONE).toInstant().toEpochMilli()

    fun dateKey(ms: Long = nowMs()): String =
        ZonedDateTime.ofInstant(Instant.ofEpochMilli(ms), ZONE).format(dateKeyFmt)

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
        val now = ZonedDateTime.now(ZONE)
        val today = now.toLocalDate().atTime(17, 0).atZone(ZONE)
        return (if (today.isAfter(now)) today else today.plusDays(1)).format(labelFmt)
    }
}

@Serializable
enum class Role { Owner, Kasir, Supervisor }

@Serializable
enum class LaundryStatus(val label: String) {
    Masuk("Menunggu dikerjakan"),
    Progress("Sedang dikerjakan"),
    Selesai("Selesai");

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
enum class StockKind(val label: String) { Tambah("Tambah"), Kurang("Kurang"), Update("Set stok akhir"), Jual("Jual") }

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
    /**
     * Role akses yang melekat pada pengguna ini.
     *
     * Kosong berarti memakai role bawaan sesuai [role] lama, sehingga data sebelum fitur
     * Kontrol Akses Role tetap bekerja tanpa migrasi khusus.
     */
    val accessRoleId: String = "",
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
    val selfService: Boolean = false,
    /** Komisi petugas yang menangani layanan, dihitung per satuan pada saat Service dibuat. */
    val commissionPerUnit: Int = 0,
    /** Produk stok yang berkurang ketika layanan retail ini masuk ke Service. */
    val productKey: String = "",
)

data class CartLine(
    val service: ServiceItem,
    var qty: Double,
    var unitPrice: Int = service.price,
    var handledByEmail: String = "",
    var handledByName: String = "",
)

@Serializable
data class NotaLine(
    val serviceId: String,
    val name: String,
    val qty: Double,
    val unit: String,
    val unitPrice: Int,
    val handledByEmail: String = "",
    val handledByName: String = "",
    val commissionPerUnit: Int = 0,
    /** Snapshot hubungan retail agar koreksi transaksi lama tetap mengubah produk yang tepat. */
    val productKey: String = "",
)

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
    var completedAt: String? = null,
    /** Terpisah dari status pengerjaan: null berarti belum diserahkan ke pelanggan. */
    var pickedUpAt: String? = null,
    val lines: List<NotaLine> = emptyList(),
    /** Email kasir disimpan sebagai identitas stabil; nama tetap menjadi snapshot tampilan. */
    val kasirEmail: String = "",
    /** Versi server terakhir untuk mencegah koreksi dari dua perangkat saling menimpa. */
    val updatedAtMs: Long = 0,
) {
    val hanging: Boolean get() = laundry != LaundryStatus.Selesai || pay != PayStatus.Lunas || pickedUpAt == null
}

@Serializable
data class AttendanceRecord(
    val id: String,
    val staffEmail: String,
    val staffName: String,
    val branchId: String,
    val workDate: String,
    val checkInAtMs: Long,
    val checkInAt: String,
    val checkOutAtMs: Long? = null,
    val checkOutAt: String? = null,
    val note: String = "",
    /** Lokasi lokal saja; nilainya dibuang sebelum sinkronisasi cloud. */
    val checkInPhotoPath: String = "",
    /** Lokasi lokal saja; nilainya dibuang sebelum sinkronisasi cloud. */
    val checkOutPhotoPath: String = "",
)

@Serializable
enum class ProductKind(val label: String) {
    BarangJual("Barang dijual"),
    BahanHabisPakai("Bahan habis pakai"),
}

@Serializable
data class Product(
    val name: String,
    var stock: Int,
    val min: Int,
    val id: String = "",
    val kind: ProductKind = ProductKind.BahanHabisPakai,
    val unit: String = "pcs",
) {
    val key: String get() = id.ifBlank { name }
}

/** Saldo produk per cabang; Product tetap menjadi katalog bersama. */
@Serializable
data class BranchStock(
    val branchId: String,
    val productKey: String,
    var stock: Int,
)

@Serializable
enum class InventoryCategory(val label: String) {
    MesinCuci("Mesin cuci"),
    MesinPengering("Mesin pengering"),
    Setrika("Setrika / steamer"),
    Timbangan("Timbangan"),
    Peralatan("Peralatan operasional"),
    BarangJual("Barang dijual"),
    BahanHabisPakai("Bahan habis pakai"),
    Lainnya("Lainnya"),
}

@Serializable
enum class InventoryStatus(val label: String) {
    Normal("Normal"),
    PerluPerbaikan("Perlu perbaikan"),
    Rusak("Rusak"),
}

@Serializable
data class AssetType(
    val id: String,
    /** Kode pendek yang membentuk Aset ID, misalnya MC untuk mesin cuci. */
    val code: String,
    val name: String,
    /** Jenis yang sudah dipakai aset tidak dihapus, hanya dinonaktifkan. */
    val active: Boolean = true,
)

@Serializable
data class InventoryItem(
    val id: String,
    val branchId: String,
    val name: String,
    val category: InventoryCategory,
    val brand: String = "",
    val serialNumber: String = "",
    val quantity: Int = 1,
    val unit: String = "unit",
    val status: InventoryStatus = InventoryStatus.Normal,
    val purchaseAt: String = "",
    val notes: String = "",
    val sellable: Boolean = false,
    /** ID jenis aset dari katalog. Kosong untuk data lama yang masih memakai kategori bawaan. */
    val assetTypeId: String = "",
    /** Aset ID yang dibuat sistem: kode cabang, kode jenis, lalu nomor urut pada cabang itu. */
    val assetCode: String = "",
    /** Path foto di perangkat ini saja. Tidak ikut dikirim ke server. */
    val photoPath: String = "",
)

@Serializable
enum class ExpenseCategory(val label: String) {
    Gaji("Gaji pegawai"),
    Sewa("Sewa laundry"),
    ListrikAir("Listrik & air"),
    PerbaikanMesin("Perbaikan mesin"),
    BahanLaundry("Bahan laundry"),
    Transportasi("Transportasi"),
    Pemasaran("Pemasaran"),
    Lainnya("Lainnya"),
}

@Serializable
data class Expense(
    val id: String,
    val branchId: String,
    val category: ExpenseCategory,
    val amount: Int,
    val occurredAtMs: Long,
    val occurredAt: String,
    val note: String,
    val by: String,
)

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
    /** Saldo setelah mutasi; null untuk data lama yang belum menyimpan snapshot saldo. */
    val balanceAfter: Int? = null,
    val syncId: String = "",
    /** Hanya true untuk stok yang dikembalikan setelah penghapusan Service berhasil di server. */
    val requiresDeletedNota: Boolean = false,
)

@Serializable
data class AuditRow(
    val at: String,
    val atMs: Long = 0,
    val user: String,
    val branchId: String,
    val action: String,
    val notaId: String? = null,
    val syncId: String = "",
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

/** Pembayaran append-only agar kas dihitung dari waktu uang diterima, bukan waktu nota dibuat. */
@Serializable
data class PaymentRecord(
    val id: String,
    val notaId: String,
    val branchId: String,
    val amount: Int,
    val method: PayMethod,
    val atMs: Long,
    val at: String,
    val by: String,
)

/** Batas modul dan fungsi tambahan milik seorang pengguna. Owner selalu memiliki akses penuh. */
@Serializable
data class UserAccessPolicy(
    val email: String,
    val modules: Set<String> = emptySet(),
    val functions: Set<String> = emptySet(),
)

/**
 * Role adalah kumpulan hak akses yang dapat dipakai ulang.
 *
 * Setiap pengguna melekat pada satu role, dan role itulah yang menentukan modul serta fungsi
 * yang dapat diakses. Role bawaan tidak dapat dihapus supaya peran lama tetap bekerja.
 */
@Serializable
data class AccessRole(
    val id: String,
    val name: String,
    val modules: Set<String> = emptySet(),
    val functions: Set<String> = emptySet(),
    /** Role bawaan dibuat sistem; hanya hak aksesnya yang boleh diubah. */
    val builtIn: Boolean = false,
    /**
     * Versi [AccessCatalog] yang terakhir menambal role ini.
     *
     * Dipakai supaya penambalan fungsi bawaan hanya terjadi SEKALI per versi katalog. Tanpa
     * penanda ini, fungsi yang sengaja dicabut Owner akan hidup kembali setiap aplikasi dibuka,
     * karena penambal tidak bisa membedakan "belum pernah ada" dari "sengaja dihapus".
     */
    val catalogVersion: Int = 0,
)

/** Pesan dapat disusun oleh Owner tanpa mengubah template nota di kode aplikasi. */
@Serializable
data class WhatsAppTemplate(
    val id: String = "business",
    val opening: String = "Halo {pelanggan},",
    val content: String = "Berikut rincian Service Anda dari {cabang}.",
    val closing: String = "Terima kasih telah mempercayakan laundry Anda kepada {cabang}.",
)

data class Session(
    val role: Role,
    val name: String,
    val email: String,
    val branchId: String,
)

@Serializable
data class CloudIdentity(
    val email: String,
    val name: String,
    val role: Role,
    val branchIds: List<String>,
)

@Serializable
data class Snapshot(
    val branches: List<Branch> = emptyList(),
    val staff: List<Staff> = emptyList(),
    val customers: List<Customer> = emptyList(),
    val services: List<ServiceItem> = emptyList(),
    val products: List<Product> = emptyList(),
    val branchStocks: List<BranchStock> = emptyList(),
    val inventory: List<InventoryItem> = emptyList(),
    /** Katalog jenis aset; dipakai sebagai filter dan pembentuk Aset ID. */
    val assetTypes: List<AssetType> = emptyList(),
    val expenses: List<Expense> = emptyList(),
    val notas: List<Nota> = emptyList(),
    val stockMoves: List<StockMove> = emptyList(),
    val audit: List<AuditRow> = emptyList(),
    val cashCloses: List<CashClose> = emptyList(),
    val payments: List<PaymentRecord> = emptyList(),
    val attendance: List<AttendanceRecord> = emptyList(),
    val accessPolicies: List<UserAccessPolicy> = emptyList(),
    /** Katalog role; setiap pengguna melekat pada salah satunya. */
    val accessRoles: List<AccessRole> = emptyList(),
    val whatsappTemplates: List<WhatsAppTemplate> = emptyList(),
    val deletedNotaIds: List<String> = emptyList(),
    val sessionEmail: String? = null,
    val viewBranch: String = "all",
    val viewKasir: String = "all",
    val reportPeriod: String = "hari",
    val updatedAt: Long = 0,
)
