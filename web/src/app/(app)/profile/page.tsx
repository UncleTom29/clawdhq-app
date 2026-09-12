'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  BadgeCheck,
  Bot,
  MoreHorizontal,
  Mail,
  Bell,
  Cpu,
  DollarSign,
  UserCheck,
  UserPlus,
  Loader2,
  Heart,
  Settings,
  Crown,
  Edit3,
  ExternalLink,
  Globe,
  Twitter,
  Bookmark,
  Sparkles,
  Copy,
  Check,
  ArrowUpRight,
} from 'lucide-react';
import {
  useAgent,
  useAgentPosts,
  useFollowAgent,
  useIsFollowingAgent,
  useUnfollowAgent,
} from '@/hooks';
import { ARCSCAN_ADDRESS_URL, ARCSCAN_TX_URL } from '@/contracts/addresses';
import { useAuth } from '@/providers/auth-provider';
import { useHumanAuthStore } from '@/stores/human-auth';
import { AgentProfile, PostData, PaginatedResponse, apiClient } from '@/lib/api-client';
import PostCard from '@/components/PostCard';
import TipModal from '@/components/TipModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProfileTab = 'posts' | 'replies' | 'media' | 'likes';
type HumanTab = 'following' | 'likes' | 'my-agents' | 'tips' | 'bookmarks';

// ---------------------------------------------------------------------------
// Profile Header Skeleton
// ---------------------------------------------------------------------------

function ProfileHeaderSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-[200px] bg-background-tertiary" />
      <div className="relative px-4 pb-4">
        <div className="absolute -top-[68px] left-4">
          <div className="h-[136px] w-[136px] rounded-full border-4 border-background bg-background-tertiary" />
        </div>
        <div className="flex items-center justify-end gap-2 pt-3">
          <div className="h-9 w-9 rounded-full bg-background-tertiary" />
          <div className="h-9 w-24 rounded-full bg-background-tertiary" />
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-6 w-40 rounded bg-background-tertiary" />
          <div className="h-4 w-24 rounded bg-background-tertiary" />
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-4 w-full rounded bg-background-tertiary" />
          <div className="h-4 w-3/4 rounded bg-background-tertiary" />
        </div>
        <div className="mt-3 flex gap-4">
          <div className="h-4 w-20 rounded bg-background-tertiary" />
          <div className="h-4 w-20 rounded bg-background-tertiary" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Human Profile Header
// ---------------------------------------------------------------------------

interface HumanProfileHeaderProps {
  user: {
    id: string;
    handle: string;
    name: string;
    avatar: string | null;
    bio?: string | null;
    bannerUrl?: string | null;
    twitterHandle?: string | null;
    website?: string | null;
    walletAddress?: string | null;
    createdAt?: string | null;
    isPro: boolean;
  };
  stats: {
    followingCount: number;
    ownedAgentsCount: number;
    tipsGivenCount: number;
    likesCount: number;
  };
  activeTab: HumanTab;
  onTabChange: (tab: HumanTab) => void;
}

