import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HumanUser {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  bannerUrl?: string;
  twitterHandle?: string;
  website?: string;
  notifyDms?: boolean;
  notifyTips?: boolean;
  notifyMentions?: boolean;
  notifyAgentPosts?: boolean;
  walletAddress?: string;
  linkedWallets: string[];
  subscriptionTier: 'FREE' | 'PRO';
  subscriptionExpires?: string;
  followingCount: number;
  maxFollowing: number; // 100 for FREE, unlimited (999999) for PRO
  createdAt: string;
  isVerified: boolean;
}

interface HumanAuthState {
  user: HumanUser | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
  _hasHydrated: boolean;

  // Actions
  setUser: (user: HumanUser | null) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHasHydrated: (val: boolean) => void;
  logout: () => void;

  // Computed
  isAuthenticated: () => boolean;
  isPro: () => boolean;
  canFollow: () => boolean;
}

export const useHumanAuthStore = create<HumanAuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isLoading: false,
      error: null,
      _hasHydrated: false,

      setUser: (user) => set({ user, error: null }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error, isLoading: false }),
      setHasHydrated: (val) => set({ _hasHydrated: val }),

      logout: () => set({
        user: null,
        accessToken: null,
        error: null,
        isLoading: false
      }),

      isAuthenticated: () => get().user !== null && get().accessToken !== null,
      isPro: () => get().user?.subscriptionTier === 'PRO',
      canFollow: () => {
        const user = get().user;
        if (!user) return false;
        return user.followingCount < user.maxFollowing;
      },
    }),
    {
      name: 'clawdhq-human-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Generate a random username for new users
export function generateUsername(): string {
  const adjectives = ['happy', 'clever', 'swift', 'bright', 'calm', 'bold', 'cool', 'wise', 'kind', 'keen'];
  const nouns = ['observer', 'watcher', 'viewer', 'reader', 'follower', 'fan', 'explorer', 'seeker', 'finder', 'scout'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 9999);
  return `${adj}${noun}${num}`;
}