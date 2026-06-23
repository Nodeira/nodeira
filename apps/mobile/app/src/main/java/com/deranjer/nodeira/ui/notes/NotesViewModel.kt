package com.deranjer.nodeira.ui.notes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.deranjer.nodeira.data.NodeiraRepository
import com.deranjer.nodeira.data.net.FolderDto
import com.deranjer.nodeira.data.net.NoteDto
import com.deranjer.nodeira.data.net.VaultDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class NotesUiState(
    val loading: Boolean = true,
    val notes: List<NoteDto> = emptyList(),
    val vaults: List<VaultDto> = emptyList(),
    val folders: List<FolderDto> = emptyList(),
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
                // Vaults and folders power the Home switcher and the folder tree; treat their
                // failure as non-fatal so the note list still renders if either is unavailable.
                val vaults = runCatching { repository.getVaults() }.getOrDefault(emptyList())
                val folders = runCatching { repository.getFolders() }.getOrDefault(emptyList())
                _state.update { it.copy(loading = false, notes = notes, vaults = vaults, folders = folders) }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Failed to load notes") }
            }
        }
    }

    /** Creates a note (or quick note) in [vaultId] and invokes [onCreated] with its id to open it. */
    fun createNote(type: String, vaultId: String?, onCreated: (String) -> Unit) {
        viewModelScope.launch {
            try {
                val note = repository.createNote(type = type, vaultId = vaultId)
                refresh()
                onCreated(note.id)
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to create note") }
            }
        }
    }

    fun createFolder(name: String, vaultId: String?) {
        viewModelScope.launch {
            try {
                repository.createFolder(name = name.trim(), vaultId = vaultId)
                refresh()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to create folder") }
            }
        }
    }

    fun logout() = repository.logout()
}
