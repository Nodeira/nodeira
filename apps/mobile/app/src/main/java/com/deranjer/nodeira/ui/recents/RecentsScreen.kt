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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.deranjer.nodeira.ui.components.BrandSearchBar
import com.deranjer.nodeira.ui.nav.AppDestination
import com.deranjer.nodeira.ui.nav.AppScaffold
import com.deranjer.nodeira.ui.notes.NoteListItem
import com.deranjer.nodeira.ui.notes.NotesStateBox
import com.deranjer.nodeira.ui.notes.NotesUiState
import com.deranjer.nodeira.ui.notes.formatTimestamp

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
    onCreateNote: (onCreated: (String) -> Unit) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var sort by remember { mutableStateOf(SortOrder.UPDATED) }

    AppScaffold(
        title = "Recent notes",
        currentRoute = AppDestination.RECENTS.route,
        onNavigate = onNavigate,
        onLogout = onLogout,
        floatingActionButton = {
            FloatingActionButton(onClick = { onCreateNote(onOpenNote) }) {
                Icon(Icons.Filled.Add, contentDescription = "New note")
            }
        },
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            BrandSearchBar(
                query = query,
                onQueryChange = { query = it },
                modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 12.dp),
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SortOrder.entries.forEach { order ->
                    val selected = sort == order
                    FilterChip(
                        selected = selected,
                        onClick = { sort = order },
                        label = { Text(order.label) },
                        leadingIcon = if (selected) {
                            { Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.padding(0.dp)) }
                        } else null,
                        colors = FilterChipDefaults.filterChipColors(),
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
                        NoteListItem(
                            note = note,
                            onClick = { onOpenNote(note.id) },
                            supporting = note.updatedAt?.let { formatTimestamp(it) },
                            showPinTrailing = true,
                        )
                    }
                }
            }
        }
    }
}
