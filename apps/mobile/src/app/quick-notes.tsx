import type { NoteMetadata } from '@nodeira/shared-types';
import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';

import { TopBar } from '@/components/TopBar';
import { api } from '@/lib/api';

const CARD_GAP = 6;
const GRID_PADDING = 16;

export default function QuickNotesScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const dark = useColorScheme() === 'dark';
  const { vaultId, search } = useLocalSearchParams<{ vaultId?: string; search?: string }>();
  const stableVaultId = useRef(vaultId ?? null).current;
  const [searchText, setSearchText] = useState('');

  const bg = dark ? '#1a1b1e' : '#ffffff';
  const bgSubtle = dark ? '#25262b' : '#f8f9fa';
  const border = dark ? '#373a40' : '#e9ecef';
  const textColor = dark ? '#c1c2c5' : '#212529';
  const textMute = '#868e96';
  const cardBg = dark ? '#25262b' : '#f8f9fa';
  const pinnedCardBg = dark ? '#1e2340' : '#edf2ff';

  const { data: notes, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['notes', stableVaultId],
    queryFn: () =>
      api.get<NoteMetadata[]>(stableVaultId ? `/notes?vaultId=${stableVaultId}` : '/notes'),
  });

  const createNote = useMutation({
    mutationFn: () =>
      api.post<NoteMetadata>('/notes', {
        title: 'Untitled',
        type: 'quick',
        ...(stableVaultId ? { vaultId: stableVaultId } : {}),
      }),
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      router.push(`/note/${note.id}?title=${encodeURIComponent(note.title)}&type=quick`);
    },
  });

  function formatDate(d: Date | string) {
    return new Date(d).toLocaleDateString();
  }

  const quickNotes = (notes ?? []).filter((n) => n.type === 'quick');
  const query = searchText.trim().toLowerCase();
  const matched = query
    ? quickNotes.filter((n) => (n.title || 'Untitled').toLowerCase().includes(query))
    : quickNotes;

  const pinned = matched.filter((n) => n.pinned);
  const unpinned = matched.filter((n) => !n.pinned);

  function renderCard(n: NoteMetadata) {
    return (
      <Pressable
        key={n.id}
        onPress={() => router.push(`/note/${n.id}?title=${encodeURIComponent(n.title)}`)}
        style={{ width: '50%', padding: CARD_GAP / 2 }}
      >
        <View
          style={{
            backgroundColor: n.pinned ? pinnedCardBg : cardBg,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: n.pinned ? '#4263eb' : border,
            padding: 12,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: n.pinned ? '#4263eb' : textColor,
              marginBottom: n.preview ? 5 : 0,
            }}
            numberOfLines={2}
          >
            {n.title || 'Untitled'}
          </Text>

          {!!n.preview && (
            <Text
              style={{ fontSize: 12, color: textMute, lineHeight: 17, marginBottom: 8 }}
              numberOfLines={6}
            >
              {n.preview}
            </Text>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 }}>
            <Text style={{ fontSize: 10, color: textMute, flex: 1 }}>
              {formatDate(n.updatedAt)}
            </Text>
            {n.pinned && <Feather name="map-pin" size={10} color="#4263eb" />}
          </View>
        </View>
      </Pressable>
    );
  }

  function renderGrid(noteList: NoteMetadata[]) {
    return (
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingHorizontal: GRID_PADDING - CARD_GAP / 2,
        }}
      >
        {noteList.map(renderCard)}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <TopBar title="Quick Notes" onBack={() => router.back()} />

      {/* Search bar */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: border,
          backgroundColor: bg,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: searchText ? '#4263eb' : border,
            backgroundColor: bgSubtle,
          }}
        >
          <Feather name="search" size={15} color={searchText ? '#4263eb' : textMute} />
          <TextInput
            autoFocus={!!search}
            placeholder="Search quick notes…"
            placeholderTextColor={textMute}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            clearButtonMode="never"
            style={{ flex: 1, fontSize: 14, color: textColor, padding: 0 }}
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => setSearchText('')} hitSlop={8}>
              <Feather name="x-circle" size={15} color={textMute} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Toolbar: note count + new button */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: border,
          backgroundColor: bgSubtle,
        }}
      >
        <Text style={{ fontSize: 12, color: textMute, flex: 1 }}>
          {query
            ? `${matched.length} of ${quickNotes.length}`
            : `${quickNotes.length} ${quickNotes.length === 1 ? 'note' : 'notes'}`}
        </Text>
        <Pressable
          onPress={() => createNote.mutate()}
          disabled={createNote.isPending}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 6,
            backgroundColor: '#4263eb',
          }}
        >
          <Feather name="plus" size={13} color="#fff" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>New</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#4263eb" />
        </View>
      ) : matched.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          {query ? (
            <>
              <Feather name="search" size={28} color={textMute} />
              <Text style={{ fontSize: 14, color: textMute }}>
                No quick notes match &quot;{searchText}&quot;
              </Text>
            </>
          ) : (
            <>
              <Feather name="zap" size={28} color={textMute} />
              <Text style={{ fontSize: 14, color: textMute }}>No quick notes yet</Text>
              <Pressable
                onPress={() => createNote.mutate()}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: '#4263eb',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                  Create your first
                </Text>
              </Pressable>
            </>
          )}
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 10, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#4263eb"
              colors={['#4263eb']}
            />
          }
        >
          {pinned.length > 0 && (
            <>
              <Text
                style={{
                  paddingHorizontal: 22,
                  paddingBottom: 8,
                  fontSize: 11,
                  color: textMute,
                  textTransform: 'uppercase',
                  letterSpacing: 0.7,
                  fontWeight: '600',
                }}
              >
                Pinned
              </Text>
              {renderGrid(pinned)}
              {unpinned.length > 0 && (
                <View
                  style={{
                    marginHorizontal: 16,
                    marginTop: 14,
                    marginBottom: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: border,
                  }}
                />
              )}
            </>
          )}
          {unpinned.length > 0 && (
            <>
              {pinned.length > 0 && (
                <Text
                  style={{
                    paddingHorizontal: 22,
                    paddingTop: 12,
                    paddingBottom: 8,
                    fontSize: 11,
                    color: textMute,
                    textTransform: 'uppercase',
                    letterSpacing: 0.7,
                    fontWeight: '600',
                  }}
                >
                  Notes
                </Text>
              )}
              {renderGrid(unpinned)}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
