package com.deranjer.nodeira.ui.notes

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MenuDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
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
    // ListItem and its DropdownMenu must share one layout node — a Popup anchors to its
    // nearest enclosing composable, and inside a LazyColumn items{} lambda, two unwrapped
    // siblings lose that anchor and the menu opens at the viewport's top-left instead of
    // over the tapped row. Wrapping here fixes every call site at once, whether or not the
    // caller happens to wrap this in its own Box for other reasons (e.g. indentation).
    Box(modifier = Modifier.fillMaxWidth()) {
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
                        leadingIcon = {
                            Icon(
                                Icons.Filled.Delete,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error,
                            )
                        },
                        colors = MenuDefaults.itemColors(textColor = MaterialTheme.colorScheme.error),
                        onClick = {
                            menuOpen = false
                            confirmDelete = true
                        },
                    )
                }
            }
        }
    }

    if (confirmDelete && onDelete != null) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete note?") },
            text = { Text("\"${note.title.ifBlank { "Untitled" }}\" will be moved to trash.") },
            confirmButton = {
                TextButton(
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
                    onClick = {
                        confirmDelete = false
                        onDelete()
                    },
                ) { Text("Delete") }
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
    Column(modifier = modifier.fillMaxSize()) {
        // Shown when a refresh failed but a cached snapshot is on screen. Without it the
        // list would look live while quietly being stale.
        if (state.offline) {
            OfflineBanner(state.lastSyncedAt)
        }
        Box(modifier = Modifier.fillMaxSize()) {
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
}

/** Shared by every screen that can serve a cached snapshot. */
@Composable
fun OfflineBanner(lastSyncedAt: Long?) {
    Surface(
        color = MaterialTheme.colorScheme.secondaryContainer,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            Icon(
                Icons.Filled.CloudOff,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSecondaryContainer,
                modifier = Modifier.size(16.dp),
            )
            Text(
                text = "Offline" + (lastSyncedAt?.let { " — showing notes from ${relativeTime(it)}" } ?: ""),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSecondaryContainer,
                modifier = Modifier.padding(start = 8.dp),
            )
        }
    }
}

/** Shown when there are changes made offline that haven't reached the server yet. */
@Composable
fun PendingWritesBanner(count: Int) {
    Surface(
        color = MaterialTheme.colorScheme.secondaryContainer,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            Icon(
                Icons.Filled.Sync,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSecondaryContainer,
                modifier = Modifier.size(16.dp),
            )
            Text(
                text = if (count == 1) "1 change waiting to sync" else "$count changes waiting to sync",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSecondaryContainer,
                modifier = Modifier.padding(start = 8.dp),
            )
        }
    }
}

/**
 * Asks the person to resolve one queued write that couldn't be replayed on its own — see
 * [com.deranjer.nodeira.data.sync.ConflictResolver] for why these three cases specifically
 * need a person rather than resolving automatically.
 */
@Composable
fun ConflictDialog(
    conflict: com.deranjer.nodeira.data.sync.Conflict,
    onResolve: (keepLocal: Boolean) -> Unit,
) {
    val (message, keepLabel, discardLabel) = when (conflict.reason) {
        com.deranjer.nodeira.data.sync.ConflictReason.RENAMED_BUT_DELETED ->
            Triple(
                "This note was deleted elsewhere while you renamed it to “${conflict.write.title}” here.",
                "Keep my rename",
                "Accept the deletion",
            )
        com.deranjer.nodeira.data.sync.ConflictReason.RENAMED_BOTH_SIDES ->
            Triple(
                "You renamed this note to “${conflict.write.title}”, but it's now " +
                    "“${conflict.serverTitle}” elsewhere.",
                "Keep my title",
                "Keep their title",
            )
        com.deranjer.nodeira.data.sync.ConflictReason.DELETED_BUT_EDITED ->
            Triple(
                "You deleted this note, but it was edited elsewhere afterward.",
                "Delete anyway",
                "Keep the note",
            )
    }
    AlertDialog(
        onDismissRequest = {},
        title = { Text("Sync conflict") },
        text = { Text(message) },
        confirmButton = { TextButton(onClick = { onResolve(true) }) { Text(keepLabel) } },
        dismissButton = { TextButton(onClick = { onResolve(false) }) { Text(discardLabel) } },
    )
}

/** Coarse "how stale is this" phrasing; exact timestamps are noise in a banner. */
private fun relativeTime(epochMillis: Long): String {
    val minutes = (System.currentTimeMillis() - epochMillis) / 60_000
    return when {
        minutes < 1 -> "just now"
        minutes < 60 -> "$minutes min ago"
        minutes < 60 * 24 -> "${minutes / 60} h ago"
        else -> "${minutes / (60 * 24)} d ago"
    }
}

/** ISO-8601 → just the date portion for now (lightweight; no date lib pulled in yet). */
fun formatTimestamp(iso: String): String =
    iso.substringBefore('T').ifBlank { iso }
