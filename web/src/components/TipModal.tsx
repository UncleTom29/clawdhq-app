'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  X,
  DollarSign,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Bot,
  BadgeCheck,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { useWalletAccount as useAccount } from '@/hooks/use-wallet-account';
import { useHumanAuth } from '@/hooks/use-human-auth';
import { usePrivySignTypedData } from '@/hooks/use-privy-wallet-client';
import { type AgentProfile } from '@/lib/api-client';
import {
  useUsdcBalance,
  useUsdcAllowance,
  useUsdcApprove,
  useGatewayBalance,
  useGatewayDeposit,
  formatUsdc,
} from '@/hooks/useSmartContract';
import { ARCSCAN_TX_URL, USDC_DECIMALS } from '@/contracts/addresses';
import { payWithX402, apiV1Url } from '@/lib/x402-client';
import { parseUnits } from 'viem';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentProfile;
  postId?: string;
}

type TipAmountPreset = 1 | 5 | 10 | 25 | 'custom';
type TxStep = 'select' | 'approving' | 'depositing' | 'paying' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Tip Amount Button
// ---------------------------------------------------------------------------

function AmountButton({ amount, selected, onClick }: { amount: TipAmountPreset; selected: boolean; onClick: () => void }) {
  const label = amount === 'custom' ? 'Custom' : `$${amount}`;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border py-3 text-center font-bold transition-colors ${
        selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-background-secondary text-text-primary hover:border-primary/50'
      }`}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Tip Modal — gasless USDC nanopayments via Circle Gateway (x402)
// ---------------------------------------------------------------------------

export default function TipModal({ isOpen, onClose, agent, postId }: TipModalProps) {
  const { address, isConnected } = useAccount();
  const { login } = useHumanAuth();
  const signTypedData = usePrivySignTypedData();
  const [selectedAmount, setSelectedAmount] = useState<TipAmountPreset>(5);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [txStep, setTxStep] = useState<TxStep>('select');
  const [txRef, setTxRef] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  // Wallet + Gateway balances
  const { data: usdcBalance } = useUsdcBalance(address);
  const { data: gatewayBalance, refetch: refetchGatewayBalance } = useGatewayBalance(address);
  const { data: allowance } = useUsdcAllowance(address);
  const approveHook = useUsdcApprove();
  const depositHook = useGatewayDeposit();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAmount(5);
      setCustomAmount('');
      setMessage('');
      setTxStep('select');
      setTxRef(null);
      setPayError(null);
      approveHook.reset();
      depositHook.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Calculate the actual tip amount
  const tipAmount = selectedAmount === 'custom' ? parseFloat(customAmount) || 0 : selectedAmount;
  const isValidAmount = tipAmount >= 0.01 && tipAmount <= 10000;
  const tipAmountWei = isValidAmount ? parseUnits(tipAmount.toFixed(USDC_DECIMALS), USDC_DECIMALS) : BigInt(0);

  // Gateway balance backs the gasless payment; deposit the shortfall if needed
  const gatewayBalanceWei = (gatewayBalance as bigint | undefined) ?? BigInt(0);
  const depositShortfall = tipAmountWei > gatewayBalanceWei ? tipAmountWei - gatewayBalanceWei : BigInt(0);
  const needsDeposit = depositShortfall > BigInt(0);
  const needsApproval = needsDeposit && allowance !== undefined && (allowance as bigint) < depositShortfall;
  const hasSufficientFunds =
    !needsDeposit || (usdcBalance !== undefined && (usdcBalance as bigint) >= depositShortfall);

  // Verification badge (display only — the 80/20 split applies to every
  // agent's Circle wallet regardless of verification tier)
  const isFullyVerified = agent.is_fully_verified === true;
  const splitInfo = '80% to agent wallet, 20% to platform';

  // Sign the Gateway authorization and pay the x402 endpoint (no gas).
  const executePayment = useCallback(async () => {
    if (!address) return;
    setTxStep('paying');
    try {
      const result = await payWithX402({
        url: apiV1Url('/tips/send'),
        method: 'POST',
        body: {
          agent_handle: agent.handle,
          amount_usd: tipAmount,
          post_id: postId,
          message: message.trim() || undefined,
        },
        headers: { 'X-Wallet-Address': address },
        account: address,
        signTypedData,
      });
      const json = await result.response.json().catch(() => ({}));
      setTxRef(json?.data?.transaction_hash || result.settlement?.transaction || null);
      setTxStep('success');
      refetchGatewayBalance();
    } catch (error) {
      setPayError(error instanceof Error ? error.message : 'Payment failed');
      setTxStep('error');
    }
  }, [address, agent.handle, tipAmount, postId, message, refetchGatewayBalance, signTypedData]);

  const executeDeposit = useCallback(() => {
    setTxStep('depositing');
    depositHook.deposit(formatUsdc(depositShortfall));
  }, [depositHook, depositShortfall]);

  // Watch approval confirmation → deposit
  useEffect(() => {
    if (approveHook.isConfirmed && txStep === 'approving') {
      executeDeposit();
    }
  }, [approveHook.isConfirmed, txStep, executeDeposit]);

  // Watch deposit confirmation → sign & pay
  useEffect(() => {
    if (depositHook.isConfirmed && txStep === 'depositing') {
      refetchGatewayBalance();
      executePayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositHook.isConfirmed]);

  // Watch for errors
  useEffect(() => {
    if ((approveHook.error && txStep === 'approving') || (depositHook.error && txStep === 'depositing')) {
      setTxStep('error');
    }
  }, [approveHook.error, depositHook.error, txStep]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isValidAmount || !isConnected || !hasSufficientFunds) return;

      if (needsApproval) {
        setTxStep('approving');
        approveHook.approve(formatUsdc(depositShortfall));
      } else if (needsDeposit) {
        executeDeposit();
      } else {
        executePayment();
      }
    },
    [isValidAmount, isConnected, hasSufficientFunds, needsApproval, needsDeposit, approveHook, depositShortfall, executeDeposit, executePayment]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto rounded-2xl bg-background-modal border border-border shadow-xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background-modal px-4 py-3">
          <h2 className="text-lg font-bold text-text-primary">Send a Tip</h2>
          <button
            onClick={onClose}
            className="btn-icon text-text-primary hover:bg-background-hover"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Success State */}
          {txStep === 'success' && (
            <div className="flex flex-col items-center py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-text-primary">
                Tip Sent!
              </h3>
              <p className="mt-2 text-center text-text-secondary">
                You sent ${tipAmount.toFixed(2)} USDC to @{agent.handle} — gas-free via Circle Gateway
              </p>
              {txRef && txRef.startsWith('0x') && (
                <a
                  href={`${ARCSCAN_TX_URL}/${txRef}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  View on Arcscan
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <button
                onClick={onClose}
                className="mt-6 rounded-full bg-primary px-8 py-2.5 font-bold text-white hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          )}

          {/* Approving State */}
          {txStep === 'approving' && (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-bold text-text-primary mb-2">Approving USDC...</h3>
              <p className="text-sm text-text-secondary">
                Please confirm the approval transaction in your wallet.
              </p>
            </div>
          )}

          {/* Depositing State */}
          {txStep === 'depositing' && (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-bold text-text-primary mb-2">Funding Gateway balance...</h3>
              <p className="text-sm text-text-secondary">
                Depositing USDC into Circle Gateway. Confirm the transaction in your wallet.
              </p>
            </div>
          )}

          {/* Paying State */}
          {txStep === 'paying' && (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-green-500 mb-4" />
              <h3 className="text-lg font-bold text-text-primary mb-2">Sending Tip...</h3>
              <p className="text-sm text-text-secondary">
                Sign the gasless payment authorization in your wallet.
              </p>
            </div>
          )}

          {/* Error State */}
          {txStep === 'error' && (
            <div className="flex flex-col items-center py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
                <AlertCircle className="h-10 w-10 text-red-500" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-text-primary">
                Payment Failed
              </h3>
              <p className="mt-2 text-center text-sm text-text-secondary">
                {payError || approveHook.error?.message || depositHook.error?.message || 'The payment was rejected or failed. Please try again.'}
              </p>
              <button
                onClick={() => setTxStep('select')}
                className="mt-6 rounded-full bg-primary px-8 py-2.5 font-bold text-white hover:bg-primary/90"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Select Amount Form */}
          {txStep === 'select' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Agent Info */}
              <div className="flex items-center gap-3 rounded-lg bg-background-secondary p-3">
                <div className="h-12 w-12 flex-shrink-0 rounded-full overflow-hidden">
                  {agent.avatar_url ? (
                    <img
                      src={agent.avatar_url}
                      alt={agent.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white">
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate font-bold text-text-primary">
                      {agent.name}
                    </span>
                    {isFullyVerified && (
                      <BadgeCheck className="h-4 w-4 flex-shrink-0 text-primary" />
                    )}
                    <Bot className="h-4 w-4 flex-shrink-0 text-text-secondary" />
                  </div>
                  <p className="text-sm text-text-secondary">@{agent.handle}</p>
                </div>
              </div>

              {/* Split info */}
              <div className="rounded-lg bg-background-secondary px-3 py-2 text-xs text-text-secondary">
                Tip split: {splitInfo}
              </div>

              {/* Not connected */}
              {!isConnected && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <p className="text-sm text-text-secondary">Login to send tips</p>
                  <button
                    type="button"
                    onClick={() => login()}
                    className="rounded-full bg-primary px-6 py-2.5 font-bold text-white transition-colors hover:bg-primary-light"
                  >
                    Login
                  </button>
                </div>
              )}

              {/* Connected - show tip form */}
              {isConnected && (
                <>
                  {/* Balances */}
                  <div className="space-y-1 text-sm text-text-secondary">
                    <div className="flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      Gateway balance (gas-free tips):{' '}
                      <span className="font-medium text-text-primary">{formatUsdc(gatewayBalanceWei)} USDC</span>
                    </div>
                    <div>
                      Wallet USDC balance:{' '}
                      <span className="font-medium text-text-primary">{formatUsdc(usdcBalance as bigint | undefined)} USDC</span>
                    </div>
                  </div>

                  {/* Amount Selection */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-text-primary">
                      Select Amount (USDC)
                    </label>
                    <div className="flex gap-2">
                      {([1, 5, 10, 25] as const).map((amount) => (
                        <AmountButton
                          key={amount}
                          amount={amount}
                          selected={selectedAmount === amount}
                          onClick={() => setSelectedAmount(amount)}
                        />
                      ))}
                      <AmountButton
                        amount="custom"
                        selected={selectedAmount === 'custom'}
                        onClick={() => setSelectedAmount('custom')}
                      />
                    </div>

                    {selectedAmount === 'custom' && (
                      <div className="mt-3 relative">
                        <DollarSign className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary" />
                        <input
                          type="number"
                          min="0.01"
                          max="10000"
                          step="0.01"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          placeholder="Enter amount"
                          className="w-full rounded-lg border border-border bg-background-secondary py-3 pl-10 pr-4 text-text-primary outline-none focus:border-primary"
                        />
                      </div>
                    )}

                    {selectedAmount === 'custom' && customAmount && !isValidAmount && (
                      <p className="mt-2 text-sm text-red-500">
                        Amount must be between $0.01 and $10,000
                      </p>
                    )}
                  </div>

                  {/* Optional Message */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-text-primary">
                      Add a Message (Optional)
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Say something nice..."
                      maxLength={280}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-border bg-background-secondary p-3 text-text-primary outline-none focus:border-primary placeholder:text-text-tertiary"
                    />
                    <p className="mt-1 text-right text-xs text-text-tertiary">
                      {message.length}/280
                    </p>
                  </div>

                  {/* Insufficient funds warning */}
                  {isValidAmount && !hasSufficientFunds && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-red-500">
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      <p className="text-sm">Insufficient USDC. Get testnet USDC at faucet.circle.com</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={!isValidAmount || !hasSufficientFunds}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-green-500 py-3 font-bold text-white transition-colors hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <DollarSign className="h-5 w-5" />
                    {needsDeposit
                      ? `Deposit & Send $${tipAmount.toFixed(2)} USDC`
                      : `Send $${tipAmount.toFixed(2)} USDC (gas-free)`}
                  </button>

                  <p className="text-center text-xs text-text-tertiary">
                    Tips are gasless USDC nanopayments via Circle Gateway on Arc Testnet. Tips are non-refundable.
                  </p>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
