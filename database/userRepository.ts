import * as SecureStore from 'expo-secure-store';
import { api, storeToken, clearToken } from '../services/api';
import { getDb } from './db';
import type { User } from '../types';

const SESSION_KEY = 'session_token';

interface AuthResponse {
  user: User;
  token: string;
}

async function cacheUser(user: User): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
    user.id,
    user.username,
    '',
    user.created_at
  );
}

async function getCachedUser(): Promise<User | null> {
  try {
    const db = await getDb();
    const user = await db.getFirstAsync<User>(
      'SELECT id, username, created_at FROM users WHERE id = (SELECT MAX(id) FROM users)'
    );
    return user ?? null;
  } catch {
    return null;
  }
}

export async function registerAndLoginUser(
  username: string,
  password: string
): Promise<{ user: User; token: string }> {
  const res = await api.post<AuthResponse | { error: string }>('/auth/register', { username, password });
  if (!res.ok) throw new Error((res.data as any).error || 'Erreur inscription');
  const data = res.data as AuthResponse;
  await storeToken(data.token);
  await cacheUser(data.user);
  return { user: data.user, token: data.token };
}

export async function loginUser(
  username: string,
  password: string
): Promise<{ user: User; token: string }> {
  const res = await api.post<AuthResponse | { error: string }>('/auth/login', { username, password });
  if (!res.ok) throw new Error((res.data as any).error || 'Identifiant ou mot de passe incorrect');
  const data = res.data as AuthResponse;
  await storeToken(data.token);
  await cacheUser(data.user);
  return { user: data.user, token: data.token };
}

export async function validateSession(): Promise<User | null> {
  try {
    const token = await SecureStore.getItemAsync(SESSION_KEY);
    if (!token) return null;
    const res = await api.get<{ user: User } | { error: string }>('/auth/me');
    if (res.ok) {
      const data = res.data as { user: User };
      if (data.user) {
        await cacheUser(data.user);
        return data.user;
      }
    }
    if (res.status === 401) {
      await clearToken();
      return null;
    }
    return getCachedUser();
  } catch {
    return getCachedUser();
  }
}

export async function logoutUser(): Promise<void> {
  await clearToken();
}

export async function updateUsername(
  userId: number,
  newUsername: string
): Promise<void> {
  const res = await api.put('/auth/username', { username: newUsername });
  if (!res.ok) throw new Error(res.data.error || 'Erreur mise à jour');
}

export async function updatePassword(
  userId: number,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  const res = await api.put('/auth/password', { oldPassword, newPassword });
  if (!res.ok) throw new Error(res.data.error || 'Erreur mise à jour');
}
