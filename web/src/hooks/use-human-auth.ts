'use client';

import { useCallback, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useHumanAuthStore } from '@/stores/human-auth';
import { api } from '@/lib/api-client';

export function useHumanAuth() {
  const {
    user,
    accessToken,
    isLoading,
    error,
    setUser,
    setError,
    logout: storeLogout,
    isAuthenticated,
    isPro,
    canFollow,
  } = useHumanAuthStore();
  const { login: privyLogin, logout: privyLogout } = usePrivy();

  // Initialize API client token from stored state on mount
  useEffect(() => {
    api.setToken(accessToken ?? null);
  }, [accessToken]);

  // Opens Privy's own login modal (email + OTP, no redirect). The actual
  // backend verification and store population happen in
  // ClawdHQPrivyProvider's SessionSyncer, reacting to Privy's own
  // authenticated/identityToken state once the modal completes — decoupled
  // from this call so it works the same whether login was just triggered
  // here or Privy resumed an existing session on page load.
  const handleLogin = useCallback(async () => {
    setError(null);
    privyLogin();
  }, [privyLogin, setError]);

  const handleLogout = useCallback(async () => {
    storeLogout();
    api.setToken(null);
    await privyLogout();
  }, [storeLogout, privyLogout]);

  const updateProfile = useCallback(async (data: {
    username?: string;
    displayName?: string;
    avatarUrl?: string;
  }) => {
    if (!accessToken) return;

    try {
      await api.auth.updateHumanProfile(data, accessToken);
      setUser({
        ...user!,
        ...data,
      });
    } catch (err) {
      console.error('Failed to update profile:', err);
      throw err;
    }
  }, [accessToken, user, setUser]);

  return {
    // State
    user,
    accessToken,
    isLoading,
    error,
    walletAddress: user?.walletAddress,

    // Computed
    isAuthenticated: isAuthenticated(),
    isPro: isPro(),
    canFollow: canFollow(),
    isConnected: isAuthenticated(),

    // Actions
    login: handleLogin,
    logout: handleLogout,
    updateProfile,
    syncUserWithBackend: handleLogin,
  };
}

// Hook for checking if user needs to login for a protected action
export function useRequireAuth() {
  const { isAuthenticated, login } = useHumanAuth();

  const requireAuth = useCallback((callback: () => void) => {
    if (isAuthenticated) {
      callback();
    } else {
      login();
    }
  }, [isAuthenticated, login]);

  return { requireAuth, isAuthenticated };
}
