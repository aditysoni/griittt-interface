import React, { createContext, useContext, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { auth as authApi, users as usersApi, User, OnboardingPayload } from './api';
import { storage } from './storage';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  onboardingDone: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Sign in with Google via the backend's server-side OAuth flow. Opens a
   *  browser, polls for the issued token, then hydrates the session. */
  loginWithGoogle: () => Promise<void>;
  /** Returns the new auth token so callers can chain follow-up requests without
   *  waiting for React state to flush. */
  signup: (name: string, email: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
  /** `overrideToken` lets callers bypass the closure-captured token when chaining
   *  immediately after signup. */
  completeOnboarding: (payload: OnboardingPayload, overrideToken?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Patch the user's profile (name, body stats, preferences) and sync state. */
  updateProfile: (data: Parameters<typeof usersApi.patch>[1]) => Promise<void>;
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
      const storedToken = await storage.getToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await authApi.me(storedToken);
        setToken(storedToken);
        setUser(me);
      } catch (err: any) {
        // Only sign the user out when the server EXPLICITLY rejects the token
        // (401/403). For transient failures — network blips, timeouts, 5xx,
        // or an unreachable LAN dev server — keep the session alive using the
        // last-known cached profile so the user isn't booted constantly.
        const status = err?.status;
        if (status === 401 || status === 403) {
          await storage.clear();
        } else {
          const cachedUser = await storage.getUser();
          setToken(storedToken);
          if (cachedUser) setUser(cachedUser);
        }
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

  async function loginWithGoogle() {
    // Random, single-use session key that ties the browser handshake to our poll.
    const session =
      `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

    // Open the browser but DON'T await it — the backend completes OAuth in the
    // browser while we poll for the token here. The promise resolves when the
    // user (or our dismissBrowser) closes the tab.
    let browserClosed = false;
    WebBrowser.openBrowserAsync(authApi.googleMobileUrl(session), { enableBarCollapsing: true })
      .then(() => { browserClosed = true; })
      .catch(() => { browserClosed = true; });

    const applyToken = async (token: string) => {
      const me = await authApi.me(token);
      await storage.setToken(token);
      await storage.setUser(me);
      setToken(token);
      setUser(me);
    };

    const deadline = Date.now() + 2 * 60 * 1000; // 2 minutes
    try {
      while (Date.now() < deadline) {
        await sleep(1200);
        let res: { ready: boolean; token?: string; error?: string };
        try {
          res = await authApi.googlePoll(session);
        } catch {
          // Transient network hiccup mid-poll — keep trying unless the user bailed.
          if (browserClosed) break;
          continue;
        }
        if (res.ready) {
          if (res.error || !res.token) throw new Error('Google sign-in failed. Please try again.');
          await applyToken(res.token);
          return;
        }
        if (browserClosed) {
          // User returned/closed the tab. Give the callback one last beat to land.
          await sleep(800);
          const final = await authApi.googlePoll(session).catch(() => ({ ready: false } as const));
          if ('ready' in final && final.ready && final.token) {
            await applyToken(final.token);
            return;
          }
          throw new Error('Google sign-in was cancelled.');
        }
      }
      throw new Error('Google sign-in timed out. Please try again.');
    } finally {
      // dismissBrowser() is effectively iOS-only — on Android it returns
      // undefined (Custom Tabs can't be closed programmatically), so guard
      // against calling .catch on undefined. Must never throw here: a throw in
      // finally would override a successful return and surface a false error.
      try { await WebBrowser.dismissBrowser(); } catch {}
    }
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

  async function updateProfile(data: Parameters<typeof usersApi.patch>[1]) {
    if (!token) throw new Error('Not authenticated');
    const updated = await usersApi.patch(token, data);
    await storage.setUser(updated);
    setUser(updated);
  }

  return (
    <AuthContext.Provider value={{
      user, token, isLoading, onboardingDone,
      login, loginWithGoogle, signup, logout, completeOnboarding, refreshUser, updateProfile,
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
