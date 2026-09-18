package com.cuciin.laundryops.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowDownward
import androidx.compose.material.icons.outlined.ArrowUpward
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.cuciin.laundryops.ui.components.FilterSheetRow
import com.cuciin.laundryops.ui.components.GhostBtn
import com.cuciin.laundryops.ui.components.ListCard
import com.cuciin.laundryops.ui.components.PrimaryBtn
import com.cuciin.laundryops.ui.components.RowDivider
import com.cuciin.laundryops.ui.components.ScreenHeader
import com.cuciin.laundryops.ui.components.SectionLabel
import com.cuciin.laundryops.ui.components.rememberTapFeedback
import com.cuciin.laundryops.ui.theme.Card
import com.cuciin.laundryops.ui.theme.CuciinShape
import com.cuciin.laundryops.ui.theme.Ink
import com.cuciin.laundryops.ui.theme.Line
import com.cuciin.laundryops.ui.theme.LineSoft
import com.cuciin.laundryops.ui.theme.Mist
import com.cuciin.laundryops.ui.theme.Muted
import com.cuciin.laundryops.ui.theme.Mist
import com.cuciin.laundryops.ui.theme.Teal
import com.cuciin.laundryops.ui.theme.TealDeep

/**
 * Layar Atur urutan menu.
 *
 * Tiap menu punya panah naik, panah turun, dan tombol pindah bagian. Tiap judul bagian punya
 * panah untuk memindahkan seluruh bagiannya. Susunan disimpan di HP ini saja lewat [MenuPrefs].
 *
 * Menu yang tidak diizinkan role tetap disembunyikan dari daftar, jadi pengguna tidak bisa
 * menyusun menu yang toh tidak akan tampil untuknya.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun MenuOrderScreen(nav: NavHostController) {
    val ui = rememberUi()
    val layout = MenuPrefs.layout
    var moving by remember { mutableStateOf<Pair<String, String>?>(null) }  // rute ke label

    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = ui.pad),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(bottom = 28.dp),
    ) {
        item { ScreenHeader("Atur urutan menu", "Berlaku di HP ini", onBack = { nav.popBackStack() }) }

        item {
            Surface(
                shape = CuciinShape.card,
                color = Mist,
                border = BorderStroke(1.dp, LineSoft),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    "Panah atas dan bawah memindahkan menu. Tombol pindah memindahkan menu ke bagian lain. " +
                        "Panah di judul bagian memindahkan seluruh bagian.",
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                    color = TealDeep,
                )
            }
        }

        layout.sections.forEach { section ->
            val entries = layout.render { allowed -> routeAllowed(allowed) }
                .firstOrNull { it.first == section }?.second.orEmpty()
            if (entries.isEmpty()) return@forEach

            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SectionHeaderRow(
                        title = section,
                        canUp = layout.sections.indexOf(section) > 0,
                        canDown = layout.sections.indexOf(section) < layout.sections.size - 1,
                        onUp = { MenuPrefs.apply(layout.moveSection(section, -1)) },
                        onDown = { MenuPrefs.apply(layout.moveSection(section, 1)) },
                    )
                    ListCard {
                        entries.forEachIndexed { index, spec ->
                            MenuOrderRow(
                                label = spec.label,
                                icon = menuIcon(spec.icon),
                                canUp = index > 0,
                                canDown = index < entries.lastIndex,
                                onUp = { MenuPrefs.apply(layout.moveRoute(spec.route, -1)) },
                                onDown = { MenuPrefs.apply(layout.moveRoute(spec.route, 1)) },
                                onMove = { moving = spec.route to spec.label },
                            )
                            if (index < entries.lastIndex) RowDivider()
                        }
                    }
                }
            }
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (!layout.isDefault()) {
                    GhostBtn("Kembalikan urutan awal") { MenuPrefs.reset() }
                }
                PrimaryBtn("Simpan urutan", icon = Icons.Outlined.SwapHoriz) { nav.popBackStack() }
                Text(
                    "Susunan ini disimpan di HP ini saja, tidak mengubah pengaturan HP lain.",
                    fontSize = 11.5.sp,
                    lineHeight = 17.sp,
                    color = Muted,
                )
            }
        }
    }

    val target = moving
    if (target != null) {
        ModalBottomSheet(onDismissRequest = { moving = null }) {
            Column(Modifier.padding(bottom = 20.dp)) {
                Text(
                    "Pindahkan ${target.second}",
                    modifier = Modifier.padding(horizontal = 20.dp),
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = Ink,
                )
                Text(
                    "Sekarang di bagian ${layout.sectionOf(target.first)}. Pilih bagian tujuan.",
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
                    fontSize = 12.5.sp,
                    color = Muted,
                )
                Spacer(Modifier.height(8.dp))
                layout.sections.forEach { section ->
                    val count = layout.render { routeAllowed(it) }.firstOrNull { it.first == section }?.second?.size ?: 0
                    if (count == 0) return@forEach
                    FilterSheetRow(
                        selected = layout.sectionOf(target.first) == section,
                        label = section,
                        detail = "$count menu",
                        onClick = {
                            MenuPrefs.apply(layout.moveRouteToSection(target.first, section))
                            moving = null
                        },
                    )
                }
                Spacer(Modifier.height(10.dp))
                PrimaryBtn("Selesai", modifier = Modifier.padding(horizontal = 20.dp)) { moving = null }
            }
        }
    }
}

/** Judul bagian dengan panah naik dan turun. */
@Composable
private fun SectionHeaderRow(title: String, canUp: Boolean, canDown: Boolean, onUp: () -> Unit, onDown: () -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f)) { SectionLabel(title) }
        IconStepButton(Icons.Outlined.ArrowUpward, "Naikkan bagian $title", canUp, onUp)
        Spacer(Modifier.width(6.dp))
        IconStepButton(Icons.Outlined.ArrowDownward, "Turunkan bagian $title", canDown, onDown)
    }
}

