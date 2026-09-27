package com.cuciin.laundryops.ui

import com.cuciin.laundryops.data.Branch

/**
 * Aturan pemilih cabang di layar operasional.
 *
 * Kasir yang ditugaskan ke lebih dari satu cabang harus dapat berpindah cabang di semua layar
 * kerja. Sebelumnya seluruh layar memakai satu syarat yang sama untuk memunculkan pemilih cabang:
 * `canViewAllBranches`, yang sebenarnya berarti "boleh melihat laporan semua cabang"
 * (`analytics.view`). Preset Kasir tidak memuat fungsi itu, sehingga kasir multi-cabang terkunci
 * di cabang pertama pada lima tempat: Antrian, Service baru, Tutup kas, Perubahan stok massal,
 * dan Laporan perubahan stok.
 *
 * Syarat yang benar bukan "boleh melihat semua cabang", melainkan "ada lebih dari satu cabang
 * yang boleh dipilih". Aturan itu dipisahkan dari layar di sini supaya dapat diuji tanpa Android.
 */
internal object BranchPicker {

    /** Apakah pemilih cabang perlu tampil untuk akun ini. */
    fun visible(seesAllBranches: Boolean, allowedBranchIds: List<String>): Boolean =
        seesAllBranches || allowedBranchIds.size > 1

    /**
     * Cabang yang boleh dipilih akun ini.
     *
     * Akun yang melihat semua cabang mendapat seluruh katalog; akun lain hanya cabang
     * penugasannya — seluruhnya, bukan hanya yang pertama.
     */
    fun options(
        seesAllBranches: Boolean,
        allowedBranchIds: List<String>,
        branches: List<Branch>,
    ): List<Branch> =
        if (seesAllBranches) branches.toList() else branches.filter { it.id in allowedBranchIds }

    /**
     * Cabang tujuan pencatatan massal.
     *
     * Pilihan pengguna disaring dengan cabang penugasan: akun yang tidak melihat semua cabang
     * tidak boleh menulis ke cabang di luar penugasannya, walau pilihan itu datang dari layar.
     * Bila tidak ada pilihan yang sah, cabang yang sedang dilihat dipakai; bila itu pun tidak
     * sah, seluruh cabang penugasan.
     */
    fun writeTargets(
        seesAllBranches: Boolean,
        allowedBranchIds: List<String>,
        chosen: Set<String>,
        fallback: String,
    ): Set<String> {
        if (seesAllBranches) return chosen
        val allowed = allowedBranchIds.toSet()
        val picked = chosen.intersect(allowed)
        if (picked.isNotEmpty()) return picked
        return if (fallback.isNotBlank() && fallback in allowed) setOf(fallback) else allowed
    }
}
