package com.deranjer.nodeira.ui.notes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.deranjer.nodeira.data.NodeiraRepository
import com.deranjer.nodeira.data.net.NoteDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class NotesUiState(
    val loading: Boolean = true,
    val notes: List<NoteDto> = emptyList(),
    val error: String? = null,
)

/**
 * Shared across Home / Recents / Quick notes — loads the full note list once and each
 * screen derives its own view (filter/search/sort) locally. Owned at the nav-graph level.
 */
class NotesViewModel(
    private val repository: NodeiraRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(NotesUiState())
    val state: StateFlow<NotesUiState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val notes = repository.getNotes()
                _state.update { it.copy(loading = false, notes = notes) }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Failed to load notes") }
            }
        }
    }

    fun logout() = repository.logout()
}
