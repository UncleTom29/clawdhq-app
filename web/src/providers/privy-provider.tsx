'use client';

// Human authentication via Privy (email login, embedded wallet) — replaces
// Circle User-Controlled Wallets, which proved unreliable in real use
// (login loops, permanent hangs on return-device logins, mobile breakage —
// all traced to Circle's full-page-redirect + hidden-iframe architecture).
// Modeled directly on Circuits Protocol's own working migration
// (~/clawd-hq/apps/web/src/lib/privy/PrivyAppProvider.tsx), which uses the
// same Privy App ID so a human's wallet matches across both platforms.
import { useEffect, useRef } from 'react';
import { PrivyProvider, usePrivy, useIdentityToken } from '@privy-io/react-auth';
import { apiClient } from '@/lib/api-client';
import { useHumanAuthStore } from '@/stores/human-auth';
import type { HumanUser } from '@/stores/human-auth';
import { arcTestnet } from '@/lib/chain';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'cms55ue5c00ea0cl5z1qf5yob';

function mapToHumanUser(userObj: any): HumanUser {
  const tier = (userObj.subscription_tier || userObj.subscriptionTier)?.toUpperCase() === 'PRO' ? 'PRO' : 'FREE';
  return {
    id: userObj.id,
    username: userObj.username,
    displayName: userObj.display_name || userObj.displayName || undefined,
    email: userObj.email || undefined,
    avatarUrl: userObj.avatar_url || userObj.avatarUrl || undefined,
    bio: userObj.bio || undefined,
    bannerUrl: userObj.banner_url || userObj.bannerUrl || undefined,
    twitterHandle: userObj.twitter_handle || userObj.twitterHandle || undefined,
    website: userObj.website || undefined,
    walletAddress: userObj.wallet_address || userObj.walletAddress || undefined,
    linkedWallets: userObj.linked_wallets || userObj.linkedWallets || [],
    subscriptionTier: tier,
    subscriptionExpires: userObj.subscription_expires || userObj.subscriptionExpires || undefined,
    followingCount: userObj.following_count || userObj.followingCount || 0,
    maxFollowing: userObj.max_following || userObj.maxFollowing || (tier === 'PRO' ? 999999 : 100),
    createdAt: userObj.created_at || userObj.createdAt || new Date().toISOString(),
    isVerified: userObj.is_verified || userObj.isVerified || false,
  };
}

// Watches Privy's own auth state and, once a session + identity token exist,
// verifies it with our backend and feeds the result into the *existing*
// useHumanAuthStore — same store every other part of the app already reads,
// so nothing downstream needs to know Privy replaced Circle.
function SessionSyncer() {
  const { authenticated, ready } = usePrivy();
  const { identityToken } = useIdentityToken();
  const { setUser, setAccessToken, setLoading, setError, logout: storeLogout } = useHumanAuthStore();
  const syncedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    if (!authenticated || !identityToken) {
      if (syncedTokenRef.current) {
        syncedTokenRef.current = null;
        storeLogout();
      }
      return;
    }

    if (syncedTokenRef.current === identityToken) return;
    syncedTokenRef.current = identityToken;

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const completion = await apiClient.auth.completePrivyAuth(identityToken);
        setUser(mapToHumanUser(completion.user));
        setAccessToken(completion.access_token);
        apiClient.setToken(completion.access_token);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, authenticated, identityToken, setUser, setAccessToken, setLoading, setError, storeLogout]);

  return null;
}

export function ClawdHQPrivyProvider({ children }: { children: React.ReactNode }) {
  if (!PRIVY_APP_ID && process.env.NODE_ENV !== 'production') {
    console.warn('NEXT_PUBLIC_PRIVY_APP_ID is not set — human login will not work.');
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email'],
        appearance: {
          theme: 'dark',
          accentColor: '#FF6B35',
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
        },
        // Without these, Privy defaults a freshly created embedded wallet to Ethereum mainnet
        // (chain id 1) and has no notion of Arc Testnet at all — usePrivyWalletClient's
        // switchChain() call fails for any chain not listed here. Matches Circuits Protocol's
        // own PrivyAppProvider.tsx, which hit this exact "current chain of the wallet (id: 1)
        // does not match the target chain" error before adding these.
        defaultChain: arcTestnet,
        supportedChains: [arcTestnet],
      }}
    >
      <SessionSyncer />
      {children}
    </PrivyProvider>
  );
}
