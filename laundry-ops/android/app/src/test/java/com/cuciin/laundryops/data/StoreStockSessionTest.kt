package com.cuciin.laundryops.data

import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class StoreStockSessionTest {
    private val store = CuciinStore
    private val owner = Staff("Owner uji", "owner@example.test", Role.Owner, listOf("b1", "b2", "b3"))
    private val applyingCloud = store.javaClass.getDeclaredField("applyingCloud").apply { isAccessible = true }

    @Before fun setup() {
        applyingCloud.setBoolean(store, true) // Tanpa disk terpasang atau jaringan pada tes store.
        store.branches.clear()
        store.branches.addAll(listOf("b1", "b2", "b3").map { Branch(it, it, it, "", "") })
        store.staff.clear()
        store.staff.add(owner.copy(passwordHash = "trusted-test-fixture"))
        store.accessRoles.clear()
        store.accessPolicies.clear()
        store.products.clear()
        store.branchStocks.clear()
        store.stockMoves.clear()
        store.audit.clear()
        store.notas.clear()
        store.cart.clear()
        store.selectedCustomer.value = null
        store.notaBranchId.value = null
        store.stockBranchId.value = null
        store.session.value = Session(owner.role, owner.name, owner.email, "b1", owner.branchIds)
    }

    @After fun cleanup() {
        store.session.value = null
        store.staff.clear()
        store.branches.clear()
        store.products.clear()
        store.branchStocks.clear()
        store.stockMoves.clear()
        store.audit.clear()
        store.notas.clear()
        store.cart.clear()
        store.selectedCustomer.value = null
        store.notaBranchId.value = null
        store.stockBranchId.value = null
        applyingCloud.setBoolean(store, false)
    }

    private val service = ServiceItem("cuci", "Cuci", "kg", 7000, false, false)

    private fun draft() {
        store.addToCart(service)
        store.selectedCustomer.value = Customer("c1", "Pelanggan uji", "", "")
        store.notaBranchId.value = "b1"
        store.stockBranchId.value = "b1"
    }

    private fun assertDraftEmpty() {
        assertTrue("keranjang akun sebelumnya harus dibuang", store.cart.isEmpty())
        assertNull(store.selectedCustomer.value)
        assertNull(store.notaBranchId.value)
        assertNull(store.stockBranchId.value)
    }

    @Test fun logoutMembuangDraftTransaksi() {
        draft()
        store.logout()
        assertNull(store.session.value)
        assertDraftEmpty()
    }

    @Test fun loginAkunBerbedaMembuangDraftDanPetugasLama() {
        draft()
        val next = Staff("Kasir baru", "baru@example.test", Role.Kasir, listOf("b2"))
        store.staff.add(next.copy(passwordHash = "trusted-test-fixture"))
        assertTrue(store.login(next.email, skipPassword = true))
        assertDraftEmpty()
        store.addToCart(service)
        assertEquals(next.email, store.cart.single().handledByEmail)
        assertEquals(next.name, store.cart.single().handledByName)
    }

    @Test fun loginAkunSamaTidakMembuangDraft() {
        draft()
        assertTrue(store.login(owner.email.uppercase(), skipPassword = true))
        assertEquals(1, store.cart.size)
        assertNotNull(store.selectedCustomer.value)
        assertEquals("b1", store.notaBranchId.value)
    }

    @Test fun loginGagalTidakMembuangDraftAkunAktif() {
        draft()
        assertFalse(store.login("tidak-ada@example.test", skipPassword = true))
        assertEquals(owner.email, store.session.value?.email)
        assertEquals(1, store.cart.size)
    }

    @Test fun sesiTerautentikasiBaruMembuangDraft() {
        draft()
        store.authenticateSession(Session(Role.Kasir, "Kasir baru", "baru@example.test", "b2", listOf("b2")))
        assertDraftEmpty()
    }

    @Test fun antreanAkunAsalMenghalangiLoginLainTetapiTidakRestoreAsal() {
        val field = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val previous = field.get(CloudSync)
        val command = SyncCommand("cmd1", "nota", "n1", "upsert", "b1", 1L, actorEmail = owner.email)
        field.set(CloudSync, SyncOutbox(SyncClientState(pending = listOf(command))))
        try {
            draft()
            val other = Staff("Kasir lain", "lain@example.test", Role.Kasir, listOf("b1"))
            store.staff.add(other)
            assertFalse(store.login(other.email, skipPassword = true))
            assertEquals(owner.email, store.session.value?.email)
            assertEquals(1, store.cart.size)
            assertTrue(store.login(owner.email, skipPassword = true))
            assertEquals(1, store.cart.size)
        } finally {
            field.set(CloudSync, previous)
        }
    }

    @Test fun firebaseMasukMemakaiJalurSesiYangSama() {
        val source = java.io.File("src/main/java/com/cuciin/laundryops/data/FirebaseCloud.kt").readText()
        val signIn = source.substringAfter("fun signIn(").substringBefore("private fun friendlyAuthMessage")
        assertTrue("Firebase tidak boleh melewati pembersihan draft", signIn.contains("CuciinStore.authenticateSession("))
        assertFalse(signIn.contains("CuciinStore.session.value ="))
    }

    @Test fun koreksiKasirMempertahankanPetugasLamaPerUrutanLayanan() {
        val editor = Staff("Editor uji", "editor@example.test", Role.Kasir, listOf("b1"))
        store.staff.add(editor)
        store.session.value = Session(editor.role, editor.name, editor.email, "b1", editor.branchIds)
        val lines = listOf(
            NotaLine("cuci", "Cuci", 1.0, "kg", 7000, "a@example.test", "Petugas A"),
            NotaLine("cuci", "Cuci", 2.0, "kg", 7000, "b@example.test", "Petugas B"),
            NotaLine("kering", "Kering", 1.0, "kg", 7000),
        )
        store.notas.add(Nota("n1", "b1", "Kasir awal", "Pelanggan", "", "", 28000, 0,
            PayStatus.Belum, LaundryStatus.Masuk, "", pickupAt = "", waSent = false, lines = lines,
            kasirEmail = "awal@example.test"))
        val edited = lines.map { it.copy(qty = it.qty + 1, handledByEmail = editor.email, handledByName = editor.name) } +
            NotaLine("baru", "Baru", 1.0, "kg", 7000, "palsu@example.test", "Palsu")
        assertNull(store.updateNotaLines("n1", edited))
        val result = store.notas.single()
        assertEquals("awal@example.test", result.kasirEmail)
        assertEquals("Kasir awal", result.kasir)
        assertEquals(listOf("a@example.test", "b@example.test", "", editor.email), result.lines.map { it.handledByEmail })
        assertEquals(listOf("Petugas A", "Petugas B", "", editor.name), result.lines.map { it.handledByName })
    }

    @Test fun ownerTetapBolehMenetapkanPetugasSaatKoreksi() {
        val line = NotaLine("cuci", "Cuci", 1.0, "kg", 7000, "a@example.test", "Petugas A")
        store.notas.add(Nota("n1", "b1", "Kasir awal", "Pelanggan", "", "", 7000, 0,
            PayStatus.Belum, LaundryStatus.Masuk, "", pickupAt = "", waSent = false, lines = listOf(line)))
        assertNull(store.updateNotaLines("n1", listOf(line.copy(handledByEmail = "b@example.test", handledByName = "Petugas B"))))
        assertEquals("b@example.test", store.notas.single().lines.single().handledByEmail)
    }

    @Test fun hanyaOwnerBolehMemilihPetugasKeranjang() {
        draft()
        assertTrue(store.canAssignHandler())
        val cashier = Staff("Kasir", "kasir@example.test", Role.Kasir, listOf("b1"))
        store.staff.add(cashier)
        store.session.value = Session(cashier.role, cashier.name, cashier.email, "b1", cashier.branchIds)
        assertFalse("pilihan UI harus mengikuti pembatasan saat simpan", store.canAssignHandler())
    }

    @Test fun firebaseMenolakCallbackTerlambatDanMemeriksaAkunOutboxSebelumAutentikasi() {
        val source = java.io.File("src/main/java/com/cuciin/laundryops/data/FirebaseCloud.kt").readText()
        val signIn = source.substringAfter("fun signIn(").substringBefore("private fun friendlyAuthMessage")
        assertTrue(signIn.indexOf("CloudSync.accountSwitchError(email)") in 0 until signIn.indexOf("FirebaseAuth.getInstance().signInWithEmailAndPassword"))
        assertTrue(signIn.contains("if (done.get() || attempt != signInAttempt.get()) return@verifyIdentity"))
        assertTrue(signIn.contains("currentUser?.uid != authenticatedUser.uid"))
        assertTrue(signIn.contains("currentEmail != identity.email.trim().lowercase()"))
        assertTrue(source.contains("val currentEmail: String?"))
        assertTrue(source.contains("val user = FirebaseAuth.getInstance().currentUser ?: return null"))
        assertFalse(source.contains("currentUser!!.getIdToken"))
    }

    @Test fun stokAwalMengirimUpdateSekaliPerCabangDipilih() {
        val product = store.addProduct("Sabun uji", 12, 2, setOf("b1", "b2", "asing"))!!
        assertEquals(listOf(12, 12, 0), listOf("b1", "b2", "b3").map { store.stockOf(product.key, it) })
        val moves = store.stockMoves.filter { it.product == product.key }
        assertEquals("stok awal memerlukan satu perintah Update per cabang nyata", 2, moves.size)
        assertEquals(setOf("b1", "b2"), moves.map { it.branchId }.toSet())
        moves.forEach {
            assertEquals(StockKind.Update, it.kind)
            assertEquals(12, it.qty)
            assertEquals(12, it.balanceAfter)
            assertEquals(owner.name, it.by)
            assertTrue(it.syncId.isNotBlank())
        }
        assertEquals(2, moves.map { it.syncId }.toSet().size)
        assertEquals(3, store.branchStocks.count { it.productKey == product.key })
    }

    @Test fun stokNolNegatifDanTanpaPilihanTidakMengirimMutasi() {
        listOf(0 to setOf("b1"), -5 to setOf("b2"), 12 to emptySet<String>()).forEach { (qty, ids) ->
            val product = store.addProduct("Produk $qty", qty, 0, ids)!!
            assertTrue(store.branchStocks.filter { it.productKey == product.key }.all { it.stock == 0 })
            assertTrue(store.stockMoves.none { it.product == product.key })
        }
    }

    @Test fun editStokSetelahStokAwalTidakMenghitungDuaKali() {
        val product = store.addProduct("Sabun uji", 12, 0, setOf("b1"))!!
        assertEquals(1, store.editStocks(mapOf(product.key to 3), "b1", StockKind.Tambah))
        assertEquals(15, store.stockOf(product.key, "b1"))
        assertEquals(1, store.editStocks(mapOf(product.key to 2), "b1", StockKind.Kurang))
        assertEquals(13, store.stockOf(product.key, "b1"))
        assertEquals(1, store.editStocks(mapOf(product.key to 5), "b1", StockKind.Update))
        assertEquals(5, store.stockOf(product.key, "b1"))
        assertEquals(4, store.stockMoves.count { it.product == product.key })
        assertEquals(0, store.stockOf(product.key, "b2"))
    }
}
