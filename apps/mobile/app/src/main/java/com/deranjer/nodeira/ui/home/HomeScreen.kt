package com.deranjer.nodeira.ui.home

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DriveFileMove
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.NoteAdd
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.CreateNewFolder
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.deranjer.nodeira.data.net.CanvasDto
import com.deranjer.nodeira.data.net.FolderDto
import com.deranjer.nodeira.data.net.NoteDto
import com.deranjer.nodeira.data.net.VaultDto
import com.deranjer.nodeira.ui.canvases.CanvasListItem
import com.deranjer.nodeira.ui.components.BrandSearchBar
import com.deranjer.nodeira.ui.components.MoveToDialog
import com.deranjer.nodeira.ui.components.NBadge
import com.deranjer.nodeira.ui.components.SectionLabel
import com.deranjer.nodeira.ui.nav.AppDestination
import com.deranjer.nodeira.ui.nav.AppScaffold
import com.deranjer.nodeira.ui.notes.ConflictDialog
import com.deranjer.nodeira.ui.notes.NoteListItem
import com.deranjer.nodeira.ui.notes.NotesUiState
import com.deranjer.nodeira.ui.notes.OfflineBanner
import com.deranjer.nodeira.ui.notes.PendingWritesBanner
import com.deranjer.nodeira.ui.notes.formatTimestamp

/** What [MoveToDialog] is currently open for — lifted to HomeScreen since the dialog needs the full, unfiltered vault/folder lists. */
private data class MoveTarget(
    val id: String,
    val kind: String, // "note" | "canvas" | "folder"
    val vaultId: String?,
    val folderId: String?,
    val label: String,
    val excludeFolderId: String? = null,
)

