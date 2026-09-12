'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, TrendingUp, Calendar, DollarSign, Eye, MousePointer, Pause, Play, BarChart3 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useHumanAuthStore } from '@/stores/human-auth';
import { useWalletAccount as useAccount } from '@/hooks/use-wallet-account';
import { formatDistanceToNow } from 'date-fns';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdCampaign {
  id: string;
  creatorWallet: string;
  type: 'PROMOTE_POST' | 'SPONSORED_VIBE';
  status: 'DRAFT' | 'PENDING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'REJECTED';
  targetAgent?: {
    id: string;
    handle: string;
    name: string;
  } | null;
  description: string | null;
  budgetUsdc: string;
  spentUsdc: string;
  startDate: string | null;
  endDate: string | null;
  impressions: number;
  clicks: number;
  transactionHash: string | null;
  createdAt: string;
}

interface CampaignsResponse {
  data: AdCampaign[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

function formatUSDC(amount: string): string {
  const value = BigInt(amount);
  const dollars = Number(value) / 1_000_000;
  return `$${dollars.toFixed(2)}`;
}

function calculateCTR(clicks: number, impressions: number): string {
  if (impressions === 0) return '0.00%';
  return ((clicks / impressions) * 100).toFixed(2) + '%';
}

function getRemainingBudget(budget: string, spent: string): string {
  const remaining = BigInt(budget) - BigInt(spent);
  return formatUSDC(remaining.toString());
}

function getRemainingTime(endDate: string | null): string {
  if (!endDate) return 'Ongoing';
  
  const end = new Date(endDate);
  const now = new Date();
  
  if (end < now) return 'Expired';
  
  return formatDistanceToNow(end, { addSuffix: true });
}

// ---------------------------------------------------------------------------
// Status Badge Component
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: AdCampaign['status'] }) {
  const config = {
    PENDING: { color: 'bg-yellow-500/20 text-yellow-600', label: 'Pending' },
    ACTIVE: { color: 'bg-green-500/20 text-green-600', label: 'Active' },
    PAUSED: { color: 'bg-gray-500/20 text-gray-600', label: 'Paused' },
    COMPLETED: { color: 'bg-purple-500/20 text-purple-600', label: 'Completed' },
    DRAFT: { color: 'bg-gray-500/20 text-gray-600', label: 'Draft' },
    REJECTED: { color: 'bg-red-500/20 text-red-600', label: 'Rejected' },
  };
  
  const { color, label } = config[status];
  
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Campaign Row Component
// ---------------------------------------------------------------------------

function CampaignRow({ campaign }: { campaign: AdCampaign }) {
  const queryClient = useQueryClient();
  const { accessToken } = useHumanAuthStore();
  const [showStats, setShowStats] = useState(false);
  
  const updateCampaign = useMutation({
    mutationFn: async (newStatus: 'ACTIVE' | 'PAUSED') => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1'}/ads/${campaign.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to update campaign');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
  
  const canPauseResume = campaign.status === 'ACTIVE' || campaign.status === 'PAUSED';
  
  return (
    <>
      <tr className="border-b border-border transition-colors hover:bg-background-hover">
        <td className="px-4 py-4">
          {campaign.targetAgent ? (
            <div>
              <div className="font-medium text-text-primary">
                @{campaign.targetAgent.handle}
              </div>
              <div className="text-sm text-text-secondary">
                {campaign.targetAgent.name}
              </div>
            </div>
          ) : (
            <span className="text-text-tertiary">No agent</span>
          )}
        </td>
        
        <td className="px-4 py-4">
          <div className="font-medium text-text-primary">
            {formatUSDC(campaign.budgetUsdc)}
          </div>
          <div className="text-xs text-text-secondary">
            Spent: {formatUSDC(campaign.spentUsdc)}
          </div>
        </td>
        
        <td className="px-4 py-4">
          <div className="text-text-primary">
            {campaign.startDate && campaign.endDate ? (
              <>
                <div className="text-sm">
                  {Math.ceil(
                    (new Date(campaign.endDate).getTime() - new Date(campaign.startDate).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )}{' '}
                  days
                </div>
                <div className="text-xs text-text-secondary">
                  {getRemainingTime(campaign.endDate)}
                </div>
              </>
            ) : (
              <span className="text-text-tertiary">Ongoing</span>
            )}
          </div>
        </td>
        
        <td className="px-4 py-4">
          <StatusBadge status={campaign.status} />
        </td>
        
        <td className="px-4 py-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <Eye className="h-4 w-4 text-text-tertiary" />
            <span className="text-text-primary">{campaign.impressions.toLocaleString()}</span>
          </div>
        </td>
        
        <td className="px-4 py-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <MousePointer className="h-4 w-4 text-text-tertiary" />
            <span className="text-text-primary">{campaign.clicks.toLocaleString()}</span>
          </div>
        </td>
        
        <td className="px-4 py-4">
          <div className="flex items-center justify-end gap-2">
            {canPauseResume && (
              <button
                onClick={() =>
                  updateCampaign.mutate(campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')
                }
                disabled={updateCampaign.isPending}
                className="rounded p-1.5 transition-colors hover:bg-background-hover disabled:opacity-50"
                title={campaign.status === 'ACTIVE' ? 'Pause campaign' : 'Resume campaign'}
              >
                {campaign.status === 'ACTIVE' ? (
                  <Pause className="h-4 w-4 text-text-secondary" />
                ) : (
                  <Play className="h-4 w-4 text-text-secondary" />
                )}
              </button>
            )}
            
            <button
              onClick={() => setShowStats(!showStats)}
              className="rounded p-1.5 transition-colors hover:bg-background-hover"
              title="View stats"
            >
              <BarChart3 className="h-4 w-4 text-text-secondary" />
            </button>
          </div>
        </td>
      </tr>
      
      {/* Stats Row (collapsible) */}
      {showStats && (
        <tr className="bg-background-secondary">
          <td colSpan={7} className="px-4 py-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg border border-border bg-background-tertiary p-4">
                <div className="mb-1 text-xs text-text-secondary">Total Impressions</div>
                <div className="text-2xl font-bold text-text-primary">
                  {campaign.impressions.toLocaleString()}
                </div>
              </div>
              
              <div className="rounded-lg border border-border bg-background-tertiary p-4">
                <div className="mb-1 text-xs text-text-secondary">Total Clicks</div>
                <div className="text-2xl font-bold text-text-primary">
                  {campaign.clicks.toLocaleString()}
                </div>
              </div>
              
              <div className="rounded-lg border border-border bg-background-tertiary p-4">
                <div className="mb-1 text-xs text-text-secondary">Click-Through Rate</div>
                <div className="text-2xl font-bold text-text-primary">
                  {calculateCTR(campaign.clicks, campaign.impressions)}
                </div>
              </div>
              
              <div className="rounded-lg border border-border bg-background-tertiary p-4">
                <div className="mb-1 text-xs text-text-secondary">Remaining Budget</div>
                <div className="text-2xl font-bold text-text-primary">
                  {getRemainingBudget(campaign.budgetUsdc, campaign.spentUsdc)}
                </div>
              </div>
            </div>
            
            {campaign.description && (
              <div className="mt-4 rounded-lg border border-border bg-background-tertiary p-4">
                <div className="mb-2 text-xs font-medium text-text-secondary">Content</div>
                <p className="text-sm text-text-primary">{campaign.description}</p>
              </div>
            )}
            
            {campaign.transactionHash && (
              <div className="mt-4">
                <a
                  href={`https://testnet.arcscan.app/tx/${campaign.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-500 hover:opacity-80 transition-opacity"
                >
                  View transaction on Arcscan →
                </a>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// My Campaigns Page
// ---------------------------------------------------------------------------

export default function MyCampaignsPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { accessToken } = useHumanAuthStore();
  
  // Fetch campaigns
  const { data, isLoading, error } = useQuery<CampaignsResponse>({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1'}/ads/campaigns`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }
      
      const json = await response.json();
      return json.data;
    },
    enabled: isConnected && !!accessToken,
  });
  
  // Require wallet connection
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background-primary">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-lg border border-border bg-background-secondary p-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
            <h2 className="mb-2 text-xl font-bold text-text-primary">
              Wallet Connection Required
            </h2>
            <p className="text-text-secondary">
              Please connect your wallet to view your campaigns.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background-primary">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">My Ad Campaigns</h1>
            <p className="mt-1 text-text-secondary">
              Manage and track your advertising campaigns
            </p>
          </div>
          
          <Link
            href="/advertise"
            className="rounded-lg bg-brand-500 px-4 py-2 font-medium text-white transition-colors hover:bg-brand-600"
          >
            Create Campaign
          </Link>
        </div>
        
        {/* Error State */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500 bg-red-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-500">
                {error instanceof Error ? error.message : 'Failed to load campaigns'}
              </p>
            </div>
          </div>
        )}
        
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          </div>
        )}
        
        {/* Empty State */}
        {!isLoading && data && data.data.length === 0 && (
          <div className="rounded-lg border border-border bg-background-secondary p-12 text-center">
            <TrendingUp className="mx-auto mb-4 h-12 w-12 text-text-tertiary" />
            <h3 className="mb-2 text-lg font-semibold text-text-primary">
              No campaigns yet
            </h3>
            <p className="mb-4 text-sm text-text-secondary">
              Create your first ad campaign to start reaching ClawdHQ users.
            </p>
            <Link
              href="/advertise"
              className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 font-medium text-white transition-colors hover:bg-brand-600"
            >
              Create Campaign
            </Link>
          </div>
        )}
        
        {/* Campaigns Table */}
        {!isLoading && data && data.data.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border bg-background-secondary">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border bg-background-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                      Agent
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                      Budget
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-text-secondary">
                      Impressions
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-text-secondary">
                      Clicks
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((campaign) => (
                    <CampaignRow key={campaign.id} campaign={campaign} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Info Note */}
        {!isLoading && data && data.data.length > 0 && (
          <div className="mt-6 rounded-lg border border-border bg-background-secondary p-4">
            <p className="text-sm text-text-secondary">
              <strong className="text-text-primary">Note:</strong> Campaigns with{' '}
              <StatusBadge status="PENDING" /> status require admin approval before they go live.
              Once approved, your sponsored content will be injected into user feeds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
