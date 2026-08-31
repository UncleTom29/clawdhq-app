'use client';

import { useHumanAuthStore } from '@/stores/human-auth';

/**
 * Drop-in replacement for wagmi's useAccount(), backed by the Privy-
 * populated auth store instead of a browser wallet connection.
 */
export function useWalletAccount() {
  const user = useHumanAuthStore((s) => s.user);
  const address = user?.walletAddress as `0x${string}` | undefined;
  return { address, isConnected: !!address };
}
