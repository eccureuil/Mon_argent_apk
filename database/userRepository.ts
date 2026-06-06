import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { getDb } from './db';
import type { User } from '../types';

const SESSION_KEY = 'session_token';

export async function registerAndLoginUser(
  username: string,
  password: string
): Promise<{ user: User; token: string }> {
  const db = await getDb();
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );

  let userId: number;
  try {
    const result = await db.runAsync(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      username,
      hash
    );
    userId = result.lastInsertRowId;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      throw new Error('Nom d\'utilisateur déjà pris');
    }
    throw err;
  }

  const user = await db.getFirstAsync<User>(
    'SELECT * FROM users WHERE id = ?',
    userId
  );
  if (!user) throw new Error('Erreur lors de la création du compte');

  const token = Crypto.randomUUID();
  await db.runAsync(
    'INSERT INTO sessions (user_id, token) VALUES (?, ?)',
    userId,
    token
  );
  await SecureStore.setItemAsync(SESSION_KEY, token);

  return { user, token };
}

export async function loginUser(
  username: string,
  password: string
): Promise<{ user: User; token: string }> {
  const db = await getDb();
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );

  const user = await db.getFirstAsync<User>(
    'SELECT * FROM users WHERE username = ? AND password_hash = ?',
    username,
    hash
  );

  if (!user) {
    throw new Error('Identifiant ou mot de passe incorrect');
  }

  const token = Crypto.randomUUID();
  await db.runAsync(
    'INSERT INTO sessions (user_id, token) VALUES (?, ?)',
    user.id,
    token
  );
  await SecureStore.setItemAsync(SESSION_KEY, token);

  return { user, token };
}

export async function validateSession(): Promise<User | null> {
  try {
    const token = await SecureStore.getItemAsync(SESSION_KEY);
    if (!token) return null;

    const db = await getDb();
    const result = await db.getFirstAsync<{ id: number; user_id: number; created_at: string }>(
      'SELECT * FROM sessions WHERE token = ?',
      token
    );
    if (!result) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return null;
    }

    const user = await db.getFirstAsync<User>(
      'SELECT * FROM users WHERE id = ?',
      result.user_id
    );
    return user ?? null;
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(SESSION_KEY);
    if (token) {
      const db = await getDb();
      await db.runAsync('DELETE FROM sessions WHERE token = ?', token);
    }
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch (err) {
    console.error('Logout error:', err);
  }
}

export async function updateUsername(
  userId: number,
  newUsername: string
): Promise<void> {
  const db = await getDb();
  try {
    await db.runAsync(
      'UPDATE users SET username = ? WHERE id = ?',
      newUsername,
      userId
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      throw new Error('Nom d\'utilisateur déjà pris');
    }
    throw err;
  }
}

export async function updatePassword(
  userId: number,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  const db = await getDb();
  const user = await db.getFirstAsync<User>(
    'SELECT * FROM users WHERE id = ?',
    userId
  );
  if (!user) throw new Error('Utilisateur introuvable');

  const oldHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    oldPassword
  );
  if (user.password_hash !== oldHash) {
    throw new Error('Ancien mot de passe incorrect');
  }

  const newHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    newPassword
  );
  await db.runAsync(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    newHash,
    userId
  );
}
