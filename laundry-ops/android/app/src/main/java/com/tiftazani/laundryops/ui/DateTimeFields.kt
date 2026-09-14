package com.tiftazani.laundryops.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.res.Configuration
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tiftazani.laundryops.data.Clock
import com.tiftazani.laundryops.ui.components.GhostBtn
import com.tiftazani.laundryops.ui.theme.Muted
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
}

/** Structured date/time controls. Stored nota strings remain compatible with older clients. */
@Composable
internal fun DateTimeFields(value: LocalDateTime, onChange: (LocalDateTime) -> Unit, label: String) {
    val context = LocalContext.current
    val localized = android.view.ContextThemeWrapper(context, android.R.style.Theme_Material_Light_Dialog_Alert).apply { applyOverrideConfiguration(Configuration(context.resources.configuration).apply { setLocale(DisplayDates.locale) }) }
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
