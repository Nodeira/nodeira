package com.deranjer.nodeira.data.net

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
    val rememberMe: Boolean = true,
)

@Serializable
data class AuthUser(
    val id: String,
    val email: String,
    val name: String? = null,
    val role: String = "user",
)

@Serializable
data class AuthResponse(
    @SerialName("access_token") val accessToken: String,
    val user: AuthUser,
)

@Serializable
data class SetupStatus(
    val setupRequired: Boolean,
)

/**
 * Subset of the API's note metadata used by the native list. `ignoreUnknownKeys` (see
 * [NetworkModule]) drops the rest. Dates are kept as ISO strings for now.
 */
@Serializable
data class NoteDto(
    val id: String,
    val title: String = "",
    val type: String = "note",
    val pinned: Boolean = false,
    val icon: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val vaultId: String? = null,
    val folderId: String? = null,
)

@Serializable
data class VaultDto(
    val id: String,
    val name: String = "",
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

@Serializable
data class FolderDto(
    val id: String,
    val name: String = "",
    val vaultId: String? = null,
    val parentId: String? = null,
)

@Serializable
data class CreateNoteBody(
    val type: String = "note",
    val vaultId: String? = null,
    val folderId: String? = null,
    val title: String? = null,
)

@Serializable
data class CreateFolderBody(
    val name: String,
    val vaultId: String? = null,
)
