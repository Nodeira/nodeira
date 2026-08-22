package com.deranjer.nodeira.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.deranjer.nodeira.data.net.FolderDto
import com.deranjer.nodeira.data.net.VaultDto

/**
 * Shared "move to vault/folder" dialog for notes, canvases, and folders. A flat vault
 * picker then a folder picker (scoped to the chosen vault), folders labeled with a full
 * "Parent / Child" breadcrumb so nested folders are distinguishable in the flat list —
 * mirrors `apps/web/src/components/modals/MoveItemModal.tsx`.
 */
@Composable
fun MoveToDialog(
    itemLabel: String,
    currentVaultId: String?,
    currentFolderId: String?,
    vaults: List<VaultDto>,
    folders: List<FolderDto>,
    /** Folder-move only: hides this folder and all its descendants, so a folder can't be moved into itself. */
    excludeFolderId: String? = null,
    onDismiss: () -> Unit,
    onConfirm: (vaultId: String?, folderId: String?) -> Unit,
) {
    var selectedVaultId by remember { mutableStateOf(currentVaultId) }
    var selectedFolderId by remember { mutableStateOf(currentFolderId) }

    val excludedIds = remember(excludeFolderId, folders) {
        if (excludeFolderId == null) emptySet() else collectDescendantIds(excludeFolderId, folders) + excludeFolderId
    }

    val vaultOptions = listOf<Pair<String?, String>>(null to "No vault") +
        vaults.map { it.id to it.name.ifBlank { "Untitled vault" } }
    val folderOptions = listOf<Pair<String?, String>>(null to "No folder") +
        folders.filter { it.vaultId == selectedVaultId && it.id !in excludedIds }
            .sortedBy { it.name.lowercase() }
            .map { it.id to folderPath(it, folders) }

    val vaultLabel = vaults.firstOrNull { it.id == selectedVaultId }?.name?.ifBlank { "Untitled vault" } ?: "No vault"
    val folderLabel = folders.firstOrNull { it.id == selectedFolderId }
        ?.let { folderPath(it, folders) } ?: "No folder"

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Move \"$itemLabel\"") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                PickerField(
                    label = "Vault",
                    valueLabel = vaultLabel,
                    options = vaultOptions,
                    onSelect = { id ->
                        selectedVaultId = id
                        selectedFolderId = null
                    },
                )
                PickerField(
                    label = "Folder",
                    valueLabel = folderLabel,
                    options = folderOptions,
                    onSelect = { id -> selectedFolderId = id },
                )
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onConfirm(selectedVaultId, selectedFolderId)
                onDismiss()
            }) { Text("Move") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

/** Tap-to-open combo box: a labeled summary button whose tap reveals a [DropdownMenu] of options. */
@Composable
private fun PickerField(
    label: String,
    valueLabel: String,
    options: List<Pair<String?, String>>,
    onSelect: (String?) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        // The trigger button and its DropdownMenu must share this Box as their anchor —
        // see the identical comment in NoteListItem for why.
        Box {
            OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(valueLabel, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Icon(Icons.Filled.ExpandMore, contentDescription = null)
                }
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                options.forEach { (id, text) ->
                    DropdownMenuItem(
                        text = { Text(text) },
                        onClick = {
                            expanded = false
                            onSelect(id)
                        },
                    )
                }
            }
        }
    }
}

/** Walks [FolderDto.parentId] up through [all] to build a "Parent / Child" breadcrumb. */
private fun folderPath(folder: FolderDto, all: List<FolderDto>): String {
    val parts = mutableListOf(folder.name.ifBlank { "Untitled folder" })
    val seen = mutableSetOf(folder.id)
    var parentId = folder.parentId
    while (parentId != null && parentId !in seen) {
        seen += parentId
        val parent = all.find { it.id == parentId } ?: break
        parts.add(0, parent.name.ifBlank { "Untitled folder" })
        parentId = parent.parentId
    }
    return parts.joinToString(" / ")
}

/** DFS over [folders] for every descendant of [rootId] — used to keep a folder out of its own move targets. */
private fun collectDescendantIds(rootId: String, folders: List<FolderDto>): Set<String> {
    val result = mutableSetOf<String>()
    fun walk(id: String) {
        folders.filter { it.parentId == id }.forEach { child ->
            result += child.id
            walk(child.id)
        }
    }
    walk(rootId)
    return result
}
