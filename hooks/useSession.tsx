import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../types';
import {
  validateSession,
  loginUser,
  registerAndLoginUser,
  logoutUser,
} from '../database/userRepository';

interface SessionContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  registerAndLogin: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const u = await validateSession();
        setUser(u);
      } catch (err) {
        console.error('Session validation error:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { user: u } = await loginUser(username, password);
    setUser(u);
  }, []);

  const registerAndLogin = useCallback(async (username: string, password: string) => {
    const { user: u } = await registerAndLoginUser(username, password);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync('setup_done');
    await logoutUser();
    setUser(null);
  }, []);

  return (
    <SessionContext.Provider value={{ user, isLoading, login, registerAndLogin, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextType {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return ctx;
}
