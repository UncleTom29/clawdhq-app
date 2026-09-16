'use client';

// Builds a viem WalletClient powered by Privy's embedded wallet — directly
// signable (a real EIP-1193 provider), unlike Circle User-Controlled
// Wallets' challenge-based model. Modeled on Circuits Protocol's own
// usePrivyWalletClient.ts (~/clawd-hq), simplified for ClawdHQ's single
// chain (Arc Testnet) rather than their multi-chain abstraction.
import { useCallback, useEffect, useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { createWalletClient, custom, type WalletClient } from 'viem';
import { activeChain } from '@/lib/chain';
import type { X402SignTypedData } from '@/lib/x402-client';

export function usePrivyWalletClient(): WalletClient | undefined {
  const { wallets } = useWallets();
  const activeWallet = wallets[0];
  const [walletClient, setWalletClient] = useState<WalletClient | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    if (!activeWallet) {
      setWalletClient(undefined);
      return;
    }

    (async () => {
      try {
        // Switch to the target Arc chain so viem won't throw ChainMismatchError
        await activeWallet.switchChain(activeChain.id);
        if (cancelled) return;

        const ethereumProvider = await activeWallet.getEthereumProvider();
        if (cancelled) return;

        const client = createWalletClient({
          account: activeWallet.address as `0x${string}`,
          chain: activeChain,
          transport: custom(ethereumProvider),
        });
        setWalletClient(client);
      } catch (err) {
        console.error('Failed to build Privy wallet client:', err);
        if (!cancelled) setWalletClient(undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWallet]);

  return walletClient;
}

/**
 * EIP-712 signature via the Privy embedded wallet — replaces
 * signTypedDataViaCircle (circle-transaction.ts). Matches x402-client.ts's
 * X402SignTypedData shape exactly, so it drops straight into payWithX402's
 * signTypedData parameter at all 4 call sites (tips, ads, Pro upgrade x2).
 * Unlike Circle's challenge model, the wallet client signs directly — no
 * challenge/poll round-trip to the backend needed for this.
 */
export function usePrivySignTypedData(): X402SignTypedData {
  const walletClient = usePrivyWalletClient();

  return useCallback(
    async (params) => {
      if (!walletClient || !walletClient.account) {
        throw new Error('Wallet not ready — please try again in a moment.');
      }

      return walletClient.signTypedData({
        account: walletClient.account,
        domain: params.domain,
        types: params.types as any,
        primaryType: params.primaryType,
        message: params.message,
      } as any);
    },
    [walletClient],
  );
}
