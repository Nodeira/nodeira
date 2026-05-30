import type { NoteMetadata } from '@nodeira/shared-types';
import { Feather } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';

import { api } from '@/lib/api';

interface Props {
  note: NoteMetadata | null;
  onClose: () => void;
  onEdit: (note: NoteMetadata) => void;
}

export function NoteContextMenu({ note, onClose, onEdit }: Props) {
  const qc = useQueryClient();
  const dark = useColorScheme() === 'dark';
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const bg = dark ? '#1a1b1e' : '#ffffff';
  const bgSubtle = dark ? '#25262b' : '#f8f9fa';
  const border = dark ? '#373a40' : '#e9ecef';
  const textColor = dark ? '#c1c2c5' : '#212529';
  const textMute = '#868e96';

  useEffect(() => {
    if (!note) setRenaming(false);
  }, [note]);

  const deleteNote = useMutation({
    mutationFn: (id: string) => api.delete(`/notes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      onClose();
    },
  });

  const pinNote = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      api.patch(`/notes/${id}`, { pinned }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      onClose();
    },
  });

  const renameNote = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.patch(`/notes/${id}`, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      setRenaming(false);
      onClose();
    },
  });

  function handleDelete() {
    if (!note) return;
    Alert.alert('Delete Note', `Delete "${note.title || 'Untitled'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteNote.mutate(note.id),
      },
    ]);
  }

  function handleRenameSubmit() {
    if (!note || !newTitle.trim()) return;
    renameNote.mutate({ id: note.id, title: newTitle.trim() });
  }

  const menuAction = (
    icon: React.ComponentProps<typeof Feather>['name'],
    label: string,
    onPress: () => void,
    color = textColor,
    disabled = false,
  ) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 14,
        borderBottomWidth: 1,
        borderBottomColor: border,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Feather name={icon} size={18} color={color} />
      <Text style={{ fontSize: 15, color }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal
      visible={note !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: bg,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: 40,
          }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: border,
              alignSelf: 'center',
              marginTop: 12,
              marginBottom: 16,
            }}
          />

          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: textColor,
              paddingHorizontal: 20,
              paddingBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: border,
            }}
            numberOfLines={1}
          >
            {note?.title || 'Untitled'}
          </Text>

          {renaming ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 10 }}>
              <TextInput
                autoFocus
                value={newTitle}
                onChangeText={setNewTitle}
                returnKeyType="done"
                onSubmitEditing={handleRenameSubmit}
                style={{
                  height: 42,
                  borderWidth: 1,
                  borderColor: '#4263eb',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  fontSize: 15,
                  color: textColor,
                  backgroundColor: bgSubtle,
                }}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => setRenaming(false)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: border,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 14, color: textMute }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleRenameSubmit}
                  disabled={!newTitle.trim() || renameNote.isPending}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: newTitle.trim() ? '#4263eb' : bgSubtle,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: newTitle.trim() ? '#fff' : textMute,
                    }}
                  >
                    {renameNote.isPending ? 'Saving…' : 'Save'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {menuAction('edit-2', 'Edit', () => note && onEdit(note))}
              {menuAction(
                'type',
                'Rename',
                () => {
                  setNewTitle(note?.title || '');
                  setRenaming(true);
                },
              )}
              {menuAction(
                'map-pin',
                note?.pinned ? 'Unpin' : 'Pin',
                () => note && pinNote.mutate({ id: note.id, pinned: !note.pinned }),
                '#4263eb',
                pinNote.isPending,
              )}
              <Pressable
                onPress={handleDelete}
                disabled={deleteNote.isPending}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  gap: 14,
                  opacity: deleteNote.isPending ? 0.5 : 1,
                }}
              >
                <Feather name="trash-2" size={18} color="#e03131" />
                <Text style={{ fontSize: 15, color: '#e03131' }}>Delete</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
