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
    // Required: content cannot exist outside a vault, since access is decided by vault
    // membership. The server rejects a null vaultId with 400.
    val vaultId: String,
    val folderId: String? = null,
    val title: String? = null,
    /**
     * Client-chosen id. Always sent by [com.deranjer.nodeira.data.NodeiraRepository.createNote]
     * so a note created offline keeps the same id once the create is replayed — see
     * `CreateNoteDto` on the API side for why that matters.
     */
    val id: String? = null,
)

/**
 * Partial note update. Every field is optional and omitted when null, so a rename does not
 * clobber the folder and vice versa.
 *
 * `tags` is deliberately absent: they are derived from the document by the sync server and
 * the API rejects them here.
 */
@Serializable
data class UpdateNoteBody(
    val title: String? = null,
    val pinned: Boolean? = null,
    val vaultId: String? = null,
    val folderId: String? = null,
)

@Serializable
data class CreateFolderBody(
    val name: String,
    val vaultId: String,
)

/** One row in Trash — a note, folder, or canvas soft-deleted and awaiting purge or restore. */
@Serializable
data class TrashItemDto(
    val type: String,
    val id: String,
    val title: String = "",
    val vaultId: String? = null,
    val deletedAt: String,
    /** Notes/canvases/subfolders nested inside — folders only. */
    val itemCount: Int? = null,
)
