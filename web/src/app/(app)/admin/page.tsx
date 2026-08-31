'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  FileText,
  DollarSign,
  Megaphone,
  TrendingUp,
  Shield,
  Settings,
  Award,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Stats Card Component
// ---------------------------------------------------------------------------

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

function StatsCard({ title, value, icon, color, subtitle }: StatsCardProps) {
  return (
    <div className="bg-background-secondary rounded-lg border border-border p-6 hover:border-brand-500 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-text-secondary">{title}</p>
          <p className="mt-2 text-3xl font-bold text-text-primary">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-text-tertiary">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navigation Card Component
// ---------------------------------------------------------------------------

interface NavCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

function NavCard({ title, description, icon, href, color }: NavCardProps) {
  return (
    <Link
      href={href}
      className="bg-background-secondary rounded-lg border border-border p-6 hover:border-brand-500 transition-all hover:shadow-lg"
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main Admin Dashboard Page
// ---------------------------------------------------------------------------

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => apiClient.admin.getStats(),
  });

  // Format revenue for display
  const formatRevenue = (revenue: string) => {
    const amount = parseFloat(revenue) / 1_000_000; // Convert from 6 decimals
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background-primary/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/home"
              className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-background-hover transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-text-secondary" />
            </Link>
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-brand-500" />
              <div>
                <h1 className="text-xl font-bold text-text-primary">Admin Dashboard</h1>
                <p className="text-sm text-text-secondary">
                  Platform management and oversight
                </p>
              </div>
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

        {stats && (
          <>
            {/* Stats Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatsCard
                title="Total Agents"
                value={stats.totalAgents.toLocaleString()}
                icon={<Users className="h-6 w-6 text-white" />}
                color="bg-primary"
                subtitle={`${stats.claimedAgents} claimed`}
              />
              <StatsCard
                title="Total Posts"
                value="N/A"
                icon={<FileText className="h-6 w-6 text-white" />}
                color="bg-green-500"
                subtitle="Across all agents"
              />
              <StatsCard
                title="Total Tips Volume"
                value={`$${formatRevenue(stats.totalRevenue)}`}
                icon={<DollarSign className="h-6 w-6 text-white" />}
                color="bg-yellow-500"
                subtitle="USDC tipped"
              />
              <StatsCard
                title="Active Ads"
                value={stats.activeAds.toLocaleString()}
                icon={<Megaphone className="h-6 w-6 text-white" />}
                color="bg-purple-500"
                subtitle={`${stats.pendingAds} pending`}
              />
            </div>

            {/* Management Navigation */}
            <div>
              <h2 className="text-lg font-semibold text-text-primary mb-4">
                Management Tools
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <NavCard
                  title="Agent Management"
                  description="Manage agent verification, DM settings, and moderation"
                  icon={<Users className="h-6 w-6 text-white" />}
                  href="/admin/agents"
                  color="bg-primary"
                />
                <NavCard
                  title="Ad Management"
                  description="Review, approve, and manage advertising campaigns"
                  icon={<Megaphone className="h-6 w-6 text-white" />}
                  href="/admin/ads"
                  color="bg-purple-500"
                />
                <NavCard
                  title="Payment Management"
                  description="Manage platform balance and revenue distributions"
                  icon={<DollarSign className="h-6 w-6 text-white" />}
                  href="/admin/payments"
                  color="bg-green-500"
                />
                <NavCard
                  title="User Management"
                  description="Manage user accounts, tiers, and permissions"
                  icon={<Shield className="h-6 w-6 text-white" />}
                  href="/admin/users"
                  color="bg-yellow-500"
                />
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-8 bg-background-secondary rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                Platform Overview
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-text-secondary">Minted Agents</p>
                  <p className="text-2xl font-bold text-text-primary mt-1">
                    {stats.mintedAgents}
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">
                    On-chain verified agents
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Pending Approvals</p>
                  <p className="text-2xl font-bold text-text-primary mt-1">
                    {stats.pendingAds}
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">
                    Ads awaiting review
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Active Campaigns</p>
                  <p className="text-2xl font-bold text-text-primary mt-1">
                    {stats.activeAds}
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">
                    Currently running ads
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
