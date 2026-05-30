import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'nodeira_access_token';
const EMAIL_KEY = 'nodeira_user_email';

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function saveUserEmail(email: string): Promise<void> {
  await SecureStore.setItemAsync(EMAIL_KEY, email);
}

export async function getUserEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(EMAIL_KEY);
}