@Composable
fun HomeScreen(
    state: NotesUiState,
    userInitial: String,
    onOpenNote: (String) -> Unit,
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit,
    onRefresh: () -> Unit,
    onCreateNote: (type: String, vaultId: String?, onCreated: (String) -> Unit) -> Unit,
    onCreateFolder: (name: String, vaultId: String?) -> Unit,
    onDeleteNote: (String) -> Unit,
    onTogglePin: (id: String, pinned: Boolean) -> Unit,
    onRenameNote: (id: String, title: String) -> Unit,
    onMoveNote: (id: String, vaultId: String?, folderId: String?) -> Unit,
    onResolveConflict: (opId: String, keepLocal: Boolean) -> Unit = { _, _ -> },
    onOpenCanvas: (String) -> Unit,
    onCreateCanvas: (vaultId: String?, onCreated: (String) -> Unit) -> Unit,
    onDeleteCanvas: (String) -> Unit,
    onToggleCanvasPin: (id: String, pinned: Boolean) -> Unit,
    onRenameCanvas: (id: String, title: String) -> Unit,
    onMoveCanvas: (id: String, vaultId: String?, folderId: String?) -> Unit,
    onRenameFolder: (id: String, name: String) -> Unit,
    onDeleteFolder: (id: String) -> Unit,
    onMoveFolder: (id: String, vaultId: String?, parentId: String?) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var selectedVaultId by remember { mutableStateOf<String?>(null) }
    var showNewMenu by remember { mutableStateOf(false) }
    var showFolderDialog by remember { mutableStateOf(false) }
    var moveTarget by remember { mutableStateOf<MoveTarget?>(null) }
    // Per-folder expand/collapse, keyed by folder id (default collapsed).
    val expandedFolders = remember { mutableStateMapOf<String, Boolean>() }

    AppScaffold(
        title = "Nodeira",
        currentRoute = AppDestination.HOME.route,
        onNavigate = onNavigate,
        onLogout = onLogout,
        titleContent = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                NBadge(size = 28)
                Spacer(Modifier.width(12.dp))
                Text("Nodeira")
            }
        },
        actions = {
            IconButton(onClick = onRefresh) {
                Icon(Icons.Filled.Refresh, contentDescription = "Refresh")
            }
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showNewMenu = true },
                icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                text = { Text("New") },
                containerColor = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
            )
        },
    ) {
        state.conflicts.firstOrNull()?.let { conflict ->
            ConflictDialog(conflict = conflict, onResolve = { keepLocal -> onResolveConflict(conflict.write.opId, keepLocal) })
        }
        Box(modifier = Modifier.fillMaxSize()) {
            when {
                state.loading && state.notes.isEmpty() ->
                    CircularProgressIndicator(Modifier.align(Alignment.Center))
                state.error != null ->
                    Text(
                        state.error,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.align(Alignment.Center).padding(24.dp),
                    )
                else -> {
                    val scoped = state.notes.filter { selectedVaultId == null || it.vaultId == selectedVaultId }
                    val scopedCanvases = state.canvases.filter { selectedVaultId == null || it.vaultId == selectedVaultId }
                    val scopedFolders = state.folders.filter { selectedVaultId == null || it.vaultId == selectedVaultId }
                    val visible = scoped.filter { query.isBlank() || it.title.contains(query, ignoreCase = true) }
                    val visibleCanvases = scopedCanvases.filter { query.isBlank() || it.title.contains(query, ignoreCase = true) }
                    val searching = query.isNotBlank()

                    val pinned = visible.filter { it.pinned }
                    val pinnedCanvases = visibleCanvases.filter { it.pinned }
                    val notesByFolder = visible.groupBy { it.folderId }
                    val canvasesByFolder = visibleCanvases.groupBy { it.folderId }
                    val rootNotes = notesByFolder[null].orEmpty()
                    val rootCanvases = canvasesByFolder[null].orEmpty()
                    // Folders grouped by parent so the tree can render recursively.
                    val foldersByParent = scopedFolders.groupBy { it.parentId }
                    val rootFolders = foldersByParent[null].orEmpty()

                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        item("search") {
                            BrandSearchBar(
                                query = query,
                                onQueryChange = { query = it },
                                avatarInitial = userInitial,
                                modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 12.dp),
                            )
                        }
                        if (state.offline) {
                            item("offline") { OfflineBanner(state.lastSyncedAt) }
                        }
                        if (state.pendingWrites > 0) {
                            item("pending-writes") { PendingWritesBanner(state.pendingWrites) }
                        }
                        item("vault") {
                            VaultRow(
                                vaults = state.vaults,
                                selectedVaultId = selectedVaultId,
                                noteCount = scoped.size,
                                offline = state.offline,
                                onSelect = { selectedVaultId = it },
                            )
                        }

                        if (pinned.isNotEmpty() || pinnedCanvases.isNotEmpty()) {
                            item("pinned-label") { SectionLabel("Pinned") }
                            items(pinned, key = { "pin-${it.id}" }) { note ->
                                NoteListItem(
                                    note = note,
                                    onClick = { onOpenNote(note.id) },
                                    showPinTrailing = true,
                                    onDelete = { onDeleteNote(note.id) },
                                    onTogglePin = { onTogglePin(note.id, !note.pinned) },
                                    onRename = { onRenameNote(note.id, it) },
                                    onMove = {
                                        moveTarget = MoveTarget(note.id, "note", note.vaultId, note.folderId, note.title.ifBlank { "Untitled" })
                                    },
                                )
                            }
                            items(pinnedCanvases, key = { "pin-c-${it.id}" }) { canvas ->
                                CanvasListItem(
                                    canvas = canvas,
                                    onClick = { onOpenCanvas(canvas.id) },
                                    showPinTrailing = true,
                                    onDelete = { onDeleteCanvas(canvas.id) },
                                    onTogglePin = { onToggleCanvasPin(canvas.id, !canvas.pinned) },
                                    onRename = { onRenameCanvas(canvas.id, it) },
                                    onMove = {
                                        moveTarget = MoveTarget(canvas.id, "canvas", canvas.vaultId, canvas.folderId, canvas.title.ifBlank { "Untitled canvas" })
                                    },
                                )
                            }
                        }

                        item("files-label") { SectionLabel("Files") }

                        val anyFolderVisible = rootFolders.any {
                            !searching || subtreeHasNotes(it.id, notesByFolder, canvasesByFolder, foldersByParent)
                        }
                        if (!anyFolderVisible && rootNotes.isEmpty() && rootCanvases.isEmpty()) {
                            item("empty") {
                                Text(
                                    if (searching) "No matching notes" else "No notes yet",
                                    modifier = Modifier.fillMaxWidth().padding(24.dp),
                                    color = MaterialTheme.colorScheme.outline,
                                )
                            }
                        } else {
                            folderTree(
                                parentId = null,
                                depth = 0,
                                notesByFolder = notesByFolder,
                                canvasesByFolder = canvasesByFolder,
                                foldersByParent = foldersByParent,
                                expandedFolders = expandedFolders,
                                searching = searching,
                                onDeleteNote = onDeleteNote,
                                onTogglePin = onTogglePin,
                                onRenameNote = onRenameNote,
                                onMoveNote = { note ->
                                    moveTarget = MoveTarget(note.id, "note", note.vaultId, note.folderId, note.title.ifBlank { "Untitled" })
                                },
                                onOpenCanvas = onOpenCanvas,
                                onDeleteCanvas = onDeleteCanvas,
                                onToggleCanvasPin = onToggleCanvasPin,
                                onRenameCanvas = onRenameCanvas,
                                onMoveCanvas = { canvas ->
                                    moveTarget = MoveTarget(canvas.id, "canvas", canvas.vaultId, canvas.folderId, canvas.title.ifBlank { "Untitled canvas" })
                                },
                                onRenameFolder = onRenameFolder,
                                onDeleteFolder = onDeleteFolder,
                                onMoveFolder = { folder ->
                                    moveTarget = MoveTarget(
                                        folder.id, "folder", folder.vaultId, folder.parentId,
                                        folder.name.ifBlank { "Untitled folder" }, excludeFolderId = folder.id,
                                    )
                                },
                                onToggle = { id ->
                                    expandedFolders[id] = !(expandedFolders[id] == true)
                                },
                                onOpenNote = onOpenNote,
                            )

                            items(rootNotes, key = { it.id }) { note ->
                                NoteListItem(
                                    note = note,
                                    onClick = { onOpenNote(note.id) },
                                    supporting = note.updatedAt?.let { formatTimestamp(it) },
                                    onDelete = { onDeleteNote(note.id) },
                                    onTogglePin = { onTogglePin(note.id, !note.pinned) },
                                    onRename = { onRenameNote(note.id, it) },
                                    onMove = {
                                        moveTarget = MoveTarget(note.id, "note", note.vaultId, note.folderId, note.title.ifBlank { "Untitled" })
                                    },
                                )
                            }

                            items(rootCanvases, key = { it.id }) { canvas ->
                                CanvasListItem(
                                    canvas = canvas,
                                    onClick = { onOpenCanvas(canvas.id) },
                                    onDelete = { onDeleteCanvas(canvas.id) },
                                    onTogglePin = { onToggleCanvasPin(canvas.id, !canvas.pinned) },
                                    onRename = { onRenameCanvas(canvas.id, it) },
                                    onMove = {
                                        moveTarget = MoveTarget(canvas.id, "canvas", canvas.vaultId, canvas.folderId, canvas.title.ifBlank { "Untitled canvas" })
                                    },
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showNewMenu) {
        NewItemSheet(
            onDismiss = { showNewMenu = false },
            onNewNote = {
                showNewMenu = false
                onCreateNote("note", selectedVaultId, onOpenNote)
            },
            onNewQuickNote = {
                showNewMenu = false
                onCreateNote("quick", selectedVaultId, onOpenNote)
            },
            onNewCanvas = {
                showNewMenu = false
                onCreateCanvas(selectedVaultId, onOpenCanvas)
            },
            onNewFolder = {
                showNewMenu = false
                showFolderDialog = true
            },
        )
    }

    if (showFolderDialog) {
        NewFolderDialog(
            onDismiss = { showFolderDialog = false },
            onConfirm = { name ->
                showFolderDialog = false
                onCreateFolder(name, selectedVaultId)
            },
        )
    }

    moveTarget?.let { target ->
        MoveToDialog(
            itemLabel = target.label,
            currentVaultId = target.vaultId,
            currentFolderId = target.folderId,
            vaults = state.vaults,
            folders = state.folders,
            excludeFolderId = target.excludeFolderId,
            onDismiss = { moveTarget = null },
            onConfirm = { vaultId, folderId ->
                when (target.kind) {
                    "note" -> onMoveNote(target.id, vaultId, folderId)
                    "canvas" -> onMoveCanvas(target.id, vaultId, folderId)
                    "folder" -> onMoveFolder(target.id, vaultId, folderId)
                }
            },
        )
    }
}

/** Top vault row: leading tile + name + "<n> notes · synced"; tap opens the vault picker. */
@Composable
private fun VaultRow(
    vaults: List<VaultDto>,
    selectedVaultId: String?,
    noteCount: Int,
    offline: Boolean,
    onSelect: (String?) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedName = vaults.firstOrNull { it.id == selectedVaultId }?.name?.ifBlank { "Untitled vault" }
        ?: "All Vaults"

    Box {
        ListItem(
            modifier = Modifier.clickable { expanded = true },
            headlineContent = { Text(selectedName) },
            supportingContent = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    // This row claimed "synced" unconditionally, which is a lie the moment a
                    // refresh fails and the list is being served from the cache.
                    Icon(
                        if (offline) Icons.Filled.CloudOff else Icons.Filled.Sync,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = if (offline) MaterialTheme.colorScheme.onSurfaceVariant
                        else MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.width(6.dp))
                    Text("$noteCount notes · " + if (offline) "offline" else "synced")
                }
            },
            leadingContent = {
                Surface(
                    color = MaterialTheme.colorScheme.primaryContainer,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.size(40.dp),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            selectedName.take(1).uppercase(),
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            },
            trailingContent = {
                Icon(Icons.Filled.ExpandMore, contentDescription = "Switch vault")
            },
        )
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text("All Vaults") },
                onClick = {
                    expanded = false
                    onSelect(null)
                },
            )
            vaults.forEach { vault ->
                DropdownMenuItem(
                    text = { Text(vault.name.ifBlank { "Untitled vault" }) },
                    onClick = {
                        expanded = false
                        onSelect(vault.id)
                    },
                )
            }
        }
    }
}

