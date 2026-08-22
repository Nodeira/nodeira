package com.deranjer.nodeira.ui.canvases

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DriveFileMove
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.style.TextOverflow
import com.deranjer.nodeira.data.net.CanvasDto

/**
 * Material 3 [ListItem] for a canvas — same shape and long-press overflow menu as
 * [com.deranjer.nodeira.ui.notes.NoteListItem], distinguished by a dashboard icon, so canvases
 * can sit inline with notes in the folder tree, Pinned section and root list.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun CanvasListItem(
    canvas: CanvasDto,
    onClick: () -> Unit,
    showPinTrailing: Boolean = false,
    onDelete: (() -> Unit)? = null,
    onTogglePin: (() -> Unit)? = null,
    onRename: ((String) -> Unit)? = null,
    onMove: (() -> Unit)? = null,
) {
    var menuOpen by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var renaming by remember { mutableStateOf(false) }
    var renameValue by remember(canvas.id) { mutableStateOf(canvas.title) }
    val hasActions = onDelete != null || onTogglePin != null || onRename != null || onMove != null
    val accent = if (canvas.pinned) MaterialTheme.colorScheme.primary
    else MaterialTheme.colorScheme.onSurfaceVariant

    // ListItem and its DropdownMenu must share this Box as their anchor — see the identical
    // comment in NoteListItem for why root-level items would otherwise anchor at (0,0).
    Box {
        ListItem(
            modifier = if (hasActions) {
                androidx.compose.ui.Modifier.combinedClickable(onClick = onClick, onLongClick = { menuOpen = true })
            } else {
                androidx.compose.ui.Modifier.clickable(onClick = onClick)
            },
            headlineContent = {
                Text(
                    canvas.title.ifBlank { "Untitled canvas" },
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            },
            leadingContent = {
                Icon(Icons.Filled.Dashboard, contentDescription = null, tint = accent)
            },
            trailingContent = if (showPinTrailing && canvas.pinned) {
                {
                    Icon(
                        Icons.Filled.PushPin,
                        contentDescription = "Pinned",
                        tint = MaterialTheme.colorScheme.primary,
                    )
                }
            } else null,
            colors = ListItemDefaults.colors(),
        )

        if (hasActions) {
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                onTogglePin?.let {
                    DropdownMenuItem(
                        text = { Text(if (canvas.pinned) "Unpin" else "Pin") },
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
                            renameValue = canvas.title
                            renaming = true
                        },
                    )
                }
                onMove?.let {
                    DropdownMenuItem(
                        text = { Text("Move to…") },
                        leadingIcon = {
                            Icon(Icons.AutoMirrored.Filled.DriveFileMove, contentDescription = null)
                        },
                        onClick = {
                            menuOpen = false
                            it()
                        },
                    )
                }
                onDelete?.let {
                    DropdownMenuItem(
                        text = { Text("Delete", color = MaterialTheme.colorScheme.error) },
                        leadingIcon = {
                            Icon(
                                Icons.Filled.Delete,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error,
                            )
                        },
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
            title = { Text("Delete canvas?") },
            text = { Text("\"${canvas.title.ifBlank { "Untitled canvas" }}\" will be deleted. This cannot be undone.") },
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
            title = { Text("Rename canvas") },
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
