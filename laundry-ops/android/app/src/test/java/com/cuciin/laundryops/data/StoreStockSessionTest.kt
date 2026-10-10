package com.cuciin.laundryops.data

import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class StoreStockSessionTest {
    private val store = CuciinStore
    private val owner = Staff("Owner uji", "owner@example.test", Role.Owner, listOf("b1", "b2", "b3"))
    private val applyingCloud = store.javaClass.getDeclaredField("applyingCloud").apply { isAccessible = true }
    private val verifiedAccess = store.javaClass.getDeclaredField("verifiedAccess").apply { isAccessible = true }

    @Before fun setup() {
        verifiedAccess.set(store, null)
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
        verifiedAccess.set(store, null)
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

    @Test fun ownerReportsDoNotInheritWorkScreenBranchOrCashierFilter() {
        val oldBranch = store.viewBranch.value
        val oldKasir = store.viewKasir.value
        val oldSelected = store.reportBranchIds.value
        try {
            val a = Nota("A", "b1", "Kasir A", "Uji", "", "Cuci", 7000, 0,
                PayStatus.Belum, LaundryStatus.Masuk, "", Clock.nowMs(), "", false)
            store.notas.addAll(listOf(a, a.copy(id = "B", branchId = "b2", kasir = "Kasir B")))
            store.viewBranch.value = "b1"
            store.viewKasir.value = "Kasir A"
            store.reportBranchIds.value = emptySet()
            assertEquals(setOf("A", "B"), store.reportNotas().map { it.id }.toSet())
            store.reportBranchIds.value = setOf("b2")
            assertEquals(listOf("B"), store.periodNotas().map { it.id })
            store.session.value = Session(Role.Kasir, "Kasir", "kasir@example.test", "b1", listOf("b1"))
            assertEquals(listOf("A"), store.reportNotas().map { it.id })
        } finally {
            store.viewBranch.value = oldBranch
            store.viewKasir.value = oldKasir
            store.reportBranchIds.value = oldSelected
        }
    }

    @Test fun ownerLoginClearsHiddenLegacyCashierFilter() {
        val oldKasir = store.viewKasir.value
        val oldBranch = store.viewBranch.value
        try {
            store.viewKasir.value = "Nama Kasir lama"
            store.authenticateSession(Session(owner.role, owner.name, owner.email, "b1", owner.branchIds),
                Snapshot(staff = listOf(owner), accessRoles = AccessCatalog.builtInRoles()))
            assertEquals("all", store.viewKasir.value)
        } finally {
            store.viewKasir.value = oldKasir
            store.viewBranch.value = oldBranch
        }
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

    @Test fun foreignBranchCannotSendWhatsAppOrHandover() {
        val n = Nota("foreign", "b2", "Kasir", "Pelanggan", "", "", 100, 100,
            PayStatus.Lunas, LaundryStatus.Selesai, "", pickupAt = "", waSent = false)
        store.notas.add(n)
        for (role in listOf(Role.Kasir, Role.Supervisor)) {
            val user = Staff("Uji", "user@example.test", role, listOf("b1"))
            store.staff.clear(); store.staff.add(user)
            store.authenticateSession(Session(role, user.name, user.email, "b1", user.branchIds))
            val before = store.cloudSnapshot()
            assertNotNull("$role: WA cabang lain", store.markWaSent(n.id))
            assertNotNull("$role: serah terima cabang lain", store.markPickedUp(n.id))
            assertEquals(before, store.cloudSnapshot())
        }
    }

    @Test fun expenseWritesRejectForeignBranchesBeforeMutation() {
        val oldExpenses = store.expenses.toList()
        val field = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val oldBox = field.get(CloudSync)
        val box = SyncOutbox(SyncClientState())
        try {
            field.set(CloudSync, box)
            store.expenses.clear()
            val foreign = Expense("foreign", "b3", ExpenseCategory.Gaji, 100, 1L, "", "", "Owner")
            store.expenses.add(foreign)
            val role = AccessRole("costs", "Biaya", setOf("expense", "analytics"), setOf("expense.write", "expense.delete", "analytics.view"))
            for (baseRole in listOf(Role.Kasir)) {
                val user = Staff("Uji", "user@example.test", baseRole, listOf("b1", "b2"), accessRoleId = role.id)
                store.staff.clear(); store.staff.add(user)
                store.authenticateSession(Session(user.role, user.name, user.email, "b1", user.branchIds), Snapshot(staff = listOf(user), accessRoles = listOf(role)))
                assertTrue(store.canAccess("expense", "expense.write"))
                assertTrue(store.canAccess("analytics", "analytics.view"))
                val before = store.cloudSnapshot()
                val state = box.state
                assertNull("$baseRole: tidak boleh mencatat biaya cabang asing", store.addExpense("b3", ExpenseCategory.Gaji, 100, 1L, "uji"))
                assertNull(store.addExpense("", ExpenseCategory.Gaji, 100, 1L, "uji"))
                assertNotNull(store.deleteExpense(foreign.id))
                assertEquals(before, store.cloudSnapshot())
                assertEquals(state, box.state)
                val own = store.addExpense("b2", ExpenseCategory.Gaji, 100, 1L, "uji")
                assertNotNull("Cabang tugas kedua tetap dapat dipakai", own)
                assertNull(store.deleteExpense(own!!.id))
            }
            store.authenticateSession(Session(owner.role, owner.name, owner.email, "b1", owner.branchIds), Snapshot(staff = listOf(owner)))
            assertNotNull(store.addExpense("b3", ExpenseCategory.Gaji, 100, 1L, "uji"))
            assertNull(store.addExpense("unknown", ExpenseCategory.Gaji, 100, 1L, "uji"))
            assertNull(store.deleteExpense(foreign.id))
            val supervisor = owner.copy(role = Role.Supervisor, accessRoleId = role.id)
            store.staff.clear(); store.staff.add(supervisor)
            store.authenticateSession(Session(supervisor.role, supervisor.name, supervisor.email, "b1", supervisor.branchIds), Snapshot(staff = listOf(supervisor), accessRoles = listOf(role)))
            val before = store.cloudSnapshot()
            assertNull(store.addExpense("b1", ExpenseCategory.Gaji, 100, 1L, "uji"))
            assertNotNull(store.deleteExpense(store.expenses.single().id))
            assertEquals(before, store.cloudSnapshot())
        } finally {
            store.expenses.clear(); store.expenses.addAll(oldExpenses)
            field.set(CloudSync, oldBox)
        }
    }

    @Test fun inventoryWritesRejectForeignBranchesBeforeMutation() {
        val oldInventory = store.inventory.toList()
        val field = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val oldBox = field.get(CloudSync)
        val box = SyncOutbox(SyncClientState())
        try {
            field.set(CloudSync, box)
            store.inventory.clear()
            val foreign = InventoryItem(id = "inv-foreign", branchId = "b3", name = "Mesin", category = InventoryCategory.values().first())
            val own = foreign.copy(id = "inv-own", branchId = "b1")
            store.inventory.addAll(listOf(foreign, own))
            val role = AccessRole("assets", "Aset", setOf("inventory"), setOf("inventory.view", "inventory.write", "inventory.delete"))
            val user = Staff("Uji", "user@example.test", Role.Kasir, listOf("b1", "b2"), accessRoleId = role.id)
            store.staff.clear(); store.staff.add(user)
            store.authenticateSession(Session(user.role, user.name, user.email, "b1", user.branchIds), Snapshot(staff = listOf(user), accessRoles = listOf(role)))
            val before = store.cloudSnapshot()
            val state = box.state
            assertNull("Aset cabang asing tidak boleh dibuat", store.addInventory("b3", "X", InventoryCategory.values().first(), "", "", 1, "unit", InventoryStatus.values().first(), "", "", false))
            assertNotNull("Aset cabang asing tidak boleh diubah", store.updateInventory(foreign.copy(name = "Ubah")))
            assertNotNull("Aset sendiri tidak boleh dipindah ke cabang asing", store.updateInventory(own.copy(branchId = "b3")))
            assertNotNull("Aset cabang asing tidak boleh dihapus", store.deleteInventory(foreign.id))
            assertEquals(before, store.cloudSnapshot())
            assertEquals(state, box.state)
            assertNull("Cabang tugas kedua tetap dapat dipakai", store.updateInventory(own.copy(branchId = "b2")))
            assertNotNull(store.addInventory("b2", "Y", InventoryCategory.values().first(), "", "", 1, "unit", InventoryStatus.values().first(), "", "", false))
        } finally {
            store.inventory.clear(); store.inventory.addAll(oldInventory)
            field.set(CloudSync, oldBox)
        }
    }

    @Test fun attendanceVisibilityAndCheckoutRespectCurrentBranches() {
        val oldAttendance = store.attendance.toList()
        try {
            store.attendance.clear()
            val user = Staff("Uji", "user@example.test", Role.Kasir, listOf("b1", "b2"))
            val role = AccessRole("attendance-test", "Absensi", setOf("attendance", "analytics"), setOf("attendance.self", "attendance.view", "analytics.view"))
            store.staff.clear(); store.staff.add(user.copy(accessRoleId = role.id))
            store.authenticateSession(Session(user.role, user.name, user.email, "b1", user.branchIds), Snapshot(staff = store.staff.toList(), accessRoles = listOf(role)))
            val today = Clock.dateKey()
            store.attendance.addAll(listOf(
                AttendanceRecord("own-b2", user.email, user.name, "b2", today, 1L, ""),
                AttendanceRecord("other-b1", "other@example.test", "Other", "b1", today, 2L, ""),
                AttendanceRecord("foreign", "other@example.test", "Other", "b3", today, 3L, ""),
                AttendanceRecord("own-revoked", user.email, user.name, "b3", today, 4L, ""),
            ))
            assertEquals(setOf("own-b2", "other-b1"), store.visibleAttendance().map { it.id }.toSet())
            assertTrue(store.visibleAttendance(branchIds = setOf("b3")).isEmpty())
            val before = store.cloudSnapshot()
            assertNotNull(store.checkOut("b3", photoPath = "fixture.jpg"))
            assertEquals(before, store.cloudSnapshot())
            assertNull(store.checkOut("b2", photoPath = "fixture.jpg"))
            assertNotNull(store.attendance.first { it.id == "own-b2" }.checkOutAtMs)
            store.applyVerifiedAccess(Snapshot(staff = listOf(user), accessRoles = listOf(role.copy(functions = setOf("attendance.self")))))
            assertEquals(listOf("own-b2"), store.visibleAttendance().map { it.id })
            store.authenticateSession(Session(owner.role, owner.name, owner.email, "b1", owner.branchIds), Snapshot(staff = listOf(owner)))
            assertEquals(4, store.visibleAttendance().size)
            assertEquals(setOf("foreign", "own-revoked"), store.visibleAttendance(branchIds = setOf("b3")).map { it.id }.toSet())
        } finally {
            store.attendance.clear(); store.attendance.addAll(oldAttendance)
        }
    }

    @Test fun businessBranchPickersDoNotExpandAssignmentWithAnalyticsPermission() {
        val source = java.io.File("src/main/java/com/cuciin/laundryops/ui/BusinessScreens.kt").readText()
        for (name in listOf("ExpensesScreen", "AttendanceScreen")) {
            val screen = source.substringAfter("internal fun $name(").substringBefore("\n@OptIn")
            assertFalse(name, screen.contains("if (canViewAllBranches(session)) businessStore.branches"))
            assertTrue("$name must reset remembered selection after assignment changes", screen.contains("LaunchedEffect(allowedBranches, branchId)"))
        }
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

    @Test fun antreanAkunAsalMenghalangiPengirimanTetapiTidakLogin() {
        val field = CloudSync.javaClass.getDeclaredField("outbox").apply { isAccessible = true }
        val previous = field.get(CloudSync)
        val command = SyncCommand("cmd1", "nota", "n1", "upsert", "b1", 1L, actorEmail = owner.email)
        field.set(CloudSync, SyncOutbox(SyncClientState(pending = listOf(command))))
        try {
            draft()
            val other = Staff("Kasir lain", "lain@example.test", Role.Kasir, listOf("b1"), passwordHash = "trusted-test-fixture")
            store.staff.add(other)
            assertTrue(store.login(other.email, skipPassword = true))
            assertEquals(other.email, store.session.value?.email)
            assertDraftEmpty()
            assertNotNull(CloudSync.accountSwitchError(other.email))
            assertTrue(store.login(owner.email, skipPassword = true))
            assertNull(CloudSync.accountSwitchError(owner.email))
            assertDraftEmpty()
        } finally {
            field.set(CloudSync, previous)
        }
    }

    @Test fun firebaseMasukMemakaiJalurSesiYangSama() {
        val source = java.io.File("src/main/java/com/cuciin/laundryops/data/FirebaseCloud.kt").readText()
        val signIn = source.substringAfter("fun signIn(").substringBefore("private fun friendlyAuthMessage")
        assertTrue("Firebase harus menangani kegagalan finalisasi sesi", signIn.contains("if (!CuciinStore.finalizeAuthenticatedSession("))
        val storeSource = java.io.File("src/main/java/com/cuciin/laundryops/data/CuciinStore.kt").readText()
        val finalize = storeSource.substringAfter("internal fun finalizeAuthenticatedSession(").substringBefore("private fun closeSession(")
        assertTrue("Finalisasi tetap memakai pembersihan draft sesi", finalize.contains("authenticateSession(authenticated, access)"))
        assertFalse(Regex("CuciinStore\\.session\\.value\\s*=(?!=)").containsMatchIn(signIn))
        assertTrue("Gagal finalisasi wajib memberi pesan gagal", signIn.substringAfter("if (!CuciinStore.finalizeAuthenticatedSession(").substringBefore("CloudSync.onAuthenticated()").contains("finish(false"))

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

    @Test fun firebaseMenolakCallbackTerlambatTanpaMengunciLoginDenganOutbox() {
        val source = java.io.File("src/main/java/com/cuciin/laundryops/data/FirebaseCloud.kt").readText()
        val signIn = source.substringAfter("fun signIn(").substringBefore("private fun friendlyAuthMessage")
        assertFalse(signIn.contains("CloudSync.accountSwitchError"))
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

    @Test fun cashCloseRetailSalesAreNetOfCancelDeleteAndCorrection() {
        val product = store.addProduct("Sabun", 0, 0, setOf("b1"), ProductKind.BarangJual)!!
        assertEquals(1, store.editStocks(mapOf(product.key to 20), "b1", StockKind.Tambah))
        // Nama layanan sengaja berbeda dari nama produk: mutasi jual memakai nama layanan.
        val retail = ServiceItem("sabun-cair", "Sabun cair", "pcs", 8000, retail = true, dropOut = false, productKey = product.key)
        store.services.clear(); store.services.add(retail)
        val pelanggan = Customer("c1", "Pelanggan uji", "", "")
        fun jual(qty: Int, paid: Int) = store.saveNota(pelanggan, listOf(CartLine(retail, qty.toDouble())), paid, "", PayMethod.Tunai, "b1", false)!!
        try {
            val batal = jual(2, 16000)
            val hapus = jual(1, 0)
            val koreksi = jual(3, 0)
            assertNull(store.cancelNota(batal.id, "uji"))
            assertNull(store.deleteNota(hapus.id))
            assertNull(store.updateNotaLines(koreksi.id, koreksi.lines.map { it.copy(qty = 1.0) }))
            assertEquals(19, store.stockOf(product.key, "b1"))
            val rincian = store.closeCashPreview("b1")
            assertEquals("Hanya 1 pcs yang benar-benar terjual: $rincian", listOf(CashCloseProduct("Sabun", 1, 8000)), rincian)
        } finally {
            store.services.clear()
        }
    }

    @Test fun retailCorrectionAndCancelAfterRelinkUseSoldProduct() {
        val sabun = store.addProduct("Sabun relink", 0, 0, setOf("b1"), ProductKind.BarangJual)!!
        val deterjen = store.addProduct("Deterjen relink", 0, 0, setOf("b1"), ProductKind.BarangJual)!!
        assertEquals(2, store.editStocks(mapOf(sabun.key to 10, deterjen.key to 10), "b1", StockKind.Tambah))
        val retail = ServiceItem("retail-relink", "Barang relink", "pcs", 8000, retail = true, dropOut = false, productKey = sabun.key)
        store.services.clear(); store.services.add(retail)
        val pelanggan = Customer("c1", "Pelanggan uji", "", "")
        try {
            val koreksi = store.saveNota(pelanggan, listOf(CartLine(retail, 3.0)), 0, "", PayMethod.Tunai, "b1", false)!!
            val batal = store.saveNota(pelanggan, listOf(CartLine(retail, 2.0)), 16000, "", PayMethod.Tunai, "b1", false)!!
            assertEquals(5, store.stockOf(sabun.key, "b1"))
            store.services[0] = retail.copy(productKey = deterjen.key)
            assertNull(store.updateNotaLines(koreksi.id, koreksi.lines.map { it.copy(qty = 1.0) }))
            assertNull(store.cancelNota(batal.id, "uji"))
            assertEquals(9, store.stockOf(sabun.key, "b1"))
            assertEquals(10, store.stockOf(deterjen.key, "b1"))
        } finally {
            store.services.clear()
        }
    }

    @Test fun nonRetailServiceNamedLikeProductNeverMovesStock() {
        val product = store.addProduct("Parfum", 0, 0, setOf("b1"), ProductKind.BarangJual)!!
        assertEquals(1, store.editStocks(mapOf(product.key to 10), "b1", StockKind.Tambah))
        // Layanan tambahan biasa yang kebetulan bernama sama dengan produk stok.
        val addOn = ServiceItem("parfum-cuci", "Parfum", "kg", 2000, retail = false, dropOut = false)
        store.services.clear(); store.services.add(addOn)
        val pelanggan = Customer("c1", "Pelanggan uji", "", "")
        fun simpan(paid: Int) = store.saveNota(pelanggan, listOf(CartLine(addOn, 3.0)), paid, "", PayMethod.Tunai, "b1", false)!!
        try {
            val hapus = simpan(0); val batal = simpan(6000); val koreksi = simpan(0)
            assertEquals("Layanan non-retail tidak boleh terikat produk", "", hapus.lines.single().productKey)
            assertEquals(10, store.stockOf(product.key, "b1"))
            assertNull(store.updateNotaLines(koreksi.id, koreksi.lines.map { it.copy(qty = 1.0) }))
            assertNull(store.deleteNota(hapus.id))
            assertNull(store.cancelNota(batal.id, "uji"))
            assertEquals("Stok tidak boleh bertambah dari layanan non-retail", 10, store.stockOf(product.key, "b1"))
            assertTrue(store.closeCashPreview("b1").isEmpty())
            // Nota lama yang sudah terlanjur menyimpan productKey untuk layanan non-retail.
            val lama = simpan(0)
            store.notas[store.notas.indexOfFirst { it.id == lama.id }] = lama.copy(lines = lama.lines.map { it.copy(productKey = product.key) })
            assertTrue(store.closeCashPreview("b1").isEmpty())
            assertNull(store.deleteNota(lama.id))
            assertEquals(10, store.stockOf(product.key, "b1"))
        } finally {
            store.services.clear()
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
