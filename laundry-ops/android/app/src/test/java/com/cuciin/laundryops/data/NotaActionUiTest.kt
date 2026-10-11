package com.cuciin.laundryops.data

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

class NotaActionUiTest {
    @Test
    fun notaBerbayarTidakMenawarkanHapusDanPembatalanTidakMemakaiDialogHapus() {
        val dir = File(System.getProperty("user.dir").orEmpty()).let {
            if (it.name == "app") it else File(it, "app")
        }
        val source = File(dir, "src/main/java/com/cuciin/laundryops")
        val ops = File(source, "ui/OpsScreens.kt").readText()
        val widgets = File(source, "ui/components/Widgets.kt").readText()
        assertTrue(ops.contains("if (n.paid <= 0) DangerBtn(\"Hapus Service\")"))
        assertTrue(ops.contains("DangerBtn(\"Batalkan nota ini\", confirmFirst = false) { cancelOpen = true }"))
        assertTrue(ops.contains("Text(\"Ya, batalkan nota\""))
        assertTrue(widgets.contains("if (confirmFirst) confirm = true else onClick()"))
    }
}
