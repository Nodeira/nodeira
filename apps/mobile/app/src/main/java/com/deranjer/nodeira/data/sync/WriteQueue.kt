package com.deranjer.nodeira.data.sync

import android.content.Context
import android.util.Log
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Durable, ordered list of note changes made while the server was unreachable, plus the
 * conflicts that replaying them raised.
 *
 * On disk for the same reason [com.deranjer.nodeira.data.OfflineCache] is: the whole point is
 * to survive the app being killed in a tunnel. Files rather than SharedPreferences, and a
 * temp-file rename on write, so being killed mid-write cannot leave a truncated queue that
 * fails to parse and silently drops everything in it.
 *
 * Order is preserved and matters: rename-then-delete and delete-then-rename are different
 * intentions, and replaying them out of order would invent a third.
 */
class WriteQueue(context: Context) {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val dir = File(context.filesDir, "write-queue")

    @Synchronized
    fun pending(): List<PendingWrite> = read(FILE_PENDING, PendingWrite.serializer())

    @Synchronized
    fun conflicts(): List<Conflict> = read(FILE_CONFLICTS, Conflict.serializer())

    fun hasPending(): Boolean = pending().isNotEmpty()

    @Synchronized
    fun enqueue(write: PendingWrite) {
        val next = pending().toMutableList()

        // Collapse repeats of the same idempotent change to one note: toggling a pin four
        // times offline should cost one request, not four, and the last one is the intent.
        // Renames are not collapsed against *other* kinds — only against themselves — so the
        // order of a rename relative to a delete survives.
        if (write.kind == WriteKind.PIN || write.kind == WriteKind.RENAME) {
            next.removeAll { it.kind == write.kind && it.noteId == write.noteId }
        }
        next += write
        write(FILE_PENDING, PendingWrite.serializer(), next)
    }

    @Synchronized
    fun remove(opIds: Set<String>) {
        if (opIds.isEmpty()) return
        write(FILE_PENDING, PendingWrite.serializer(), pending().filterNot { it.opId in opIds })
    }

    @Synchronized
    fun recordConflicts(newConflicts: List<Conflict>) {
        if (newConflicts.isEmpty()) return
        val existing = conflicts().associateBy { it.write.opId }.toMutableMap()
        for (conflict in newConflicts) existing[conflict.write.opId] = conflict
        write(FILE_CONFLICTS, Conflict.serializer(), existing.values.toList())
    }

    @Synchronized
    fun clearConflict(opId: String) {
        write(FILE_CONFLICTS, Conflict.serializer(), conflicts().filterNot { it.write.opId == opId })
    }

    /** Wipes queue and conflicts. Called on logout — these hold note titles. */
    @Synchronized
    fun clear() {
        runCatching { dir.deleteRecursively() }
    }

    private fun <T> write(name: String, item: kotlinx.serialization.KSerializer<T>, value: List<T>) {
        runCatching {
            dir.mkdirs()
            val tmp = File(dir, "$name.tmp")
            tmp.writeText(json.encodeToString(ListSerializer(item), value))
            tmp.renameTo(File(dir, name))
        }.onFailure { Log.w(TAG, "Failed to persist $name", it) }
    }

    private fun <T> read(name: String, item: kotlinx.serialization.KSerializer<T>): List<T> {
        val file = File(dir, name)
        if (!file.exists()) return emptyList()
        return runCatching { json.decodeFromString(ListSerializer(item), file.readText()) }
            .onFailure { Log.w(TAG, "Discarding unreadable $name", it) }
            .getOrDefault(emptyList())
    }

    private companion object {
        const val TAG = "WriteQueue"
        const val FILE_PENDING = "pending.json"
        const val FILE_CONFLICTS = "conflicts.json"
    }
}
