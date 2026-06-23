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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.deranjer.nodeira.ui.components.BrandSearchBar
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
    onCreateNote: (onCreated: (String) -> Unit) -> Unit,
) {
    var query by remember { mutableStateOf("") }

    AppScaffold(
        title = "Quick notes",
        currentRoute = AppDestination.QUICK_NOTES.route,
        onNavigate = onNavigate,
        onLogout = onLogout,
        floatingActionButton = {
            FloatingActionButton(onClick = { onCreateNote(onOpenNote) }) {
                Icon(Icons.Filled.Add, contentDescription = "New quick note")
            }
        },
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            BrandSearchBar(
                query = query,
                onQueryChange = { query = it },
                placeholder = "Search quick notes",
                modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 12.dp),
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
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
                            ),
                        ) {
                            Text(
                                text = note.title.ifBlank { "Untitled" },
                                style = MaterialTheme.typography.bodyLarge,
                                modifier = Modifier.padding(14.dp),
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
