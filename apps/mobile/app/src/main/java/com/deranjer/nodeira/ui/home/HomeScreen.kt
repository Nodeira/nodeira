package com.deranjer.nodeira.ui.home

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.deranjer.nodeira.ui.nav.AppDestination
import com.deranjer.nodeira.ui.nav.AppScaffold
import com.deranjer.nodeira.ui.notes.NoteRow
import com.deranjer.nodeira.ui.notes.NotesStateBox
import com.deranjer.nodeira.ui.notes.NotesUiState

@Composable
fun HomeScreen(
    state: NotesUiState,
    onOpenNote: (String) -> Unit,
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit,
    onRefresh: () -> Unit,
) {
    AppScaffold(
        title = "Home",
        currentRoute = AppDestination.HOME.route,
        onNavigate = onNavigate,
        onLogout = onLogout,
        actions = {
            IconButton(onClick = onRefresh) {
                Icon(Icons.Filled.Refresh, contentDescription = "Refresh")
            }
        },
    ) {
        NotesStateBox(state = state, emptyMessage = "No notes yet") {
            val pinned = state.notes.filter { it.pinned }
            val recent = state.notes.take(10)
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                if (pinned.isNotEmpty()) {
                    item { SectionHeader("Pinned") }
                    items(pinned, key = { "pin-${it.id}" }) { note ->
                        NoteRow(note) { onOpenNote(note.id) }
                        HorizontalDivider()
                    }
                }
                item { SectionHeader("Recent") }
                items(recent, key = { it.id }) { note ->
                    NoteRow(note) { onOpenNote(note.id) }
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 4.dp),
    )
}
