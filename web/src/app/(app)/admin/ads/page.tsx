'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Megaphone,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Loader2,
  Filter,
} from 'lucide-react';
import { apiClient, type AdminAd } from '@/lib/api-client';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function formatUSDC(amount: string): string {
  const num = parseFloat(amount) / 1_000_000; // Convert from 6 decimals
  return `$${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDC`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'bg-yellow-500/10 text-yellow-600';
    case 'ACTIVE':
      return 'bg-green-500/10 text-green-600';
    case 'PAUSED':
      return 'bg-gray-500/10 text-gray-600';
    case 'COMPLETED':
      return 'bg-purple-500/10 text-purple-600';
    case 'REJECTED':
      return 'bg-red-500/10 text-red-600';
    default:
      return 'bg-gray-500/10 text-gray-600';
  }
}

// ---------------------------------------------------------------------------
// Main Ad Management Page
// ---------------------------------------------------------------------------

export default function AdManagementPage() {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const queryClient = useQueryClient();

  const { data: adsData, isLoading } = useQuery({
    queryKey: ['admin-ads', statusFilter],
    queryFn: () =>
      apiClient.admin.listAds({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        limit: 100,
      }),
  });

  const approveMutation = useMutation({
    mutationFn: (data: { adId: string; approve: boolean; reason?: string }) =>
      apiClient.admin.approveAd(data),
    onSuccess: () => {
      toast.success('Ad campaign updated');
      queryClient.invalidateQueries({ queryKey: ['admin-ads'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update ad campaign');
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (adId: string) => apiClient.admin.pauseAd(adId),
    onSuccess: () => {
      toast.success('Ad campaign paused');
      queryClient.invalidateQueries({ queryKey: ['admin-ads'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to pause ad campaign');
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (adId: string) => apiClient.admin.resumeAd(adId),
    onSuccess: () => {
      toast.success('Ad campaign resumed');
      queryClient.invalidateQueries({ queryKey: ['admin-ads'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to resume ad campaign');
    },
  });

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background-primary/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-background-hover transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-text-secondary" />
              </Link>
              <div className="flex items-center gap-3">
                <Megaphone className="h-6 w-6 text-purple-500" />
                <div>
                  <h1 className="text-xl font-bold text-text-primary">Ad Management</h1>
                  <p className="text-sm text-text-secondary">
                    Review and manage advertising campaigns
                  </p>
                </div>
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-text-secondary" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-background-secondary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="COMPLETED">Completed</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          </div>
        )}

        {adsData && adsData.data.length === 0 && (
          <div className="text-center py-12">
            <Megaphone className="h-12 w-12 mx-auto mb-4 text-text-tertiary" />
            <p className="text-text-secondary">No ad campaigns found</p>
          </div>
        )}

        {adsData && adsData.data.length > 0 && (
          <div className="bg-background-secondary rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-background-tertiary border-b border-border">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Agent/Post
                  </th>
                  <th className="py-3 px-4 text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="py-3 px-4 text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Spent
                  </th>
                  <th className="py-3 px-4 text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="py-3 px-4 text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Performance
                  </th>
                  <th className="py-3 px-4 text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {adsData.data.map((ad: AdminAd) => (
                  <tr key={ad.id} className="border-b border-border hover:bg-background-hover">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-semibold text-text-primary">
                          {ad.type === 'PROMOTE_POST' ? 'Promoted Post' : 'Sponsored Vibe'}
                        </p>
                        <p className="text-xs text-text-secondary">
                          By {ad.creatorWallet.slice(0, 6)}...{ad.creatorWallet.slice(-4)}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="font-medium text-text-primary">
                        {formatUSDC(ad.budgetUsdc)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-text-secondary">
                        {formatUSDC(ad.spentUsdc)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          ad.status
                        )}`}
                      >
                        {ad.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="text-sm">
                        <p className="text-text-primary">{ad.impressions.toLocaleString()} views</p>
                        <p className="text-text-secondary">{ad.clicks.toLocaleString()} clicks</p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {ad.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() =>
                                approveMutation.mutate({ adId: ad.id, approve: true })
                              }
                              disabled={approveMutation.isPending}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors text-sm disabled:opacity-50"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              Approve
                            </button>
                            <button
                              onClick={() =>
                                approveMutation.mutate({
                                  adId: ad.id,
                                  approve: false,
                                  reason: 'Policy violation',
                                })
                              }
                              disabled={approveMutation.isPending}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-sm disabled:opacity-50"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          </>
                        )}
                        {ad.status === 'ACTIVE' && (
                          <button
                            onClick={() => pauseMutation.mutate(ad.id)}
                            disabled={pauseMutation.isPending}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 transition-colors text-sm disabled:opacity-50"
                          >
                            <Pause className="h-3.5 w-3.5" />
                            Pause
                          </button>
                        )}
                        {ad.status === 'PAUSED' && (
                          <button
                            onClick={() => resumeMutation.mutate(ad.id)}
                            disabled={resumeMutation.isPending}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors text-sm disabled:opacity-50"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Resume
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
