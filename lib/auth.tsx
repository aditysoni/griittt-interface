import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth as authApi, users as usersApi, User, OnboardingPayload } from './api';
import { storage } from './storage';

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  onboardingDone: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Returns the new auth token so callers can chain follow-up requests without
   *  waiting for React state to flush. */
  signup: (name: string, email: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
  /** `overrideToken` lets callers bypass the closure-captured token when chaining
   *  immediately after signup. */
  completeOnboarding: (payload: OnboardingPayload, overrideToken?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Server is the source of truth — local flag is just an offline fallback.
  const onboardingDone = !!user?.onboardingDone;

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

  async function signup(name: string, email: string, password: string): Promise<string> {
    const result = await authApi.signup(name, email, password);
    await storage.setToken(result.token);
    await storage.setUser(result.user);
    setToken(result.token);
    setUser(result.user);
    return result.token;
  }

  async function logout() {
    await storage.clear();
    setToken(null);
    setUser(null);
  }

  async function completeOnboarding(payload: OnboardingPayload, overrideToken?: string) {
    const t = overrideToken ?? token;
    if (!t) throw new Error('Not authenticated');
    const res = await usersApi.onboarding(t, payload);
    await storage.setUser(res.user);
    setUser(res.user);
  }

  async function refreshUser() {
    if (!token) return;
    const me = await authApi.me(token);
    await storage.setUser(me);
    setUser(me);
  }

  return (
    <AuthContext.Provider value={{
      user, token, isLoading, onboardingDone,
      login, signup, logout, completeOnboarding, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
