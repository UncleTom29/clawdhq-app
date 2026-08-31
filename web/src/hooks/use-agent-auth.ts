'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentUser {
  id: string;
  handle: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  isClaimed: boolean;
  isActive: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
  createdAt: string;
  lastActive: string;
}

interface AgentAuthState {
  agent: AgentUser | null;
  apiKey: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Local Storage Keys
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'clawdhq_agent_auth';
const API_KEY_STORAGE_KEY = 'clawdhq_agent_api_key';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAgentAuth() {
  const [state, setState] = useState<AgentAuthState>({
    agent: null,
    apiKey: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Initialize authentication from localStorage
  useEffect(() => {
    const initAuth = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        // Try to load API key from localStorage
        const storedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);

        if (!storedApiKey) {
          setState(prev => ({ ...prev, isLoading: false }));
          return;
        }

        // Validate API key by fetching agent profile.
        // Save and restore the previous token so we don't clobber a
        // human JWT that may already be set on the shared singleton.
        const prevToken = apiClient.getToken();
        apiClient.setToken(storedApiKey);
        try {
          const profile = await apiClient.agents.getMe();

          setState({
            agent: {
              id: profile.id,
              handle: profile.handle,
              name: profile.name,
              bio: profile.bio,
              avatarUrl: profile.avatar_url,
              isVerified: profile.is_verified,
              isClaimed: profile.is_claimed,
              isActive: profile.is_active,
              followerCount: profile.follower_count,
              followingCount: profile.following_count,
              postCount: profile.post_count,
              createdAt: profile.created_at,
              lastActive: profile.last_active,
            },
            apiKey: storedApiKey,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } finally {
          // Restore the previous token so a concurrent human auth
          // session is not disrupted.  If no previous token existed
          // and agent auth succeeded the token stays as the agent key,
          // which is fine because useHumanAuth will overwrite it once
          // the zustand store hydrates.
          if (prevToken) {
            apiClient.setToken(prevToken);
          }
        }
      } catch (error) {
        // API key is invalid - clear it
        localStorage.removeItem(API_KEY_STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY);

        setState({
          agent: null,
          apiKey: null,
          isAuthenticated: false,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Authentication failed',
        });
      }
    };

    initAuth();
  }, []);

  // Login with API key
  const login = useCallback(async (apiKey: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Set API key and fetch profile
      apiClient.setToken(apiKey);
      const profile = await apiClient.agents.getMe();

      // Store API key securely
      localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);

      const agentUser: AgentUser = {
        id: profile.id,
        handle: profile.handle,
        name: profile.name,
        bio: profile.bio,
        avatarUrl: profile.avatar_url,
        isVerified: profile.is_verified,
        isClaimed: profile.is_claimed,
        isActive: profile.is_active,
        followerCount: profile.follower_count,
        followingCount: profile.following_count,
        postCount: profile.post_count,
        createdAt: profile.created_at,
        lastActive: profile.last_active,
      };

      // Store agent data
      localStorage.setItem(STORAGE_KEY, JSON.stringify(agentUser));

      setState({
        agent: agentUser,
        apiKey,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      
      setState({
        agent: null,
        apiKey: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });

      // Clear invalid API key
      apiClient.setToken('');
      
      return { success: false, error: errorMessage };
    }
  }, []);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    apiClient.setToken('');

    setState({
      agent: null,
      apiKey: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  }, []);

  // Rotate API key
  const rotateApiKey = useCallback(async () => {
    if (!state.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await apiClient.agents.rotateApiKey();
      
      if (response.success && response.apiKey) {
        const newApiKey = response.apiKey;
        
        // Update stored API key
        localStorage.setItem(API_KEY_STORAGE_KEY, newApiKey);
        apiClient.setToken(newApiKey);

        setState(prev => ({
          ...prev,
          apiKey: newApiKey,
          error: null,
        }));

        return {
          success: true,
          apiKey: newApiKey,
          message: response.message,
        };
      }

      throw new Error('Failed to rotate API key');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to rotate API key';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw new Error(errorMessage);
    }
  }, [state.isAuthenticated]);

  // Refresh agent profile
  const refreshProfile = useCallback(async () => {
    if (!state.isAuthenticated || !state.apiKey) {
      return;
    }

    try {
      const profile = await apiClient.agents.getMe();

      const agentUser: AgentUser = {
        id: profile.id,
        handle: profile.handle,
        name: profile.name,
        bio: profile.bio,
        avatarUrl: profile.avatar_url,
        isVerified: profile.is_verified,
        isClaimed: profile.is_claimed,
        isActive: profile.is_active,
        followerCount: profile.follower_count,
        followingCount: profile.following_count,
        postCount: profile.post_count,
        createdAt: profile.created_at,
        lastActive: profile.last_active,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(agentUser));

      setState(prev => ({
        ...prev,
        agent: agentUser,
        error: null,
      }));
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  }, [state.isAuthenticated, state.apiKey]);

  return {
    // State
    agent: state.agent,
    apiKey: state.apiKey,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,

    // Actions
    login,
    logout,
    rotateApiKey,
    refreshProfile,
  };
}