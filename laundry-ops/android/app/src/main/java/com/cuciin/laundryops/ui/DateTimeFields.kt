package com.cuciin.laundryops.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cuciin.laundryops.data.Clock
import com.cuciin.laundryops.ui.components.GhostBtn
import com.cuciin.laundryops.ui.theme.Muted
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

internal object DisplayDates {
    val locale: Locale = Locale.forLanguageTag("id-ID")
    private val stored = DateTimeFormatter.ofPattern("d MMM yyyy, HH.mm", locale)
    private val day = DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy", locale)
    fun parse(value: String): LocalDateTime? = runCatching { LocalDateTime.parse(value, stored) }.getOrNull()
    fun encode(value: LocalDateTime): String = value.format(stored)
    fun date(value: LocalDateTime): String = value.format(day)
    fun time(value: LocalDateTime): String = value.format(DateTimeFormatter.ofPattern("HH.mm"))
    fun fromMillis(value: Long): LocalDateTime = Instant.ofEpochMilli(value).atZone(Clock.ZONE).toLocalDateTime()
    fun full(value: Long): String = fromMillis(value).let { "${date(it)} · ${time(it)} WIB" }

    fun reportTimestamp(atMs: Long, legacyLabel: String): Long? =
        atMs.takeIf { it > 0 } ?: parse(legacyLabel)?.atZone(Clock.ZONE)?.toInstant()?.toEpochMilli()

    fun isInSelectedMinute(timestampMs: Long, from: LocalDateTime, until: LocalDateTime): Boolean {
        val startMs = from.atZone(Clock.ZONE).toInstant().toEpochMilli()
        val endExclusiveMs = until.plusMinutes(1).atZone(Clock.ZONE).toInstant().toEpochMilli()
        return timestampMs >= startMs && timestampMs < endExclusiveMs
    }

    /**
     * Titik tengah hari UTC dari sebuah tanggal lokal.
     *
     * Pemilih tanggal Material3 memakai UTC sebagai acuan harinya. Memakai tengah hari, bukan
     * tengah malam, supaya tanggal tidak bergeser satu hari di zona waktu mana pun.
     */
    fun toPickerUtcMillis(value: LocalDateTime): Long =
        value.toLocalDate().atStartOfDay(ZoneOffset.UTC).plusHours(12).toInstant().toEpochMilli()

    /** Kembalikan pilihan pemilih tanggal ke tanggal lokal, dengan jam yang sudah ada. */
    fun fromPickerUtcMillis(millis: Long, keepTime: LocalDateTime): LocalDateTime =
        Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate().atTime(keepTime.toLocalTime())
}

/**
 * Pemilih tanggal dan jam.
 *
 * Memakai komponen Compose Material3, bukan dialog bawaan Android. Ada dua alasan:
 *
 * 1. Dialog bawaan Android tidak mewarisi palet aplikasi. Dulu dialognya memakai tema bawaan
 *    yang membawa aksen teal, sehingga tombol "Pilih" dan "Batal" berbeda warna dari seluruh
 *    tombol aplikasi.
 * 2. Dialog bawaan juga selalu terang. Di tema Gelap dan Custom, dialog itu muncul sebagai
 *    kotak putih menyolok di atas latar gelap.
 *
 * Dengan komponen Compose, warnanya diambil dari `MaterialTheme.colorScheme` yang sudah
 * diturunkan dari palet Cuciin lewat `materialScheme()`. Jadi warnanya ikut berubah sendiri
 * saat tema diganti, termasuk tema Custom yang warnanya diatur pengguna.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun DateTimeFields(value: LocalDateTime, onChange: (LocalDateTime) -> Unit, label: String) {
    var showDate by remember { mutableStateOf(false) }
    var showTime by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(label, fontSize = 13.sp, color = Muted)
        GhostBtn(DisplayDates.date(value), icon = Icons.Outlined.CalendarMonth) { showDate = true }
        GhostBtn("${DisplayDates.time(value)} WIB", icon = Icons.Outlined.Schedule) { showTime = true }
    }

    if (showDate) {
        val state = rememberDatePickerState(initialSelectedDateMillis = DisplayDates.toPickerUtcMillis(value))
        DatePickerDialog(
            onDismissRequest = { showDate = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { onChange(DisplayDates.fromPickerUtcMillis(it, value)) }
                    showDate = false
                }) { Text("Pilih") }
            },
            dismissButton = {
                TextButton(onClick = { showDate = false }) { Text("Batal") }
            },
        ) {
            // Judul dan headline bawaan dibuang supaya dialognya pendek dan tidak menutupi
            // layar. Tombol pindah mode disembunyikan karena tampilan kalender sudah cukup.
            DatePicker(state = state, title = null, headline = null, showModeToggle = false)
        }
    }

    if (showTime) {
        val state = rememberTimePickerState(initialHour = value.hour, initialMinute = value.minute, is24Hour = true)
        AlertDialog(
            onDismissRequest = { showTime = false },
            confirmButton = {
                TextButton(onClick = {
                    onChange(value.withHour(state.hour).withMinute(state.minute).withSecond(0).withNano(0))
                    showTime = false
                }) { Text("Pilih") }
            },
            dismissButton = {
                TextButton(onClick = { showTime = false }) { Text("Batal") }
            },
            text = {
                // TimePicker diletakkan di tengah supaya lingkarannya tidak terpotong di layar sempit.
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { TimePicker(state = state) }
            },
        )
    }
}
