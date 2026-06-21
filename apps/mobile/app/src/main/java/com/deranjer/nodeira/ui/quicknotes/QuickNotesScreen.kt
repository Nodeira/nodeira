package com.deranjer.nodeira.ui.quicknotes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.Card
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.deranjer.nodeira.ui.nav.AppDestination
import com.deranjer.nodeira.ui.nav.AppScaffold
import com.deranjer.nodeira.ui.notes.NotesStateBox
import com.deranjer.nodeira.ui.notes.NotesUiState

@Composable
fun QuickNotesScreen(
    state: NotesUiState,
    onOpenNote: (String) -> Unit,
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit,
) {
    var query by remember { mutableStateOf("") }

    AppScaffold(
        title = "Quick notes",
        currentRoute = AppDestination.QUICK_NOTES.route,
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

            val visible = remember(state.notes, query) {
                state.notes.filter {
                    it.type == "quick" && it.title.contains(query, ignoreCase = true)
                }
            }

            NotesStateBox(
                state = state.copy(notes = visible),
                emptyMessage = if (query.isBlank()) "No quick notes yet" else "No matches",
                modifier = Modifier.weight(1f),
            ) {
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 160.dp),
                    modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(visible, key = { it.id }) { note ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 96.dp),
                            onClick = { onOpenNote(note.id) },
                        ) {
                            Text(
                                text = note.title.ifBlank { "Untitled" },
                                modifier = Modifier.padding(12.dp),
                                maxLines = 4,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }
        }
    }
}
