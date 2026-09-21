package com.cuciin.laundryops.data

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga: setiap kolom isian harus memberi tahu keyboard apa yang harus
 * dilakukan tombol aksi, dan mengarahkan fokus saat tombol itu ditekan.
 *
 * Kenapa ini penting. Tanpa `imeAction` dan `keyboardActions`, menekan tombol
 * Next di keyboard tidak melakukan apa pun. Fokus tetap di kolom pertama, jadi
 * apa pun yang diketik berikutnya masuk ke kolom yang salah. Yang terjadi di
 * lapangan: kasir mengetik email, menekan Next, mengetik kata sandi, lalu
 * menemukan kolom emailnya berisi `nama@gmail.comsandi`. Masuk gagal, dan
 * penyebabnya tidak terlihat sama sekali di layar.
 *
 * Test ini membaca berkas sumber langsung, bukan nilai di memori, supaya
 * kolom baru yang ditambahkan tanpa arahan keyboard ikut tertangkap.
 */
class FieldKeyboardActionTest {

    /** Akar modul `app`, naik dari folder kelas test bila perlu. */
    private val modul: File = File(System.getProperty("user.dir").orEmpty()).let {
        if (it.name == "app") it else File(it, "app")
    }

    private val berkasTempatIsian: List<File> = listOf("GlassCard.kt", "AuthScreens.kt")
        .map { File(modul, "src/main/java/com/cuciin/laundryops/ui/$it") }
        .filter { it.exists() }

    @Test
    fun `berkas tempat isian ditemukan`() {
        assertTrue(
            "Tidak ada berkas tempat isian yang ditemukan di ${modul.absolutePath}",
            berkasTempatIsian.isNotEmpty(),
        )
    }

    @Test
    fun `setiap tempat isian mengarahkan tombol keyboard`() {
        val pelanggar = mutableListOf<String>()

        for (berkas in berkasTempatIsian) {
            val teks = berkas.readText()
            // Hitung berapa OutlinedTextField ada, dan berapa yang punya arahan.
            val jumlahKolom = Regex("OutlinedTextField\\(").findAll(teks).count()
            val jumlahArahan = Regex("keyboardActions\\s*=").findAll(teks).count()
            if (jumlahArahan < jumlahKolom) {
                pelanggar += "${berkas.name}: $jumlahKolom kolom tapi hanya $jumlahArahan yang " +
                    "mengarahkan tombol keyboard. Kolom tanpa arahan membuat tombol Next tidak " +
                    "berpindah fokus, sehingga ketikan berikutnya masuk ke kolom yang salah."
            }
        }

        assertTrue(pelanggar.joinToString("\n"), pelanggar.isEmpty())
    }

    @Test
    fun `keyboard memakai aksi Next atau Done, bukan default`() {
        val pelanggar = mutableListOf<String>()

        for (berkas in berkasTempatIsian) {
            val teks = berkas.readText()
            if (!teks.contains("OutlinedTextField(")) continue
            val adaArahan = teks.contains("ImeAction.Next") || teks.contains("ImeAction.Done")
            if (!adaArahan) {
                pelanggar += "${berkas.name}: ada kolom isian tapi tidak ada ImeAction.Next " +
                    "maupun ImeAction.Done. Tanpa imeAction, keyboard menampilkan tombol yang " +
                    "tidak melakukan apa pun."
            }
        }

        assertTrue(pelanggar.joinToString("\n"), pelanggar.isEmpty())
    }
}
