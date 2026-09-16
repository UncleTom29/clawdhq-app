'use client';

// ---------------------------------------------------------------------------
// ClawdHQ Smart Contract Hooks - on-chain interactions
//
// Reads: plain viem publicClient (no signer/login dependency at all).
// Writes: the Privy embedded wallet is a directly signable EIP-1193
// provider (see hooks/use-privy-wallet-client.ts) — replaces Circle User-
// Controlled Wallets' challenge-based model, which could never hand back a
// transaction hash for a contract-execution challenge and needed a whole
// backend polling apparatus (lib/circle-transaction.ts, now deleted) just to
// find out whether a write actually landed. A plain writeContract +
// waitForTransactionReceipt pair needs none of that.
// ---------------------------------------------------------------------------

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parseUnits, formatUnits, type Abi } from 'viem';
import { publicClient, activeChain } from '@/lib/chain';
import { usePrivyWalletClient } from './use-privy-wallet-client';
import { USDC_ABI, GATEWAY_WALLET_ABI, AGENT_REGISTRY_ABI } from '@/contracts/abis';
import {
  USDC_ADDRESS,
  GATEWAY_WALLET_ADDRESS,
  AGENT_REGISTRY_ADDRESS,
  USDC_DECIMALS,
} from '@/contracts/addresses';

// ---------------------------------------------------------------------------
// Read hooks (plain viem, no signer needed)
// ---------------------------------------------------------------------------

/** Read USDC balance for a given address */
export function useUsdcBalance(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ['usdc-balance', address],
    queryFn: () =>
      publicClient.readContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [address!],
      }) as Promise<bigint>,
    enabled: !!address,
  });
}

/** Read USDC allowance for the Circle GatewayWallet contract */
export function useUsdcAllowance(owner: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ['usdc-allowance', owner],
    queryFn: () =>
      publicClient.readContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'allowance',
        args: [owner!, GATEWAY_WALLET_ADDRESS],
      }) as Promise<bigint>,
    enabled: !!owner,
  });
}

/** Read the payer's available Gateway balance (backs x402 nanopayments) */
export function useGatewayBalance(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ['gateway-balance', address],
    queryFn: () =>
      publicClient.readContract({
        address: GATEWAY_WALLET_ADDRESS,
        abi: GATEWAY_WALLET_ABI,
        functionName: 'availableBalance',
        args: [USDC_ADDRESS, address!],
      }) as Promise<bigint>,
    enabled: !!address,
  });
}

// ---------------------------------------------------------------------------
// Write hooks (direct signing via the Privy embedded wallet)
// ---------------------------------------------------------------------------

interface WriteState {
  hash: `0x${string}` | undefined;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: Error | null;
}

const INITIAL_WRITE_STATE: WriteState = {
  hash: undefined,
  isPending: false,
  isConfirming: false,
  isConfirmed: false,
  error: null,
};

/** Shared write-then-wait sequence every hook below uses. Not exported —
 * each hook wraps this with its own contract-specific args and state. */
