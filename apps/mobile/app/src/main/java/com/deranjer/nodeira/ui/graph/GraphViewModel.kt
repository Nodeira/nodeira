package com.deranjer.nodeira.ui.graph

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.deranjer.nodeira.data.NodeiraRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class GraphNode(val id: String, val label: String)
data class GraphEdge(val from: String, val to: String)

data class GraphUiState(
    val loading: Boolean = true,
    val nodes: List<GraphNode> = emptyList(),
    val edges: List<GraphEdge> = emptyList(),
    val error: String? = null,
    val offline: Boolean = false,
    val lastSyncedAt: Long? = null,
)

class GraphViewModel(
    private val repository: NodeiraRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(GraphUiState())
    val state: StateFlow<GraphUiState> = _state.asStateFlow()

    init {
        // Render the cached graph first so it survives a failed refresh.
        build(repository.cachedNotes(), repository.cachedGraph(), offline = false, loading = true)
        refresh()
    }

    private fun build(
        notes: List<com.deranjer.nodeira.data.net.NoteDto>,
        links: List<com.deranjer.nodeira.data.net.GraphLink>,
        offline: Boolean,
        loading: Boolean,
    ) {
        val titles = notes.associate { it.id to it.title.ifBlank { "Untitled" } }
        val nodeIds = titles.keys
        _state.update {
            it.copy(
                loading = loading,
                nodes = titles.map { (id, label) -> GraphNode(id, label) },
                edges = links
                    .filter { l -> l.sourceId in nodeIds && l.targetId in nodeIds }
                    .map { l -> GraphEdge(l.sourceId, l.targetId) },
                offline = offline,
                lastSyncedAt = repository.lastSyncedAt(),
            )
        }
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val notes = repository.getNotes()
                val links = repository.getGraph()
                repository.markSynced()
                build(notes, links, offline = false, loading = false)
            } catch (e: Exception) {
                // Keep the cached graph on screen and flag it, rather than replacing a usable
                // view with an error string.
                val haveCache = repository.hasCachedData()
                _state.update {
                    it.copy(
                        loading = false,
                        offline = haveCache,
                        error = if (haveCache) null else e.message ?: "Failed to load graph",
                    )
                }
            }
        }
    }
}
