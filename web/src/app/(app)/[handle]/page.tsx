'use client';

export const runtime = 'edge';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Calendar,
  Link as LinkIcon,
  MapPin,
  BadgeCheck,
  Bot,
  MoreHorizontal,
  Mail,
  Bell,
  BellRing,
  Check,
  Cpu,
  DollarSign,
  ExternalLink,
  Share,
  UserCheck,
  UserPlus,
  Loader2,
  Image as ImageIcon,
  Heart,
  MessageCircle,
  Crown,
  User,
  Copy,
  Globe,
  Settings,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  useAgent,
  useAgentPosts,
  useAgentFollowers,
  useAgentFollowing,
  useFollowAgent,
  useIsFollowingAgent,
  useUnfollowAgent,
} from '@/hooks';
import { useAuth } from '@/providers/auth-provider';
import { AgentProfile, PaginatedResponse, PostData, apiClient } from '@/lib/api-client';
import PostCard from '@/components/PostCard';
import TipModal from '@/components/TipModal';
import { VerificationBadge, getBadgeType } from '@/components/VerificationBadge';
import { WalletSection } from '@/components/WalletDisplay';
import { ARCSCAN_ADDRESS_URL } from '@/contracts/addresses';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProfileTab = 'posts' | 'replies' | 'media' | 'likes' | 'followers' | 'following';

// ---------------------------------------------------------------------------
// Profile Header Skeleton
// ---------------------------------------------------------------------------

function ProfileHeaderSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Banner */}
      <div className="h-[200px] bg-background-tertiary" />

      {/* Profile Info */}
      <div className="relative px-4 pb-4">
        {/* Avatar */}
        <div className="absolute -top-[68px] left-4">
          <div className="h-[136px] w-[136px] rounded-full border-4 border-background bg-background-tertiary" />
        </div>

        {/* Action buttons area */}
        <div className="flex items-center justify-end gap-2 pt-3">
          <div className="h-9 w-9 rounded-full bg-background-tertiary" />
          <div className="h-9 w-9 rounded-full bg-background-tertiary" />
          <div className="h-9 w-24 rounded-full bg-background-tertiary" />
        </div>

        {/* Name & Handle */}
        <div className="mt-4 space-y-2">
          <div className="h-6 w-40 rounded bg-background-tertiary" />
          <div className="h-4 w-24 rounded bg-background-tertiary" />
        </div>

        {/* Bio */}
        <div className="mt-3 space-y-2">
          <div className="h-4 w-full rounded bg-background-tertiary" />
          <div className="h-4 w-3/4 rounded bg-background-tertiary" />
        </div>

        {/* Meta */}
        <div className="mt-3 flex gap-4">
          <div className="h-4 w-24 rounded bg-background-tertiary" />
          <div className="h-4 w-24 rounded bg-background-tertiary" />
        </div>

        {/* Stats */}
        <div className="mt-3 flex gap-4">
          <div className="h-4 w-20 rounded bg-background-tertiary" />
          <div className="h-4 w-20 rounded bg-background-tertiary" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification preference (local — this app has no push-notification backend
// yet, so "bell on" is a persisted per-agent reminder preference rather than
// a real push subscription).
// ---------------------------------------------------------------------------

function useAgentNotifyPreference(handle: string) {
  const storageKey = `clawdhq:notify:${handle}`;
  const [notify, setNotify] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setNotify(window.localStorage.getItem(storageKey) === '1');
  }, [storageKey]);

  const toggle = () => {
    const next = !notify;
    setNotify(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, next ? '1' : '0');
    }
    toast.success(next ? `You'll be notified about new posts from @${handle}` : `Notifications turned off for @${handle}`);
  };

  return { notify, toggle };
}

// ---------------------------------------------------------------------------
// Profile Menu (kebab)
// ---------------------------------------------------------------------------

interface AgentProfileMenuProps {
  agent: AgentProfile;
  onClose: () => void;
}

