package com.deranjer.nodeira.ui.recents

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.deranjer.nodeira.ui.nav.AppDestination
import com.deranjer.nodeira.ui.nav.AppScaffold
import com.deranjer.nodeira.ui.notes.NoteRow
import com.deranjer.nodeira.ui.notes.NotesStateBox
import com.deranjer.nodeira.ui.notes.NotesUiState

private enum class SortOrder(val label: String) {
    UPDATED("Updated"),
    CREATED("Created"),
    TITLE("Title"),
}

@Composable
fun RecentsScreen(
    state: NotesUiState,
    onOpenNote: (String) -> Unit,
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var sort by remember { mutableStateOf(SortOrder.UPDATED) }

    AppScaffold(
        title = "Recents",
        currentRoute = AppDestination.RECENTS.route,
        onNavigate = onNavigate,
        onLogout = onLogout,
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("Search") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SortOrder.entries.forEach { order ->
                    FilterChip(
                        selected = sort == order,
                        onClick = { sort = order },
                        label = { Text(order.label) },
                    )
                }
            }

            val visible = remember(state.notes, query, sort) {
                state.notes
                    .filter { it.title.contains(query, ignoreCase = true) }
                    .sortedWith(
                        when (sort) {
                            SortOrder.UPDATED -> compareByDescending { it.updatedAt ?: "" }
                            SortOrder.CREATED -> compareByDescending { it.createdAt ?: "" }
                            SortOrder.TITLE -> compareBy { it.title.lowercase() }
                        },
                    )
            }

            NotesStateBox(
                state = state.copy(notes = visible),
                emptyMessage = if (query.isBlank()) "No notes yet" else "No matches",
                modifier = Modifier.weight(1f),
            ) {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(visible, key = { it.id }) { note ->
                        NoteRow(note) { onOpenNote(note.id) }
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}
