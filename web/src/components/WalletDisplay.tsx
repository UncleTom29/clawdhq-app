'use client';

import { Wallet, Copy, ExternalLink, Check, Loader2, DollarSign, Send } from 'lucide-react';
import { useState } from 'react';
import { useWalletAccount as useAccount } from '@/hooks/use-wallet-account';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';
import { useSendUsdc } from '@/hooks/useSmartContract';

interface WalletDisplayProps {
  label: string;
  address: string;
  className?: string;
}

export function WalletDisplay({ label, address, className = '' }: WalletDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const arcscanUrl = `https://testnet.arcscan.app/address/${address}`;

  return (
    <div className={`flex items-center justify-between rounded-lg border border-border bg-background-secondary p-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-text-secondary" />
        <div>
          <p className="text-xs text-text-tertiary">{label}</p>
          <p className="font-mono text-sm text-text-primary">{formatAddress(address)}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={handleCopy}
          className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-background-hover hover:text-text-primary"
          title={copied ? 'Copied!' : 'Copy address'}
        >
          {copied ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
        <a
          href={arcscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-background-hover hover:text-text-primary"
          title="View on Arcscan"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Send USDC — a human sends USDC out of their own wallet to any address,
// signed directly via the Privy embedded wallet. Unlike claiming an agent's
// earnings, this has no owner/claim restriction — it's the caller's own
// wallet, same as any wallet app's "send" action.
// ---------------------------------------------------------------------------

export function SendUsdcForm({ balanceUsdc }: { balanceUsdc?: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const { send, isPending, isConfirming, isConfirmed, error, reset } = useSendUsdc();

  const isBusy = isPending || isConfirming;
  const isValidDestination = /^0x[a-fA-F0-9]{40}$/.test(destination);
  const canSubmit = !!amount && Number(amount) > 0 && isValidDestination && !isBusy;

  if (isConfirmed) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
        <Check className="h-4 w-4" />
        Sent {amount} USDC.
        <button
          onClick={() => {
            reset();
            setAmount('');
            setDestination('');
            setOpen(false);
          }}
          className="ml-auto text-xs font-semibold underline"
        >
          Done
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary/10 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
      >
        <Send className="h-4 w-4" />
        Send USDC
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-background-secondary p-3">
      <p className="text-xs text-text-tertiary">
        Send USDC from your wallet to any address.
        {balanceUsdc && <> Available: {balanceUsdc} USDC.</>}
      </p>
      <input
        type="text"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        placeholder="Destination address (0x...)"
        className="w-full rounded-lg border border-border bg-background-tertiary px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-primary"
      />
      {destination && !isValidDestination && (
        <p className="text-xs text-error">Enter a valid address.</p>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <DollarSign className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <input
            type="number"
            min="0.000001"
            step="0.000001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-full rounded-lg border border-border bg-background-tertiary py-2 pl-7 pr-2 text-sm text-text-primary outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={() => send(amount, destination)}
          disabled={!canSubmit}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:bg-background-hover"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-error">{error.message}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Claim Earnings — only shown to the agent's verified on-chain owner
// (claimed/minted), withdrawing from the agent's own Circle wallet on demand.
// ---------------------------------------------------------------------------

function ClaimEarningsForm({ handle, balanceUsdc, onClaimed }: { handle: string; balanceUsdc: string; onClaimed: () => void }) {
  const [amount, setAmount] = useState('');
  const [open, setOpen] = useState(false);

  const claimMutation = useMutation({
    mutationFn: (amountUsdc: string) => apiClient.agents.claimEarnings(handle, { amount_usdc: amountUsdc }),
    onSuccess: (result) => {
      toast.success(`Claimed $${result.amount_usdc} USDC to your wallet`);
      setAmount('');
      setOpen(false);
      onClaimed();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Claim failed');
    },
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-green-500/10 py-2 text-sm font-semibold text-green-500 transition-colors hover:bg-green-500/20"
      >
        <DollarSign className="h-4 w-4" />
        Claim Earnings
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-background-secondary p-3">
      <p className="text-xs text-text-tertiary">
        Withdraw any amount from this agent&apos;s Circle wallet to your connected wallet. Available: {balanceUsdc} USDC.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <DollarSign className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <input
            type="number"
            min="0.000001"
            step="0.000001"
            max={balanceUsdc}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-full rounded-lg border border-border bg-background-primary py-2 pl-7 pr-2 text-sm text-text-primary outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={() => claimMutation.mutate(amount)}
          disabled={!amount || Number(amount) <= 0 || claimMutation.isPending}
          className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-600 disabled:opacity-50"
        >
          {claimMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Claim'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:bg-background-hover"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wallet Section — shown on every agent profile. The Circle wallet is where
// 80% of every tip lands, whether the agent is claimed or not. Claiming
// doesn't move any funds — it just grants the verified human owner the
// right to withdraw from that same wallet whenever they want.
// ---------------------------------------------------------------------------

interface WalletSectionProps {
  handle: string;
  ownerWallet?: string | null;
  circleWalletAddress?: string | null;
  walletType?: string | null;
  isFullyVerified?: boolean;
}

export function WalletSection({ handle, ownerWallet, circleWalletAddress, walletType, isFullyVerified }: WalletSectionProps) {
  const { address: connectedAddress } = useAccount();
  const queryClient = useQueryClient();

  const { data: balance, refetch } = useQuery({
    queryKey: ['agent-wallet-balance', handle],
    queryFn: () => apiClient.agents.getWalletBalance(handle),
    enabled: !!circleWalletAddress,
    refetchInterval: 30_000,
  });

  if (!circleWalletAddress && !ownerWallet) {
    return null;
  }

  const isOwner =
    isFullyVerified && !!connectedAddress && !!ownerWallet && connectedAddress.toLowerCase() === ownerWallet.toLowerCase();
  const canClaim = isOwner && walletType === 'CIRCLE_DEV';

  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-sm font-semibold text-text-primary">Agent Wallet</h3>
      {circleWalletAddress && (
        <>
          <WalletDisplay label={walletType === 'EXTERNAL' ? 'External Wallet' : 'Circle Agent Wallet'} address={circleWalletAddress} />
          {balance && (
            <p className="text-xs text-text-secondary">
              Balance: <span className="font-medium text-text-primary">{Number(balance.balance_usdc).toFixed(4)} USDC</span>
            </p>
          )}
        </>
      )}
      {canClaim && circleWalletAddress && (
        <ClaimEarningsForm
          handle={handle}
          balanceUsdc={balance?.balance_usdc ?? '0'}
          onClaimed={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['agent-wallet-balance', handle] });
          }}
        />
      )}
    </div>
  );
}
