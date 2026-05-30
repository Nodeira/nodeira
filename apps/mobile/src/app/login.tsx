import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { saveToken, saveUserEmail } from '@/lib/auth';
import { getApiUrl, saveServerUrl } from '@/lib/config';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setServerUrl(getApiUrl());
  }, []);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      await saveServerUrl(serverUrl);
      const res = await fetch(`${getApiUrl()}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError('Invalid email or password');
        return;
      }
      const data = await res.json() as { access_token: string };
      await saveToken(data.access_token);
      await saveUserEmail(email);
      router.replace('/');
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 justify-center bg-zinc-100 dark:bg-zinc-950 px-6"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="bg-white dark:bg-zinc-900 rounded-2xl p-6 gap-3">
        <Text className="text-3xl font-bold text-center text-zinc-900 dark:text-zinc-100 mb-2">
          Nodeira
        </Text>
        <TextInput
          className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-3 text-base text-zinc-900 dark:text-zinc-100 dark:bg-zinc-800"
          placeholder="Email"
          placeholderTextColor="#71717a"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <View className="flex-row items-center border border-zinc-300 dark:border-zinc-700 rounded-lg dark:bg-zinc-800">
          <TextInput
            className="flex-1 px-3 py-3 text-base text-zinc-900 dark:text-zinc-100"
            placeholder="Password"
            placeholderTextColor="#71717a"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <Pressable
            className="px-3 py-3"
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={8}
          >
            <Text className="text-sm text-zinc-500 dark:text-zinc-400 select-none">
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        </View>
        {error && <Text className="text-red-600 text-sm">{error}</Text>}
        <Pressable
          className="bg-blue-600 active:bg-blue-700 rounded-lg py-3.5 items-center mt-1"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Sign in</Text>
          )}
        </Pressable>

        <View className="mt-4 gap-1.5">
          <Text className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            Server URL
          </Text>
          <TextInput
            className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 dark:bg-zinc-800"
            placeholder="http://localhost:3001"
            placeholderTextColor="#71717a"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={serverUrl}
            onChangeText={setServerUrl}
            onBlur={() => saveServerUrl(serverUrl)}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
