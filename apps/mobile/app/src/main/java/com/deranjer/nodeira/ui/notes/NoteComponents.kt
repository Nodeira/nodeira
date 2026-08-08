package com.deranjer.nodeira.ui.notes

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.deranjer.nodeira.data.net.NoteDto

/**
 * Material 3 [ListItem] for a note. Leading doc icon (primary-tinted when pinned),
 * optional [supporting] line, and an optional trailing pin. [selected] shades the row
 * with the M3 secondaryContainer (the design's active-row treatment).
 *
 * Long-pressing opens an overflow menu when [onDelete] or [onTogglePin] is supplied. The
 * app previously had no way at all to delete, pin or rename a note from the phone — the
 * REST client did not even expose the endpoints.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun NoteListItem(
    note: NoteDto,
    onClick: () -> Unit,
    supporting: String? = null,
    showPinTrailing: Boolean = false,
    selected: Boolean = false,
    onDelete: (() -> Unit)? = null,
    onTogglePin: (() -> Unit)? = null,
    onRename: ((String) -> Unit)? = null,
) {
    var menuOpen by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var renaming by remember { mutableStateOf(false) }
    var renameValue by remember(note.id) { mutableStateOf(note.title) }
    val hasActions = onDelete != null || onTogglePin != null || onRename != null
    val accent = if (note.pinned) MaterialTheme.colorScheme.primary
    else MaterialTheme.colorScheme.onSurfaceVariant
    ListItem(
        modifier = if (hasActions) {
            Modifier.combinedClickable(onClick = onClick, onLongClick = { menuOpen = true })
        } else {
            Modifier.clickable(onClick = onClick)
        },
        headlineContent = {
            Text(
                note.title.ifBlank { "Untitled" },
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        },
        supportingContent = supporting?.let {
            {
                Text(it, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        },
        leadingContent = {
            Icon(Icons.Filled.Description, contentDescription = null, tint = accent)
        },
        trailingContent = if (showPinTrailing && note.pinned) {
            {
                Icon(
                    Icons.Filled.PushPin,
                    contentDescription = "Pinned",
                    tint = MaterialTheme.colorScheme.primary,
                )
            }
        } else null,
        colors = if (selected) {
            ListItemDefaults.colors(
                containerColor = MaterialTheme.colorScheme.secondaryContainer,
                headlineColor = MaterialTheme.colorScheme.onSecondaryContainer,
                supportingColor = MaterialTheme.colorScheme.onSecondaryContainer,
            )
        } else ListItemDefaults.colors(),
    )

    if (hasActions) {
        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
            onTogglePin?.let {
                DropdownMenuItem(
                    text = { Text(if (note.pinned) "Unpin" else "Pin") },
                    leadingIcon = { Icon(Icons.Filled.PushPin, contentDescription = null) },
                    onClick = {
                        menuOpen = false
                        it()
                    },
                )
            }
            onRename?.let {
                DropdownMenuItem(
                    text = { Text("Rename") },
                    leadingIcon = { Icon(Icons.Filled.Edit, contentDescription = null) },
                    onClick = {
                        menuOpen = false
                        renameValue = note.title
                        renaming = true
                    },
                )
            }
            onDelete?.let {
                DropdownMenuItem(
                    text = { Text("Delete") },
                    leadingIcon = { Icon(Icons.Filled.Delete, contentDescription = null) },
                    onClick = {
                        menuOpen = false
                        confirmDelete = true
                    },
                )
            }
        }
    }

    if (confirmDelete && onDelete != null) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete note?") },
            text = { Text("\"${note.title.ifBlank { "Untitled" }}\" will be deleted. This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmDelete = false
                    onDelete()
                }) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = false }) { Text("Cancel") }
            },
        )
    }

    if (renaming && onRename != null) {
        AlertDialog(
            onDismissRequest = { renaming = false },
            title = { Text("Rename note") },
            text = {
                OutlinedTextField(
                    value = renameValue,
                    onValueChange = { renameValue = it },
                    singleLine = true,
                    label = { Text("Title") },
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    renaming = false
                    onRename(renameValue)
                }) { Text("Save") }
            },
            dismissButton = {
                TextButton(onClick = { renaming = false }) { Text("Cancel") }
            },
        )
    }
}

/** Renders loading / error / empty states, or invokes [content] with the notes. */
@Composable
fun NotesStateBox(
    state: NotesUiState,
    emptyMessage: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(modifier = modifier.fillMaxSize()) {
        when {
            state.loading && state.notes.isEmpty() ->
                CircularProgressIndicator(Modifier.align(Alignment.Center))
            state.error != null ->
                Text(
                    state.error,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.align(Alignment.Center).padding(24.dp),
                )
            state.notes.isEmpty() ->
                Text(emptyMessage, modifier = Modifier.align(Alignment.Center))
            else -> content()
        }
    }
}

/** ISO-8601 → just the date portion for now (lightweight; no date lib pulled in yet). */
fun formatTimestamp(iso: String): String =
    iso.substringBefore('T').ifBlank { iso }
