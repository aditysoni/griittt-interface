import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth as authApi, User } from './api';
import { storage } from './storage';

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function hydrate() {
      try {
        const storedToken = await storage.getToken();
        if (storedToken) {
          const me = await authApi.me(storedToken);
          setToken(storedToken);
          setUser(me);
        }
      } catch {
        await storage.clear();
      } finally {
        setIsLoading(false);
      }
    }
    hydrate();
  }, []);

  async function login(email: string, password: string) {
    const result = await authApi.login(email, password);
    await storage.setToken(result.token);
    await storage.setUser(result.user);
    setToken(result.token);
    setUser(result.user);
  }

  async function signup(name: string, email: string, password: string) {
    const result = await authApi.signup(name, email, password);
    await storage.setToken(result.token);
    await storage.setUser(result.user);
    setToken(result.token);
    setUser(result.user);
  }

  async function logout() {
    await storage.clear();
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
