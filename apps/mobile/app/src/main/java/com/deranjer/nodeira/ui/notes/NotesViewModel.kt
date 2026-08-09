package com.deranjer.nodeira.ui.notes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.deranjer.nodeira.data.NodeiraRepository
import com.deranjer.nodeira.data.net.FolderDto
import com.deranjer.nodeira.data.net.NoteDto
import com.deranjer.nodeira.data.net.UpdateNoteBody
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

    /**
     * The vault new content should go into.
     *
     * Content cannot exist outside a vault since access is decided by vault membership, so
     * the server rejects a null vaultId with 400. Callers that have no particular vault in
     * mind fall back to the first one the user can see.
     */
    private fun resolveVaultId(preferred: String?): String? =
        preferred ?: _state.value.vaults.firstOrNull()?.id

    /** Creates a note (or quick note) in [vaultId] and invokes [onCreated] with its id to open it. */
    fun createNote(type: String, vaultId: String?, onCreated: (String) -> Unit) {
        val targetVault = resolveVaultId(vaultId)
        if (targetVault == null) {
            _state.update { it.copy(error = "No vault available yet — pull to refresh and try again") }
            return
        }
        viewModelScope.launch {
            try {
                val note = repository.createNote(type = type, vaultId = targetVault)
                refresh()
                onCreated(note.id)
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to create note") }
            }
        }
    }

    fun createFolder(name: String, vaultId: String?) {
        val targetVault = resolveVaultId(vaultId)
        if (targetVault == null) {
            _state.update { it.copy(error = "No vault available yet — pull to refresh and try again") }
            return
        }
        viewModelScope.launch {
            try {
                repository.createFolder(name = name.trim(), vaultId = targetVault)
                refresh()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to create folder") }
            }
        }
    }

    /** Deletes a note. The app could create and read notes but never remove one. */
    fun deleteNote(id: String) {
        viewModelScope.launch {
            try {
                repository.deleteNote(id)
                refresh()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to delete note") }
            }
        }
    }

    fun renameNote(id: String, title: String) {
        val trimmed = title.trim().ifEmpty { "Untitled" }
        viewModelScope.launch {
            try {
                repository.updateNote(id, UpdateNoteBody(title = trimmed))
                refresh()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to rename note") }
            }
        }
    }

    fun setNotePinned(id: String, pinned: Boolean) {
        viewModelScope.launch {
            try {
                repository.updateNote(id, UpdateNoteBody(pinned = pinned))
                refresh()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to update note") }
            }
        }
    }

    fun moveNote(id: String, vaultId: String?, folderId: String?) {
        viewModelScope.launch {
            try {
                repository.updateNote(id, UpdateNoteBody(vaultId = vaultId, folderId = folderId))
                refresh()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to move note") }
            }
        }
    }

    fun clearError() = _state.update { it.copy(error = null) }

    fun logout() = repository.logout()
}
