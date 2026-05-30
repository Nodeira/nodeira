import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "nodeira_server_url";
const STARTUP_VIEW_KEY = "nodeira_startup_view";
const DEFAULT_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

let _serverUrl = DEFAULT_URL;

export async function initServerUrl(): Promise<void> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  if (saved) _serverUrl = saved;
}

export function getApiUrl(): string {
  return _serverUrl;
}

export function getWsUrl(): string {
  return _serverUrl.replace(/^https?/, (proto: string) => (proto === "https" ? "wss" : "ws"));
}

export async function saveServerUrl(url: string): Promise<void> {
  _serverUrl = url.replace(/\/+$/, "");
  await AsyncStorage.setItem(STORAGE_KEY, _serverUrl);
}

export async function getStartupView(): Promise<string> {
  return (await AsyncStorage.getItem(STARTUP_VIEW_KEY)) ?? "home";
}

export async function saveStartupView(view: string): Promise<void> {
  await AsyncStorage.setItem(STARTUP_VIEW_KEY, view);
}
