package com.deranjer.nodeira.data

import com.deranjer.nodeira.data.net.CreateNoteBody
import com.deranjer.nodeira.data.net.LoginRequest
import com.deranjer.nodeira.data.net.NetworkModule
import com.deranjer.nodeira.data.net.NoteDto
import com.deranjer.nodeira.data.net.ReminderDto
import com.deranjer.nodeira.data.net.UpdateNoteBody
import com.deranjer.nodeira.data.sync.Conflict
import com.deranjer.nodeira.data.sync.ConflictResolver
import com.deranjer.nodeira.data.sync.PendingWrite
import com.deranjer.nodeira.data.sync.Resolution
import com.deranjer.nodeira.data.sync.WriteKind
import com.deranjer.nodeira.data.sync.WriteQueue
import java.io.IOException
import java.util.UUID

/**
 * Thin repository over the REST API + [AuthStorage]. Resolves the API for the currently
 * configured (login) or stored (post-login) server URL.
 */
class NodeiraRepository(
    private val auth: AuthStorage,
    private val network: NetworkModule,
    private val cache: OfflineCache,
    private val writeQueue: WriteQueue,
) {

    /** True when a cached snapshot exists to render before the network answers. */
    fun hasCachedData(): Boolean = cache.hasNotes()

    fun hasCachedGraph(): Boolean = cache.hasGraph()

    fun hasCachedCanvases(): Boolean = cache.hasCanvases()

    fun cachedNotes(): List<NoteDto> = cache.loadNotes()

    fun cachedVaults(): List<com.deranjer.nodeira.data.net.VaultDto> = cache.loadVaults()

    fun cachedFolders(): List<com.deranjer.nodeira.data.net.FolderDto> = cache.loadFolders()

    /** When the cache was last refreshed, for the "showing offline copy" line. */
    fun lastSyncedAt(): Long? = cache.lastSyncedAt

    fun markSynced() = cache.markSynced()

    fun cachedGraph(): List<com.deranjer.nodeira.data.net.GraphLink> = cache.loadGraph()

    fun cachedCanvases(): List<com.deranjer.nodeira.data.net.CanvasDto> = cache.loadCanvases()

    /** Changes made offline that have not reached the server yet. */
    fun pendingWriteCount(): Int = writeQueue.pending().size

    /** Queued changes that need a person to pick a side — see [ConflictResolver]. */
    fun conflicts(): List<Conflict> = writeQueue.conflicts()

    /**
     * A person's answer to a conflict: send the queued change anyway, or drop it and accept
     * the server's version.
     *
     * "Keep mine" is a best-effort resend, not a guarantee — a rename of a note someone else
     * deleted will fail again (there is nothing to rename), and the conflict resurfaces on the
     * next sync rather than vanishing silently.
     */
    suspend fun resolveConflict(opId: String, keepLocal: Boolean) {
        val conflict = writeQueue.conflicts().find { it.write.opId == opId } ?: return
        writeQueue.clearConflict(opId)
        if (!keepLocal) return
        runCatching { sendWrite(conflict.write) }.onFailure { writeQueue.enqueue(conflict.write) }
    }

    /** Logs in against [serverUrl] and persists the session on success. */
    suspend fun login(serverUrl: String, email: String, password: String) {
        val api = network.apiFor(serverUrl)
        val res = api.login(LoginRequest(email = email, password = password))
        auth.serverUrl = serverUrl
        auth.token = res.accessToken
        auth.userEmail = res.user.email
    }

    fun logout() {
        auth.clearSession()
        // The cache and queue hold note titles; neither must survive the session.
        cache.clear()
        writeQueue.clear()
    }

    private fun requireApi() =
        network.apiFor(auth.serverUrl ?: error("No server configured"))

    /** See [com.deranjer.nodeira.data.net.NodeiraMoveApi] for why moves use a separate client. */
    private fun requireMoveApi() =
        network.moveApiFor(auth.serverUrl ?: error("No server configured"))

    /**
     * Fetches the note list and, if the phone is back online with queued changes, replays them
     * first so the list returned reflects the merged result rather than a stale local echo.
     */
    suspend fun getNotes(): List<NoteDto> {
        val notes = requireApi().getNotes().sortedByDescending { it.updatedAt ?: "" }
        val merged = if (writeQueue.hasPending()) replayPendingWrites(notes) else notes
        cache.saveNotes(merged)
        return merged
    }

    suspend fun getVaults(): List<com.deranjer.nodeira.data.net.VaultDto> =
        requireApi().getVaults().sortedBy { it.name.lowercase() }.also(cache::saveVaults)

    suspend fun getFolders(vaultId: String? = null): List<com.deranjer.nodeira.data.net.FolderDto> =
        requireApi().getFolders(vaultId).sortedBy { it.name.lowercase() }
            // Only the unfiltered list is a faithful snapshot; a vault-filtered one would
            // overwrite the cache with a subset.
            .also { if (vaultId == null) cache.saveFolders(it) }

    /**
     * Creates a note under a client-chosen id, so the caller can open the editor against it
     * immediately whether or not the create actually reached the server yet — the id is what
     * the Yjs document is keyed by, and the server-side create is idempotent on it (see
     * `CreateNoteDto`), so replaying it later is always safe.
     */
    suspend fun createNote(
        type: String,
        vaultId: String,
        folderId: String? = null,
    ): NoteDto {
        val id = UUID.randomUUID().toString()
        val body = CreateNoteBody(id = id, type = type, vaultId = vaultId, folderId = folderId)
        return try {
            requireApi().createNote(body).also(::upsertCache)
        } catch (e: IOException) {
            val note = NoteDto(id = id, title = "Untitled", type = type, vaultId = vaultId, folderId = folderId)
            upsertCache(note)
            writeQueue.enqueue(
                PendingWrite(
                    opId = UUID.randomUUID().toString(),
                    kind = WriteKind.CREATE,
                    noteId = id,
                    queuedAt = System.currentTimeMillis(),
                    vaultId = vaultId,
                    folderId = folderId,
                    type = type,
                ),
            )
            note
        }
    }

    suspend fun renameNote(id: String, title: String): NoteDto = mutateNote(
        id = id,
        body = UpdateNoteBody(title = title),
        write = { existing ->
            PendingWrite(
                opId = UUID.randomUUID().toString(),
                kind = WriteKind.RENAME,
                noteId = id,
                queuedAt = System.currentTimeMillis(),
                baseUpdatedAt = existing?.updatedAt,
                title = title,
            )
        },
        optimistic = { existing -> (existing ?: NoteDto(id = id, title = title)).copy(title = title) },
    )

    suspend fun setNotePinned(id: String, pinned: Boolean): NoteDto = mutateNote(
        id = id,
        body = UpdateNoteBody(pinned = pinned),
        write = { existing ->
            PendingWrite(
                opId = UUID.randomUUID().toString(),
                kind = WriteKind.PIN,
                noteId = id,
                queuedAt = System.currentTimeMillis(),
                baseUpdatedAt = existing?.updatedAt,
                pinned = pinned,
            )
        },
        optimistic = { existing -> (existing ?: NoteDto(id = id)).copy(pinned = pinned) },
    )

    // Uses requireMoveApi()/MoveNoteBody rather than mutateNote()'s UpdateNoteBody — a
    // "move to vault root" clears folderId to null, which the default JSON encoder would
    // silently omit (and the server would then leave the note's folder untouched). See
    // MoveNoteBody's doc comment.
    suspend fun moveNote(id: String, vaultId: String?, folderId: String?): NoteDto = try {
        requireMoveApi().moveNote(id, com.deranjer.nodeira.data.net.MoveNoteBody(vaultId = vaultId, folderId = folderId))
            .also(::upsertCache)
    } catch (e: IOException) {
        val existing = cache.loadNotes().find { it.id == id }
        val note = (existing ?: NoteDto(id = id)).copy(vaultId = vaultId ?: existing?.vaultId, folderId = folderId)
        upsertCache(note)
        writeQueue.enqueue(
            PendingWrite(
                opId = UUID.randomUUID().toString(),
                kind = WriteKind.MOVE,
                noteId = id,
                queuedAt = System.currentTimeMillis(),
                baseUpdatedAt = existing?.updatedAt,
                vaultId = vaultId,
                folderId = folderId,
            ),
        )
        note
    }

    suspend fun deleteNote(id: String) {
        try {
            requireApi().deleteNote(id)
            removeFromCache(id)
        } catch (e: IOException) {
            val existing = cache.loadNotes().find { it.id == id }
            removeFromCache(id)
            writeQueue.enqueue(
                PendingWrite(
                    opId = UUID.randomUUID().toString(),
                    kind = WriteKind.DELETE,
                    noteId = id,
                    queuedAt = System.currentTimeMillis(),
                    baseUpdatedAt = existing?.updatedAt,
                ),
            )
        }
    }

    /**
     * Sends [body], falling back to a queued [write] plus an [optimistic] cache update when the
     * server is unreachable. Only [IOException] is treated as "offline" — an HTTP error response
     * (validation, auth, a 404) is a real answer from the server and must not be queued.
     */
    private suspend fun mutateNote(
        id: String,
        body: UpdateNoteBody,
        write: (existing: NoteDto?) -> PendingWrite,
        optimistic: (existing: NoteDto?) -> NoteDto,
    ): NoteDto = try {
        requireApi().updateNote(id, body).also(::upsertCache)
    } catch (e: IOException) {
        val existing = cache.loadNotes().find { it.id == id }
        val note = optimistic(existing)
        upsertCache(note)
        writeQueue.enqueue(write(existing))
        note
    }

    private fun upsertCache(note: NoteDto) {
        val notes = cache.loadNotes().toMutableList()
        val idx = notes.indexOfFirst { it.id == note.id }
        if (idx >= 0) notes[idx] = note else notes.add(0, note)
        cache.saveNotes(notes)
    }

    private fun removeFromCache(id: String) {
        cache.saveNotes(cache.loadNotes().filterNot { it.id == id })
    }

    /**
     * Resolves every queued write against the current server state and sends the ones that
     * apply cleanly. Called from [getNotes], which is the only place that knows the phone is
     * actually online right now.
     */
    private suspend fun replayPendingWrites(serverNotes: List<NoteDto>): List<NoteDto> {
        val pending = writeQueue.pending()
        if (pending.isEmpty()) return serverNotes

        val folderIds = runCatching { requireApi().getFolders() }
            .getOrDefault(emptyList()).map { it.id }.toSet()
        val resolved = ConflictResolver.resolveAll(pending, serverNotes, folderIds)

        val settled = mutableSetOf<String>()
        val newConflicts = mutableListOf<Conflict>()
        var anyApplied = false

        for ((write, resolution) in resolved) {
            when (resolution) {
                is Resolution.Apply -> {
                    // Left in the queue on failure — still offline, or a transient error —
                    // rather than dropped, so the next successful sync tries again.
                    if (runCatching { sendWrite(resolution.write) }.isSuccess) {
                        settled += write.opId
                        anyApplied = true
                    }
                }
                is Resolution.Drop -> settled += write.opId
                is Resolution.Conflict -> {
                    settled += write.opId
                    newConflicts += Conflict(
                        write = write,
                        reason = resolution.reason,
                        serverTitle = serverNotes.find { it.id == write.noteId }?.title,
                    )
                }
            }
        }
        writeQueue.remove(settled)
        writeQueue.recordConflicts(newConflicts)

        if (!anyApplied) return serverNotes

        // A replayed write can change fields the client doesn't compute itself (create's
        // position, for one) — re-fetch rather than patch the list by hand.
        return requireApi().getNotes().sortedByDescending { it.updatedAt ?: "" }
    }

    private suspend fun sendWrite(write: PendingWrite) {
        val api = requireApi()
        when (write.kind) {
            WriteKind.CREATE -> api.createNote(
                CreateNoteBody(
                    id = write.noteId,
                    type = write.type ?: "note",
                    vaultId = write.vaultId ?: error("queued create with no vault"),
                    folderId = write.folderId,
                    title = write.title,
                ),
            )
            WriteKind.RENAME -> api.updateNote(write.noteId, UpdateNoteBody(title = write.title))
            WriteKind.PIN -> api.updateNote(write.noteId, UpdateNoteBody(pinned = write.pinned))
            WriteKind.MOVE ->
                requireMoveApi().moveNote(
                    write.noteId,
                    com.deranjer.nodeira.data.net.MoveNoteBody(vaultId = write.vaultId, folderId = write.folderId),
                )
            WriteKind.DELETE -> api.deleteNote(write.noteId)
        }
    }

    suspend fun createFolder(
        name: String,
        vaultId: String,
    ): com.deranjer.nodeira.data.net.FolderDto = requireApi().createFolder(
        com.deranjer.nodeira.data.net.CreateFolderBody(name = name, vaultId = vaultId),
    )

    suspend fun renameFolder(id: String, name: String): com.deranjer.nodeira.data.net.FolderDto =
        requireApi().updateFolder(id, com.deranjer.nodeira.data.net.UpdateFolderBody(name = name))

    suspend fun deleteFolder(id: String) = requireApi().deleteFolder(id)

    // See moveNote's comment — folders need the same explicit-null-capable encoder for
    // "move to vault root" (parentId = null).
    suspend fun moveFolder(id: String, vaultId: String?, parentId: String?): com.deranjer.nodeira.data.net.FolderDto =
        requireMoveApi().moveFolder(id, com.deranjer.nodeira.data.net.MoveFolderBody(vaultId = vaultId, parentId = parentId))

    suspend fun getReminders(): List<ReminderDto> = requireApi().getReminders()

    suspend fun createReminder(body: com.deranjer.nodeira.data.net.CreateReminderBody): ReminderDto =
        requireApi().createReminder(body)

    suspend fun updateReminder(id: String, body: com.deranjer.nodeira.data.net.CreateReminderBody): ReminderDto =
        requireApi().updateReminder(id, body)

    suspend fun deleteReminder(id: String) = requireApi().deleteReminder(id)

    suspend fun getGraph(): List<com.deranjer.nodeira.data.net.GraphLink> = requireApi().getGraph().also(cache::saveGraph)

    suspend fun getCanvases(): List<com.deranjer.nodeira.data.net.CanvasDto> =
        requireApi().getCanvases().also(cache::saveCanvases).sortedByDescending { it.updatedAt ?: "" }

    suspend fun createCanvas(
        vaultId: String,
        folderId: String? = null,
        title: String? = null,
    ): com.deranjer.nodeira.data.net.CanvasDto = requireApi().createCanvas(
        com.deranjer.nodeira.data.net.CreateCanvasBody(title = title, vaultId = vaultId, folderId = folderId),
    )

    suspend fun renameCanvas(id: String, title: String): com.deranjer.nodeira.data.net.CanvasDto =
        requireApi().updateCanvas(id, com.deranjer.nodeira.data.net.UpdateCanvasBody(title = title))

    suspend fun setCanvasPinned(id: String, pinned: Boolean): com.deranjer.nodeira.data.net.CanvasDto =
        requireApi().updateCanvas(id, com.deranjer.nodeira.data.net.UpdateCanvasBody(pinned = pinned))

    suspend fun deleteCanvas(id: String) = requireApi().deleteCanvas(id)

    // See moveNote's comment — canvases need the same explicit-null-capable encoder for
    // "move to no folder" (folderId = null).
    suspend fun moveCanvas(id: String, vaultId: String?, folderId: String?): com.deranjer.nodeira.data.net.CanvasDto =
        requireMoveApi().moveCanvas(id, com.deranjer.nodeira.data.net.MoveCanvasBody(vaultId = vaultId, folderId = folderId))
}
