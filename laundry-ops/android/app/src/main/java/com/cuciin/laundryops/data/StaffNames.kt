package com.cuciin.laundryops.data

/**
 * Nama yang ditampilkan untuk transaksi lama.
 *
 * Email adalah identitas yang stabil, nama manusia bisa berubah. Transaksi historis
 * menyimpan nama pada saat dibuat, jadi laporan harus mencari nama terkini dari daftar
 * staf supaya perubahan nama di Daftar User langsung terlihat di seluruh laporan.
 */
fun staffDisplayName(staff: List<Staff>, email: String, snapshotName: String): String {
    val current = staff.firstOrNull { it.email.equals(email, ignoreCase = true) }?.name?.trim()
    return current.takeUnless { it.isNullOrBlank() }
        ?: snapshotName.trim().takeUnless { it.isNullOrBlank() }
        ?: email.substringBefore('@')
}
