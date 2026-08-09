package com.deranjer.nodeira.ui.canvases

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.foundation.layout.Column
import com.deranjer.nodeira.ui.notes.OfflineBanner
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.deranjer.nodeira.data.net.CanvasDto
import com.deranjer.nodeira.ui.nav.AppDestination
import com.deranjer.nodeira.ui.nav.AppScaffold

@Composable
fun CanvasesScreen(
    viewModel: CanvasesViewModel,
    onOpenCanvas: (String) -> Unit,
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showCreate by remember { mutableStateOf(false) }

    AppScaffold(
        title = "Canvases",
        currentRoute = AppDestination.CANVASES.route,
        onNavigate = onNavigate,
        onLogout = onLogout,
        floatingActionButton = {
            FloatingActionButton(onClick = { showCreate = true }) {
                Icon(Icons.Filled.Add, contentDescription = "New canvas")
            }
        },
    ) {
        Column {
            if (state.offline) OfflineBanner(state.lastSyncedAt)
            when {
                state.loading && state.canvases.isEmpty() ->
                    CircularProgressIndicator(Modifier.padding(24.dp))
                state.error != null ->
                    Text(
                        state.error!!,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(24.dp),
                    )
                state.canvases.isEmpty() ->
                    Text("No canvases yet", modifier = Modifier.padding(24.dp))
                else -> LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(state.canvases, key = { it.id }) { canvas ->
                        CanvasRow(
                            canvas = canvas,
                            onClick = { onOpenCanvas(canvas.id) },
                            onDelete = { viewModel.delete(canvas.id) },
                        )
                        HorizontalDivider()
                    }
                }
            }
        }
    }

    if (showCreate) {
        CreateCanvasDialog(
            onDismiss = { showCreate = false },
            onConfirm = { title ->
                showCreate = false
                viewModel.create(title) { id -> onOpenCanvas(id) }
            },
        )
    }
}

@Composable
private fun CanvasRow(canvas: CanvasDto, onClick: () -> Unit, onDelete: () -> Unit) {
    ListItem(
        modifier = Modifier.clickable(onClick = onClick),
        headlineContent = { Text(canvas.title.ifBlank { "Untitled canvas" }) },
        leadingContent = {
            Icon(
                Icons.Filled.Dashboard,
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

@Composable
private fun CreateCanvasDialog(onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var title by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New canvas") },
        text = {
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("Title") },
                singleLine = true,
            )
        },
        confirmButton = { TextButton(onClick = { onConfirm(title) }) { Text("Create") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
