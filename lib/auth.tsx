import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth as authApi, User } from './api';
import { storage } from './storage';

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  onboardingDone: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    async function hydrate() {
      try {
        const [storedToken, obDone] = await Promise.all([
          storage.getToken(),
          storage.getOnboardingDone(),
        ]);
        setOnboardingDone(obDone);
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
    const obDone = await storage.getOnboardingDone();
    await storage.setToken(result.token);
    await storage.setUser(result.user);
    setOnboardingDone(obDone);
    setToken(result.token);
    setUser(result.user);
  }

  async function signup(name: string, email: string, password: string) {
    const result = await authApi.signup(name, email, password);
    await storage.setToken(result.token);
    await storage.setUser(result.user);
    setOnboardingDone(false);
    setToken(result.token);
    setUser(result.user);
  }

  async function logout() {
    await storage.clear();
    setToken(null);
    setUser(null);
    setOnboardingDone(false);
  }

  async function completeOnboarding() {
    await storage.setOnboardingDone();
    setOnboardingDone(true);
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, onboardingDone, login, signup, logout, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
