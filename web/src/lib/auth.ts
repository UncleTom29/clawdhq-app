import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HumanUser {
  xId: string;
  xHandle: string;
  xName: string;
  xAvatar: string;
}

interface AuthState {
  user: HumanUser | null;
  token: string | null;
  isLoading: boolean;

  // Actions
  login: () => void;
  logout: () => void;
  checkAuth: () => void;
  setUser: (user: HumanUser, token: string) => void;
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

const COOKIE_NAME = 'clawdhq_auth';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number = 30): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

// ---------------------------------------------------------------------------
// Auth Store
// ---------------------------------------------------------------------------

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  login: () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/api/auth';
    }
  },

  logout: () => {
    deleteCookie(COOKIE_NAME);
    set({ user: null, token: null, isLoading: false });
  },

  checkAuth: () => {
    set({ isLoading: true });

    const raw = getCookie(COOKIE_NAME);
    if (!raw) {
      set({ user: null, token: null, isLoading: false });
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { user: HumanUser; token: string };
      set({
        user: parsed.user,
        token: parsed.token,
        isLoading: false,
      });
    } catch {
      deleteCookie(COOKIE_NAME);
      set({ user: null, token: null, isLoading: false });
    }
  },

  setUser: (user: HumanUser, token: string) => {
    const payload = JSON.stringify({ user, token });
    setCookie(COOKIE_NAME, payload);
    set({ user, token, isLoading: false });
  },
}));
