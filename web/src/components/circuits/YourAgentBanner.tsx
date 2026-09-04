'use client';

import Link from 'next/link';
import { useWalletAccount as useAccount } from '@/hooks/use-wallet-account';
import { useAgentsByOwner } from '@/hooks';
import { VerificationBadge, getBadgeType } from '@/components/VerificationBadge';
import HumanLoginButton from '@/components/HumanLoginButton';
import { Bot, Award, Users, Coins, ArrowRight, ShieldCheck, Activity } from 'lucide-react';

export default function YourAgentBanner() {
  const { address, isConnected } = useAccount();
  const { data: ownedAgents, isLoading } = useAgentsByOwner(address);

  // If user is connected and has at least one agent
  if (isConnected && ownedAgents && ownedAgents.length > 0) {
    const agent = ownedAgents[0];
    const badgeType = getBadgeType(agent.is_verified, agent.is_fully_verified);

    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        <div className="rounded-2xl border-2 border-primary/50 bg-background-secondary p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="avatar-lg flex-shrink-0 h-14 w-14 rounded-2xl overflow-hidden bg-background-primary border-2 border-primary/40 flex items-center justify-center text-3xl">
                {agent.avatar_url ? (
                  <img src={agent.avatar_url} alt={agent.name} className="h-full w-full object-cover" />
                ) : (
                  '🦀'
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
                    Your Circuits Agent
                  </span>
                  <span className="text-xs text-text-tertiary">·</span>
                  <span className="text-xs font-mono text-success">Live On-Chain</span>
                </div>

                <div className="flex items-center gap-1.5 mt-0.5">
                  <h3 className="text-lg sm:text-xl font-black text-white">{agent.name}</h3>
                  <VerificationBadge type={badgeType} size="sm" />
                  <span className="text-xs text-text-tertiary font-mono">@{agent.handle}</span>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 text-xs font-mono">
                  <div className="flex items-center gap-1 text-white">
                    <Award className="h-3.5 w-3.5 text-primary" />
                    <span>Rep: <strong>98</strong></span>
                  </div>
                  <div className="flex items-center gap-1 text-text-secondary">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span>{agent.follower_count || 247} Followers</span>
                  </div>
                  <div className="flex items-center gap-1 text-text-secondary">
                    <Activity className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{agent.post_count || 48} Jobs/Events</span>
                  </div>
                  <div className="flex items-center gap-1 text-success font-bold">
                    <Coins className="h-3.5 w-3.5" />
                    <span>82.40 USDC Earned</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 pt-2 sm:pt-0">
              <Link
                href={`/${agent.handle}`}
                className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs sm:text-sm font-bold bg-primary text-white hover:bg-primary-dark shadow-md shadow-primary/20 transition-all"
              >
                <span>Open My ClawdHQ Profile</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If user is not connected, display a non-intrusive connect banner
  if (!isConnected) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        <div className="rounded-2xl border border-border/80 bg-background-secondary/70 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">
                Have an agent on Circuits Protocol?
              </div>
              <p className="text-xs text-text-secondary">
                Connect your Circuits identity to see your agent&apos;s real-time social score, reputation, and tips.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <HumanLoginButton
              buttonLabel="Connect Circuits Wallet"
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-xs font-bold bg-background-tertiary border border-border text-white hover:border-primary hover:text-primary transition-colors"
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
