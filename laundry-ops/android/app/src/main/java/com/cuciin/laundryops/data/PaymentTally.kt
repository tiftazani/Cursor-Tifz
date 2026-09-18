package com.cuciin.laundryops.data

/**
 * Perhitungan penerimaan uang dari nota dan jurnal pembayaran.
 *
 * Dipisah dari store supaya dapat diuji tanpa Android, dan supaya aturannya hanya ada di satu
 * tempat. Dipakai `CuciinStore.paymentRecords()`.
 *
 * Aturan penting: sebagian nota dibayar SEBELUM jurnal pembayaran ada, lalu menerima pembayaran
 * berikutnya setelah jurnal aktif. Untuk nota seperti itu jurnalnya hanya memuat pembayaran yang
 * baru, sehingga bagian lamanya harus dihitung sebagai SELISIH antara `paid` nota dan jumlah
 * jurnalnya. Membuang seluruh `paid` begitu nota punya satu entri jurnal membuat uang yang
 * diterima sebelum jurnal ada hilang dari laporan kas dan tutup kas.
 */
object PaymentTally {

    /**
     * Penerimaan lama yang tidak punya entri jurnal sendiri.
     *
     * @param paid jumlah yang sudah dibayar menurut nota
     * @param jurnal jumlah entri jurnal pembayaran untuk nota itu
     * @return bagian yang belum terjurnal, atau 0 bila seluruhnya sudah terjurnal
     */
    fun legacyAmount(paid: Int, jurnal: Int): Int = (paid - jurnal).coerceAtLeast(0)
}
