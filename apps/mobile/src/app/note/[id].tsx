import type * as Y from 'yjs';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as ImagePicker from 'expo-image-picker';

import { FormattingToolbar } from '@/components/FormattingToolbar';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { api, uploadImage } from '@/lib/api';
import { getApiUrl } from '@/lib/config';
import { applyMarkdownToXmlFragment, xmlFragmentToMarkdown } from '@/lib/yjsMarkdown';
import { getYjsContext } from '@/providers/YjsProvider';

function deriveTitle(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'Untitled';
  return words.slice(0, 5).join(' ').slice(0, 40);
}

export default function NoteEditorScreen() {
  const { id, title: titleParam, type } = useLocalSearchParams<{
    id: string;
    title?: string;
    type?: string;
  }>();
  const router = useRouter();
  const dark = useColorScheme() === 'dark';

  const bg = dark ? '#1a1b1e' : '#ffffff';
  const bgSubtle = dark ? '#25262b' : '#f8f9fa';
  const border = dark ? '#373a40' : '#e9ecef';
  const textColor = dark ? '#c1c2c5' : '#212529';
  const textDim = dark ? '#868e96' : '#495057';

  const insets = useSafeAreaInsets();
  const initialTitle = titleParam ? decodeURIComponent(titleParam) : 'Untitled';

  const [titleValue, setTitleValue] = useState(initialTitle);
  const [content, setContent] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const yFragRef = useRef<Y.XmlFragment | null>(null);
  const autoTitleDoneRef = useRef(initialTitle !== 'Untitled');
  const autoTitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionRef = useRef({ start: 0, end: 0 });

  useEffect(() => {
    if (!id) return;
    const { doc } = getYjsContext(id);
    const frag = doc.getXmlFragment('default');
    yFragRef.current = frag;
    setContent(xmlFragmentToMarkdown(frag));

    const observer = () => {
      const text = xmlFragmentToMarkdown(frag);
      setContent(text);

      if (type === 'quick' && !autoTitleDoneRef.current) {
        const derived = deriveTitle(text);
        if (derived !== 'Untitled') {
          autoTitleDoneRef.current = true;
          setTitleValue(derived);
          if (autoTitleTimerRef.current) clearTimeout(autoTitleTimerRef.current);
          autoTitleTimerRef.current = setTimeout(() => {
            void api.patch(`/notes/${id}`, { title: derived });
          }, 800);
        }
      }
    };
    frag.observe(observer);
    return () => {
      frag.unobserve(observer);
      if (autoTitleTimerRef.current) clearTimeout(autoTitleTimerRef.current);
    };
  }, [id, type]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  function handleChange(text: string) {
    const frag = yFragRef.current;
    if (!frag) return;
    if (text === xmlFragmentToMarkdown(frag)) return;
    frag.doc!.transact(() => {
      applyMarkdownToXmlFragment(frag, text);
    });
    setContent(text);
  }

  function insertAtCursor(text: string) {
    const { start, end } = selectionRef.current;
    const newContent = content.slice(0, start) + text + content.slice(end);
    handleChange(newContent);
  }

  async function handleToolbarAction(actionId: string) {
    if (actionId === 'photo' || actionId === 'camera') {
      let result: ImagePicker.ImagePickerResult;
      if (actionId === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
      }
      if (result.canceled || !result.assets[0]) return;
      setIsUploading(true);
      try {
        const { url } = await uploadImage(result.assets[0].uri);
        const fullUrl = url.startsWith('http') ? url : `${getApiUrl()}${url}`;
        insertAtCursor(`![image](${fullUrl})\n`);
      } finally {
        setIsUploading(false);
      }
    }
  }

  function saveTitle(val: string) {
    const trimmed = val.trim() || 'Untitled';
    setTitleValue(trimmed);
    autoTitleDoneRef.current = trimmed !== 'Untitled';
    void api.patch(`/notes/${id}`, { title: trimmed });
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Tab strip */}
      <View
        style={{
          paddingHorizontal: 6,
          paddingTop: insets.top + 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: bgSubtle,
          borderBottomWidth: 1,
          borderBottomColor: border,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 4,
          }}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={18} color="#4263eb" />
        </Pressable>

        {/* Active tab */}
        <View
          style={{
            paddingHorizontal: 10,
            paddingTop: 6,
            paddingBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: bg,
            borderTopLeftRadius: 6,
            borderTopRightRadius: 6,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderTopWidth: 2,
            borderLeftColor: border,
            borderRightColor: border,
            borderTopColor: '#4263eb',
            marginBottom: -1,
          }}
        >
          <Feather name={type === 'quick' ? 'zap' : 'file-text'} size={13} color="#4263eb" />
          <Text style={{ fontSize: 13, fontWeight: '500', color: '#4263eb' }} numberOfLines={1}>
            {titleValue}
          </Text>
          <Pressable onPress={() => router.back()} hitSlop={6}>
            <Feather name="x" size={13} color={textDim} />
          </Pressable>
        </View>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={() => {
            if (isEditing) Keyboard.dismiss();
            setIsEditing((v) => !v);
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 6,
            backgroundColor: isEditing ? '#4263eb' : bgSubtle,
            borderWidth: 1,
            borderColor: isEditing ? '#4263eb' : border,
            marginBottom: 4,
          }}
          hitSlop={8}
        >
          <Feather name={isEditing ? 'check' : 'edit-2'} size={13} color={isEditing ? '#fff' : textDim} />
          <Text style={{ fontSize: 12, fontWeight: '500', color: isEditing ? '#fff' : textDim }}>
            {isEditing ? 'Done' : 'Edit'}
          </Text>
        </Pressable>
      </View>

      {/* View mode */}
      {!isEditing && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 80 }}
        >
          <Text
            style={{
              fontSize: 26,
              fontWeight: '700',
              letterSpacing: -0.4,
              color: textColor,
              marginBottom: 16,
            }}
          >
            {titleValue}
          </Text>
          <MarkdownRenderer content={content} />
        </ScrollView>
      )}

      {/* Edit mode */}
      {isEditing && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 80 }}
            keyboardShouldPersistTaps="handled"
          >
            <TextInput
              value={titleValue}
              onChangeText={setTitleValue}
              onFocus={() => setIsTitleFocused(true)}
              onBlur={() => {
                setIsTitleFocused(false);
                saveTitle(titleValue);
              }}
              onSubmitEditing={() => saveTitle(titleValue)}
              placeholder="Untitled"
              placeholderTextColor={textDim}
              style={{
                fontSize: 26,
                fontWeight: '700',
                letterSpacing: -0.4,
                color: textColor,
                marginBottom: isTitleFocused ? 8 : 20,
                padding: 0,
                borderBottomWidth: isTitleFocused ? 1 : 0,
                borderBottomColor: '#4263eb',
              }}
            />
            <TextInput
              style={{
                fontSize: 15,
                lineHeight: 24,
                color: textColor,
                minHeight: 200,
                opacity: isUploading ? 0.5 : 1,
              }}
              multiline
              value={content}
              onChangeText={handleChange}
              onSelectionChange={(e) => {
                selectionRef.current = e.nativeEvent.selection;
              }}
              placeholder="Start writing…"
              placeholderTextColor={textDim}
              textAlignVertical="top"
            />
          </ScrollView>

          {isKeyboardVisible && <FormattingToolbar onAction={handleToolbarAction} />}
        </KeyboardAvoidingView>
      )}

      {/* Floating actions — view mode only */}
      {!isEditing && !isKeyboardVisible && (
        <>
          <Pressable
            style={{
              position: 'absolute',
              right: 16,
              bottom: 90,
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: '#4263eb',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#4263eb',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <Feather name="star" size={22} color="#fff" />
          </Pressable>
          <View
            style={{
              position: 'absolute',
              right: 14,
              bottom: 30,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#36b67a',
              borderWidth: 2,
              borderColor: bg,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text style={{ fontSize: 18 }}>🏝️</Text>
          </View>
        </>
      )}
    </View>
  );
}
