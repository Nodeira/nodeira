package com.deranjer.nodeira.ui.notes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.deranjer.nodeira.data.NodeiraRepository
import com.deranjer.nodeira.data.net.CanvasDto
import com.deranjer.nodeira.data.net.FolderDto
import com.deranjer.nodeira.data.net.NoteDto
import com.deranjer.nodeira.data.net.VaultDto
import com.deranjer.nodeira.data.sync.Conflict
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class NotesUiState(
    val loading: Boolean = true,
    val notes: List<NoteDto> = emptyList(),
    val canvases: List<CanvasDto> = emptyList(),
    val vaults: List<VaultDto> = emptyList(),
    val folders: List<FolderDto> = emptyList(),
    val error: String? = null,
    /** Showing a cached snapshot because the last refresh failed. */
    val offline: Boolean = false,
    /** When that snapshot was taken, for the offline banner. */
    val lastSyncedAt: Long? = null,
    /** Changes made offline, not yet confirmed by the server. */
    val pendingWrites: Int = 0,
    /** Queued changes that need a person to pick a side. */
    val conflicts: List<Conflict> = emptyList(),
)

/**
 * Shared across Home / Recents / Quick notes — loads the full note (and canvas) list once and
 * each screen derives its own view (filter/search/sort) locally. Owned at the nav-graph level.
 */
class NotesViewModel(
    private val repository: NodeiraRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(NotesUiState())
    val state: StateFlow<NotesUiState> = _state.asStateFlow()

    init {
        // Paint the cached snapshot first so the list is there immediately — and stays there
        // if the refresh below fails. Previously a failed load meant an error screen even
        // when a perfectly good copy had already been fetched.
        loadFromCache()
        refresh()
    }

    private fun loadFromCache() {
        if (!repository.hasCachedData()) return
        _state.update {
            it.copy(
                notes = repository.cachedNotes(),
                canvases = repository.cachedCanvases(),
                vaults = repository.cachedVaults(),
                folders = repository.cachedFolders(),
                lastSyncedAt = repository.lastSyncedAt(),
            )
        }
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val notes = repository.getNotes()
                // Vaults, folders and canvases power the Home switcher and the folder tree;
                // treat their failure as non-fatal so the note list still renders if any of
                // them is unavailable.
                val vaults = runCatching { repository.getVaults() }.getOrDefault(emptyList())
                val folders = runCatching { repository.getFolders() }.getOrDefault(emptyList())
                val canvases = runCatching { repository.getCanvases() }.getOrDefault(emptyList())
                repository.markSynced()
                _state.update {
                    it.copy(
                        loading = false,
                        notes = notes,
                        canvases = canvases,
                        vaults = vaults,
                        folders = folders,
                        offline = false,
                        error = null,
                        lastSyncedAt = repository.lastSyncedAt(),
                        pendingWrites = repository.pendingWriteCount(),
                        conflicts = repository.conflicts(),
                    )
                }
            } catch (e: Exception) {
                // With a cached snapshot on screen this is a connectivity notice, not a
                // failure: the user keeps their notes and sees when they were last synced.
                // The cache already reflects any offline edit — mutateNote/createNote/
                // deleteNote write through it — so it's safe to reload here rather than leave
                // the previous state.notes stale.
                val haveCache = repository.hasCachedData()
                _state.update {
                    it.copy(
                        loading = false,
                        notes = if (haveCache) repository.cachedNotes() else it.notes,
                        canvases = if (haveCache) repository.cachedCanvases() else it.canvases,
                        offline = haveCache,
                        error = if (haveCache) null else e.message ?: "Failed to load notes",
                        pendingWrites = repository.pendingWriteCount(),
                        conflicts = repository.conflicts(),
                    )
                }
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

    /** Creates a canvas in [vaultId] (or the default vault) and invokes [onCreated] with its id. */
    fun createCanvas(vaultId: String?, onCreated: (String) -> Unit) {
        val targetVault = resolveVaultId(vaultId)
        if (targetVault == null) {
            _state.update { it.copy(error = "No vault available yet — pull to refresh and try again") }
            return
        }
        viewModelScope.launch {
            try {
                val canvas = repository.createCanvas(vaultId = targetVault)
                refresh()
                onCreated(canvas.id)
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to create canvas") }
            }
        }
    }

    fun deleteCanvas(id: String) {
        viewModelScope.launch {
            try {
                repository.deleteCanvas(id)
                refresh()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to delete canvas") }
            }
        }
    }

    fun renameCanvas(id: String, title: String) {
        val trimmed = title.trim().ifEmpty { "Untitled" }
        viewModelScope.launch {
            try {
                repository.renameCanvas(id, trimmed)
                refresh()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to rename canvas") }
            }
        }
    }

    fun setCanvasPinned(id: String, pinned: Boolean) {
        viewModelScope.launch {
            try {
                repository.setCanvasPinned(id, pinned)
                refresh()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to update canvas") }
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
                repository.renameNote(id, trimmed)
                refresh()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to rename note") }
            }
        }
    }

    fun setNotePinned(id: String, pinned: Boolean) {
        viewModelScope.launch {
            try {
                repository.setNotePinned(id, pinned)
                refresh()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to update note") }
            }
        }
    }

    fun moveNote(id: String, vaultId: String?, folderId: String?) {
        viewModelScope.launch {
            try {
                repository.moveNote(id, vaultId, folderId)
                refresh()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to move note") }
            }
        }
    }

    /** A person's answer to a queued conflict — see [NodeiraRepository.resolveConflict]. */
    fun resolveConflict(opId: String, keepLocal: Boolean) {
        _state.update { it.copy(conflicts = it.conflicts.filterNot { c -> c.write.opId == opId }) }
        viewModelScope.launch {
            repository.resolveConflict(opId, keepLocal)
            refresh()
        }
    }

    fun clearError() = _state.update { it.copy(error = null) }

    fun logout() = repository.logout()
}
