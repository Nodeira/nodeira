package com.deranjer.nodeira.data

import android.content.Context
import android.util.Log
import androidx.core.content.edit
import com.deranjer.nodeira.data.net.CanvasDto
import com.deranjer.nodeira.data.net.FolderDto
import com.deranjer.nodeira.data.net.GraphLink
import com.deranjer.nodeira.data.net.NoteDto
import com.deranjer.nodeira.data.net.VaultDto
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.io.File

/**
 * On-disk snapshot of the note list, vaults and folders, refreshed on every successful load.
 *
 * Only the editor WebView worked offline (it has IndexedDB); every native screen was a live
 * REST call, so Home, Recents, Graph and Canvases showed an error the moment the network went
 * away — including in a tunnel, with a perfectly good copy of everything already fetched.
 *
 * A snapshot rather than a Room database, on purpose. The app fetches the whole note list and
 * every screen filters it in memory, so there are no queries for a database to answer, and
 * Room would mean adding KSP and schema migrations to the build for behaviour nothing uses.
 * [ReminderCache] set the same precedent. If notes ever grow past what should be held in
 * memory, that is the moment to switch — and the repository is the only thing that changes.
 *
 * Files rather than SharedPreferences: a note list is far larger than preferences are meant
 * to hold, and prefs are parsed in full on first access.
 */
class OfflineCache(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val dir = File(context.filesDir, "offline-cache")
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** When the cache was last refreshed from the server, or null if it never has been. */
    val lastSyncedAt: Long?
        get() = prefs.getLong(KEY_SYNCED_AT, 0L).takeIf { it > 0L }

    fun saveNotes(notes: List<NoteDto>) = write(FILE_NOTES, NoteDto.serializer(), notes)
    fun loadNotes(): List<NoteDto> = read(FILE_NOTES, NoteDto.serializer())

    fun saveVaults(vaults: List<VaultDto>) = write(FILE_VAULTS, VaultDto.serializer(), vaults)
    fun loadVaults(): List<VaultDto> = read(FILE_VAULTS, VaultDto.serializer())

    fun saveFolders(folders: List<FolderDto>) = write(FILE_FOLDERS, FolderDto.serializer(), folders)
    fun loadFolders(): List<FolderDto> = read(FILE_FOLDERS, FolderDto.serializer())

    fun saveGraph(links: List<GraphLink>) = write(FILE_GRAPH, GraphLink.serializer(), links)
    fun loadGraph(): List<GraphLink> = read(FILE_GRAPH, GraphLink.serializer())

    fun saveCanvases(canvases: List<CanvasDto>) = write(FILE_CANVASES, CanvasDto.serializer(), canvases)
    fun loadCanvases(): List<CanvasDto> = read(FILE_CANVASES, CanvasDto.serializer())

    /**
     * Whether a snapshot of each kind has ever been written.
     *
     * Screens ask this rather than checking whether the list they loaded is non-empty: a user
     * with no canvases has a perfectly good *empty* snapshot, and treating that as "no cache"
     * shows a connection error offline instead of the empty state.
     */
    fun hasNotes(): Boolean = exists(FILE_NOTES)

    fun hasGraph(): Boolean = exists(FILE_GRAPH)

    fun hasCanvases(): Boolean = exists(FILE_CANVASES)

    private fun exists(name: String) = File(dir, name).exists()

    fun markSynced() = prefs.edit { putLong(KEY_SYNCED_AT, System.currentTimeMillis()) }

    /**
     * Wipes the cache. Called on logout: these files hold note titles and folder names, and
     * must not outlive the session that fetched them or leak into the next account.
     */
    fun clear() {
        runCatching { dir.deleteRecursively() }
        prefs.edit { remove(KEY_SYNCED_AT) }
    }

    private fun <T> write(name: String, item: KSerializer<T>, value: List<T>) {
        runCatching {
            dir.mkdirs()
            // Write to a temp file and rename: being killed mid-write must not leave a
            // truncated file that fails to parse on the next launch.
            val tmp = File(dir, "$name.tmp")
            tmp.writeText(json.encodeToString(ListSerializer(item), value))
            tmp.renameTo(File(dir, name))
        }.onFailure { Log.w(TAG, "Failed to cache $name", it) }
    }

    private fun <T> read(name: String, item: KSerializer<T>): List<T> {
        val file = File(dir, name)
        if (!file.exists()) return emptyList()
        return runCatching { json.decodeFromString(ListSerializer(item), file.readText()) }
            .onFailure { Log.w(TAG, "Discarding unreadable cache $name", it) }
            .getOrDefault(emptyList())
    }

    private companion object {
        const val TAG = "OfflineCache"
        const val PREFS = "nodeira_offline_cache"
        const val KEY_SYNCED_AT = "last_synced_at"
        const val FILE_NOTES = "notes.json"
        const val FILE_VAULTS = "vaults.json"
        const val FILE_FOLDERS = "folders.json"
        const val FILE_GRAPH = "graph.json"
        const val FILE_CANVASES = "canvases.json"
    }
}
