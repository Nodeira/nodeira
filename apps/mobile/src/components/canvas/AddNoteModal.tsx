import type { NoteMetadata } from '@nodeira/shared-types';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (note: NoteMetadata) => void;
}

export function AddNoteModal({ visible, onClose, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const dark = useColorScheme() === 'dark';
  const bg = dark ? '#1a1b1e' : '#ffffff';
  const bgSubtle = dark ? '#25262b' : '#f8f9fa';
  const textColor = dark ? '#c1c2c5' : '#212529';
  const textMute = '#868e96';
  const border = dark ? '#373a40' : '#e9ecef';

  const { data: notes, isLoading } = useQuery<NoteMetadata[]>({
    queryKey: ['notes'],
    queryFn: () => api.get<NoteMetadata[]>('/notes'),
    enabled: visible,
  });

  const filtered = notes?.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()),
  ) ?? [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: border, gap: 12 }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search notes…"
            placeholderTextColor={textMute}
            autoFocus
            style={{ flex: 1, fontSize: 15, color: textColor, backgroundColor: bgSubtle, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}
          />
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={{ fontSize: 15, color: '#4263eb', fontWeight: '500' }}>Cancel</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#4263eb" />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(n) => n.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { onSelect(item); setSearch(''); }}
                style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: border }}
              >
                <Text style={{ fontSize: 15, color: textColor }}>{item.title || 'Untitled'}</Text>
                <Text style={{ fontSize: 12, color: textMute, marginTop: 2 }}>
                  {new Date(item.updatedAt).toLocaleDateString()}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: textMute }}>No notes found</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
