const TOKEN_KEY = "nodeira_token";
const USER_KEY = "nodeira_user";

export interface StoredUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export const authStorage = {
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string): void => void localStorage.setItem(TOKEN_KEY, token),
  getUser: (): StoredUser | null => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  },
  setUser: (user: StoredUser): void => void localStorage.setItem(USER_KEY, JSON.stringify(user)),
  clear: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
