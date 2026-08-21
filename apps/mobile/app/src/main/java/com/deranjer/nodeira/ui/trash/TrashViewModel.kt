package com.deranjer.nodeira.ui.trash

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.deranjer.nodeira.data.NodeiraRepository
import com.deranjer.nodeira.data.net.TrashItemDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class TrashUiState(
    val loading: Boolean = true,
    val items: List<TrashItemDto> = emptyList(),
    val error: String? = null,
)

/**
 * Trash has no offline cache (unlike notes/graph) — it's a small, occasionally-viewed list,
 * so a plain server round-trip on open/refresh is enough.
 */
class TrashViewModel(
    private val repository: NodeiraRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(TrashUiState())
    val state: StateFlow<TrashUiState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val items = repository.getTrash()
                    .sortedByDescending { it.deletedAt }
                _state.update { it.copy(loading = false, items = items) }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Failed to load trash") }
            }
        }
    }

    fun restore(item: TrashItemDto) {
        viewModelScope.launch {
            try {
                repository.restoreTrashItem(item.type, item.id)
                refresh()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to restore item") }
            }
        }
    }

    fun purge(item: TrashItemDto) {
        viewModelScope.launch {
            try {
                repository.purgeTrashItem(item.type, item.id)
                refresh()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to delete item") }
            }
        }
    }
}
