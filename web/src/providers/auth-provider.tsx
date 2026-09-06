'use client';

import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useHumanAuth } from '@/hooks/use-human-auth';
import { useAgentAuth } from '@/hooks/use-agent-auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  type: 'human' | 'agent';
  handle?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  bannerUrl?: string;
  twitterHandle?: string;
  website?: string;
  walletAddress?: string;
  subscriptionTier?: 'FREE' | 'PRO';
  subscriptionExpires?: string;
  isVerified?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isHuman: boolean;
  isAgent: boolean;
  isPro: boolean;
  isLoading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider Component
// ---------------------------------------------------------------------------

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider - Unified authentication provider
 * 
 * This provider supports both human and agent authentication:
 * - Human authentication: wallet-based with nonce-signature verification
 * - Agent authentication: API key-based
 * 
 * The provider automatically detects which type of authentication is active
 * and provides a consistent interface for both.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  // Use both authentication hooks
  const humanAuth = useHumanAuth();
  const agentAuth = useAgentAuth();

  // Determine which type of auth is active
  const activeAuth = useMemo(() => {
    if (humanAuth.isAuthenticated) return 'human';
    if (agentAuth.isAuthenticated) return 'agent';
    return null;
  }, [humanAuth.isAuthenticated, agentAuth.isAuthenticated]);

  // Map to unified AuthUser format
  const user: AuthUser | null = useMemo(() => {
    if (activeAuth === 'human' && humanAuth.user) {
      return {
        id: humanAuth.user.id,
        type: 'human' as const,
        handle: humanAuth.user.username,
        username: humanAuth.user.username,
        displayName: humanAuth.user.displayName,
        avatarUrl: humanAuth.user.avatarUrl,
        bio: humanAuth.user.bio,
        bannerUrl: humanAuth.user.bannerUrl,
        twitterHandle: humanAuth.user.twitterHandle,
        website: humanAuth.user.website,
        walletAddress: humanAuth.user.walletAddress,
        subscriptionTier: humanAuth.user.subscriptionTier,
        subscriptionExpires: humanAuth.user.subscriptionExpires,
        isVerified: humanAuth.user.isVerified,
      };
    }
    
    if (activeAuth === 'agent' && agentAuth.agent) {
      return {
        id: agentAuth.agent.id,
        type: 'agent' as const,
        handle: agentAuth.agent.handle,
        username: agentAuth.agent.name,
        displayName: agentAuth.agent.name,
        avatarUrl: agentAuth.agent.avatarUrl || undefined,
        isVerified: agentAuth.agent.isVerified,
      };
    }
    
    return null;
  }, [activeAuth, humanAuth.user, agentAuth.agent]);

  // Provide consistent authentication interface
  const value: AuthContextValue = useMemo(() => ({
    user,
    isAuthenticated: activeAuth !== null,
    isHuman: activeAuth === 'human',
    isAgent: activeAuth === 'agent',
    isPro: activeAuth === 'human' ? humanAuth.isPro : false,
    isLoading: humanAuth.isLoading || agentAuth.isLoading,
    error: humanAuth.error || null,
    login: async () => {
      // Login is handled by respective auth hooks
      // For humans: automatic via wallet connection
      // For agents: use agentAuth.login(apiKey) directly
      if (activeAuth === 'human' || humanAuth.isConnected) {
        await humanAuth.syncUserWithBackend();
      }
    },
    logout: () => {
      if (activeAuth === 'human') {
        humanAuth.logout();
      } else if (activeAuth === 'agent') {
        agentAuth.logout();
      }
    },
    refreshAuth: async () => {
      if (activeAuth === 'human' || humanAuth.isConnected) {
        await humanAuth.syncUserWithBackend();
      } else if (activeAuth === 'agent') {
        await agentAuth.refreshProfile();
      }
    },
  }), [user, activeAuth, humanAuth, agentAuth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}