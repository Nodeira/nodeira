package com.deranjer.nodeira.ui.reminders

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

private enum class TriggerMode { TIME, LOCATION }

private val recurrenceOptions = listOf(
    null to "Does not repeat",
    "DAILY" to "Daily",
    "WEEKLY" to "Weekly",
    "MONTHLY" to "Monthly",
    "YEARLY" to "Yearly",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReminderEditorScreen(
    viewModel: RemindersViewModel,
    onDone: () -> Unit,
    onCancel: () -> Unit,
) {
    val context = LocalContext.current

    var mode by remember { mutableStateOf(TriggerMode.TIME) }
    var title by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    // TIME fields
    var date by remember { mutableStateOf(LocalDate.now()) }
    var time by remember { mutableStateOf(LocalTime.now().plusHours(1).withSecond(0).withNano(0)) }
    var recurrence by remember { mutableStateOf<String?>(null) }
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    var recurrenceOpen by remember { mutableStateOf(false) }

    // LOCATION fields
    var lat by remember { mutableStateOf("") }
    var lng by remember { mutableStateOf("") }
    var radius by remember { mutableStateOf("150") }
    var locationName by remember { mutableStateOf("") }
    var onLeave by remember { mutableStateOf(false) }

    val bgLocationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* best-effort: geofences fire in background only if granted */ }

    fun fillLocation() {
        requestCurrentLocation(context) { loc ->
            if (loc != null) {
                lat = loc.latitude.toString(); lng = loc.longitude.toString(); error = null
            } else {
                error = "Couldn't get current location"
            }
        }
    }

    val fineLocationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            fillLocation()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                bgLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            }
        }
    }

    fun useCurrentLocation() {
        if (hasFineLocation(context)) {
            fillLocation()
        } else {
            fineLocationLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }

    fun save() {
        if (title.isBlank()) { error = "Title is required"; return }
        when (mode) {
            TriggerMode.TIME -> {
                val fireAt = LocalDateTime.of(date, time)
                    .atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                if (fireAt <= System.currentTimeMillis() && recurrence == null) {
                    error = "Pick a time in the future"; return
                }
                viewModel.createTimeReminder(title, body, fireAt, recurrence, onDone)
            }
            TriggerMode.LOCATION -> {
                val latD = lat.toDoubleOrNull()
                val lngD = lng.toDoubleOrNull()
                val radM = radius.toIntOrNull()
                if (latD == null || lngD == null) { error = "Set a location (lat/lng)"; return }
                if (radM == null || radM <= 0) { error = "Radius must be a positive number"; return }
                viewModel.createLocationReminder(
                    title, body, latD, lngD, radM, locationName, onLeave, onDone,
                )
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("New reminder") },
                navigationIcon = {
                    IconButton(onClick = onCancel) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Cancel")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = mode == TriggerMode.TIME,
                    onClick = { mode = TriggerMode.TIME; error = null },
                    label = { Text("Time") },
                )
                FilterChip(
                    selected = mode == TriggerMode.LOCATION,
                    onClick = { mode = TriggerMode.LOCATION; error = null },
                    label = { Text("Location") },
                )
            }

            OutlinedTextField(
                value = title,
                onValueChange = { title = it; error = null },
                label = { Text("Title") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = body,
                onValueChange = { body = it },
                label = { Text("Note (optional)") },
                modifier = Modifier.fillMaxWidth(),
            )

            when (mode) {
                TriggerMode.TIME -> {
                    OutlinedButton(onClick = { showDatePicker = true }, modifier = Modifier.fillMaxWidth()) {
                        Text("Date: ${date.format(dateLabel)}")
                    }
                    OutlinedButton(onClick = { showTimePicker = true }, modifier = Modifier.fillMaxWidth()) {
                        Text("Time: ${time.format(timeLabel)}")
                    }
                    ExposedDropdownMenuBox(
                        expanded = recurrenceOpen,
                        onExpandedChange = { recurrenceOpen = it },
                    ) {
                        OutlinedTextField(
                            value = recurrenceOptions.first { it.first == recurrence }.second,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Repeat") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(recurrenceOpen) },
                            modifier = Modifier
                                .menuAnchor(androidx.compose.material3.MenuAnchorType.PrimaryNotEditable)
                                .fillMaxWidth(),
                        )
                        ExposedDropdownMenu(
                            expanded = recurrenceOpen,
                            onDismissRequest = { recurrenceOpen = false },
                        ) {
                            recurrenceOptions.forEach { (value, label) ->
                                DropdownMenuItem(
                                    text = { Text(label) },
                                    onClick = { recurrence = value; recurrenceOpen = false },
                                )
                            }
                        }
                    }
                }

                TriggerMode.LOCATION -> {
                    OutlinedButton(onClick = { useCurrentLocation() }, modifier = Modifier.fillMaxWidth()) {
                        Text("Use current location")
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = lat,
                            onValueChange = { lat = it; error = null },
                            label = { Text("Latitude") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Next),
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = lng,
                            onValueChange = { lng = it; error = null },
                            label = { Text("Longitude") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Next),
                            modifier = Modifier.weight(1f),
                        )
                    }
                    OutlinedTextField(
                        value = radius,
                        onValueChange = { radius = it.filter(Char::isDigit) },
                        label = { Text("Radius (metres)") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = locationName,
                        onValueChange = { locationName = it },
                        label = { Text("Place name (optional)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Switch(checked = onLeave, onCheckedChange = { onLeave = it })
                        Text("Notify when leaving (instead of arriving)", modifier = Modifier.padding(start = 8.dp))
                    }
                }
            }

            error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Start)
            }

            Button(onClick = { save() }, modifier = Modifier.fillMaxWidth()) {
                Text("Save reminder")
            }
        }
    }

    if (showDatePicker) {
        val dpState = rememberDatePickerState(
            initialSelectedDateMillis = date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    dpState.selectedDateMillis?.let { millis ->
                        date = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate()
                    }
                    showDatePicker = false
                }) { Text("OK") }
            },
            dismissButton = { TextButton(onClick = { showDatePicker = false }) { Text("Cancel") } },
        ) {
            DatePicker(state = dpState)
        }
    }

    if (showTimePicker) {
        val tpState = rememberTimePickerState(initialHour = time.hour, initialMinute = time.minute, is24Hour = false)
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    time = LocalTime.of(tpState.hour, tpState.minute)
                    showTimePicker = false
                }) { Text("OK") }
            },
            dismissButton = { TextButton(onClick = { showTimePicker = false }) { Text("Cancel") } },
            text = { TimePicker(state = tpState) },
        )
    }
}

private fun hasFineLocation(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED

/**
 * Actively requests a current location fix (falling back across providers), so it works
 * even when there's no recent last-known location. Result delivered on the main thread.
 */
@SuppressLint("MissingPermission")
private fun requestCurrentLocation(context: Context, onResult: (Location?) -> Unit) {
    if (!hasFineLocation(context)) { onResult(null); return }
    val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val provider = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
        .firstOrNull { runCatching { lm.isProviderEnabled(it) }.getOrDefault(false) }
        ?: LocationManager.PASSIVE_PROVIDER
    // Fast path: a recent fix if we have one.
    runCatching { lm.getLastKnownLocation(provider) }.getOrNull()?.let { onResult(it); return }
    LocationManagerCompat.getCurrentLocation(
        lm,
        provider,
        null as androidx.core.os.CancellationSignal?,
        ContextCompat.getMainExecutor(context),
        androidx.core.util.Consumer<Location?> { loc -> onResult(loc) },
    )
}

private val dateLabel = DateTimeFormatter.ofLocalizedDate(FormatStyle.FULL)
private val timeLabel = DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT)