/** Satu baris menu: ikon, label, lalu tiga tombol. */
@Composable
private fun MenuOrderRow(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    canUp: Boolean,
    canDown: Boolean,
    onUp: () -> Unit,
    onDown: () -> Unit,
    onMove: () -> Unit,
) {
    Surface(color = Card, modifier = Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Surface(shape = CuciinShape.badge, color = Mist) {
                Icon(icon, null, tint = Teal, modifier = Modifier.padding(9.dp).size(18.dp))
            }
            Text(
                label,
                modifier = Modifier.weight(1f),
                color = Ink,
                fontSize = 14.sp,
                lineHeight = 18.sp,
                fontWeight = FontWeight.SemiBold,
            )
            IconStepButton(Icons.Outlined.ArrowUpward, "Naikkan $label", canUp, onUp)
            IconStepButton(Icons.Outlined.ArrowDownward, "Turunkan $label", canDown, onDown)
            IconStepButton(Icons.Outlined.SwapHoriz, "Pindah bagian $label", true, onMove, accent = true)
        }
    }
}

/** Tombol panah atau pindah berukuran 44dp sesuai target sentuh minimum. */
@Composable
private fun IconStepButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    description: String,
    enabled: Boolean,
    onClick: () -> Unit,
    accent: Boolean = false,
) {
    val tap = rememberTapFeedback()
    Surface(
        onClick = { if (enabled) { tap(); onClick() } },
        enabled = enabled,
        shape = CuciinShape.badge,
        color = Card,
        border = BorderStroke(1.dp, LineSoft),
        modifier = Modifier.size(44.dp),
    ) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Icon(
                icon,
                contentDescription = description,
                tint = when {
                    !enabled -> Line
                    accent -> Teal
                    else -> TealDeep
                },
                modifier = Modifier.size(18.dp),
            )
        }
    }
}
