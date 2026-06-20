package com.deranjer.nodeira.data.net

import kotlinx.serialization.Serializable

/** A directed link between two notes (from `GET /notes/graph`). */
@Serializable
data class GraphLink(
    val sourceId: String,
    val targetId: String,
)

/** Canvas metadata for the list (drops the `data` blob via ignoreUnknownKeys). */
@Serializable
data class CanvasDto(
    val id: String,
    val title: String = "",
    val pinned: Boolean = false,
    val icon: String? = null,
    val updatedAt: String? = null,
)

@Serializable
data class CreateCanvasBody(
    val title: String? = null,
    val vaultId: String? = null,
    val folderId: String? = null,
)
