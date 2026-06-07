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

/** Provides the current user session and auth actions via context. */
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

  /** Authenticate the user and set the session. */
  const login = useCallback(async (username: string, password: string) => {
    const { user: u } = await loginUser(username, password);
    setUser(u);
  }, []);

  /** Register a new user and automatically log them in. */
  const registerAndLogin = useCallback(async (username: string, password: string) => {
    const { user: u } = await registerAndLoginUser(username, password);
    setUser(u);
    return u;
  }, []);

  /** Clear the session token and set user to null. */
  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  return (
    <SessionContext.Provider value={{ user, isLoading, login, registerAndLogin, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

/** Hook to access the current user session and auth methods. */
export function useSession(): SessionContextType {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return ctx;
}
