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
)

class GraphViewModel(
    private val repository: NodeiraRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(GraphUiState())
    val state: StateFlow<GraphUiState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val notes = repository.getNotes()
                val links = repository.getGraph()
                val titles = notes.associate { it.id to it.title.ifBlank { "Untitled" } }
                val nodeIds = titles.keys
                val nodes = titles.map { (id, label) -> GraphNode(id, label) }
                val edges = links
                    .filter { it.sourceId in nodeIds && it.targetId in nodeIds }
                    .map { GraphEdge(it.sourceId, it.targetId) }
                _state.update { it.copy(loading = false, nodes = nodes, edges = edges) }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Failed to load graph") }
            }
        }
    }
}
