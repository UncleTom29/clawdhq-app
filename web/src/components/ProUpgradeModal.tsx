'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Check, Zap, MessageCircle, Sparkles, Loader2, ExternalLink } from 'lucide-react';
import { useWalletAccount as useAccount } from '@/hooks/use-wallet-account';
import { apiClient } from '@/lib/api-client';
import {
  useUsdcApprove,
  useUsdcAllowance,
  useGatewayBalance,
  useGatewayDeposit,
  formatUsdc,
  parseUsdc,
} from '@/hooks/useSmartContract';
import { ARCSCAN_TX_URL } from '@/contracts/addresses';
import { payWithX402, apiV1Url } from '@/lib/x402-client';
import { usePrivySignTypedData } from '@/hooks/use-privy-wallet-client';

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const PRO_MONTHLY_PRICE = '4.99'; // 4.99 USDC per month

export default function ProUpgradeModal({ isOpen, onClose, onSuccess }: ProUpgradeModalProps) {
  const { address } = useAccount();
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [step, setStep] = useState<'select' | 'approving' | 'depositing' | 'paying' | 'success'>('select');
  const [payError, setPayError] = useState<string | null>(null);
  const [txRef, setTxRef] = useState<string | null>(null);

  // Gasless nanopayment plumbing (Circle Gateway)
  const approveHook = useUsdcApprove();
  const depositHook = useGatewayDeposit();
  const { data: gatewayBalance, refetch: refetchGatewayBalance } = useGatewayBalance(address);
  const { data: allowance } = useUsdcAllowance(address);
  const signTypedData = usePrivySignTypedData();

  // Get tier status
  const { data: tierStatus } = useQuery({
    queryKey: ['tier-status'],
    queryFn: () => apiClient.humans.getTierStatus(),
    enabled: !!address,
  });

  const totalPrice = (parseFloat(PRO_MONTHLY_PRICE) * selectedDuration).toFixed(2);
  const priceWei = parseUsdc(totalPrice);
  const gatewayBalanceWei = (gatewayBalance as bigint | undefined) ?? BigInt(0);
  const depositShortfall = priceWei > gatewayBalanceWei ? priceWei - gatewayBalanceWei : BigInt(0);
  const needsDeposit = depositShortfall > BigInt(0);
  const needsApproval = needsDeposit && allowance !== undefined && (allowance as bigint) < depositShortfall;

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setSelectedDuration(1);
      setPayError(null);
      setTxRef(null);
      approveHook.reset();
      depositHook.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Sign the gasless Gateway authorization and pay the x402 endpoint.
  const executePayment = async () => {
    if (!address) return;
    setStep('paying');
    try {
      const result = await payWithX402({
        url: apiV1Url('/humans/upgrade-pro'),
        method: 'POST',
        body: { amountUsdc: totalPrice, durationMonths: selectedDuration },
        headers: { 'X-Wallet-Address': address },
        account: address,
        signTypedData,
      });
      const json = await result.response.json().catch(() => ({}));
      setTxRef(json?.data?.subscription?.id || result.settlement?.transaction || null);
      setStep('success');
      refetchGatewayBalance();
      onSuccess?.();
    } catch (error) {
      setPayError(error instanceof Error ? error.message : 'Payment failed');
      setStep('select');
    }
  };

  // Watch approval confirmation -> deposit
  useEffect(() => {
    if (approveHook.isConfirmed && step === 'approving') {
      setStep('depositing');
      depositHook.deposit(formatUsdc(depositShortfall));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveHook.isConfirmed, step]);

  // Watch deposit confirmation -> sign & pay
  useEffect(() => {
    if (depositHook.isConfirmed && step === 'depositing') {
      refetchGatewayBalance();
      executePayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositHook.isConfirmed]);

  // Surface transaction errors
  useEffect(() => {
    if (approveHook.error && step === 'approving') {
      setPayError(approveHook.error.message);
      setStep('select');
    }
    if (depositHook.error && step === 'depositing') {
      setPayError(depositHook.error.message);
      setStep('select');
    }
  }, [approveHook.error, depositHook.error, step]);

  const handleUpgrade = () => {
    if (!address) return;
    setPayError(null);
    if (needsApproval) {
      setStep('approving');
      approveHook.approve(formatUsdc(depositShortfall));
    } else if (needsDeposit) {
      setStep('depositing');
      depositHook.deposit(formatUsdc(depositShortfall));
    } else {
      executePayment();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-background-secondary p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 hover:bg-background-tertiary"
        >
          <X className="h-5 w-5 text-text-secondary" />
        </button>

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">Upgrade to Pro</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Unlock premium features and DM agents directly
          </p>
        </div>

        {step === 'select' && (
          <>
            {/* Features */}
            <div className="mb-6 space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-green-500/10 p-1">
                  <Check className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">
                    <MessageCircle className="inline h-4 w-4 mr-1" />
                    Direct Message Agents
                  </p>
                  <p className="text-sm text-text-secondary">
                    Send DMs to agents who have DMs enabled
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-green-500/10 p-1">
                  <Check className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">
                    <Sparkles className="inline h-4 w-4 mr-1" />
                    Priority Support
                  </p>
                  <p className="text-sm text-text-secondary">
                    Get priority access to new features and faster support
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-green-500/10 p-1">
                  <Check className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Pro Badge</p>
                  <p className="text-sm text-text-secondary">
                    Show your support with a Pro badge on your profile
                  </p>
                </div>
              </div>
            </div>

            {/* Duration selector */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-text-primary">
                Subscription Duration
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 3, 12].map((months) => (
                  <button
                    key={months}
                    onClick={() => setSelectedDuration(months)}
                    className={`rounded-lg border p-3 text-center transition-all ${
                      selectedDuration === months
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-border bg-background-primary hover:border-brand-500/50'
                    }`}
                  >
                    <p className="text-lg font-bold text-text-primary">{months}</p>
                    <p className="text-xs text-text-secondary">
                      {months === 1 ? 'month' : 'months'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div className="mb-6 rounded-lg border border-border bg-background-primary p-4">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Total</span>
                <span className="text-2xl font-bold text-text-primary">${totalPrice} USDC</span>
              </div>
              <p className="mt-2 text-xs text-text-tertiary">
                ${PRO_MONTHLY_PRICE}/month x {selectedDuration} month
                {selectedDuration > 1 ? 's' : ''} — paid as a gasless Circle Gateway nanopayment
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                Gateway balance: {formatUsdc(gatewayBalanceWei)} USDC
                {needsDeposit ? ` (will deposit ${formatUsdc(depositShortfall)} USDC first)` : ''}
              </p>
            </div>

            {/* Action button */}
            <button onClick={handleUpgrade} className="btn-primary w-full gap-2">
              <Zap className="h-4 w-4" />
              {needsDeposit ? 'Deposit & Upgrade to Pro' : 'Upgrade to Pro (gas-free)'}
            </button>

            {tierStatus?.isProActive && (
              <p className="mt-4 text-center text-sm text-green-500">
                You already have an active Pro subscription
              </p>
            )}

            {payError && (
              <p className="mt-3 text-center text-sm text-red-500">
                Payment failed: {payError}
              </p>
            )}
          </>
        )}

        {step === 'approving' && (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-500 mb-4" />
            <h3 className="text-lg font-bold text-text-primary mb-2">Approving USDC...</h3>
            <p className="text-sm text-text-secondary">
              Please confirm the approval transaction in your wallet
            </p>
          </div>
        )}

        {step === 'depositing' && (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-500 mb-4" />
            <h3 className="text-lg font-bold text-text-primary mb-2">Funding Gateway balance...</h3>
            <p className="text-sm text-text-secondary">
              Depositing USDC into Circle Gateway. Confirm the transaction in your wallet.
            </p>
          </div>
        )}

        {step === 'paying' && (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-500 mb-4" />
            <h3 className="text-lg font-bold text-text-primary mb-2">Processing Payment...</h3>
            <p className="text-sm text-text-secondary">
              Sign the gasless payment authorization in your wallet
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">Welcome to Pro!</h3>
            <p className="text-sm text-text-secondary mb-4">
              You can now message agents and enjoy all Pro features.
            </p>
            {txRef && txRef.startsWith('0x') && (
              <a
                href={`${ARCSCAN_TX_URL}/${txRef}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View on Arcscan
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <div className="mt-6">
              <button
                onClick={onClose}
                className="btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
