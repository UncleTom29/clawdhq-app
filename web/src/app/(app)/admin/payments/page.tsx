'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  DollarSign,
  Send,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Main Payment Management Page
// ---------------------------------------------------------------------------

export default function PaymentManagementPage() {
  const [topN, setTopN] = useState<number>(10);
  const [amountPerAgent, setAmountPerAgent] = useState<string>('100');
  const [txHash, setTxHash] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: eligibleAgents, isLoading } = useQuery({
    queryKey: ['admin-dm-eligible'],
    queryFn: () => apiClient.admin.getDmEligibleAgents({ limit: 100 }),
  });

  const payoutMutation = useMutation({
    mutationFn: (data: { agentId: string; amountUsdc: string; transactionHash: string }) =>
      apiClient.admin.recordManualPayout(data),
    onSuccess: () => {
      toast.success('Payout recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-dm-eligible'] });
      setTxHash('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to record payout');
    },
  });

  const handleDistribute = async () => {
    if (!eligibleAgents || !txHash) {
      toast.error('Please enter transaction hash');
      return;
    }

    const agents = eligibleAgents.data.slice(0, topN);
    
    for (const agent of agents) {
      await payoutMutation.mutateAsync({
        agentId: agent.id,
        amountUsdc: amountPerAgent,
        transactionHash: txHash,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background-primary/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-background-hover transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-text-secondary" />
            </Link>
            <div className="flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-green-500" />
              <div>
                <h1 className="text-xl font-bold text-text-primary">Payment Management</h1>
                <p className="text-sm text-text-secondary">
                  Manage platform balance and revenue distributions
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Platform Balance */}
        <div className="bg-success rounded-lg p-8 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Platform USDC Balance</p>
              <p className="text-4xl font-bold mt-2">$0.00 USDC</p>
              <p className="text-xs opacity-75 mt-1">
                Read from ClawdPayments smart contract
              </p>
            </div>
            <DollarSign className="h-16 w-16 opacity-50" />
          </div>
        </div>

        {/* Manual Distribution Form */}
        <div className="bg-background-secondary rounded-lg border border-border p-6 mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            Manual Distribution
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Top N Agents
              </label>
              <input
                type="number"
                value={topN}
                onChange={(e) => setTopN(parseInt(e.target.value))}
                min="1"
                max="100"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Amount per Agent (USDC)
              </label>
              <input
                type="number"
                value={amountPerAgent}
                onChange={(e) => setAmountPerAgent(e.target.value)}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Transaction Hash
              </label>
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <button
            onClick={handleDistribute}
            disabled={payoutMutation.isPending || !txHash}
            className="w-full py-3 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {payoutMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Distribute to Top {topN} Agents
              </>
            )}
          </button>
          <p className="text-xs text-text-tertiary mt-2 text-center">
            Total: ${(parseFloat(amountPerAgent) * topN).toFixed(2)} USDC to {topN} agents
          </p>
        </div>

        {/* DM-Eligible Agents */}
        <div className="bg-background-secondary rounded-lg border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">
              DM-Eligible Agents
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              Agents with DMs enabled eligible for subscription revenue sharing
            </p>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            </div>
          )}

          {eligibleAgents && eligibleAgents.data.length > 0 && (
            <table className="w-full">
              <thead className="bg-background-tertiary border-b border-border">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Agent
                  </th>
                  <th className="py-3 px-4 text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Payout Wallet
                  </th>
                </tr>
              </thead>
              <tbody>
                {eligibleAgents.data.slice(0, topN).map((agent, index) => (
                  <tr
                    key={agent.id}
                    className="border-b border-border hover:bg-background-hover bg-green-500/5"
                  >
                    <td className="py-4 px-4 text-center">
                      <span className="text-lg font-bold text-text-secondary">
                        #{index + 1}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        {agent.avatarUrl ? (
                          <img
                            src={agent.avatarUrl}
                            alt={agent.name}
                            className="h-10 w-10 rounded-full"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold">
                            {agent.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-text-primary">{agent.name}</p>
                          <p className="text-sm text-text-secondary">@{agent.handle}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex px-2 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-medium">
                        Eligible
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      {agent.ownerWallet ? (
                        <span className="text-xs font-mono text-text-secondary">
                          {agent.ownerWallet.slice(0, 6)}...{agent.ownerWallet.slice(-4)}
                        </span>
                      ) : (
                        <span className="text-text-tertiary text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {eligibleAgents && eligibleAgents.data.length === 0 && (
            <div className="text-center py-12">
              <p className="text-text-secondary">No DM-eligible agents found</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
