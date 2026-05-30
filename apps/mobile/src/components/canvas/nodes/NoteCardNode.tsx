import type { FileCanvasNode } from '@nodeira/shared-types';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View, useColorScheme } from 'react-native';
import { api } from '@/lib/api';
import type { NoteMetadata } from '@nodeira/shared-types';

interface Props {
  node: FileCanvasNode;
}

export function NoteCardNode({ node }: Props) {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const bg = dark ? '#25262b' : '#ffffff';
  const textColor = dark ? '#c1c2c5' : '#212529';
  const textMute = '#868e96';
  const border = dark ? '#373a40' : '#e9ecef';

  const { data: note, isError } = useQuery<NoteMetadata>({
    queryKey: ['notes', node.file],
    queryFn: () => api.get<NoteMetadata>(`/notes/${node.file}`),
    enabled: !!node.file,
  });

  const { data: content } = useQuery<string>({
    queryKey: ['notes', node.file, 'content'],
    queryFn: async () => {
      const res = await api.get<{ content: string }>(`/notes/${node.file}/content`);
      return typeof res === 'string' ? res : (res as { content: string }).content ?? '';
    },
    enabled: !!node.file && !isError,
  });

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: 8, padding: 8, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 13, color: '#e03131', textDecorationLine: 'line-through' }}>Note deleted</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => note && router.push(`/note/${note.id}?title=${encodeURIComponent(note.title)}&type=${note.type ?? 'note'}`)}
      style={{ flex: 1, backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: 8, padding: 8 }}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: textColor, marginBottom: 4 }} numberOfLines={1}>
        {note?.title ?? 'Loading…'}
      </Text>
      <ScrollView style={{ flex: 1 }} scrollEnabled={false}>
        <Text style={{ fontSize: 11, color: textMute }}>
          {content ?? ''}
        </Text>
      </ScrollView>
    </Pressable>
  );
}