async function writeAndWait(
  walletClient: NonNullable<ReturnType<typeof usePrivyWalletClient>>,
  params: { address: `0x${string}`; abi: Abi; functionName: string; args: readonly unknown[] },
): Promise<`0x${string}`> {
  if (!walletClient.account) {
    throw new Error('Wallet not ready — please try again in a moment.');
  }

  const hash = await walletClient.writeContract({
    address: params.address,
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
    account: walletClient.account,
    chain: activeChain,
  } as Parameters<typeof walletClient.writeContract>[0]);

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/** Approve USDC spending by the GatewayWallet (for deposits) */
export function useUsdcApprove() {
  const walletClient = usePrivyWalletClient();
  const [state, setState] = useState<WriteState>(INITIAL_WRITE_STATE);

  const approve = useCallback(async (amount: string) => {
    if (!walletClient) {
      setState({ ...INITIAL_WRITE_STATE, error: new Error('Sign in to continue.') });
      return;
    }
    setState({ ...INITIAL_WRITE_STATE, isPending: true });
    try {
      const amountWei = parseUnits(amount, USDC_DECIMALS);
      setState((prev) => ({ ...prev, isConfirming: true }));
      const hash = await writeAndWait(walletClient, {
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [GATEWAY_WALLET_ADDRESS, amountWei],
      });
      setState({ hash, isPending: false, isConfirming: false, isConfirmed: true, error: null });
    } catch (err) {
      setState({ ...INITIAL_WRITE_STATE, error: err instanceof Error ? err : new Error('USDC approval failed.') });
    }
  }, [walletClient]);

  const reset = useCallback(() => setState(INITIAL_WRITE_STATE), []);

  return { approve, ...state, reset };
}

/** Send USDC from the caller's own wallet to any address */
export function useSendUsdc() {
  const walletClient = usePrivyWalletClient();
  const [state, setState] = useState<WriteState>(INITIAL_WRITE_STATE);

  const send = useCallback(async (amount: string, destinationAddress: string) => {
    if (!walletClient) {
      setState({ ...INITIAL_WRITE_STATE, error: new Error('Sign in to continue.') });
      return;
    }
    setState({ ...INITIAL_WRITE_STATE, isPending: true });
    try {
      const amountWei = parseUnits(amount, USDC_DECIMALS);
      setState((prev) => ({ ...prev, isConfirming: true }));
      const hash = await writeAndWait(walletClient, {
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [destinationAddress as `0x${string}`, amountWei],
      });
      setState({ hash, isPending: false, isConfirming: false, isConfirmed: true, error: null });
    } catch (err) {
      setState({ ...INITIAL_WRITE_STATE, error: err instanceof Error ? err : new Error('Send failed.') });
    }
  }, [walletClient]);

  const reset = useCallback(() => setState(INITIAL_WRITE_STATE), []);

  return { send, ...state, reset };
}

/** Deposit USDC into the GatewayWallet to fund gasless nanopayments */
export function useGatewayDeposit() {
  const walletClient = usePrivyWalletClient();
  const [state, setState] = useState<WriteState>(INITIAL_WRITE_STATE);

  const deposit = useCallback(async (amount: string) => {
    if (!walletClient) {
      setState({ ...INITIAL_WRITE_STATE, error: new Error('Sign in to continue.') });
      return;
    }
    setState({ ...INITIAL_WRITE_STATE, isPending: true });
    try {
      const amountWei = parseUnits(amount, USDC_DECIMALS);
      setState((prev) => ({ ...prev, isConfirming: true }));
      const hash = await writeAndWait(walletClient, {
        address: GATEWAY_WALLET_ADDRESS,
        abi: GATEWAY_WALLET_ABI,
        functionName: 'deposit',
        args: [USDC_ADDRESS, amountWei],
      });
      setState({ hash, isPending: false, isConfirming: false, isConfirmed: true, error: null });
    } catch (err) {
      setState({ ...INITIAL_WRITE_STATE, error: err instanceof Error ? err : new Error('Gateway deposit failed.') });
    }
  }, [walletClient]);

  const reset = useCallback(() => setState(INITIAL_WRITE_STATE), []);

  return { deposit, ...state, reset };
}

/** Reserve an agent (fallback when the backend's admin-signed reservation fails) */
export function useReserveAgent() {
  const walletClient = usePrivyWalletClient();
  const [state, setState] = useState<WriteState>(INITIAL_WRITE_STATE);

  const reserve = useCallback(async (
    agentId: string,
    reservationHash: `0x${string}`,
    expiry: bigint,
    authorizedWallet: `0x${string}`,
  ) => {
    if (!walletClient) {
      setState({ ...INITIAL_WRITE_STATE, error: new Error('Sign in to continue.') });
      return;
    }
    setState({ ...INITIAL_WRITE_STATE, isPending: true });
    try {
      setState((prev) => ({ ...prev, isConfirming: true }));
      const hash = await writeAndWait(walletClient, {
        address: AGENT_REGISTRY_ADDRESS,
        abi: AGENT_REGISTRY_ABI as Abi,
        functionName: 'reserveAgent',
        args: [agentId, reservationHash, expiry, authorizedWallet],
      });
      setState({ hash, isPending: false, isConfirming: false, isConfirmed: true, error: null });
    } catch (err) {
      setState({ ...INITIAL_WRITE_STATE, error: err instanceof Error ? err : new Error('Agent reservation failed.') });
    }
  }, [walletClient]);

  const reset = useCallback(() => setState(INITIAL_WRITE_STATE), []);

  return { reserve, ...state, reset };
}

/** Mint a reserved agent NFT */
export function useMintAgent() {
  const walletClient = usePrivyWalletClient();
  const [state, setState] = useState<WriteState>(INITIAL_WRITE_STATE);

  const mint = useCallback(async (agentId: string, metadataURI: string, payoutWallet: `0x${string}`) => {
    if (!walletClient) {
      setState({ ...INITIAL_WRITE_STATE, error: new Error('Sign in to continue.') });
      return;
    }
    setState({ ...INITIAL_WRITE_STATE, isPending: true });
    try {
      setState((prev) => ({ ...prev, isConfirming: true }));
      const hash = await writeAndWait(walletClient, {
        address: AGENT_REGISTRY_ADDRESS,
        abi: AGENT_REGISTRY_ABI as Abi,
        functionName: 'mintReservedAgent',
        args: [agentId, metadataURI, payoutWallet],
      });
      setState({ hash, isPending: false, isConfirming: false, isConfirmed: true, error: null });
    } catch (err) {
      setState({ ...INITIAL_WRITE_STATE, error: err instanceof Error ? err : new Error('Agent mint failed.') });
    }
  }, [walletClient]);

  const reset = useCallback(() => setState(INITIAL_WRITE_STATE), []);

  return { mint, ...state, reset };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Format USDC amount from atomic units (6 decimals) to display string */
export function formatUsdc(amount: bigint | undefined): string {
  if (amount === undefined) return '0.00';
  return formatUnits(amount, USDC_DECIMALS);
}

/** Parse USDC display string to atomic units */
export function parseUsdc(amount: string): bigint {
  return parseUnits(amount, USDC_DECIMALS);
}
