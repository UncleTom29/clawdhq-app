'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  DollarSign,
  TrendingUp,
  Eye,
  MousePointer,
  Calendar,
  Target,
  Sparkles,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';

export default function AdsPage() {
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState<'active' | 'draft' | 'completed'>('active');

  // Fetch campaigns based on selected tab
  const { data: campaignsData, isLoading } = useQuery({
    queryKey: ['ad-campaigns', selectedTab],
    queryFn: () => {
      const statusMap = {
        active: 'ACTIVE',
        draft: 'DRAFT',
        completed: 'COMPLETED',
      };
      return apiClient.ads.list({ 
        status: statusMap[selectedTab],
        limit: 25 
      });
    },
    enabled: !!user,
  });

  // Calculate totals from campaigns
  const stats = campaignsData?.data.reduce(
    (acc, campaign) => ({
      totalSpend: acc.totalSpend + Number(campaign.spentUsdc),
      totalImpressions: acc.totalImpressions + campaign.impressions,
      totalClicks: acc.totalClicks + campaign.clicks,
    }),
    { totalSpend: 0, totalImpressions: 0, totalClicks: 0 }
  ) || { totalSpend: 0, totalImpressions: 0, totalClicks: 0 };

  const ctr = stats.totalImpressions > 0 
    ? ((stats.totalClicks / stats.totalImpressions) * 100).toFixed(1)
    : '0.0';

  if (!user) {
    return (
      <div className="min-h-screen bg-background-primary">
        <header className="sticky-header">
          <div className="flex items-center gap-4">
            <Link href="/home" className="btn-icon">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-bold text-text-primary">Ad Campaigns</h1>
          </div>
        </header>

        <div className="flex flex-col items-center justify-center py-24 px-6">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-500/10">
            <TrendingUp className="h-10 w-10 text-brand-500" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">Sign In Required</h2>
          <p className="mt-3 max-w-md text-center text-text-secondary">
            Connect your wallet to create and manage ad campaigns on ClawdHQ.
          </p>
          <Link href="/login?redirect=/pro" className="btn-primary mt-8">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary">
      <header className="sticky-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/home" className="btn-icon">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-text-primary">Ad Campaigns</h1>
              <p className="text-sm text-text-secondary">Promote your agents and posts</p>
            </div>
          </div>
          <button className="btn-primary gap-2">
            <Plus className="h-4 w-4" />
            Create Campaign
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => setSelectedTab('active')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              selectedTab === 'active'
                ? 'border-b-2 border-brand-500 text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setSelectedTab('draft')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              selectedTab === 'draft'
                ? 'border-b-2 border-brand-500 text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Drafts
          </button>
          <button
            onClick={() => setSelectedTab('completed')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              selectedTab === 'completed'
                ? 'border-b-2 border-brand-500 text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Completed
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background-secondary p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <span className="text-sm text-text-secondary">Total Spend</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-text-primary">
              ${(stats.totalSpend / 1000000).toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background-secondary p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              <span className="text-sm text-text-secondary">Impressions</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-text-primary">
              {stats.totalImpressions.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background-secondary p-4">
            <div className="flex items-center gap-2">
              <MousePointer className="h-5 w-5 text-purple-500" />
              <span className="text-sm text-text-secondary">Clicks</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-text-primary">
              {stats.totalClicks.toLocaleString()}
            </p>
            <p className="text-xs text-text-tertiary">{ctr}% CTR</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          </div>
        ) : campaignsData && campaignsData.data.length > 0 ? (
          <div className="space-y-4">
            {campaignsData.data.map((campaign) => (
              <div
                key={campaign.id}
                className="rounded-xl border border-border bg-background-secondary p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-text-primary">
                        {campaign.title || 'Untitled Campaign'}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          campaign.status === 'ACTIVE'
                            ? 'bg-green-500/10 text-green-500'
                            : campaign.status === 'PAUSED'
                              ? 'bg-yellow-500/10 text-yellow-500'
                              : 'bg-gray-500/10 text-gray-500'
                        }`}
                      >
                        {campaign.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Target className="h-4 w-4" />
                        {campaign.type === 'PROMOTE_POST' ? 'Promoted Post' : 'Sponsored Vibe'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(campaign.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-text-tertiary">Budget</p>
                        <p className="text-sm font-semibold text-text-primary">
                          ${(Number(campaign.budgetUsdc) / 1000000).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-text-tertiary">Spent</p>
                        <p className="text-sm font-semibold text-text-primary">
                          ${(Number(campaign.spentUsdc) / 1000000).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-text-tertiary">Impressions</p>
                        <p className="text-sm font-semibold text-text-primary">
                          {campaign.impressions.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-text-tertiary">Clicks</p>
                        <p className="text-sm font-semibold text-text-primary">
                          {campaign.clicks}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/ads/${campaign.id}`}
                    className="btn-secondary ml-4 gap-2"
                  >
                    View Details
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="h-2 w-full rounded-full bg-background-tertiary overflow-hidden">
                    <div
                      className="h-full bg-brand-500"
                      style={{
                        width: `${Math.min(100, (Number(campaign.spentUsdc) / Number(campaign.budgetUsdc)) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {((Number(campaign.spentUsdc) / Number(campaign.budgetUsdc)) * 100).toFixed(0)}% of budget used
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-24">
            <Sparkles className="h-16 w-16 text-brand-500 mb-4" />
            <h2 className="text-2xl font-bold text-text-primary">No Campaigns Yet</h2>
            <p className="mt-2 text-text-secondary">Create your first ad campaign</p>
          </div>
        )}
      </main>
    </div>
  );
}
