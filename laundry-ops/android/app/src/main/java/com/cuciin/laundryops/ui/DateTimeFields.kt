package com.cuciin.laundryops.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Context
import android.content.res.Configuration
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cuciin.laundryops.R
import com.cuciin.laundryops.data.Clock
import com.cuciin.laundryops.ui.components.GhostBtn
import com.cuciin.laundryops.ui.theme.Muted
import java.time.Instant
import java.time.LocalDateTime
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
}

/**
 * Konteks untuk dialog pemilih tanggal dan jam.
 *
 * Dialog sistem dibangun dari sumber daya Android, bukan Compose, jadi warnanya tidak ikut
 * palet aplikasi dengan sendirinya. Sebelumnya kode ini memakai
 * `android.R.style.Theme_Material_Light_Dialog_Alert` yang dipaku mati, sehingga tombol
 * "Pilih" dan "Batal" berwarna teal bawaan Android sementara tombol aplikasi berwarna magenta.
 *
 * Sekarang dialog memakai `Theme.Cuciin.Picker`, yang mewarnai aksennya dari palet Cuciin
 * (`values/colors.xml`) sehingga tanggal terpilih dan kedua tombolnya sejalan dengan
 * tampilan aplikasi. Locale dipaksa ke Indonesia supaya nama hari dan bulan ikut berbahasa
 * Indonesia walau bahasa HP bukan Indonesia.
 */
@Composable
private fun pickerContext(): Context {
    val context = LocalContext.current
    val configuration = LocalConfiguration.current
    return android.view.ContextThemeWrapper(context, R.style.Theme_Cuciin_Picker).apply {
        val localized = Configuration(configuration)
        localized.setLocale(DisplayDates.locale)
        applyOverrideConfiguration(localized)
    }
}

/** Structured date/time controls. Stored nota strings remain compatible with older clients. */
@Composable
internal fun DateTimeFields(value: LocalDateTime, onChange: (LocalDateTime) -> Unit, label: String) {
    val localized = pickerContext()
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(label, fontSize = 13.sp, color = Muted)
        GhostBtn(DisplayDates.date(value), icon = Icons.Outlined.CalendarMonth) {
            DatePickerDialog(localized, { _, y, m, d -> onChange(value.withYear(y).withMonth(1).withDayOfMonth(1).withMonth(m + 1).withDayOfMonth(d)) }, value.year, value.monthValue - 1, value.dayOfMonth).apply {
                setButton(DatePickerDialog.BUTTON_POSITIVE, "Pilih", this)
                setButton(DatePickerDialog.BUTTON_NEGATIVE, "Batal", this)
                show()
            }
        }
        GhostBtn("${DisplayDates.time(value)} WIB", icon = Icons.Outlined.Schedule) {
            TimePickerDialog(localized, { _, hour, minute -> onChange(value.withHour(hour).withMinute(minute).withSecond(0).withNano(0)) }, value.hour, value.minute, true).apply {
                setButton(TimePickerDialog.BUTTON_POSITIVE, "Pilih", this)
                setButton(TimePickerDialog.BUTTON_NEGATIVE, "Batal", this)
                show()
            }
        }
    }
}
