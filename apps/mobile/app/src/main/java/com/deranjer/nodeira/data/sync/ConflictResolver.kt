package com.deranjer.nodeira.data.sync

import com.deranjer.nodeira.data.net.NoteDto
import kotlinx.serialization.Serializable

/** What should happen to a queued write when the phone gets back online. */
sealed interface Resolution {
    /**
     * Send [write]. Nothing else touched the note in a way that matters.
     *
     * Carries the write rather than a bare marker because it is not always the one that was
     * queued: a move into a folder that has since been deleted is applied to the vault root.
     */
    data class Apply(val write: PendingWrite) : Resolution

    /** Drop it silently — the server already reflects the intent, or there is nothing to lose. */
    data class Drop(val because: String) : Resolution

    /** Ask the user. Applying or dropping would each throw away something they did. */
    data class Conflict(val reason: ConflictReason) : Resolution
}

/**
 * Why a queued write could not be replayed on its own.
 *
 * Deliberately a small closed set. Every member is a case where *both* answers lose something,
 * which is the bar for interrupting someone — see [ConflictResolver] for the cases that
 * deliberately do not qualify.
 */
@Serializable
enum class ConflictReason {
    /** Renamed here; deleted elsewhere. Applying resurrects it, dropping loses the new title. */
    RENAMED_BUT_DELETED,

    /** Renamed here and elsewhere, differently. One title has to win. */
    RENAMED_BOTH_SIDES,

    /** Deleted here; edited elsewhere after that. Deleting discards someone else's work. */
    DELETED_BUT_EDITED,
}

/** A queued write that needs a person to decide, with the server state that made it a question. */
@Serializable
data class Conflict(
    val write: PendingWrite,
    val reason: ConflictReason,
    /** The note as the server has it — absent when the conflict is that it was deleted. */
    val serverTitle: String? = null,
)

/**
 * Decides, for each queued write, whether to send it, drop it, or ask.
 *
 * Pure and side-effect free so it can be tested exhaustively; the replay loop does the I/O.
 *
 * The rule is that a conflict is raised only when **both** answers destroy something a person
 * did. Everything else resolves on its own, because a prompt the user cannot get wrong is a
 * prompt that should not have been shown:
 *
 *  - a **pin** carries no content, so a lost pin costs a tap — last write wins;
 *  - a **move** into a folder that has since been deleted falls back to the vault root rather
 *    than asking which folder was meant;
 *  - **deleting something already deleted** has converged, and there is nothing to report;
 *  - a **rename to the title the server already has** is likewise a no-op, however it got there.
 */
object ConflictResolver {

    /**
     * @param write the queued change
     * @param server the note as the server has it now, or null if the server does not have it
     * @param folderExists whether [PendingWrite.folderId] still resolves (MOVE only)
     */
    fun resolve(
        write: PendingWrite,
        server: NoteDto?,
        folderExists: Boolean = true,
    ): Resolution = when (write.kind) {
        WriteKind.CREATE ->
            // Create is idempotent server-side on the client-chosen id, so replaying is
            // always safe: it either creates the note or hands back the one already there.
            if (server != null) Resolution.Drop("already created") else Resolution.Apply(write)

        WriteKind.RENAME -> resolveRename(write, server)

        WriteKind.PIN ->
            if (server == null) Resolution.Drop("note no longer exists") else Resolution.Apply(write)

        WriteKind.MOVE -> when {
            server == null -> Resolution.Drop("note no longer exists")
            // A dangling folderId would be rejected outright. The note belongs at the root of
            // its vault instead — which is where a deleted folder's contents end up anyway —
            // rather than asking the user to re-pick a folder that no longer exists.
            !folderExists -> Resolution.Apply(write.copy(folderId = null))
            else -> Resolution.Apply(write)
        }

        WriteKind.DELETE -> when {
            server == null -> Resolution.Drop("already deleted")
            changedElsewhere(write, server) ->
                Resolution.Conflict(ConflictReason.DELETED_BUT_EDITED)
            else -> Resolution.Apply(write)
        }
    }

    private fun resolveRename(write: PendingWrite, server: NoteDto?): Resolution = when {
        server == null -> Resolution.Conflict(ConflictReason.RENAMED_BUT_DELETED)
        // However it happened, the server already reads the way the user wanted.
        server.title == write.title -> Resolution.Drop("title already matches")
        changedElsewhere(write, server) -> Resolution.Conflict(ConflictReason.RENAMED_BOTH_SIDES)
        else -> Resolution.Apply(write)
    }

    /**
     * Whether the note moved on since the phone last saw it.
     *
     * A missing [PendingWrite.baseUpdatedAt] means the phone queued the write without ever
     * having seen the note — it cannot claim the server is unchanged, but it also has no
     * evidence of a conflict. Treated as unchanged so the user's own action still lands;
     * the alternative is prompting about a conflict that may not exist.
     */
    private fun changedElsewhere(write: PendingWrite, server: NoteDto): Boolean {
        val base = write.baseUpdatedAt ?: return false
        val current = server.updatedAt ?: return false
        return current != base
    }

    /** Resolves a whole queue against a snapshot of the server's notes, in order. */
    fun resolveAll(
        writes: List<PendingWrite>,
        serverNotes: List<NoteDto>,
        existingFolderIds: Set<String> = emptySet(),
    ): List<Pair<PendingWrite, Resolution>> {
        val byId = serverNotes.associateBy { it.id }
        return writes.map { write ->
            val folderExists = write.folderId == null || write.folderId in existingFolderIds
            write to resolve(write, byId[write.noteId], folderExists)
        }
    }
}
