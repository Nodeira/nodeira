package com.deranjer.nodeira.data

import com.deranjer.nodeira.data.net.CreateReminderBody
import com.deranjer.nodeira.data.net.LoginRequest
import com.deranjer.nodeira.data.net.NetworkModule
import com.deranjer.nodeira.data.net.NoteDto
import com.deranjer.nodeira.data.net.ReminderDto

/**
 * Thin repository over the REST API + [AuthStorage]. Resolves the API for the currently
 * configured (login) or stored (post-login) server URL.
 */
class NodeiraRepository(
    private val auth: AuthStorage,
    private val network: NetworkModule,
) {

    /** Logs in against [serverUrl] and persists the session on success. */
    suspend fun login(serverUrl: String, email: String, password: String) {
        val api = network.apiFor(serverUrl)
        val res = api.login(LoginRequest(email = email, password = password))
        auth.serverUrl = serverUrl
        auth.token = res.accessToken
        auth.userEmail = res.user.email
    }

    fun logout() = auth.clearSession()

    private fun requireApi() =
        network.apiFor(auth.serverUrl ?: error("No server configured"))

    suspend fun getNotes(): List<NoteDto> =
        requireApi().getNotes().sortedByDescending { it.updatedAt ?: "" }

    suspend fun getVaults(): List<com.deranjer.nodeira.data.net.VaultDto> =
        requireApi().getVaults().sortedBy { it.name.lowercase() }

    suspend fun getFolders(vaultId: String? = null): List<com.deranjer.nodeira.data.net.FolderDto> =
        requireApi().getFolders(vaultId).sortedBy { it.name.lowercase() }

    suspend fun createNote(
        type: String,
        vaultId: String,
        folderId: String? = null,
    ): NoteDto = requireApi().createNote(
        com.deranjer.nodeira.data.net.CreateNoteBody(type = type, vaultId = vaultId, folderId = folderId),
    )

    suspend fun updateNote(
        id: String,
        body: com.deranjer.nodeira.data.net.UpdateNoteBody,
    ): NoteDto = requireApi().updateNote(id, body)

    suspend fun deleteNote(id: String) = requireApi().deleteNote(id)

    suspend fun createFolder(
        name: String,
        vaultId: String,
    ): com.deranjer.nodeira.data.net.FolderDto = requireApi().createFolder(
        com.deranjer.nodeira.data.net.CreateFolderBody(name = name, vaultId = vaultId),
    )

    suspend fun getReminders(): List<ReminderDto> = requireApi().getReminders()

    suspend fun createReminder(body: CreateReminderBody): ReminderDto =
        requireApi().createReminder(body)

    suspend fun updateReminder(id: String, body: CreateReminderBody): ReminderDto =
        requireApi().updateReminder(id, body)

    suspend fun deleteReminder(id: String) = requireApi().deleteReminder(id)

    suspend fun getGraph(): List<com.deranjer.nodeira.data.net.GraphLink> = requireApi().getGraph()

    suspend fun getCanvases(): List<com.deranjer.nodeira.data.net.CanvasDto> =
        requireApi().getCanvases().sortedByDescending { it.updatedAt ?: "" }

    suspend fun createCanvas(title: String): com.deranjer.nodeira.data.net.CanvasDto =
        requireApi().createCanvas(com.deranjer.nodeira.data.net.CreateCanvasBody(title = title))

    suspend fun deleteCanvas(id: String) = requireApi().deleteCanvas(id)
}