/**
 * Recursively emits a folder and its descendants into the LazyColumn. Subfolders render
 * first, then the folder's own notes, then its canvases — each level indented one step
 * deeper. Mirrors the web sidebar's ordering (notes, then canvases, at every level).
 */
private fun LazyListScope.folderTree(
    parentId: String?,
    depth: Int,
    notesByFolder: Map<String?, List<NoteDto>>,
    canvasesByFolder: Map<String?, List<CanvasDto>>,
    foldersByParent: Map<String?, List<FolderDto>>,
    expandedFolders: Map<String, Boolean>,
    searching: Boolean,
    onToggle: (String) -> Unit,
    onOpenNote: (String) -> Unit,
    onDeleteNote: (String) -> Unit,
    onTogglePin: (id: String, pinned: Boolean) -> Unit,
    onRenameNote: (id: String, title: String) -> Unit,
    onMoveNote: (NoteDto) -> Unit,
    onOpenCanvas: (String) -> Unit,
    onDeleteCanvas: (String) -> Unit,
    onToggleCanvasPin: (id: String, pinned: Boolean) -> Unit,
    onRenameCanvas: (id: String, title: String) -> Unit,
    onMoveCanvas: (CanvasDto) -> Unit,
    onRenameFolder: (id: String, name: String) -> Unit,
    onDeleteFolder: (id: String) -> Unit,
    onMoveFolder: (FolderDto) -> Unit,
) {
    foldersByParent[parentId].orEmpty().forEach { folder ->
        // While searching, hide folders whose subtree has no matching note or canvas.
        if (searching && !subtreeHasNotes(folder.id, notesByFolder, canvasesByFolder, foldersByParent)) return@forEach
        val folderNotes = notesByFolder[folder.id].orEmpty()
        val folderCanvases = canvasesByFolder[folder.id].orEmpty()
        val expanded = searching || expandedFolders[folder.id] == true
        item("folder-${folder.id}") {
            FolderRow(
                name = folder.name,
                count = folderNotes.size + folderCanvases.size,
                expanded = expanded,
                depth = depth,
                onToggle = { onToggle(folder.id) },
                onRename = { onRenameFolder(folder.id, it) },
                onDelete = { onDeleteFolder(folder.id) },
                onMove = { onMoveFolder(folder) },
            )
        }
        if (expanded) {
            // Nested subfolders first, then this folder's notes, then its canvases.
            folderTree(
                parentId = folder.id,
                depth = depth + 1,
                notesByFolder = notesByFolder,
                canvasesByFolder = canvasesByFolder,
                foldersByParent = foldersByParent,
                expandedFolders = expandedFolders,
                searching = searching,
                onToggle = onToggle,
                onOpenNote = onOpenNote,
                onDeleteNote = onDeleteNote,
                onTogglePin = onTogglePin,
                onRenameNote = onRenameNote,
                onMoveNote = onMoveNote,
                onOpenCanvas = onOpenCanvas,
                onDeleteCanvas = onDeleteCanvas,
                onToggleCanvasPin = onToggleCanvasPin,
                onRenameCanvas = onRenameCanvas,
                onMoveCanvas = onMoveCanvas,
                onRenameFolder = onRenameFolder,
                onDeleteFolder = onDeleteFolder,
                onMoveFolder = onMoveFolder,
            )
            items(folderNotes, key = { "f-${folder.id}-${it.id}" }) { note ->
                Box(modifier = Modifier.padding(start = (24 + depth * 16).dp)) {
                    NoteListItem(
                        note = note,
                        onClick = { onOpenNote(note.id) },
                        supporting = note.updatedAt?.let { formatTimestamp(it) },
                        onDelete = { onDeleteNote(note.id) },
                        onTogglePin = { onTogglePin(note.id, !note.pinned) },
                        onRename = { onRenameNote(note.id, it) },
                        onMove = { onMoveNote(note) },
                    )
                }
            }
            items(folderCanvases, key = { "f-c-${folder.id}-${it.id}" }) { canvas ->
                Box(modifier = Modifier.padding(start = (24 + depth * 16).dp)) {
                    CanvasListItem(
                        canvas = canvas,
                        onClick = { onOpenCanvas(canvas.id) },
                        onDelete = { onDeleteCanvas(canvas.id) },
                        onTogglePin = { onToggleCanvasPin(canvas.id, !canvas.pinned) },
                        onRename = { onRenameCanvas(canvas.id, it) },
                        onMove = { onMoveCanvas(canvas) },
                    )
                }
            }
        }
    }
}

