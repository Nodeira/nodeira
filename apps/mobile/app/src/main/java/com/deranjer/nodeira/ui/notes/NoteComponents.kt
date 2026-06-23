package com.deranjer.nodeira.ui.notes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.deranjer.nodeira.data.net.NoteDto

/**
 * Material 3 [ListItem] for a note. Leading doc icon (primary-tinted when pinned),
 * optional [supporting] line, and an optional trailing pin. [selected] shades the row
 * with the M3 secondaryContainer (the design's active-row treatment).
 */
@Composable
fun NoteListItem(
    note: NoteDto,
    onClick: () -> Unit,
    supporting: String? = null,
    showPinTrailing: Boolean = false,
    selected: Boolean = false,
) {
    val accent = if (note.pinned) MaterialTheme.colorScheme.primary
    else MaterialTheme.colorScheme.onSurfaceVariant
    ListItem(
        modifier = Modifier.clickable(onClick = onClick),
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
