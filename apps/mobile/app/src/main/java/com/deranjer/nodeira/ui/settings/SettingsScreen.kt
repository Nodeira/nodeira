package com.deranjer.nodeira.ui.settings

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.deranjer.nodeira.ui.nav.AppDestination
import com.deranjer.nodeira.ui.nav.AppScaffold

private val startupChoices = listOf(
    AppDestination.HOME,
    AppDestination.RECENTS,
    AppDestination.QUICK_NOTES,
    AppDestination.REMINDERS,
)

@Composable
fun SettingsScreen(
    serverUrl: String,
    userEmail: String,
    appVersion: String,
    startupRoute: String,
    onStartupRouteChange: (String) -> Unit,
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit,
) {
    AppScaffold(
        title = "Settings",
        currentRoute = AppDestination.SETTINGS.route,
        onNavigate = onNavigate,
        onLogout = onLogout,
    ) {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            SettingRow(label = "Server", value = serverUrl)
            SettingRow(label = "Signed in as", value = userEmail)
            HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))

            Text("Startup screen", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
            startupChoices.forEach { dest ->
                Row(
                    selected = dest.route == startupRoute,
                    label = dest.label,
                    onSelect = { onStartupRouteChange(dest.route) },
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))
            SettingRow(label = "Version", value = appVersion)
        }
    }
}

@Composable
private fun SettingRow(label: String, value: String) {
    ListItem(
        overlineContent = { Text(label) },
        headlineContent = { Text(value) },
    )
}

@Composable
private fun Row(selected: Boolean, label: String, onSelect: () -> Unit) {
    androidx.compose.foundation.layout.Row(
        modifier = Modifier
            .fillMaxWidth()
            .selectable(selected = selected, onClick = onSelect)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RadioButton(selected = selected, onClick = onSelect)
        Text(label, modifier = Modifier.padding(start = 8.dp))
    }
}
