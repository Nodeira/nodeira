package com.deranjer.nodeira.ui.reminders

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.deranjer.nodeira.data.net.ReminderDto
import com.deranjer.nodeira.reminders.ReminderScheduler
import com.deranjer.nodeira.ui.nav.AppDestination
import com.deranjer.nodeira.ui.nav.AppScaffold
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

@Composable
fun RemindersScreen(
    viewModel: RemindersViewModel,
    onAddReminder: () -> Unit,
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    // Ask for notification permission on first entry (Android 13+).
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* result ignored; reminders still schedule, notifications just won't show if denied */ }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    AppScaffold(
        title = "Reminders",
        currentRoute = AppDestination.REMINDERS.route,
        onNavigate = onNavigate,
        onLogout = onLogout,
        floatingActionButton = {
            FloatingActionButton(onClick = onAddReminder) {
                Icon(Icons.Filled.Add, contentDescription = "New reminder")
            }
        },
    ) {
        when {
            state.loading && state.reminders.isEmpty() ->
                CircularProgressIndicator(Modifier.padding(24.dp))
            state.error != null ->
                Text(state.error!!, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(24.dp))
            state.reminders.isEmpty() ->
                Text("No reminders yet", modifier = Modifier.padding(24.dp))
            else -> LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(state.reminders, key = { it.id }) { reminder ->
                    ReminderRow(reminder = reminder, onDelete = { viewModel.delete(reminder.id) })
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
private fun ReminderRow(reminder: ReminderDto, onDelete: () -> Unit) {
    ListItem(
        headlineContent = { Text(reminder.title.ifBlank { "Untitled" }) },
        supportingContent = { Text(subtitle(reminder)) },
        leadingContent = {
            Icon(
                Icons.Filled.Notifications,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
            )
        },
        trailingContent = {
            IconButton(onClick = onDelete) {
                Icon(Icons.Filled.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
            }
        },
    )
}

private val dateFormat = DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)

private fun subtitle(r: ReminderDto): String {
    val recurrence = r.recurrence?.lowercase()?.replaceFirstChar { it.uppercase() }
    val whenText = ReminderScheduler.triggerTimeMillis(r)?.let { millis ->
        runCatching {
            Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault()).format(dateFormat)
        }.getOrNull()
    } ?: r.fireAt ?: "—"
    return if (recurrence != null) "$whenText · $recurrence" else whenText
}
