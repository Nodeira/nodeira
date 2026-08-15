package com.deranjer.nodeira.data.sync

import com.deranjer.nodeira.data.net.NoteDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The decision table for replaying offline writes.
 *
 * Two things are being pinned here. The obvious one is that genuine conflicts are raised. The
 * less obvious and more easily broken one is that everything else is *not* — a queue that
 * prompts about a pin, or about a delete that already happened, trains people to dismiss
 * prompts without reading them, and the one that mattered goes with the rest.
 */
class ConflictResolverTest {

    private val seenAt = "2026-08-11T10:00:00.000Z"
    private val laterAt = "2026-08-11T12:00:00.000Z"

    private fun note(
        id: String = "n1",
        title: String = "Original",
        updatedAt: String? = seenAt,
    ) = NoteDto(id = id, title = title, updatedAt = updatedAt)

    private fun write(
        kind: WriteKind,
        title: String? = null,
        pinned: Boolean? = null,
        folderId: String? = null,
        base: String? = seenAt,
    ) = PendingWrite(
        opId = "op1",
        kind = kind,
        noteId = "n1",
        queuedAt = 0L,
        baseUpdatedAt = base,
        title = title,
        pinned = pinned,
        folderId = folderId,
    )

    // --- the three conflicts, each one where both answers lose something ---

    @Test
    fun `renaming a note deleted elsewhere is a conflict`() {
        val result = ConflictResolver.resolve(write(WriteKind.RENAME, title = "My new title"), null)
        assertEquals(Resolution.Conflict(ConflictReason.RENAMED_BUT_DELETED), result)
    }

    @Test
    fun `renaming a note renamed elsewhere is a conflict`() {
        val result = ConflictResolver.resolve(
            write(WriteKind.RENAME, title = "Mine"),
            note(title = "Theirs", updatedAt = laterAt),
        )
        assertEquals(Resolution.Conflict(ConflictReason.RENAMED_BOTH_SIDES), result)
    }

    @Test
    fun `deleting a note edited elsewhere is a conflict`() {
        val result = ConflictResolver.resolve(
            write(WriteKind.DELETE),
            note(updatedAt = laterAt),
        )
        assertEquals(Resolution.Conflict(ConflictReason.DELETED_BUT_EDITED), result)
    }

    // --- everything that must resolve on its own ---

    @Test
    fun `renaming an untouched note applies`() {
        val result = ConflictResolver.resolve(write(WriteKind.RENAME, title = "Mine"), note())
        assertEquals(Resolution.Apply(write(WriteKind.RENAME, title = "Mine")), result)
    }

    @Test
    fun `renaming to the title the server already has is dropped, not conflicted`() {
        // Someone else made the same edit, or an earlier replay landed and the response was
        // lost. Either way there is nothing left to do and nothing to ask about.
        val result = ConflictResolver.resolve(
            write(WriteKind.RENAME, title = "Same"),
            note(title = "Same", updatedAt = laterAt),
        )
        assertTrue(result is Resolution.Drop)
    }

    @Test
    fun `a pin never conflicts - last write wins`() {
        val result = ConflictResolver.resolve(
            write(WriteKind.PIN, pinned = true),
            note(updatedAt = laterAt),
        )
        assertTrue(result is Resolution.Apply)
    }

    @Test
    fun `pinning a note deleted elsewhere is dropped`() {
        assertTrue(ConflictResolver.resolve(write(WriteKind.PIN, pinned = true), null) is Resolution.Drop)
    }

    @Test
    fun `deleting an already deleted note is dropped - it converged`() {
        assertTrue(ConflictResolver.resolve(write(WriteKind.DELETE), null) is Resolution.Drop)
    }

    @Test
    fun `deleting an untouched note applies`() {
        assertTrue(ConflictResolver.resolve(write(WriteKind.DELETE), note()) is Resolution.Apply)
    }

    @Test
    fun `moving into a folder that no longer exists falls back to the vault root`() {
        val queued = write(WriteKind.MOVE, folderId = "gone")
        val result = ConflictResolver.resolve(queued, note(), folderExists = false)

        // Applied, but rewritten — the point of Apply carrying the write.
        assertEquals(Resolution.Apply(queued.copy(folderId = null)), result)
    }

    @Test
    fun `moving into a folder that still exists keeps the folder`() {
        val queued = write(WriteKind.MOVE, folderId = "f1")
        assertEquals(Resolution.Apply(queued), ConflictResolver.resolve(queued, note(), true))
    }

    @Test
    fun `moving a note deleted elsewhere is dropped`() {
        assertTrue(
            ConflictResolver.resolve(write(WriteKind.MOVE, folderId = "f1"), null) is Resolution.Drop,
        )
    }

    @Test
    fun `create replays even when the server has never seen it`() {
        assertTrue(ConflictResolver.resolve(write(WriteKind.CREATE), null) is Resolution.Apply)
    }

    @Test
    fun `create is dropped once the server has the note - the id makes it idempotent`() {
        assertTrue(ConflictResolver.resolve(write(WriteKind.CREATE), note()) is Resolution.Drop)
    }

    // --- the evidence the decision rests on ---

    @Test
    fun `a write queued without a seen version is applied rather than assumed conflicting`() {
        val result = ConflictResolver.resolve(
            write(WriteKind.RENAME, title = "Mine", base = null),
            note(title = "Theirs", updatedAt = laterAt),
        )
        assertTrue(result is Resolution.Apply)
    }

    @Test
    fun `a server note with no timestamp cannot prove a conflict`() {
        val result = ConflictResolver.resolve(
            write(WriteKind.RENAME, title = "Mine"),
            note(title = "Theirs", updatedAt = null),
        )
        assertTrue(result is Resolution.Apply)
    }

    // --- whole-queue resolution ---

    @Test
    fun `resolveAll pairs every write with its own verdict`() {
        val writes = listOf(
            write(WriteKind.RENAME, title = "Mine").copy(opId = "a", noteId = "n1"),
            write(WriteKind.PIN, pinned = true).copy(opId = "b", noteId = "missing"),
            write(WriteKind.DELETE).copy(opId = "c", noteId = "n2"),
        )
        val server = listOf(note(id = "n1"), note(id = "n2", updatedAt = laterAt))

        val results = ConflictResolver.resolveAll(writes, server)

        assertEquals(3, results.size)
        assertTrue(results[0].second is Resolution.Apply)
        assertTrue(results[1].second is Resolution.Drop)
        assertEquals(
            Resolution.Conflict(ConflictReason.DELETED_BUT_EDITED),
            results[2].second,
        )
    }

    @Test
    fun `resolveAll treats an unknown folder as missing`() {
        val queued = write(WriteKind.MOVE, folderId = "f-unknown")
        val results = ConflictResolver.resolveAll(listOf(queued), listOf(note()), setOf("f-known"))
        assertEquals(Resolution.Apply(queued.copy(folderId = null)), results.single().second)
    }
}