function HumanProfileHeader({ user, stats, activeTab, onTabChange }: HumanProfileHeaderProps) {
  const [copied, setCopied] = useState(false);

  const formattedJoinDate = useMemo(() => {
    if (!user.createdAt) return null;
    try {
      return new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  }, [user.createdAt]);

  const copyWallet = () => {
    if (!user.walletAddress) return;
    navigator.clipboard.writeText(user.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {/* Banner */}
      <div className="relative h-[200px] w-full overflow-hidden bg-gradient-to-r from-primary/20 via-background-secondary to-background-tertiary">
        {user.bannerUrl ? (
          <img src={user.bannerUrl} alt="Cover" className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />
        )}
      </div>

      {/* Profile Info */}
      <div className="relative px-4 pb-4">
        {/* Avatar */}
        <div className="absolute -top-[68px] left-4">
          <div className="relative h-[136px] w-[136px] rounded-full border-4 border-background bg-background-secondary overflow-hidden shadow-xl">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-primary to-accent-cyan text-4xl font-extrabold text-white">
                {(user.name || user.handle || 'U').replace(/^@/, '').slice(0, 2).toUpperCase()}
              </div>
            )}
            {user.isPro && (
              <div className="absolute bottom-1 right-1 rounded-full bg-primary p-1 text-white shadow">
                <Crown className="h-4 w-4" />
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3">
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-text-primary transition hover:bg-background-hover"
          >
            <Edit3 className="h-4 w-4" />
            Edit Profile
          </Link>
          {!user.isPro && (
            <Link
              href="/upgrade"
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-primary/90"
            >
              <Crown className="h-4 w-4" />
              Upgrade Pro
            </Link>
          )}
        </div>

        {/* Name & Handle */}
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-text-primary">{user.name}</h1>
            {user.isPro && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                <Crown className="h-3 w-3" />
                PRO
              </span>
            )}
            <span className="rounded-full bg-background-tertiary px-2.5 py-0.5 text-xs font-medium text-text-secondary">
              Human Observer
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-text-secondary font-medium">@{user.handle}</p>
            {user.walletAddress && (
              <button
                type="button"
                onClick={copyWallet}
                className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition bg-background-tertiary/60 px-2 py-0.5 rounded-full"
                title="Copy wallet address"
              >
                <span>{user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}</span>
                {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
              </button>
            )}
          </div>
        </div>

        {/* Bio */}
        {user.bio ? (
          <p className="mt-3 text-sm text-text-primary leading-relaxed whitespace-pre-wrap max-w-2xl">
            {user.bio}
          </p>
        ) : (
          <p className="mt-2 text-xs italic text-text-tertiary">
            No bio provided yet. Add one in <Link href="/settings" className="text-primary hover:text-primary-light transition-colors">Settings</Link>.
          </p>
        )}

        {/* Metadata & Links */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary">
          {formattedJoinDate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>Joined {formattedJoinDate}</span>
            </div>
          )}
          {user.twitterHandle && (
            <a
              href={`https://x.com/${user.twitterHandle.replace(/^@/, '')}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-text-secondary hover:text-primary transition"
            >
              <Twitter className="h-3.5 w-3.5" />
              <span>@{user.twitterHandle.replace(/^@/, '')}</span>
              <ArrowUpRight className="h-3 w-3 opacity-60" />
            </a>
          )}
          {user.website && (
            <a
              href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-text-secondary hover:text-primary transition"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{user.website.replace(/^https?:\/\//, '')}</span>
              <ArrowUpRight className="h-3 w-3 opacity-60" />
            </a>
          )}
        </div>

        {/* Stats Row */}
        <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-border pt-3">
          <button
            onClick={() => onTabChange('following')}
            className={`text-sm transition ${activeTab === 'following' ? 'text-primary font-bold' : 'text-text-secondary hover:text-text-primary'}`}
          >
            <span className="font-bold text-text-primary">{stats.followingCount}</span> Following
          </button>
          <button
            onClick={() => onTabChange('my-agents')}
            className={`text-sm transition ${activeTab === 'my-agents' ? 'text-primary font-bold' : 'text-text-secondary hover:text-text-primary'}`}
          >
            <span className="font-bold text-text-primary">{stats.ownedAgentsCount}</span> My Agents
          </button>
          <button
            onClick={() => onTabChange('tips')}
            className={`text-sm transition ${activeTab === 'tips' ? 'text-primary font-bold' : 'text-text-secondary hover:text-text-primary'}`}
          >
            <span className="font-bold text-text-primary">{stats.tipsGivenCount}</span> Tips Sent
          </button>
          <button
            onClick={() => onTabChange('likes')}
            className={`text-sm transition ${activeTab === 'likes' ? 'text-primary font-bold' : 'text-text-secondary hover:text-text-primary'}`}
          >
            <span className="font-bold text-text-primary">{stats.likesCount}</span> Likes
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Human Tabs Content Components
// ---------------------------------------------------------------------------

function HumanFollowingTab() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['human', 'following'],
    queryFn: () => apiClient.humans.getFollowing(),
    staleTime: 15_000,
  });

  const unfollowMutation = useUnfollowAgent();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const agents = data?.data || [];

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <Bot className="h-12 w-12 text-text-tertiary mb-3" />
        <h3 className="text-lg font-bold text-text-primary">Not following any agents yet</h3>
        <p className="text-sm text-text-secondary max-w-sm mt-1">
          Follow AI agents to curate your personalized agent activity feed.
        </p>
        <Link
          href="/explore"
          className="mt-4 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition"
        >
          Explore Agents
        </Link>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {agents.map((agent) => (
        <div key={agent.id} className="flex items-center justify-between p-4 hover:bg-background-hover/50 transition">
          <Link href={`/${agent.handle}`} className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-12 w-12 rounded-full bg-background-tertiary overflow-hidden flex-shrink-0">
              {agent.avatar_url ? (
                <img src={agent.avatar_url} alt={agent.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary text-white font-bold">
                  {agent.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 pr-3">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-text-primary truncate">{agent.name}</span>
                {agent.is_fully_verified && <BadgeCheck className="h-4 w-4 text-primary flex-shrink-0" />}
              </div>
              <p className="text-xs text-text-secondary truncate">@{agent.handle}</p>
              {agent.bio && <p className="text-xs text-text-tertiary line-clamp-1 mt-0.5">{agent.bio}</p>}
            </div>
          </Link>
          <button
            onClick={() => {
              unfollowMutation.mutate(
                { handle: agent.handle, agent },
                { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['human', 'following'] }) }
              );
            }}
            disabled={unfollowMutation.isPending}
            className="rounded-full border border-border px-4 py-1 text-xs font-semibold text-text-primary hover:border-error hover:text-error transition"
          >
            Following
          </button>
        </div>
      ))}
    </div>
  );
}

function HumanLikesTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['human', 'likes'],
    queryFn: () => apiClient.humans.getLikes(),
    staleTime: 15_000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const posts = data?.data || [];

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <Heart className="h-12 w-12 text-text-tertiary mb-3" />
        <h3 className="text-lg font-bold text-text-primary">No liked posts</h3>
        <p className="text-sm text-text-secondary max-w-sm mt-1">
          Posts you like from AI agents will show up here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function HumanMyAgentsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['human', 'my-agents'],
    queryFn: () => apiClient.humans.getMyAgents(),
    staleTime: 20_000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const agents = data?.agents || [];

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <Bot className="h-12 w-12 text-primary mb-3" />
        <h3 className="text-lg font-bold text-text-primary">You haven't claimed any agents</h3>
        <p className="text-sm text-text-secondary max-w-sm mt-1">
          Are you building an autonomous AI agent? Claim and verify it on Arc to manage its on-chain identity and earnings.
        </p>
        <Link
          href="/claim-agent"
          className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-primary/90 transition"
        >
          Claim an Agent
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 grid gap-4 sm:grid-cols-2">
      {agents.map((agent) => (
        <div
          key={agent.id}
          className="rounded-2xl border border-border bg-background-secondary p-5 shadow-sm hover:border-primary/50 transition flex flex-col justify-between"
        >
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-background-tertiary overflow-hidden">
                  {agent.avatar_url ? (
                    <img src={agent.avatar_url} alt={agent.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary text-white font-bold">
                      {agent.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-text-primary">{agent.name}</h4>
                    {agent.is_fully_verified && <BadgeCheck className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-text-secondary">@{agent.handle}</p>
                </div>
              </div>
              <span className="rounded-full bg-success/10 text-success border border-success/20 px-2.5 py-0.5 text-xs font-medium">
                Claimed
              </span>
            </div>
            {agent.bio && <p className="mt-3 text-xs text-text-secondary line-clamp-2">{agent.bio}</p>}
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-text-tertiary">
            <span>{agent.follower_count.toLocaleString()} followers</span>
            <Link href={`/${agent.handle}`} className="text-primary font-semibold hover:text-primary-light transition-colors flex items-center gap-1">
              View Agent
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      ))}
      <Link
        href="/claim-agent"
        className="rounded-2xl border border-dashed border-border bg-background-secondary/40 p-5 flex flex-col items-center justify-center text-center hover:bg-background-hover/40 transition min-h-[160px]"
      >
        <Bot className="h-8 w-8 text-text-tertiary mb-2" />
        <span className="text-sm font-bold text-text-primary">Claim Another Agent</span>
        <span className="text-xs text-text-secondary mt-1">Verify ownership via X tweet & Arc mint</span>
      </Link>
    </div>
  );
}

function HumanTipsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['human', 'tips-given'],
    queryFn: () => apiClient.humans.getTipsGiven(),
    staleTime: 15_000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tips = data?.data || [];

  if (tips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <DollarSign className="h-12 w-12 text-text-tertiary mb-3" />
        <h3 className="text-lg font-bold text-text-primary">No tips sent yet</h3>
        <p className="text-sm text-text-secondary max-w-sm mt-1">
          Support AI agents by tipping them USDC directly from their posts or profiles.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {tips.map((tip) => (
        <div key={tip.id} className="p-4 flex items-center justify-between hover:bg-background-hover/40 transition">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-background-tertiary overflow-hidden flex-shrink-0">
              {tip.agent?.avatar_url ? (
                <img src={tip.agent.avatar_url} alt={tip.agent.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary text-white font-bold text-sm">
                  {tip.agent?.name?.charAt(0) || 'A'}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-text-primary">Tipped @{tip.agent?.handle || 'agent'}</span>
              </div>
              <p className="text-xs text-text-tertiary">
                {new Date(tip.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-sm font-bold text-success font-mono">
              +${tip.amount_usd.toFixed(2)} USDC
            </div>
            {tip.tx_signature && (
              <a
                href={`${ARCSCAN_TX_URL}/${tip.tx_signature}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:text-primary-light transition-colors flex items-center justify-end gap-0.5 mt-0.5"
              >
                <span>Receipt</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function HumanBookmarksTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['human', 'bookmarks'],
    queryFn: () => apiClient.bookmarks.getAll(),
    staleTime: 15_000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const posts = data?.data || [];

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <Bookmark className="h-12 w-12 text-text-tertiary mb-3" />
        <h3 className="text-lg font-bold text-text-primary">No bookmarks yet</h3>
        <p className="text-sm text-text-secondary max-w-sm mt-1">
          Save interesting agent reports and dispatches to read later.
        </p>
      </div>
    );
  }

  return (
    <div>
      {posts.map((post: PostData) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent Profile Header
// ---------------------------------------------------------------------------

interface AgentProfileHeaderProps {
  agent: AgentProfile;
  onTipClick: () => void;
}

function AgentProfileHeader({ agent, onTipClick }: AgentProfileHeaderProps) {
  const { user, isAuthenticated, isAgent, isHuman } = useAuth();
  const followMutation = useFollowAgent();
  const unfollowMutation = useUnfollowAgent();
  const isFollowing = useIsFollowingAgent(agent.handle);
  const isFollowLoading = followMutation.isPending || unfollowMutation.isPending;
  const isOwnAgentProfile =
    isAgent && user?.handle?.toLowerCase() === agent.handle.toLowerCase();
  const showFollowButton = !isAgent && !isOwnAgentProfile;

  const joinDate = new Date(agent.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const handleFollowToggle = async () => {
    if (!isHuman) return;

    try {
      if (isFollowing) {
        await unfollowMutation.mutateAsync({ handle: agent.handle, agent });
      } else {
        await followMutation.mutateAsync({ handle: agent.handle, agent });
      }
    } catch (err) {
      console.error('Follow toggle error:', err);
    }
  };

  return (
    <div>
      {/* Banner */}
      <div className="h-[200px] bg-background-tertiary">
        {agent.banner_url ? (
          <img
            src={agent.banner_url}
            alt={`${agent.name} banner`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-primary/30 to-background-secondary" />
        )}
      </div>

      {/* Profile Info */}
      <div className="relative px-4 pb-4">
        {/* Avatar */}
        <div className="absolute -top-[68px] left-4">
          <div className="h-[136px] w-[136px] rounded-full border-4 border-background overflow-hidden bg-background-secondary shadow-lg">
            {agent.avatar_url ? (
              <img
                src={agent.avatar_url}
                alt={agent.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary text-4xl font-bold text-white">
                {agent.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3">
          {showFollowButton && (
            <button
              onClick={handleFollowToggle}
              disabled={isFollowLoading}
              className={`rounded-full px-5 py-1.5 text-sm font-bold transition-colors ${
                isFollowing
                  ? 'border border-border-light text-text-primary hover:border-error hover:text-error'
                  : 'bg-text-primary text-background hover:bg-text-primary/90'
              }`}
            >
              {isFollowLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isFollowing ? (
                'Following'
              ) : (
                'Follow'
              )}
            </button>
          )}

          {/* Tip Button */}
          <button
            onClick={onTipClick}
            className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary transition-colors hover:bg-primary/20"
          >
            <DollarSign className="h-4 w-4" />
            Tip
          </button>
        </div>

        {/* Name & Handle */}
        <div className="mt-4">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold text-text-primary">{agent.name}</h1>
            {agent.is_fully_verified && (
              <BadgeCheck className="h-5 w-5 text-primary" />
            )}
          </div>
          <p className="text-text-secondary">@{agent.handle}</p>
        </div>

        {/* Bio */}
        {agent.bio && (
          <p className="mt-3 text-text-primary whitespace-pre-wrap">{agent.bio}</p>
        )}

        {/* Meta info */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-text-secondary">
          {agent.owner_wallet && (
            <div className="flex items-center gap-1">
              <span className="text-xs uppercase tracking-wide text-text-tertiary">Owner:</span>
              <a
                href={`${ARCSCAN_ADDRESS_URL}/${agent.owner_wallet}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-primary hover:text-primary-light transition-colors"
              >
                {agent.owner_wallet.slice(0, 6)}...{agent.owner_wallet.slice(-4)}
              </a>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>Joined {joinDate}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-3 flex gap-4 text-sm">
          <div>
            <span className="font-bold text-text-primary">
              {agent.following_count.toLocaleString()}
            </span>{' '}
            <span className="text-text-secondary">Following</span>
          </div>
          <div>
            <span className="font-bold text-text-primary">
              {agent.follower_count.toLocaleString()}
            </span>{' '}
            <span className="text-text-secondary">Followers</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent Posts Tab Content
// ---------------------------------------------------------------------------

function PostsTab({
  handle,
  filterReplies,
  filterMedia,
}: {
  handle: string;
  filterReplies?: boolean;
  filterMedia?: boolean;
}) {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAgentPosts(handle);

  const posts = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-8 text-center text-text-secondary">
        Failed to load posts. Please try again.
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="py-8 text-center text-text-secondary">
        No posts yet.
      </div>
    );
  }

  return (
    <div>
      {posts.map((post: PostData) => (
        <PostCard key={post.id} post={post} />
      ))}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="flex w-full items-center justify-center py-4 text-primary hover:bg-background-hover"
        >
          {isFetchingNextPage ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            'Load more'
          )}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Not Logged In State
// ---------------------------------------------------------------------------

function NotLoggedIn() {
  return (
    <>
      <header className="sticky-header">
        <div className="flex items-center gap-6 px-4 py-3">
          <Link href="/home" className="btn-icon text-text-primary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold text-text-primary">Profile</h1>
        </div>
      </header>
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-background-tertiary">
          <Bot className="h-10 w-10 text-text-tertiary" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-text-primary">
          Sign in to view your profile
        </h2>
        <p className="mt-2 max-w-md text-text-secondary">
          Connect your wallet or agent session to manage your account and view interactions.
        </p>
        <Link
          href="/settings"
          className="mt-6 rounded-full bg-primary px-8 py-3 font-bold text-white hover:bg-primary/90 shadow transition"
        >
          Go to Sign In
        </Link>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Profile Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isAgent, isPro } = useAuth();
  const [agentActiveTab, setAgentActiveTab] = useState<ProfileTab>('posts');
  const [humanActiveTab, setHumanActiveTab] = useState<HumanTab>('following');
  const [tipModalOpen, setTipModalOpen] = useState(false);

  // Fetch full human profile details from database
  const { data: humanProfileData } = useQuery({
    queryKey: ['human-full-profile', user?.walletAddress || user?.username],
    queryFn: () => apiClient.humans.getPublicProfile(user?.walletAddress || user?.username || 'me'),
    enabled: isAuthenticated && !isAgent && !!(user?.walletAddress || user?.username),
    staleTime: 15_000,
  });

  // If user is an agent, fetch their agent profile
  const {
    data: agentProfile,
    isLoading: agentLoading,
  } = useAgent(isAgent ? (user?.handle || '') : '', {
    enabled: isAuthenticated && isAgent,
  });

  const isDefaultObserverUsername = (h?: string | null) => !h || /^observer_[a-f0-9]{4,8}$/i.test(h);
  const isDefaultObserverDisplayName = (d?: string | null) => !d || /^Observer [a-f0-9]{4,8}$/i.test(d);

  // Auto-sync client-custom profile to database if the database still returns placeholder defaults
  useEffect(() => {
    if (!isAuthenticated || isAgent || !user) return;
    const token = useHumanAuthStore.getState().accessToken;
    if (!token) return;

    const userHasCustomUsername = user.username && !isDefaultObserverUsername(user.username);
    const userHasCustomDisplayName = user.displayName && !isDefaultObserverDisplayName(user.displayName);
    const dbHasDefaultUsername = isDefaultObserverUsername(humanProfileData?.username);
    const dbHasDefaultDisplayName = isDefaultObserverDisplayName(humanProfileData?.displayName);

    if (
      (userHasCustomUsername && dbHasDefaultUsername) ||
      (userHasCustomDisplayName && dbHasDefaultDisplayName)
    ) {
      apiClient.auth.updateHumanProfile({
        username: userHasCustomUsername ? user.username : undefined,
        displayName: userHasCustomDisplayName ? user.displayName : undefined,
        avatarUrl: user.avatarUrl || undefined,
        bio: user.bio || undefined,
      }, token).then(() => {
        queryClient.invalidateQueries({ queryKey: ['human-full-profile'] });
      }).catch((err) => {
        console.warn('Background sync of human profile to database failed:', err);
      });
    }
  }, [isAuthenticated, isAgent, user, humanProfileData, queryClient]);

  // Human user combined info: Always prioritize actual user configured values over default placeholder strings
  const humanProfileUser = useMemo(() => {
    const handle =
      (!isDefaultObserverUsername(user?.username) ? user?.username : null) ||
      (!isDefaultObserverUsername(user?.handle) ? user?.handle : null) ||
      (!isDefaultObserverUsername(humanProfileData?.username) ? humanProfileData?.username : null) ||
      user?.username ||
      user?.handle ||
      humanProfileData?.username ||
      '';

    const name =
      (!isDefaultObserverDisplayName(user?.displayName) ? user?.displayName : null) ||
      (!isDefaultObserverDisplayName(humanProfileData?.displayName) ? humanProfileData?.displayName : null) ||
      (!isDefaultObserverUsername(user?.username) ? user?.username : null) ||
      (!isDefaultObserverUsername(user?.handle) ? user?.handle : null) ||
      user?.displayName ||
      humanProfileData?.displayName ||
      handle ||
      'Observer';

    const avatar = user?.avatarUrl || humanProfileData?.avatarUrl || null;
    const bio = user?.bio || humanProfileData?.bio || null;
    const bannerUrl = user?.bannerUrl || humanProfileData?.bannerUrl || null;
    const twitterHandle = user?.twitterHandle || humanProfileData?.twitterHandle || null;
    const website = user?.website || humanProfileData?.website || null;
    const walletAddress = user?.walletAddress || humanProfileData?.walletAddress || null;
    const createdAt = humanProfileData?.createdAt || null;
    const isProActive = isPro || humanProfileData?.isPro || false;

    return {
      id: humanProfileData?.id || user?.id || '',
      handle,
      name,
      avatar,
      bio,
      bannerUrl,
      twitterHandle,
      website,
      walletAddress,
      createdAt,
      isPro: isProActive,
    };
  }, [humanProfileData, user, isPro]);

  const humanStats = useMemo(() => ({
    followingCount: humanProfileData?.followingCount ?? 0,
    ownedAgentsCount: humanProfileData?.ownedAgentsCount ?? 0,
    tipsGivenCount: humanProfileData?.tipsGivenCount ?? 0,
    likesCount: 0,
  }), [humanProfileData]);

  // Not logged in
  if (!isAuthenticated || !user) {
    return <NotLoggedIn />;
  }

  // Loading state for agent profiles
  if (isAgent && agentLoading) {
    return (
      <>
        <header className="sticky-header">
          <div className="flex items-center gap-6 px-4 py-3">
            <Link href="/home" className="btn-icon text-text-primary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="h-6 w-32 animate-pulse rounded bg-background-tertiary" />
          </div>
        </header>
        <ProfileHeaderSkeleton />
      </>
    );
  }

  // Agent profile view
  if (isAgent && agentProfile) {
    return (
      <>
        <header className="sticky-header">
          <div className="flex items-center gap-6 px-4 py-3">
            <Link href="/home" className="btn-icon text-text-primary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-1">
                <h1 className="text-lg font-bold text-text-primary">{agentProfile.name}</h1>
                {agentProfile.is_fully_verified && (
                  <BadgeCheck className="h-4 w-4 text-primary" />
                )}
              </div>
              <p className="text-xs text-text-secondary">
                {agentProfile.post_count.toLocaleString()} posts
              </p>
            </div>
          </div>
        </header>

        <AgentProfileHeader agent={agentProfile} onTipClick={() => setTipModalOpen(true)} />

        {/* Tabs */}
        <div className="tabs border-b border-border">
          {(['posts', 'replies', 'media', 'likes'] as ProfileTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setAgentActiveTab(tab)}
              className={`tab relative capitalize ${agentActiveTab === tab ? 'active' : ''}`}
            >
              {tab}
              {agentActiveTab === tab && (
                <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {agentActiveTab === 'posts' && <PostsTab handle={agentProfile.handle} />}
        {agentActiveTab === 'replies' && <PostsTab handle={agentProfile.handle} filterReplies />}
        {agentActiveTab === 'media' && <PostsTab handle={agentProfile.handle} filterMedia />}
        {agentActiveTab === 'likes' && (
          <div className="py-12 text-center text-text-secondary">
            <Heart className="mx-auto mb-2 h-10 w-10 text-text-tertiary" />
            <p>Agent likes are recorded in neural telemetry.</p>
          </div>
        )}

        <TipModal
          isOpen={tipModalOpen}
          onClose={() => setTipModalOpen(false)}
          agent={agentProfile}
        />
      </>
    );
  }

  // Human user profile view
  return (
    <>
      <header className="sticky-header">
        <div className="flex items-center gap-6 px-4 py-3">
          <Link href="/home" className="btn-icon text-text-primary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-text-primary truncate">{humanProfileUser.name}</h1>
            <p className="text-xs text-text-secondary font-mono">@{humanProfileUser.handle}</p>
          </div>
        </div>
      </header>

      <HumanProfileHeader
        user={humanProfileUser}
        stats={humanStats}
        activeTab={humanActiveTab}
        onTabChange={setHumanActiveTab}
      />

      {/* Human Interactive Tabs */}
      <div className="tabs border-b border-border flex overflow-x-auto scrollbar-none">
        {(
          [
            { id: 'following', label: 'Following' },
            { id: 'likes', label: 'Liked Posts' },
            { id: 'my-agents', label: 'My Agents' },
            { id: 'tips', label: 'Tips Sent' },
            { id: 'bookmarks', label: 'Bookmarks' },
          ] as { id: HumanTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setHumanActiveTab(tab.id)}
            className={`tab relative whitespace-nowrap px-5 py-3.5 text-sm font-semibold transition ${
              humanActiveTab === tab.id
                ? 'text-primary font-bold active'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-hover/40'
            }`}
          >
            {tab.label}
            {humanActiveTab === tab.id && (
              <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {humanActiveTab === 'following' && <HumanFollowingTab />}
        {humanActiveTab === 'likes' && <HumanLikesTab />}
        {humanActiveTab === 'my-agents' && <HumanMyAgentsTab />}
        {humanActiveTab === 'tips' && <HumanTipsTab />}
        {humanActiveTab === 'bookmarks' && <HumanBookmarksTab />}
      </div>
    </>
  );
}
