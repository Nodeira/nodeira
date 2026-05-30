import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getApiUrl, getStartupView, saveServerUrl, saveStartupView } from '@/lib/config';

const STARTUP_VIEW_OPTIONS = [
  { value: 'home', label: 'Home', description: 'The main home screen' },
  { value: 'quick-notes', label: 'Quick Notes', description: 'Your quick-capture notes' },
  { value: 'recents', label: 'Recents', description: 'Recently edited notes' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  const bg = dark ? '#1a1b1e' : '#ffffff';
  const bgCard = dark ? '#25262b' : '#f8f9fa';
  const border = dark ? '#373a40' : '#e9ecef';
  const text = dark ? '#c1c2c5' : '#212529';
  const textMute = '#868e96';
  const accent = '#4263eb';

  const [startupView, setStartupView] = useState('home');
  const [serverUrl, setServerUrl] = useState('');

  useEffect(() => {
    getStartupView().then(setStartupView);
    setServerUrl(getApiUrl());
  }, []);

  async function handleSelect(value: string) {
    setStartupView(value);
    await saveStartupView(value);
  }

  async function handleSaveServerUrl() {
    const trimmed = serverUrl.trim();
    if (!trimmed) return;
    await saveServerUrl(trimmed);
    Alert.alert('Saved', 'Server URL updated. Restart the app to reconnect.');
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingTop: insets.top + 8,
          paddingBottom: 8,
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: border,
          backgroundColor: bg,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={18} color={accent} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: '600', color: text, flex: 1 }}>Settings</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 8 }}>
        {/* Startup View section */}
        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            color: textMute,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginBottom: 6,
            marginTop: 8,
          }}
        >
          Startup View
        </Text>
        <Text style={{ fontSize: 13, color: textMute, marginBottom: 12 }}>
          Which screen opens when you launch the app.
        </Text>

        <View style={{ borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: border }}>
          {STARTUP_VIEW_OPTIONS.map((opt, i) => (
            <Pressable
              key={opt.value}
              onPress={() => handleSelect(opt.value)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 12,
                backgroundColor: pressed ? bgCard : bg,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: border,
                gap: 12,
              })}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: text }}>{opt.label}</Text>
                <Text style={{ fontSize: 12, color: textMute, marginTop: 2 }}>{opt.description}</Text>
              </View>
              {startupView === opt.value && (
                <Feather name="check" size={16} color={accent} />
              )}
            </Pressable>
          ))}
        </View>

        {/* Server URL section */}
        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            color: textMute,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginBottom: 6,
            marginTop: 20,
          }}
        >
          Server
        </Text>
        <Text style={{ fontSize: 13, color: textMute, marginBottom: 12 }}>
          The URL of your Nodeira server. Use your machine&apos;s local IP when connecting from a physical device (e.g. http://192.168.1.x:3001).
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 10,
            borderWidth: 1,
            borderColor: border,
            overflow: 'hidden',
          }}
        >
          <TextInput
            style={{
              flex: 1,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 14,
              color: text,
              backgroundColor: bg,
            }}
            placeholder="http://192.168.1.x:3001"
            placeholderTextColor={textMute}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={serverUrl}
            onChangeText={setServerUrl}
          />
          <Pressable
            onPress={handleSaveServerUrl}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              paddingVertical: 12,
              backgroundColor: pressed ? accent + 'cc' : accent,
            })}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Save</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
