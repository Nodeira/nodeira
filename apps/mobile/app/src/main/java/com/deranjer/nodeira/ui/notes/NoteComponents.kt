package com.deranjer.nodeira.ui.notes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.deranjer.nodeira.data.net.NoteDto

/** Single tappable note row. */
@Composable
fun NoteRow(note: NoteDto, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        Text(
            text = note.title.ifBlank { "Untitled" },
            style = MaterialTheme.typography.bodyLarge,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        note.updatedAt?.let { ts ->
            Text(
                text = formatTimestamp(ts),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.outline,
            )
        }
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
private fun formatTimestamp(iso: String): String =
    iso.substringBefore('T').ifBlank { iso }
