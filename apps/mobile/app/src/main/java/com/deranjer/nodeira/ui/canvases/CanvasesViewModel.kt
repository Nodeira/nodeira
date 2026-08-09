package com.deranjer.nodeira.ui.canvases

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.deranjer.nodeira.data.NodeiraRepository
import com.deranjer.nodeira.data.net.CanvasDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CanvasesUiState(
    val loading: Boolean = true,
    val canvases: List<CanvasDto> = emptyList(),
    val error: String? = null,
    val offline: Boolean = false,
    val lastSyncedAt: Long? = null,
)

class CanvasesViewModel(
    private val repository: NodeiraRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(CanvasesUiState())
    val state: StateFlow<CanvasesUiState> = _state.asStateFlow()

    init {
        // Cached list first, so a failed refresh does not blank the screen.
        _state.update {
            it.copy(canvases = repository.cachedCanvases(), lastSyncedAt = repository.lastSyncedAt())
        }
        refresh()
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val canvases = repository.getCanvases()
                repository.markSynced()
                _state.update {
                    it.copy(
                        loading = false,
                        canvases = canvases,
                        offline = false,
                        lastSyncedAt = repository.lastSyncedAt(),
                    )
                }
            } catch (e: Exception) {
                val haveCache = repository.hasCachedCanvases()
                _state.update {
                    it.copy(
                        loading = false,
                        offline = haveCache,
                        error = if (haveCache) null else e.message ?: "Failed to load canvases",
                    )
                }
            }
        }
    }

    fun create(title: String, onCreated: (String) -> Unit) {
        viewModelScope.launch {
            try {
                val canvas = repository.createCanvas(title.trim().ifBlank { "Untitled canvas" })
                refresh()
                onCreated(canvas.id)
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to create canvas") }
            }
        }
    }

    fun delete(id: String) {
        viewModelScope.launch {
            try {
                repository.deleteCanvas(id)
                refresh()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to delete canvas") }
            }
        }
    }
}