/** True if [folderId] or any descendant folder holds at least one (already-filtered) note or canvas. */
private fun subtreeHasNotes(
    folderId: String,
    notesByFolder: Map<String?, List<NoteDto>>,
    canvasesByFolder: Map<String?, List<CanvasDto>>,
    foldersByParent: Map<String?, List<FolderDto>>,
): Boolean {
    if (notesByFolder[folderId]?.isNotEmpty() == true) return true
    if (canvasesByFolder[folderId]?.isNotEmpty() == true) return true
    return foldersByParent[folderId].orEmpty().any {
        subtreeHasNotes(it.id, notesByFolder, canvasesByFolder, foldersByParent)
    }
}

/**
 * Expandable folder row: folder icon, name, item count, and a rotating expand chevron.
 * Long-press opens a Rename/Delete/Move overflow menu when any of those callbacks are
 * supplied — same convention as [com.deranjer.nodeira.ui.notes.NoteListItem].
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun FolderRow(
    name: String,
    count: Int,
    expanded: Boolean,
    depth: Int,
    onToggle: () -> Unit,
    onRename: ((String) -> Unit)? = null,
    onDelete: (() -> Unit)? = null,
    onMove: (() -> Unit)? = null,
) {
    var menuOpen by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var renaming by remember { mutableStateOf(false) }
    var renameValue by remember(name) { mutableStateOf(name) }
    val hasActions = onRename != null || onDelete != null || onMove != null
    val displayName = name.ifBlank { "Untitled folder" }

    // ListItem and its DropdownMenu must share this Box as their anchor — see the identical
    // comment in NoteListItem for why a root-level (unwrapped) item would otherwise anchor
    // its long-press menu at the screen's top-left corner.
    Box {
        ListItem(
            modifier = if (hasActions) {
                Modifier.combinedClickable(onClick = onToggle, onLongClick = { menuOpen = true })
            } else {
                Modifier.clickable(onClick = onToggle)
            }.padding(start = (depth * 16).dp),
            headlineContent = { Text(displayName) },
            supportingContent = { Text(if (count == 1) "1 item" else "$count items") },
            leadingContent = {
                Icon(
                    Icons.Filled.Folder,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                )
            },
            trailingContent = {
                Icon(
                    if (expanded) Icons.Filled.ExpandMore else Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    contentDescription = if (expanded) "Collapse" else "Expand",
                )
            },
        )

        if (hasActions) {
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                onRename?.let {
                    DropdownMenuItem(
                        text = { Text("Rename") },
                        leadingIcon = { Icon(Icons.Filled.Edit, contentDescription = null) },
                        onClick = {
                            menuOpen = false
                            renameValue = name
                            renaming = true
                        },
                    )
                }
                onMove?.let {
                    DropdownMenuItem(
                        text = { Text("Move to…") },
                        leadingIcon = {
                            Icon(Icons.AutoMirrored.Filled.DriveFileMove, contentDescription = null)
                        },
                        onClick = {
                            menuOpen = false
                            it()
                        },
                    )
                }
                onDelete?.let {
                    DropdownMenuItem(
                        text = { Text("Delete", color = MaterialTheme.colorScheme.error) },
                        leadingIcon = {
                            Icon(
                                Icons.Filled.Delete,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error,
                            )
                        },
                        onClick = {
                            menuOpen = false
                            confirmDelete = true
                        },
                    )
                }
            }
        }
    }

    if (confirmDelete && onDelete != null) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete folder?") },
            text = {
                Text("\"$displayName\" and everything inside it — subfolders, notes, and canvases — will be moved to Trash.")
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmDelete = false
                    onDelete()
                }) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = false }) { Text("Cancel") }
            },
        )
    }

    if (renaming && onRename != null) {
        AlertDialog(
            onDismissRequest = { renaming = false },
            title = { Text("Rename folder") },
            text = {
                OutlinedTextField(
                    value = renameValue,
                    onValueChange = { renameValue = it },
                    singleLine = true,
                    label = { Text("Name") },
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    renaming = false
                    onRename(renameValue)
                }) { Text("Save") }
            },
            dismissButton = {
                TextButton(onClick = { renaming = false }) { Text("Cancel") }
            },
        )
    }
}

/** Slides up from the FAB: create a note, quick note, canvas, or folder. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NewItemSheet(
    onDismiss: () -> Unit,
    onNewNote: () -> Unit,
    onNewQuickNote: () -> Unit,
    onNewCanvas: () -> Unit,
    onNewFolder: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(),
    ) {
        ListItem(
            headlineContent = { Text("New note") },
            leadingContent = { Icon(Icons.AutoMirrored.Filled.NoteAdd, contentDescription = null) },
            modifier = Modifier.clickable(onClick = onNewNote),
        )
        ListItem(
            headlineContent = { Text("New quick note") },
            leadingContent = { Icon(Icons.Filled.Bolt, contentDescription = null) },
            modifier = Modifier.clickable(onClick = onNewQuickNote),
        )
        ListItem(
            headlineContent = { Text("New canvas") },
            leadingContent = { Icon(Icons.Filled.Dashboard, contentDescription = null) },
            modifier = Modifier.clickable(onClick = onNewCanvas),
        )
        ListItem(
            headlineContent = { Text("New folder") },
            leadingContent = { Icon(Icons.Filled.CreateNewFolder, contentDescription = null) },
            modifier = Modifier.clickable(onClick = onNewFolder),
        )
    }
}

@Composable
private fun NewFolderDialog(onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var name by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New folder") },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Name") },
                singleLine = true,
            )
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(name) },
                enabled = name.isNotBlank(),
            ) { Text("Create") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
