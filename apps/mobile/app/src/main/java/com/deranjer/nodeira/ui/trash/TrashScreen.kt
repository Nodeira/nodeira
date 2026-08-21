package com.deranjer.nodeira.ui.trash

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Restore
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.deranjer.nodeira.data.net.TrashItemDto
import com.deranjer.nodeira.ui.nav.AppDestination
import com.deranjer.nodeira.ui.nav.AppScaffold
import com.deranjer.nodeira.ui.notes.formatTimestamp

@Composable
fun TrashScreen(
    state: TrashUiState,
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit,
    onRestore: (TrashItemDto) -> Unit,
    onPurge: (TrashItemDto) -> Unit,
    onRefresh: () -> Unit,
) {
    var purgeTarget by remember { mutableStateOf<TrashItemDto?>(null) }

    AppScaffold(
        title = "Trash",
        currentRoute = AppDestination.TRASH.route,
        onNavigate = onNavigate,
        onLogout = onLogout,
    ) {
        when {
            state.loading && state.items.isEmpty() ->
                CircularProgressIndicator(Modifier.padding(24.dp))
            state.error != null ->
                Text(state.error, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(24.dp))
            state.items.isEmpty() ->
                Text(
                    "Trash is empty. Deleted notes, folders, and canvases stay here for 30 " +
                        "days before they're permanently removed.",
                    modifier = Modifier.padding(24.dp),
                )
            else -> LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(state.items, key = { "${it.type}-${it.id}" }) { item ->
                    TrashRow(
                        item = item,
                        onRestore = { onRestore(item) },
                        onDelete = { purgeTarget = item },
                    )
                    HorizontalDivider()
                }
            }
        }
    }

    purgeTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { purgeTarget = null },
            title = { Text("Delete forever?") },
            text = {
                val name = target.title.ifBlank { "Untitled" }
                Text(
                    if (target.itemCount != null) {
                        "This will permanently delete \"$name\" and everything inside it " +
                            "(${target.itemCount} item${if (target.itemCount == 1) "" else "s"}). " +
                            "This cannot be undone."
                    } else {
                        "This will permanently delete \"$name\". This cannot be undone."
                    },
                )
            },
            confirmButton = {
                TextButton(
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
                    onClick = {
                        onPurge(target)
                        purgeTarget = null
                    },
                ) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { purgeTarget = null }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun TrashRow(item: TrashItemDto, onRestore: () -> Unit, onDelete: () -> Unit) {
    val icon = when (item.type) {
        "folder" -> Icons.Filled.Folder
        "canvas" -> Icons.Filled.Dashboard
        else -> Icons.Filled.Description
    }
    ListItem(
        headlineContent = { Text(item.title.ifBlank { "Untitled" }) },
        supportingContent = {
            val deleted = "Deleted ${formatTimestamp(item.deletedAt)}"
            Text(
                if (item.itemCount != null) {
                    "$deleted · ${item.itemCount} item${if (item.itemCount == 1) "" else "s"}"
                } else {
                    deleted
                },
            )
        },
        leadingContent = {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        },
        trailingContent = {
            Row {
                IconButton(onClick = onRestore) {
                    Icon(Icons.Filled.Restore, contentDescription = "Restore")
                }
                IconButton(onClick = onDelete) {
                    Icon(
                        Icons.Filled.Delete,
                        contentDescription = "Delete forever",
                        tint = MaterialTheme.colorScheme.error,
                    )
                }
            }
        },
    )
}
