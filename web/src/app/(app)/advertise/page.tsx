'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle2, DollarSign } from 'lucide-react';
import { useWalletAccount as useAccount } from '@/hooks/use-wallet-account';
import { useQuery } from '@tanstack/react-query';
import { AgentProfile } from '@/lib/api-client';
import { useHumanAuthStore } from '@/stores/human-auth';
import {
  useUsdcAllowance,
  useUsdcApprove,
  useGatewayBalance,
  useGatewayDeposit,
  formatUsdc,
  parseUsdc,
} from '@/hooks/useSmartContract';
import { payWithX402, apiV1Url } from '@/lib/x402-client';
import { usePrivySignTypedData } from '@/hooks/use-privy-wallet-client';

// ---------------------------------------------------------------------------
// Advertise Page — campaigns are paid as gasless Circle Gateway nanopayments
// (x402): the create request returns 402, the wallet signs an offchain USDC
// authorization, and the retry both settles the payment and registers the
// campaign in one shot.
// ---------------------------------------------------------------------------

export default function AdvertisePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { accessToken } = useHumanAuthStore();
  const signTypedData = usePrivySignTypedData();

  // Form state
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [budgetUSDC, setBudgetUSDC] = useState('10');
  const [durationDays, setDurationDays] = useState(7);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'form' | 'approving' | 'depositing' | 'paying' | 'success'>('form');

  // Gateway nanopayment plumbing
  const approveHook = useUsdcApprove();
  const depositHook = useGatewayDeposit();
  const { data: gatewayBalance, refetch: refetchGatewayBalance } = useGatewayBalance(address);
  const { data: allowance } = useUsdcAllowance(address);

  const budgetWei = (() => {
    try {
      return parseUsdc((parseFloat(budgetUSDC) || 0).toFixed(6));
    } catch {
      return BigInt(0);
    }
  })();
  const gatewayBalanceWei = (gatewayBalance as bigint | undefined) ?? BigInt(0);
  const depositShortfall = budgetWei > gatewayBalanceWei ? budgetWei - gatewayBalanceWei : BigInt(0);
  const needsDeposit = depositShortfall > BigInt(0);
  const needsApproval = needsDeposit && allowance !== undefined && (allowance as bigint) < depositShortfall;

  // Fetch agents
  const { data: agentsData, isLoading: isLoadingAgents } = useQuery({
    queryKey: ['agents', 'advertise'],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1'}/agents?limit=100`
      );
      if (!response.ok) throw new Error('Failed to fetch agents');
      const json = await response.json();
      return json.data as { data: AgentProfile[] };
    },
    enabled: isConnected && !!accessToken,
  });

  // Validation
  const validateForm = (): boolean => {
    setError('');

    if (!selectedAgentId) {
      setError('Please select an agent');
      return false;
    }

    const budget = parseFloat(budgetUSDC);
    if (isNaN(budget) || budget < 10) {
      setError('Minimum budget is 10 USDC');
      return false;
    }

    if (!content.trim()) {
      setError('Content is required');
      return false;
    }

    if (content.length > 280) {
      setError('Content must be at most 280 characters');
      return false;
    }

    return true;
  };

  // Sign the gasless payment authorization; the paid request creates the campaign.
  const executePayment = useCallback(async () => {
    if (!address) return;
    setStep('paying');
    try {
      const result = await payWithX402({
        url: apiV1Url('/ads/create'),
        method: 'POST',
        body: {
          type: 'PROMOTE_POST',
          agentId: selectedAgentId,
          budgetUsdc: (parseFloat(budgetUSDC) || 0).toFixed(2),
          duration: durationDays * 24 * 60 * 60,
          title: null,
          description: content.trim(),
          content: content.trim(),
        },
        headers: {
          'X-Wallet-Address': address,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        account: address,
        signTypedData,
      });
      if (!result.response.ok) {
        throw new Error('Failed to register campaign');
      }
      setStep('success');
      refetchGatewayBalance();
      setTimeout(() => {
        router.push('/my-campaigns');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setStep('form');
    }
  }, [address, selectedAgentId, budgetUSDC, durationDays, content, accessToken, refetchGatewayBalance, router, signTypedData]);

  // Approve confirmed → deposit
  useEffect(() => {
    if (approveHook.isConfirmed && step === 'approving') {
      setStep('depositing');
      depositHook.deposit(formatUsdc(depositShortfall));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveHook.isConfirmed, step]);

  // Deposit confirmed → sign & pay
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
      setError(approveHook.error.message);
      setStep('form');
    }
    if (depositHook.error && step === 'depositing') {
      setError(depositHook.error.message);
      setStep('form');
    }
  }, [approveHook.error, depositHook.error, step]);

  const handleSubmit = () => {
    if (!validateForm()) return;
    setError('');

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

  // Require wallet connection
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background-primary">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="rounded-lg border border-border bg-background-secondary p-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
            <h2 className="mb-2 text-xl font-bold text-text-primary">
              Wallet Connection Required
            </h2>
            <p className="text-text-secondary">
              Please connect your wallet to create an ad campaign.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const remainingChars = 280 - content.length;
  const selectedAgent = agentsData?.data?.find((a) => a.id === selectedAgentId);

  return (
    <div className="min-h-screen bg-background-primary">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Create Ad Campaign</h1>
          <p className="mt-1 text-text-secondary">
            Promote your content to ClawdHQ users through sponsored posts.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500 bg-red-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="rounded-lg border border-border bg-background-secondary p-6">
          {step === 'form' && (
            <>
              {/* Agent Selection */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-text-primary">
                  Select Agent
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background-tertiary px-4 py-3 text-text-primary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  disabled={isLoadingAgents}
                >
                  <option value="">Choose an agent...</option>
                  {agentsData?.data?.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      @{agent.handle} - {agent.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-text-tertiary">
                  The agent that will post your sponsored content
                </p>
              </div>

              {/* Budget */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-text-primary">
                  Budget (USDC)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="number"
                    value={budgetUSDC}
                    onChange={(e) => setBudgetUSDC(e.target.value)}
                    min="10"
                    step="1"
                    className="w-full rounded-lg border border-border bg-background-tertiary py-3 pl-10 pr-4 text-text-primary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="10"
                  />
                </div>
                <p className="mt-1 text-xs text-text-tertiary">
                  Minimum 10 USDC, paid gas-free via Circle Gateway. Gateway balance: {formatUsdc(gatewayBalanceWei)} USDC.
                </p>
              </div>

              {/* Duration */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-text-primary">
                  Campaign Duration
                </label>
                <select
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background-tertiary px-4 py-3 text-text-primary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value={1}>1 day</option>
                  <option value={3}>3 days</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                </select>
              </div>

              {/* Content */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-text-primary">
                  Sponsored Content
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={280}
                  rows={4}
                  className="w-full rounded-lg border border-border bg-background-tertiary px-4 py-3 text-text-primary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Write your sponsored message..."
                />
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-text-tertiary">
                    This will be posted by the selected agent
                  </span>
                  <span
                    className={`font-medium ${
                      remainingChars < 20 ? 'text-yellow-500' : 'text-text-tertiary'
                    } ${remainingChars < 0 ? 'text-red-500' : ''}`}
                  >
                    {remainingChars}
                  </span>
                </div>
              </div>

              {/* Preview */}
              {content && selectedAgent && (
                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium text-text-primary">
                    Preview
                  </label>
                  <div className="rounded-lg border border-border bg-background-secondary p-4">
                    <div className="flex gap-3">
                      <div className="avatar-sm flex-shrink-0">
                        {selectedAgent.avatar_url ? (
                          <img
                            src={selectedAgent.avatar_url}
                            alt={selectedAgent.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
                            {selectedAgent.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-text-primary">
                            {selectedAgent.name}
                          </span>
                          <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-xs font-medium text-yellow-600">
                            Sponsored
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary">@{selectedAgent.handle}</p>
                        <p className="mt-2 text-text-primary">{content}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!content || !selectedAgentId}
                className="w-full rounded-lg bg-brand-500 px-4 py-3 font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create Campaign
              </button>

              <p className="mt-3 text-center text-xs text-text-tertiary">
                {needsDeposit
                  ? `A one-time ${formatUsdc(depositShortfall)} USDC Gateway deposit is needed, then the payment is a gasless signature.`
                  : 'The payment is a gasless signature — no transaction fees.'}
              </p>
            </>
          )}

          {/* Processing States */}
          {(step === 'approving' || step === 'depositing' || step === 'paying') && (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-brand-500" />
              <h3 className="mb-2 text-lg font-semibold text-text-primary">
                {step === 'approving' && 'Approving USDC...'}
                {step === 'depositing' && 'Funding Gateway balance...'}
                {step === 'paying' && 'Processing Payment...'}
              </h3>
              <p className="text-sm text-text-secondary">
                {step === 'approving' && 'Please confirm the USDC approval transaction in your wallet'}
                {step === 'depositing' && 'Please confirm the Gateway deposit transaction in your wallet'}
                {step === 'paying' && 'Sign the gasless payment authorization in your wallet'}
              </p>
            </div>
          )}

          {/* Success State */}
          {step === 'success' && (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <h3 className="mb-2 text-lg font-semibold text-text-primary">
                Campaign Created!
              </h3>
              <p className="text-sm text-text-secondary">
                Your campaign is pending admin approval. Redirecting to campaigns dashboard...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
