import * as SecureStore from 'expo-secure-store';

const API_BASE_KEY = 'api_base_url';
const DEFAULT_API_URL = 'http://localhost:4000/api';

function getApiUrl(): string {
  if (__DEV__) {
    return DEFAULT_API_URL;
  }
  return DEFAULT_API_URL;
}

export function setApiUrl(url: string) {
  SecureStore.setItemAsync(API_BASE_KEY, url);
}

async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('session_token');
  } catch {
    return null;
  }
}

export async function storeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync('session_token', token);
}

export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync('session_token');
  } catch {}
}

interface ApiResponse<T = any> {
  ok: boolean;
  data: T;
  status: number;
}

async function request<T = any>(
  method: string,
  path: string,
  body?: any
): Promise<ApiResponse<T>> {
  const baseUrl = getApiUrl();
  const token = await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    return { ok: response.ok, data, status: response.status };
  } catch (err) {
    return { ok: false, data: { error: 'Erreur réseau' } as T, status: 0 };
  }
}

export const api = {
  get: <T = any>(path: string) => request<T>('GET', path),
  post: <T = any>(path: string, body?: any) => request<T>('POST', path, body),
  put: <T = any>(path: string, body?: any) => request<T>('PUT', path, body),
  delete: <T = any>(path: string) => request<T>('DELETE', path),
};
