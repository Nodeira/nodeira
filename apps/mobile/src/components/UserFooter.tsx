import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View, useColorScheme } from 'react-native';

import { clearToken, getUserEmail } from '@/lib/auth';

export function UserFooter() {
  const dark = useColorScheme() === 'dark';
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    getUserEmail().then(setEmail);
  }, []);

  const initials = email ? email[0].toUpperCase() : '?';
  const displayName = email ?? 'Account';

  async function handleLogout() {
    await clearToken();
    router.replace('/login');
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 28,
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: dark ? '#373a40' : '#e9ecef',
        backgroundColor: dark ? '#1a1b1e' : '#ffffff',
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: '#5c7cfa',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{initials}</Text>
      </View>
      <Text
        style={{ flex: 1, fontSize: 14, color: dark ? '#c1c2c5' : '#212529' }}
        numberOfLines={1}
      >
        {displayName}
      </Text>
      <Pressable
        style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
        hitSlop={8}
      >
        <Feather name="settings" size={14} color="#868e96" />
      </Pressable>
      <Pressable
        onPress={handleLogout}
        style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
        hitSlop={8}
      >
        <Feather name="log-out" size={14} color="#868e96" />
      </Pressable>
    </View>
  );
}
