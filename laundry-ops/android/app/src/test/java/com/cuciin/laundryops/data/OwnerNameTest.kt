package com.cuciin.laundryops.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

/**
 * Nama pemilik tidak boleh tampil di aplikasi.
 *
 * Aplikasi ini dijual ke banyak pemilik laundry, jadi nama yang muncul di layar harus netral.
 * Nama pribadi hanya boleh hidup di alamat email, karena itu identitas akun Firebase yang
 * tidak bisa diganti tanpa memutus login semua perangkat.
 *
 * Test ini menjaga supaya nama pribadi tidak kembali masuk ke berkas yang tampil ke pengguna,
 * termasuk lewat penggantian nama massal atau salin tempel dari berkas lama.
 */
class OwnerNameTest {

    @Test
    fun namaOwnerBawaanNetral() {
        assertEquals("Cuciin", CuciinStore.ownerName)
    }

    @Test
    fun namaOwnerBukanNamaPribadi() {
        val nama = CuciinStore.ownerName.lowercase()
        assertFalse(
            "Nama Owner masih memuat nama pribadi: '${CuciinStore.ownerName}'",
            nama.contains("tiftazani"),
        )
    }

    @Test
    fun emailTetapAlamatAsli() {
        // Email sengaja tidak diubah: itu identitas akun Firebase dan dipakai untuk login.
        assertEquals("tiftazani.khara@gmail.com", CuciinStore.ownerEmail)
    }

    @Test
    fun namaOwnerDipakaiUntukStafBawaan() {
        // Seed bawaan memakai ownerName, jadi nama staf pertama ikut netral.
        assertFalse(CuciinStore.ownerName.contains("Tiftazani"))
    }
}
