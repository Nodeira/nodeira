package com.deranjer.nodeira.ui.home

import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.NoteAdd
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CreateNewFolder
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
import com.deranjer.nodeira.data.net.FolderDto
import com.deranjer.nodeira.data.net.NoteDto
import com.deranjer.nodeira.data.net.VaultDto
import com.deranjer.nodeira.ui.components.BrandSearchBar
import com.deranjer.nodeira.ui.components.NBadge
import com.deranjer.nodeira.ui.components.SectionLabel
import com.deranjer.nodeira.ui.nav.AppDestination
import com.deranjer.nodeira.ui.nav.AppScaffold
import com.deranjer.nodeira.ui.notes.NoteListItem
import com.deranjer.nodeira.ui.notes.NotesUiState
import com.deranjer.nodeira.ui.notes.formatTimestamp

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
) {
    var query by remember { mutableStateOf("") }
    var selectedVaultId by remember { mutableStateOf<String?>(null) }
    var showNewMenu by remember { mutableStateOf(false) }
    var showFolderDialog by remember { mutableStateOf(false) }
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
                    val scopedFolders = state.folders.filter { selectedVaultId == null || it.vaultId == selectedVaultId }
                    val visible = scoped.filter { query.isBlank() || it.title.contains(query, ignoreCase = true) }
                    val searching = query.isNotBlank()

                    val pinned = visible.filter { it.pinned }
                    val notesByFolder = visible.groupBy { it.folderId }
                    val rootNotes = notesByFolder[null].orEmpty()
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
                        item("vault") {
                            VaultRow(
                                vaults = state.vaults,
                                selectedVaultId = selectedVaultId,
                                noteCount = scoped.size,
                                onSelect = { selectedVaultId = it },
                            )
                        }

                        if (pinned.isNotEmpty()) {
                            item("pinned-label") { SectionLabel("Pinned") }
                            items(pinned, key = { "pin-${it.id}" }) { note ->
                                NoteListItem(
                                    note = note,
                                    onClick = { onOpenNote(note.id) },
                                    showPinTrailing = true,
                                    onDelete = { onDeleteNote(note.id) },
                                    onTogglePin = { onTogglePin(note.id, !note.pinned) },
                                    onRename = { onRenameNote(note.id, it) },
                                )
                            }
                        }

                        item("files-label") { SectionLabel("Files") }

                        val anyFolderVisible = rootFolders.any {
                            !searching || subtreeHasNotes(it.id, notesByFolder, foldersByParent)
                        }
                        if (!anyFolderVisible && rootNotes.isEmpty()) {
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
                                foldersByParent = foldersByParent,
                                expandedFolders = expandedFolders,
                                searching = searching,
                                onDeleteNote = onDeleteNote,
                                onTogglePin = onTogglePin,
                                onRenameNote = onRenameNote,
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
}

/** Top vault row: leading tile + name + "<n> notes · synced"; tap opens the vault picker. */
@Composable
private fun VaultRow(
    vaults: List<VaultDto>,
    selectedVaultId: String?,
    noteCount: Int,
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
                    Icon(
                        Icons.Filled.Sync,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.width(6.dp))
                    Text("$noteCount notes · synced")
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
 * before the folder's own notes, each level indented one step deeper.
 */
private fun LazyListScope.folderTree(
    parentId: String?,
    depth: Int,
    notesByFolder: Map<String?, List<NoteDto>>,
    foldersByParent: Map<String?, List<FolderDto>>,
    expandedFolders: Map<String, Boolean>,
    searching: Boolean,
    onToggle: (String) -> Unit,
    onOpenNote: (String) -> Unit,
    onDeleteNote: (String) -> Unit,
    onTogglePin: (id: String, pinned: Boolean) -> Unit,
    onRenameNote: (id: String, title: String) -> Unit,
) {
    foldersByParent[parentId].orEmpty().forEach { folder ->
        // While searching, hide folders whose subtree has no matching note.
        if (searching && !subtreeHasNotes(folder.id, notesByFolder, foldersByParent)) return@forEach
        val folderNotes = notesByFolder[folder.id].orEmpty()
        val expanded = searching || expandedFolders[folder.id] == true
        item("folder-${folder.id}") {
            FolderRow(
                name = folder.name,
                count = folderNotes.size,
                expanded = expanded,
                depth = depth,
                onToggle = { onToggle(folder.id) },
            )
        }
        if (expanded) {
            // Nested subfolders first, then this folder's notes.
            folderTree(
                parentId = folder.id,
                depth = depth + 1,
                notesByFolder = notesByFolder,
                foldersByParent = foldersByParent,
                expandedFolders = expandedFolders,
                searching = searching,
                onToggle = onToggle,
                onOpenNote = onOpenNote,
                onDeleteNote = onDeleteNote,
                onTogglePin = onTogglePin,
                onRenameNote = onRenameNote,
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
                    )
                }
            }
        }
    }
}

/** True if [folderId] or any descendant folder holds at least one (already-filtered) note. */
private fun subtreeHasNotes(
    folderId: String,
    notesByFolder: Map<String?, List<NoteDto>>,
    foldersByParent: Map<String?, List<FolderDto>>,
): Boolean {
    if (notesByFolder[folderId]?.isNotEmpty() == true) return true
    return foldersByParent[folderId].orEmpty().any {
        subtreeHasNotes(it.id, notesByFolder, foldersByParent)
    }
}

/** Expandable folder row: folder icon, name, note count, and a rotating expand chevron. */
@Composable
private fun FolderRow(name: String, count: Int, expanded: Boolean, depth: Int, onToggle: () -> Unit) {
    ListItem(
        modifier = Modifier.clickable(onClick = onToggle).padding(start = (depth * 16).dp),
        headlineContent = { Text(name.ifBlank { "Untitled folder" }) },
        supportingContent = { Text("$count notes") },
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
}

/** Slides up from the FAB: create a note, quick note, or folder. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NewItemSheet(
    onDismiss: () -> Unit,
    onNewNote: () -> Unit,
    onNewQuickNote: () -> Unit,
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