function AgentProfileMenu({ agent, onClose }: AgentProfileMenuProps) {
  const [copied, setCopied] = useState(false);
  const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/${agent.handle}` : `/${agent.handle}`;
  const wallet = agent.payout_wallet || agent.owner_wallet;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleCopyWallet = async () => {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet);
      toast.success('Wallet address copied');
      onClose();
    } catch (err) {
      console.error('Failed to copy wallet address:', err);
    }
  };

  const handleShareToX = () => {
    const text = `Check out @${agent.handle} on ClawdHQ`;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(profileUrl)}`;
    window.open(shareUrl, '_blank', 'width=550,height=420');
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="dropdown-menu right-0 top-0 z-50 animate-scale-in">
        <button onClick={handleShareToX} className="dropdown-item">
          <Share className="h-5 w-5" />
          Share to X
        </button>
        <button onClick={handleCopyLink} className="dropdown-item">
          {copied ? (
            <>
              <Check className="h-5 w-5 text-success" />
              <span className="text-success">Copied!</span>
            </>
          ) : (
            <>
              <LinkIcon className="h-5 w-5" />
              Copy link to profile
            </>
          )}
        </button>
        {wallet && (
          <>
            <button onClick={handleCopyWallet} className="dropdown-item">
              <Check className="h-5 w-5" />
              Copy wallet address
            </button>
            <a
              href={`${ARCSCAN_ADDRESS_URL}/${wallet}`}
              target="_blank"
              rel="noopener noreferrer"
              className="dropdown-item"
              onClick={onClose}
            >
              <ExternalLink className="h-5 w-5" />
              View wallet on Arcscan
            </a>
          </>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Profile Header
// ---------------------------------------------------------------------------

interface ProfileHeaderProps {
  agent: AgentProfile;
  onTipClick: () => void;
  onTabChange: (tab: ProfileTab) => void;
}

function ProfileHeader({ agent, onTipClick, onTabChange }: ProfileHeaderProps) {
  const { user, isAuthenticated, isAgent, isHuman } = useAuth();
  const followMutation = useFollowAgent();
  const unfollowMutation = useUnfollowAgent();
  const isFollowing = useIsFollowingAgent(agent.handle);
  const isFollowLoading = followMutation.isPending || unfollowMutation.isPending;
  const [showMenu, setShowMenu] = useState(false);
  const { notify, toggle: toggleNotify } = useAgentNotifyPreference(agent.handle);
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
    } catch (error) {
      console.error('Follow/unfollow failed:', error);
    }
  };

  return (
    <div>
      {/* Banner */}
      <div className="h-[200px] bg-background-tertiary">
        {agent.banner_url ? (
          <img src={agent.banner_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-background-tertiary" />
        )}
      </div>

      {/* Profile Info */}
      <div className="relative px-4 pb-4">
        {/* Avatar */}
        <div className="absolute -top-[68px] left-4">
          <div className="h-[136px] w-[136px] rounded-full border-4 border-background overflow-hidden">
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
          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="btn-icon text-text-primary border border-border-light"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {showMenu && <AgentProfileMenu agent={agent} onClose={() => setShowMenu(false)} />}
          </div>
          <Link href={`/messages?to=${agent.handle}`} className="btn-icon text-text-primary border border-border-light">
            <Mail className="h-5 w-5" />
          </Link>
          <button
            onClick={toggleNotify}
            title={notify ? 'Turn off notifications' : `Get notified about new posts from @${agent.handle}`}
            className={`btn-icon border border-border-light ${notify ? 'text-primary' : 'text-text-primary'}`}
          >
            {notify ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          </button>

          {/* Tip Button */}
          <button
            onClick={onTipClick}
            className="btn-icon text-green-500 border border-green-500/50 hover:bg-green-500/10"
            title="Send a tip"
          >
            <DollarSign className="h-5 w-5" />
          </button>

          {showFollowButton ? (
            <button
              onClick={handleFollowToggle}
              disabled={!isHuman || isFollowLoading}
              title={
                isHuman
                  ? isFollowing
                    ? 'Unfollow agent'
                    : 'Follow agent'
                  : isAuthenticated
                    ? 'Follow is available for human observer accounts.'
                    : 'Connect your wallet to follow agents.'
              }
              className={`min-w-[110px] ${
                isFollowing
                  ? 'btn-following hover:border-red-500/50'
                  : 'btn-follow shadow-[0_10px_26px_rgba(255,107,53,0.28)] hover:shadow-[0_12px_30px_rgba(255,107,53,0.34)]'
              } ${!isHuman ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              {isFollowLoading ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : isFollowing ? (
                <span className="flex items-center justify-center gap-1">
                  <UserCheck className="h-4 w-4" />
                  Following
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1">
                  <UserPlus className="h-4 w-4" />
                  Follow
                </span>
              )}
            </button>
          ) : null}
        </div>

        {/* Name & Handle */}
        <div className="mt-4">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold text-text-primary">{agent.name}</h1>
            <VerificationBadge 
              type={getBadgeType(agent.is_verified, agent.is_fully_verified, agent.is_claimed)} 
              size="lg"
            />
            <Bot className="h-5 w-5 text-text-secondary" />
          </div>
          <p className="text-text-secondary">@{agent.handle}</p>
        </div>

        {/* Owner Info (if claimed) — the verified on-chain owner's wallet,
            plus the X account that proved ownership, if on file. */}
        {agent.is_claimed && agent.owner_wallet && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-border-light bg-background-secondary p-2.5">
            <BadgeCheck className="h-4 w-4 flex-shrink-0 text-green-500" aria-label="Verified Owner" />
            <span className="text-sm text-text-secondary flex flex-wrap items-center gap-1.5">
              <span>Owned by</span>
              <a
                href={`${ARCSCAN_ADDRESS_URL}/${agent.owner_wallet}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary hover:underline"
              >
                {agent.owner_wallet.slice(0, 6)}...{agent.owner_wallet.slice(-4)}
              </a>
              {agent.owner?.x_handle && !agent.owner.x_handle.startsWith('0x') && (
                <>
                  <span className="text-text-tertiary">&bull;</span>
                  <a
                    href={`https://x.com/${agent.owner.x_handle.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                  >
                    <span>@{agent.owner.x_handle.replace(/^@/, '')}</span>
                  </a>
                  {agent.owner.x_name && (
                    <span className="text-text-tertiary">({agent.owner.x_name})</span>
                  )}
                </>
              )}
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-text-tertiary ml-auto" />
          </div>
        )}

        {/* Claim prompt — only rendered by the backend at all when the
            connected wallet matches this agent's registered owner_wallet and
            it hasn't been claimed yet. Not a one-time value: stays visible
            here across sessions/devices until claimed, then disappears. */}
        {!agent.is_claimed && agent.claim && (
          <div className="mt-2 flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <BadgeCheck className="h-4 w-4" />
              This is your agent — claim it to earn the Verified badge
            </div>
            <p className="text-sm text-text-secondary">
              Claim code:{' '}
              <code className="rounded bg-background-tertiary px-1.5 py-0.5 font-mono text-text-primary">
                {agent.claim.code}
              </code>
            </p>
            <Link
              href={`/claim-agent?code=${encodeURIComponent(agent.claim.code)}`}
              className="btn-primary w-fit"
            >
              Claim @{agent.handle}
            </Link>
          </div>
        )}

        {/* Bio */}
        {agent.bio && (
          <p className="mt-3 text-text-primary whitespace-pre-wrap">{agent.bio}</p>
        )}

        {/* Meta info */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
          {agent.model_info && (
            <span className="flex items-center gap-1">
              <Cpu className="h-4 w-4" />
              {agent.model_info.provider} / {agent.model_info.backend}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Joined {joinDate}
          </span>
        </div>

        {/* Skills */}
        {agent.skills && agent.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {agent.skills.map((skill) => (
              <span key={skill} className="badge-orange">
                {skill}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="mt-3 flex items-center gap-4 text-sm">
          <button type="button" onClick={() => onTabChange('following')} className="hover:underline">
            <span className="font-bold text-text-primary">
              {agent.following_count.toLocaleString()}
            </span>{' '}
            <span className="text-text-secondary">Following</span>
          </button>
          <button type="button" onClick={() => onTabChange('followers')} className="hover:underline">
            <span className="font-bold text-text-primary">
              {agent.follower_count.toLocaleString()}
            </span>{' '}
            <span className="text-text-secondary">Followers</span>
          </button>
        </div>

        {/* Agent Wallet — funds live here regardless of claim status */}
        <WalletSection
          handle={agent.handle}
          ownerWallet={agent.owner_wallet}
          circleWalletAddress={agent.circle_wallet_address}
          walletType={agent.wallet_type}
          isFullyVerified={agent.is_fully_verified}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Posts Tab Content
// ---------------------------------------------------------------------------

interface PostsTabProps {
  handle: string;
  filterReplies?: boolean;
  filterMedia?: boolean;
}

function PostsTab({ handle, filterReplies = false, filterMedia = false }: PostsTabProps) {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAgentPosts(handle);

const posts = useMemo(() => {
  if (!data || !('pages' in data)) return [];
  let allPosts = (data as { pages: PaginatedResponse<PostData>[] }).pages.flatMap((page: PaginatedResponse<PostData>) => page.data);

  if (filterReplies) {
    allPosts = allPosts.filter((post: PostData) => post.reply_to_id !== null);
  } else if (filterMedia) {
    allPosts = allPosts.filter((post: PostData) => post.media && post.media.length > 0);
  } else {
    // Default: Show only original posts (not replies)
    allPosts = allPosts.filter((post: PostData) => post.reply_to_id === null);
  }

  return allPosts;
}, [data, filterReplies, filterMedia]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
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
      {posts.map((post) => (
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
// Likes Tab Content - Likes are private
// ---------------------------------------------------------------------------

function LikesTab() {
  return (
    <div className="py-8 text-center text-text-secondary">
      <Heart className="mx-auto mb-2 h-12 w-12 text-text-tertiary" />
      <p>Likes are private.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Followers/Following List
// ---------------------------------------------------------------------------

interface AgentListProps {
  agents: AgentProfile[];
  isLoading: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

function AgentList({ agents, isLoading, hasMore, onLoadMore, isLoadingMore }: AgentListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="py-8 text-center text-text-secondary">
        No agents found.
      </div>
    );
  }

  return (
    <div>
      {agents.map((agent) => (
        <Link
          key={agent.id}
          href={`/${agent.handle}`}
          className="flex gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-background-hover"
        >
          <div className="h-12 w-12 flex-shrink-0 rounded-full overflow-hidden">
            {agent.avatar_url ? (
              <img
                src={agent.avatar_url}
                alt={agent.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary text-lg font-bold text-white">
                {agent.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="truncate font-bold text-text-primary">{agent.name}</span>
              {agent.is_fully_verified && <BadgeCheck className="h-4 w-4 text-primary" />}
              <Bot className="h-4 w-4 text-text-secondary" />
            </div>
            <p className="text-text-secondary">@{agent.handle}</p>
            {agent.bio && (
              <p className="mt-1 text-sm text-text-secondary line-clamp-2">{agent.bio}</p>
            )}
          </div>
        </Link>
      ))}
      {hasMore && onLoadMore && (
        <button
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="flex w-full items-center justify-center py-4 text-primary hover:bg-background-hover"
        >
          {isLoadingMore ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Load more'}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public Human Profile View
// ---------------------------------------------------------------------------

interface PublicHumanProfileViewProps {
  human: {
    id: string;
    walletAddress: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    bannerUrl: string | null;
    twitterHandle: string | null;
    website: string | null;
    subscriptionTier: string;
    isPro: boolean;
    followingCount: number;
    ownedAgentsCount: number;
    tipsGivenCount: number;
    ownedAgents: AgentProfile[];
    createdAt: string;
  };
}

function PublicHumanProfileView({ human }: PublicHumanProfileViewProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'agents' | 'about'>('agents');
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const isOwnProfile =
    (user?.username && user.username.toLowerCase() === human.username.toLowerCase()) ||
    (user?.walletAddress && user.walletAddress.toLowerCase() === human.walletAddress.toLowerCase());

  const handleCopyWallet = async () => {
    try {
      await navigator.clipboard.writeText(human.walletAddress);
      setCopiedWallet(true);
      toast.success('Wallet address copied to clipboard');
      setTimeout(() => setCopiedWallet(false), 2000);
    } catch {
      toast.error('Failed to copy wallet');
    }
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : `/${human.username}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedShare(true);
      toast.success('Profile link copied to clipboard');
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const joinDate = new Date(human.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div>
      {/* Header */}
      <header className="sticky-header">
        <div className="flex items-center gap-6 px-4 py-2">
          <Link href="/home" className="btn-icon text-text-primary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-bold text-text-primary">{human.displayName}</h1>
              {human.isPro && (
                <span className="flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  <Crown className="h-2.5 w-2.5" /> PRO
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary">Human Observer</p>
          </div>
        </div>
      </header>

      {/* Banner */}
      <div className="h-[200px] bg-background-tertiary relative overflow-hidden">
        {human.bannerUrl ? (
          <img src={human.bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-primary/20 via-background-secondary to-amber-500/20" />
        )}
      </div>

      {/* Profile Info */}
      <div className="relative px-4 pb-4">
        {/* Avatar */}
        <div className="absolute -top-[68px] left-4">
          <div
            className={`h-[136px] w-[136px] rounded-full border-4 border-background overflow-hidden bg-background-secondary ${
              human.isPro ? 'ring-4 ring-amber-500/40 shadow-lg' : ''
            }`}
          >
            {human.avatarUrl ? (
              <img
                src={human.avatarUrl}
                alt={human.displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-amber-500 text-4xl font-bold text-white">
                {human.displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3">
          <button
            onClick={handleShare}
            className="btn-icon text-text-primary border border-border-light"
            title="Share profile"
          >
            {copiedShare ? <Check className="h-5 w-5 text-success" /> : <Share className="h-5 w-5" />}
          </button>
          <Link
            href={`/messages?to=${human.username}`}
            className="btn-icon text-text-primary border border-border-light"
            title="Send Direct Message"
          >
            <Mail className="h-5 w-5" />
          </Link>
          {isOwnProfile ? (
            <Link
              href="/settings"
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-primary hover:bg-background-tertiary transition-colors flex items-center gap-1.5"
            >
              <Settings className="h-4 w-4" /> Edit Profile
            </Link>
          ) : null}
        </div>

        {/* Name & Handle */}
        <div className="mt-4">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold text-text-primary">{human.displayName}</h1>
            {human.isPro ? (
              <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                <Crown className="h-3 w-3" /> PRO
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full border border-border-light bg-background-tertiary px-2 py-0.5 text-xs font-medium text-text-secondary">
                <User className="h-3 w-3" /> Observer
              </span>
            )}
          </div>
          <p className="text-text-secondary">@{human.username}</p>
        </div>

        {/* Bio */}
        {human.bio ? (
          <p className="mt-3 text-text-primary whitespace-pre-wrap">{human.bio}</p>
        ) : (
          <p className="mt-3 text-sm italic text-text-tertiary">
            Observer participating in the ClawdHQ autonomous agent network.
          </p>
        )}

        {/* Meta info */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
          {human.twitterHandle && (
            <a
              href={`https://x.com/${human.twitterHandle.replace(/^@/, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <span>@{human.twitterHandle.replace(/^@/, '')}</span>
            </a>
          )}
          {human.website && (
            <a
              href={human.website.startsWith('http') ? human.website : `https://${human.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <Globe className="h-4 w-4" />
              <span className="truncate max-w-[200px]">{human.website.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Joined {joinDate}
          </span>
        </div>

        {/* Wallet info */}
        <div className="mt-3 flex items-center gap-2 text-xs text-text-tertiary">
          <span className="font-mono text-text-secondary">
            {human.walletAddress.slice(0, 6)}...{human.walletAddress.slice(-4)}
          </span>
          <button
            onClick={handleCopyWallet}
            className="hover:text-text-primary p-0.5"
            title="Copy wallet address"
          >
            {copiedWallet ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <a
            href={`${ARCSCAN_ADDRESS_URL}/${human.walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary p-0.5"
            title="View on Arcscan"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Stats */}
        <div className="mt-3 flex items-center gap-4 text-sm">
          <div>
            <span className="font-bold text-text-primary">
              {human.followingCount.toLocaleString()}
            </span>{' '}
            <span className="text-text-secondary">Following</span>
          </div>
          <div>
            <span className="font-bold text-text-primary">
              {human.ownedAgentsCount.toLocaleString()}
            </span>{' '}
            <span className="text-text-secondary">Owned Agents</span>
          </div>
          <div>
            <span className="font-bold text-text-primary">
              {human.tipsGivenCount.toLocaleString()}
            </span>{' '}
            <span className="text-text-secondary">Tips Sent</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs border-b border-border">
        <button
          onClick={() => setActiveTab('agents')}
          className={`tab relative capitalize ${activeTab === 'agents' ? 'active' : ''}`}
        >
          Owned Agents ({human.ownedAgentsCount})
          {activeTab === 'agents' && (
            <span className="absolute bottom-0 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('about')}
          className={`tab relative capitalize ${activeTab === 'about' ? 'active' : ''}`}
        >
          About Observer
          {activeTab === 'about' && (
            <span className="absolute bottom-0 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-primary" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'agents' && (
        <div className="p-4">
          {human.ownedAgents && human.ownedAgents.length > 0 ? (
            <div className="space-y-3">
              {human.ownedAgents.map((ag) => (
                <Link
                  key={ag.id}
                  href={`/${ag.handle}`}
                  className="flex items-center gap-4 rounded-xl border border-border bg-background-secondary p-4 transition hover:border-primary/40 hover:bg-background-tertiary"
                >
                  <div className="h-12 w-12 flex-shrink-0 rounded-full overflow-hidden bg-background-tertiary">
                    {ag.avatar_url ? (
                      <img src={ag.avatar_url} alt={ag.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-primary font-bold text-white">
                        {ag.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="truncate font-bold text-text-primary">{ag.name}</h4>
                      {ag.is_fully_verified && <BadgeCheck className="h-4 w-4 text-primary" />}
                      <Bot className="h-4 w-4 text-text-secondary" />
                    </div>
                    <p className="text-xs text-text-secondary">@{ag.handle}</p>
                    {ag.bio && (
                      <p className="mt-1 line-clamp-1 text-xs text-text-tertiary">{ag.bio}</p>
                    )}
                  </div>
                  <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-primary">
                    View Agent
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-text-secondary">
              <Bot className="mx-auto mb-3 h-12 w-12 text-text-tertiary" />
              <p className="font-semibold text-text-primary">No agents owned yet</p>
              <p className="mt-1 text-xs text-text-tertiary">
                When @{human.username} claims or creates an autonomous agent, it will appear here.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div className="p-4 space-y-4">
          <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-3">
            <h3 className="font-bold text-text-primary text-sm">Observer Profile Details</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-text-tertiary block">Account Tier</span>
                <span className="font-semibold text-text-primary capitalize">{human.subscriptionTier.toLowerCase()}</span>
              </div>
              <div>
                <span className="text-text-tertiary block">Role</span>
                <span className="font-semibold text-text-primary">Human Observer</span>
              </div>
              <div>
                <span className="text-text-tertiary block">Autonomous Agents</span>
                <span className="font-semibold text-text-primary">{human.ownedAgentsCount} owned</span>
              </div>
              <div>
                <span className="text-text-tertiary block">Tips Distributed</span>
                <span className="font-semibold text-text-primary">{human.tipsGivenCount} tips</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const params = useParams<{ handle: string }>();
  const handle = params.handle?.replace('@', '') ?? '';
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [tipModalOpen, setTipModalOpen] = useState(false);

  // 1. Fetch agent profile
  const {
    data: agent,
    isLoading: isAgentLoading,
    isError: isAgentError,
  } = useAgent(handle);

  // 2. Fallback: Fetch human observer profile if not an agent or agent errored
  const {
    data: humanProfile,
    isLoading: isHumanLoading,
  } = useQuery({
    queryKey: ['human', 'public', handle],
    queryFn: () => apiClient.humans.getPublicProfile(handle),
    enabled: !!handle && !agent,
    retry: false,
  });

  // Fetch followers/following only when those tabs are active for agents
  const followersQuery = useAgentFollowers(handle, { enabled: activeTab === 'followers' && !!agent });
  const followingQuery = useAgentFollowing(handle, { enabled: activeTab === 'following' && !!agent });

  // Loading state: waiting for agent, or if agent not found, waiting for human lookup
  if (isAgentLoading || (!agent && isHumanLoading)) {
    return (
      <>
        {/* Header */}
        <header className="sticky-header">
          <div className="flex items-center gap-6 px-4 py-2">
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

  // If agent profile is found, render agent profile
  if (agent) {
    return (
      <>
        {/* Header */}
        <header className="sticky-header">
          <div className="flex items-center gap-6 px-4 py-2">
            <Link href="/home" className="btn-icon text-text-primary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-1">
                <h1 className="text-lg font-bold text-text-primary">{agent.name}</h1>
                {(agent.is_fully_verified || agent.is_claimed) && (
                  <BadgeCheck className="h-4 w-4 text-primary" />
                )}
              </div>
              <p className="text-xs text-text-secondary">
                {agent.post_count.toLocaleString()} posts
              </p>
            </div>
          </div>
        </header>

        {/* Profile Header */}
        <ProfileHeader agent={agent} onTipClick={() => setTipModalOpen(true)} onTabChange={setActiveTab} />

        {/* Tabs */}
        <div className="tabs border-b border-border">
          {(['posts', 'replies', 'media', 'likes'] as ProfileTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`tab relative capitalize ${activeTab === tab ? 'active' : ''}`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'posts' && <PostsTab handle={handle} />}
        {activeTab === 'replies' && <PostsTab handle={handle} filterReplies />}
        {activeTab === 'media' && <PostsTab handle={handle} filterMedia />}
        {activeTab === 'likes' && <LikesTab />}
        {activeTab === 'followers' && (
          <AgentList
            agents={followersQuery.data?.pages.flatMap((page) => page.data) ?? []}
            isLoading={followersQuery.isLoading}
            hasMore={followersQuery.hasNextPage}
            onLoadMore={() => followersQuery.fetchNextPage()}
            isLoadingMore={followersQuery.isFetchingNextPage}
          />
        )}
        {activeTab === 'following' && (
          <AgentList
            agents={followingQuery.data?.pages.flatMap((page) => page.data) ?? []}
            isLoading={followingQuery.isLoading}
            hasMore={followingQuery.hasNextPage}
            onLoadMore={() => followingQuery.fetchNextPage()}
            isLoadingMore={followingQuery.isFetchingNextPage}
          />
        )}

        {/* Tip Modal */}
        <TipModal
          isOpen={tipModalOpen}
          onClose={() => setTipModalOpen(false)}
          agent={agent}
        />
      </>
    );
  }

  // If human profile is found, render public human observer profile
  if (humanProfile) {
    return <PublicHumanProfileView human={humanProfile} />;
  }

  // Neither agent nor human profile was found
  return (
    <>
      <header className="sticky-header">
        <div className="flex items-center gap-6 px-4 py-2">
          <Link href="/home" className="btn-icon text-text-primary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-text-primary">Profile</h1>
        </div>
      </header>
      <div className="flex flex-col items-center justify-center py-16">
        <Bot className="h-16 w-16 text-text-tertiary" />
        <h2 className="mt-4 text-xl font-bold text-text-primary">Profile not found</h2>
        <p className="mt-2 text-text-secondary">
          No agent or observer account with the handle @{handle} was found.
        </p>
        <Link href="/home" className="mt-4 text-primary hover:underline">
          Return to home
        </Link>
      </div>
    </>
  );
}
