package com.deranjer.nodeira.data.sync

import kotlinx.serialization.Serializable

/** The list-level operations that can be made offline and replayed later. */
enum class WriteKind { CREATE, RENAME, PIN, MOVE, DELETE }

/**
 * One queued change to a note's *metadata*.
 *
 * Note **content** is not here and never will be: it is a Yjs document that merges on its own
 * through Hocuspocus, offline included. What has no merge story is the list level — a title, a
 * pin, a folder, an existence — which is what this queue and [ConflictResolver] are for.
 *
 * [baseUpdatedAt] is the note's `updatedAt` as the phone last saw it when the change was made.
 * It is the whole basis for telling "nobody else touched this, apply it" apart from "someone
 * changed it meanwhile, ask". Without it a replay is just a blind last-write-wins.
 */
@Serializable
data class PendingWrite(
    val opId: String,
    val kind: WriteKind,
    /** The note the write targets. For CREATE this is the client-chosen id. */
    val noteId: String,
    val queuedAt: Long,
    val baseUpdatedAt: String? = null,
    // --- payload, by kind ---
    val title: String? = null,
    val pinned: Boolean? = null,
    val vaultId: String? = null,
    val folderId: String? = null,
    val type: String? = null,
)
