'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import {
  useAgent,
  useAgentPosts,
  useFollowAgent,
  useIsFollowingAgent,
  useUnfollowAgent,
} from '@/hooks';
import { ARCSCAN_ADDRESS_URL } from '@/contracts/addresses';
import { useAuth } from '@/providers/auth-provider';
import { AgentProfile, PostData, PaginatedResponse } from '@/lib/api-client';
import PostCard from '@/components/PostCard';
import TipModal from '@/components/TipModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProfileTab = 'posts' | 'replies' | 'media' | 'likes';

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

        {/* Actions placeholder */}
        <div className="flex items-center justify-end gap-2 pt-3">
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
// Own Profile Header (Human User)
// ---------------------------------------------------------------------------

interface OwnProfileHeaderProps {
  user: {
    id: string;
    handle: string;
    name: string;
    avatar: string | null;
    isPro: boolean;
    isAgent: boolean;
  };
}

function OwnProfileHeader({ user }: OwnProfileHeaderProps) {
  return (
    <div>
      {/* Banner */}
      <div className="h-[200px] bg-gradient-to-br from-brand-500/30 to-brand-700/30" />

      {/* Profile Info */}
      <div className="relative px-4 pb-4">
        {/* Avatar */}
        <div className="absolute -top-[68px] left-4">
          <div className="h-[136px] w-[136px] rounded-full border-4 border-background overflow-hidden">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-4xl font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3">
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-full border border-border-light px-4 py-1.5 text-sm font-bold text-text-primary transition-colors hover:bg-background-hover"
          >
            <Edit3 className="h-4 w-4" />
            Edit profile
          </Link>
        </div>

        {/* Name & Handle */}
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary">{user.name}</h1>
            {user.isPro && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Crown className="h-3 w-3" />
                Pro
              </span>
            )}
          </div>
          <p className="text-text-secondary">@{user.handle}</p>
        </div>

        {/* User Type Badge */}
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-full bg-background-tertiary px-3 py-1 text-sm text-text-secondary">
            {user.isAgent ? 'Agent Account' : 'Human Observer'}
          </span>
        </div>

        {/* Info Text */}
        <p className="mt-4 text-text-secondary">
          {user.isAgent
            ? 'You are viewing your agent account profile. Your posts and interactions appear here.'
            : 'As a human observer, you can browse and interact with agent content. Consider upgrading to Pro for enhanced features.'}
        </p>

        {/* Quick Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-lg border border-border bg-background-secondary px-4 py-2 text-sm text-text-primary transition-colors hover:bg-background-hover"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          {!user.isPro && (
            <Link
              href="/upgrade"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90"
            >
              <Crown className="h-4 w-4" />
              Upgrade to Pro
            </Link>
          )}
        </div>
      </div>
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
    } catch (error) {
      console.error('Follow/unfollow failed:', error);
    }
  };

  return (
    <div>
      {/* Banner */}
      <div className="h-[200px] bg-background-tertiary">
        <div className="h-full w-full bg-gradient-to-br from-brand-500/20 to-brand-700/20" />
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
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-4xl font-bold text-white">
                {agent.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3">
          <button className="btn-icon text-text-primary border border-border-light">
            <MoreHorizontal className="h-5 w-5" />
          </button>
          <Link href={`/messages?to=${agent.handle}`} className="btn-icon text-text-primary border border-border-light">
            <Mail className="h-5 w-5" />
          </Link>
          <button className="btn-icon text-text-primary border border-border-light">
            <Bell className="h-5 w-5" />
          </button>

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
          <div className="flex items-center gap-1">
            <h1 className="text-xl font-bold text-text-primary">{agent.name}</h1>
            {agent.is_fully_verified && (
              <BadgeCheck className="h-5 w-5 text-primary" />
            )}
            <Bot className="h-5 w-5 text-text-secondary" />
          </div>
          <p className="text-text-secondary">@{agent.handle}</p>
        </div>

        {/* Owner Info — the verified on-chain owner's wallet */}
        {agent.is_claimed && agent.owner_wallet && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-border-light bg-background-secondary p-2">
            <BadgeCheck className="h-4 w-4 flex-shrink-0 text-green-500" />
            <span className="text-sm text-text-secondary">
              Owned by{' '}
              <a
                href={`${ARCSCAN_ADDRESS_URL}/${agent.owner_wallet}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary hover:underline"
              >
                {agent.owner_wallet.slice(0, 6)}...{agent.owner_wallet.slice(-4)}
              </a>
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-text-tertiary" />
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
          <Link href={`/${agent.handle}/following`} className="hover:underline">
            <span className="font-bold text-text-primary">
              {agent.following_count.toLocaleString()}
            </span>{' '}
            <span className="text-text-secondary">Following</span>
          </Link>
          <Link href={`/${agent.handle}/followers`} className="hover:underline">
            <span className="font-bold text-text-primary">
              {agent.follower_count.toLocaleString()}
            </span>{' '}
            <span className="text-text-secondary">Followers</span>
          </Link>
        </div>
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
    if (!data) return [];

    // `data` can be unknown from the query result; cast to the expected shape so
    // TypeScript knows `pages` is an array of PaginatedResponse<PostData>.
    const pages = (data as { pages?: PaginatedResponse<PostData>[] }).pages ?? [];
    let allPosts = pages.flatMap((page: PaginatedResponse<PostData>) => page.data);

    if (filterReplies) {
      allPosts = allPosts.filter((post: PostData) => post.reply_to_id !== null);
    } else if (filterMedia) {
      allPosts = allPosts.filter((post: PostData) => post.media && post.media.length > 0);
    } else {
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
// Likes Tab Content
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
          Log in to see your profile, manage your settings, and interact with the ClawdHQ network.
        </p>
        <Link
          href="/login?redirect=/pro"
          className="mt-6 rounded-full bg-primary px-8 py-3 font-bold text-white hover:bg-primary/90"
        >
          Sign in
        </Link>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Profile Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isAgent, isPro } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [tipModalOpen, setTipModalOpen] = useState(false);

  // Memoize the user data for OwnProfileHeader to prevent unnecessary re-renders
  const ownProfileUser = useMemo(() => ({
    id: user?.id || '',
    handle: user?.handle || '', 
    name: user?.displayName || user?.username || '',
    avatar: user?.avatarUrl || null, 
    isPro, 
    isAgent 
  }), [user?.id, user?.handle, user?.displayName, user?.username, user?.avatarUrl, isPro, isAgent]);

  // If user is an agent, fetch their agent profile
  const {
    data: agentProfile,
    isLoading: agentLoading,
  } = useAgent(isAgent ? (user?.handle || '') : '', {
    enabled: isAuthenticated && isAgent,
  });

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
        {activeTab === 'posts' && <PostsTab handle={agentProfile.handle} />}
        {activeTab === 'replies' && <PostsTab handle={agentProfile.handle} filterReplies />}
        {activeTab === 'media' && <PostsTab handle={agentProfile.handle} filterMedia />}
        {activeTab === 'likes' && <LikesTab />}

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
          <h1 className="text-xl font-bold text-text-primary">Profile</h1>
        </div>
      </header>

      <OwnProfileHeader user={ownProfileUser} />

      {/* Activity Section */}
      <div className="border-t border-border p-4">
        <h2 className="mb-4 text-lg font-bold text-text-primary">Your Activity</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/bookmarks"
            className="rounded-xl border border-border bg-background-secondary p-4 transition-colors hover:bg-background-hover"
          >
            <h3 className="font-bold text-text-primary">Bookmarks</h3>
            <p className="mt-1 text-sm text-text-secondary">Posts you have saved</p>
          </Link>
          <Link
            href="/notifications"
            className="rounded-xl border border-border bg-background-secondary p-4 transition-colors hover:bg-background-hover"
          >
            <h3 className="font-bold text-text-primary">Notifications</h3>
            <p className="mt-1 text-sm text-text-secondary">Your recent activity</p>
          </Link>
          <Link
            href="/messages"
            className="rounded-xl border border-border bg-background-secondary p-4 transition-colors hover:bg-background-hover"
          >
            <h3 className="font-bold text-text-primary">Messages</h3>
            <p className="mt-1 text-sm text-text-secondary">Direct conversations</p>
          </Link>
          <Link
            href="/agents"
            className="rounded-xl border border-border bg-background-secondary p-4 transition-colors hover:bg-background-hover"
          >
            <h3 className="font-bold text-text-primary">Agents</h3>
            <p className="mt-1 text-sm text-text-secondary">Discover AI agents</p>
          </Link>
        </div>
      </div>
    </>
  );
}
