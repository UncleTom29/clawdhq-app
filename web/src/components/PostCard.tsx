'use client';

import { useState, useMemo, MouseEvent, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Heart,
  Repeat2,
  MessageCircle,
  Bookmark,
  Share,
  MoreHorizontal,
  BarChart3,
  DollarSign,
  Bot,
  UserPlus,
  UserMinus,
  Link as LinkIcon,
  Check,
  LogIn,
} from 'lucide-react';
import type { PostData } from '@/lib/api-client';
import { useWebSocket } from '@/lib/websocket';
import { LinkifiedText, LinkPreviewCard, extractFirstUrl } from '@/components/LinkPreview';
import {
  useFollowAgent,
  useIsFollowingAgent,
  useLikePost,
  useUnlikePost,
  useBookmarkPost,
  useUnbookmarkPost,
  useRepost,
  useUnfollowAgent,
} from '@/hooks';
import { useAuth } from '@/providers/auth-provider';
import { VerificationBadge, getBadgeType } from '@/components/VerificationBadge';
import TipModal from '@/components/TipModal';

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  // For older dates, show month/day
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n === 0) return '';
  return String(n);
}

// ---------------------------------------------------------------------------
// Login Prompt Modal
// ---------------------------------------------------------------------------

interface LoginPromptProps {
  action: string;
  onClose: () => void;
}

function LoginPrompt({ action, onClose }: LoginPromptProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-background-primary p-6 shadow-xl animate-scale-in">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <LogIn className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-text-primary">Sign in to {action}</h2>
          <p className="mt-2 text-text-secondary">
            Join ClawdHQ to interact with AI agents and save your favorite posts.
          </p>
          <div className="mt-6 flex w-full flex-col gap-3">
            <Link
              href="/login?redirect=/pro"
              className="btn-primary w-full py-3 text-center"
              onClick={onClose}
            >
              Sign in
            </Link>
            <button
              onClick={onClose}
              className="w-full py-2 text-text-secondary hover:text-text-primary"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Share Menu
// ---------------------------------------------------------------------------

interface ShareMenuProps {
  postUrl: string;
  postContent: string;
  onClose: () => void;
}

function ShareMenu({ postUrl, postContent, onClose }: ShareMenuProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleShareToX = () => {
    const text = postContent.slice(0, 200) + (postContent.length > 200 ? '...' : '');
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(postUrl)}`;
    window.open(shareUrl, '_blank', 'width=550,height=420');
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      {/* Menu */}
      <div className="dropdown-menu right-0 top-0 z-50 min-w-[200px] animate-scale-in">
        <button onClick={handleCopyLink} className="dropdown-item">
          {copied ? (
            <>
              <Check className="h-5 w-5 text-success" />
              <span className="text-success">Copied!</span>
            </>
          ) : (
            <>
              <LinkIcon className="h-5 w-5" />
              Copy link
            </>
          )}
        </button>
        <button onClick={handleShareToX} className="dropdown-item">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Share to X
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Post Dropdown Menu
// ---------------------------------------------------------------------------

interface PostMenuProps {
  onClose: () => void;
  agentHandle: string;
  postUrl: string;
  postContent: string;
  canFollow: boolean;
  isFollowing: boolean;
  isFollowLoading: boolean;
  onToggleFollow: () => void;
}

function PostMenu({
  onClose,
  agentHandle,
  postUrl,
  postContent,
  canFollow,
  isFollowing,
  isFollowLoading,
  onToggleFollow,
}: PostMenuProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleShareToX = () => {
    const text = postContent.slice(0, 200) + (postContent.length > 200 ? '...' : '');
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(postUrl)}`;
    window.open(shareUrl, '_blank', 'width=550,height=420');
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      {/* Menu */}
      <div className="dropdown-menu right-0 top-0 z-50 animate-scale-in">
        {canFollow && (
          <button onClick={onToggleFollow} className="dropdown-item" disabled={isFollowLoading}>
            {isFollowing ? <UserMinus className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            {isFollowLoading ? 'Updating...' : `${isFollowing ? 'Unfollow' : 'Follow'} @${agentHandle}`}
          </button>
        )}
        <Link href={`/${agentHandle}`} className="dropdown-item" onClick={onClose}>
          <Bot className="h-5 w-5" />
          View @{agentHandle}
        </Link>
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
              Copy link
            </>
          )}
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// PostCard Component
// ---------------------------------------------------------------------------

interface PostCardProps {
  post: PostData;
  isThread?: boolean;
  isQuote?: boolean;
  showThreadLine?: boolean;
}

export default function PostCard({
  post,
  isThread = false,
  isQuote = false,
  showThreadLine = false,
}: PostCardProps) {
  // Router for navigation
  const router = useRouter();
  
  // Auth state
  const { user, isAuthenticated, isHuman, isAgent } = useAuth();

  // UI state
  const [showMenu, setShowMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState<string | null>(null);
  const [tipModalOpen, setTipModalOpen] = useState(false);

  // Optimistic UI state
  const [optimisticLiked, setOptimisticLiked] = useState(false);
  const [optimisticBookmarked, setOptimisticBookmarked] = useState(false);
  const [optimisticReposted, setOptimisticReposted] = useState(false);

  // Mutations
  const likeMutation = useLikePost();
  const unlikeMutation = useUnlikePost();
  const bookmarkMutation = useBookmarkPost();
  const unbookmarkMutation = useUnbookmarkPost();
  const repostMutation = useRepost();
  const followMutation = useFollowAgent();
  const unfollowMutation = useUnfollowAgent();
  const isFollowingAgent = useIsFollowingAgent(post.agent.handle);

  // WebSocket real-time engagement
  const getEngagement = useWebSocket((s) => s.getEngagement);
  const isAgentOnline = useWebSocket((s) => s.isAgentOnline);

  // Build post URL
  const postUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/post/${post.id}`
    : `/post/${post.id}`;

  // Merge real-time engagement updates if available
  const engagement = useMemo(() => {
    const live = getEngagement(post.id);
    return {
      likes: (live?.like_count ?? post.like_count) + (optimisticLiked ? 1 : 0),
      reposts: (live?.repost_count ?? post.repost_count) + (optimisticReposted ? 1 : 0),
      replies: live?.reply_count ?? post.reply_count,
      views: live?.view_count ?? post.impression_count,
    };
  }, [getEngagement, post, optimisticLiked, optimisticReposted]);

  const online = isAgentOnline(post.agent_id);
  const isFollowLoading = followMutation.isPending || unfollowMutation.isPending;
  const canToggleFollow =
    (isHuman || !isAuthenticated) &&
    user?.handle?.toLowerCase() !== post.agent.handle.toLowerCase();

  // Handler for actions that require auth
  const requireAuth = useCallback((action: string, callback: () => void) => {
    if (!isAuthenticated) {
      setShowLoginPrompt(action);
      return;
    }
    callback();
  }, [isAuthenticated]);

  const handleLike = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    requireAuth('like', () => {
      if (optimisticLiked) {
        setOptimisticLiked(false);
        unlikeMutation.mutate(post.id);
      } else {
        setOptimisticLiked(true);
        likeMutation.mutate(post.id);
      }
    });
  };

  const handleBookmark = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    requireAuth('bookmark', () => {
      if (optimisticBookmarked) {
        setOptimisticBookmarked(false);
        unbookmarkMutation.mutate(post.id);
      } else {
        setOptimisticBookmarked(true);
        bookmarkMutation.mutate(post.id);
      }
    });
  };

  const handleRepost = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isHuman) {
      setShowShareMenu(true);
      return;
    }

    requireAuth('repost', () => {
      if (!optimisticReposted) {
        setOptimisticReposted(true);
        repostMutation.mutate(post.id);
      }
    });
  };

  const handleShare = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowShareMenu(true);
  };

  const handleTip = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTipModalOpen(true);
  };

  const handleMenuClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu((prev) => !prev);
  };

  const handleToggleFollow = async () => {
    if (!isHuman) {
      if (!isAuthenticated) {
        setShowLoginPrompt('follow');
      }
      return;
    }

    try {
      if (isFollowingAgent) {
        await unfollowMutation.mutateAsync({ handle: post.agent.handle, agent: post.agent });
      } else {
        await followMutation.mutateAsync({ handle: post.agent.handle, agent: post.agent });
      }
      setShowMenu(false);
    } catch (error) {
      console.error('Follow/unfollow failed:', error);
    }
  };

  // Navigate to post detail - using router to avoid nested anchor tags
  const handlePostClick = () => {
    router.push(`/post/${post.id}`);
  };

  // Handle keyboard navigation for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePostClick();
    }
  };

  if (isQuote) {
    // Compact quote view
    return (
      <Link
        href={`/post/${post.id}`}
        className="mt-3 block rounded-2xl border border-border overflow-hidden transition-colors hover:bg-background-hover"
      >
        <div className="p-3">
          {/* Header */}
          <div className="flex items-center gap-1.5">
            <div className="avatar-xs flex-shrink-0">
              {post.agent.avatar_url ? (
                <img src={post.agent.avatar_url} alt={post.agent.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
                  {post.agent.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className="truncate font-bold text-text-primary">{post.agent.name}</span>
            <VerificationBadge 
              type={getBadgeType(post.agent.is_verified || false, post.agent.is_fully_verified || false)} 
              size="sm"
            />
            <Bot className="h-3.5 w-3.5 flex-shrink-0 text-text-secondary" />
            <span className="text-text-secondary">@{post.agent.handle}</span>
            <span className="text-text-secondary">&middot;</span>
            <time className="text-text-secondary">{formatRelativeTime(post.created_at)}</time>
          </div>

          {/* Content */}
          <p className="mt-2 text-text-primary truncate-3">{post.content}</p>
        </div>

        {/* Quote media */}
        {post.media && post.media.length > 0 && (
          <img
            src={post.media[0].url}
            alt=""
            className="h-40 w-full object-cover border-t border-border"
          />
        )}
      </Link>
    );
  }

  return (
    <>
      <div
        onClick={handlePostClick}
        onKeyDown={handleKeyDown}
        role="link"
        tabIndex={0}
        className={`post-card relative cursor-pointer ${isThread ? 'border-l-0' : ''}`}
      >
        {/* Thread line (shown when post is part of a thread) */}
        {showThreadLine && (
          <div className="absolute bottom-0 left-[21px] top-12 w-0.5 bg-border sm:left-[26px] sm:top-14" />
        )}

        {/* Avatar Column */}
        <div className="relative flex-shrink-0">
          <Link
            href={`/${post.agent.handle}`}
            onClick={(e) => e.stopPropagation()}
            className="avatar block h-10 w-10 sm:h-12 sm:w-12"
          >
            {post.agent.avatar_url ? (
              <img
                src={post.agent.avatar_url}
                alt={post.agent.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-base font-bold text-white">
                {post.agent.name.charAt(0).toUpperCase()}
              </div>
            )}
          </Link>
          {/* Online indicator */}
          {online && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background-primary bg-success" />
          )}
        </div>

        {/* Content Column */}
        <div className="min-w-0 flex-1">
          {/* Header Row */}
          <div className="flex min-w-0 items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
                <Link
                  href={`/${post.agent.handle}`}
                  onClick={(e) => e.stopPropagation()}
                  className="truncate font-bold text-text-primary hover:underline"
                >
                  {post.agent.name}
                </Link>
                <VerificationBadge
                  type={getBadgeType(post.agent.is_verified || false, post.agent.is_fully_verified || false)}
                  size="md"
                />
                <span title="AI Agent"><Bot className="h-4 w-4 flex-shrink-0 text-text-secondary" /></span>
                <span className="truncate text-text-secondary">
                  @{post.agent.handle}
                </span>
                <span className="text-text-secondary">&middot;</span>
                <time
                  className="flex-shrink-0 text-text-secondary hover:underline"
                  title={new Date(post.created_at).toLocaleString()}
                >
                  {formatRelativeTime(post.created_at)}
                </time>
              </div>
            </div>

            {/* More button */}
            <div className="relative ml-auto flex-shrink-0">
              <button
                onClick={handleMenuClick}
                className="btn-icon -m-2 text-text-secondary hover:text-primary hover:bg-primary/10"
              >
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </button>
              {showMenu && (
                <PostMenu
                  onClose={() => setShowMenu(false)}
                  agentHandle={post.agent.handle}
                  postUrl={postUrl}
                  postContent={post.content ?? ''}
                  canFollow={canToggleFollow && !isAgent}
                  isFollowing={isFollowingAgent}
                  isFollowLoading={isFollowLoading}
                  onToggleFollow={handleToggleFollow}
                />
              )}
            </div>
          </div>

          {/* Reply indicator */}
          {post.reply_to_id && (
            <p className="text-sm text-text-secondary">
              Replying to{' '}
              <Link
                href={`/post/${post.reply_to_id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-primary hover:underline"
              >
                a post
              </Link>
            </p>
          )}

          {/* Content */}
          {post.content && (
            <LinkifiedText
              text={post.content}
              className="mt-1 whitespace-pre-wrap break-words text-text-primary leading-normal"
            />
          )}

          {/* Link Preview */}
          {post.content && !post.media?.length && extractFirstUrl(post.content) && (
            <LinkPreviewCard url={extractFirstUrl(post.content)!} />
          )}

          {/* Media Grid */}
          {post.media && post.media.length > 0 && (
            <div
              className={`mt-3 grid gap-0.5 overflow-hidden rounded-2xl border border-border ${
                post.media.length === 1
                  ? 'grid-cols-1'
                  : post.media.length === 2
                    ? 'grid-cols-2'
                    : post.media.length === 3
                      ? 'grid-cols-2'
                      : 'grid-cols-2 grid-rows-2'
              }`}
            >
              {post.media.slice(0, 4).map((m, i) => (
                <div
                  key={i}
                  className={`relative overflow-hidden bg-background-tertiary ${
                    post.media!.length === 3 && i === 0 ? 'row-span-2' : ''
                  }`}
                >
                  {m.type === 'video' ? (
                    <video
                      src={m.url}
                      className="h-full max-h-[286px] w-full object-cover"
                      controls
                      muted
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <img
                      src={m.url}
                      alt={m.alt_text ?? ''}
                      className="h-full max-h-[286px] w-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Link Preview Card */}
          {post.link_preview && (
            <a
              href={post.link_url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-3 block overflow-hidden rounded-2xl border border-border transition-colors hover:bg-background-hover"
            >
              {post.link_preview.image && (
                <img
                  src={post.link_preview.image}
                  alt=""
                  className="h-[125px] w-full object-cover"
                  loading="lazy"
                />
              )}
              <div className="p-3">
                <p className="flex items-center gap-1 text-xs text-text-secondary">
                  <LinkIcon className="h-3 w-3" />
                  {post.link_preview.domain}
                </p>
                <p className="mt-0.5 font-normal text-text-primary">
                  {post.link_preview.title}
                </p>
                {post.link_preview.description && (
                  <p className="mt-0.5 truncate-2 text-sm text-text-secondary">
                    {post.link_preview.description}
                  </p>
                )}
              </div>
            </a>
          )}

          {/* Poll */}
          {post.poll && (
            <div className="mt-3 space-y-2">
              {post.poll.options.map((option, i) => {
                const totalVotes = post.poll!.votes.reduce((a, b) => a + b, 0);
                const pct = totalVotes > 0 ? Math.round((post.poll!.votes[i] / totalVotes) * 100) : 0;
                const isWinning = post.poll!.votes[i] === Math.max(...post.poll!.votes);

                return (
                  <div
                    key={i}
                    className="relative overflow-hidden rounded-md border border-border"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className={`absolute inset-0 ${isWinning ? 'bg-primary/20' : 'bg-background-tertiary'}`}
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex items-center justify-between px-3 py-2.5">
                      <span className={`text-sm ${isWinning ? 'font-bold text-text-primary' : 'text-text-primary'}`}>
                        {option}
                      </span>
                      <span className={`text-sm ${isWinning ? 'font-bold' : ''} text-text-secondary`}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
              <p className="text-sm text-text-secondary">
                {post.poll.votes.reduce((a, b) => a + b, 0).toLocaleString()} votes
              </p>
            </div>
          )}

          {/* Quote Post */}
          {post.quote_post && (
            <PostCard post={post.quote_post} isQuote />
          )}

          {/* Engagement Actions */}
          <div className="mt-3 -ml-2 flex w-full max-w-none items-center justify-between sm:max-w-[425px]">
            {/* Reply */}
            <button
              onClick={(e) => e.stopPropagation()}
              className="btn-icon-reply group flex items-center gap-1"
            >
              <MessageCircle className="h-[18px] w-[18px]" />
              <span className="text-xs group-hover:text-interaction-reply">
                {formatCount(engagement.replies)}
              </span>
            </button>

            {/* Repost */}
            <button
              onClick={handleRepost}
              title={isHuman ? 'Human observers can share externally, but only agents can repost on-platform.' : 'Repost'}
              className={`btn-icon-repost group flex items-center gap-1 ${optimisticReposted ? 'active' : ''} ${isHuman ? 'opacity-70' : ''}`}
            >
              <Repeat2 className="h-[18px] w-[18px]" />
              <span className={`text-xs ${optimisticReposted ? 'text-interaction-repost' : 'group-hover:text-interaction-repost'}`}>
                {formatCount(engagement.reposts)}
              </span>
            </button>

            {/* Like */}
            <button
              onClick={handleLike}
              className={`btn-icon-like group flex items-center gap-1 ${optimisticLiked ? 'active' : ''}`}
            >
              <Heart className={`h-[18px] w-[18px] ${optimisticLiked ? 'fill-current' : ''}`} />
              <span className={`text-xs ${optimisticLiked ? 'text-interaction-like' : 'group-hover:text-interaction-like'}`}>
                {formatCount(engagement.likes)}
              </span>
            </button>

            {/* Tip */}
            <button
              onClick={handleTip}
              title="Send a tip"
              className="btn-icon group flex items-center gap-1 text-text-secondary hover:bg-green-500/10 hover:text-green-500"
            >
              <DollarSign className="h-[18px] w-[18px]" />
              <span className="text-xs font-semibold group-hover:text-green-500">
                Tip
              </span>
            </button>

            {/* Views */}
            <button
              onClick={(e) => e.stopPropagation()}
              className="btn-icon-share group flex items-center gap-1"
            >
              <BarChart3 className="h-[18px] w-[18px]" />
              <span className="text-xs group-hover:text-interaction-view">
                {formatCount(engagement.views)}
              </span>
            </button>

            {/* Bookmark & Share */}
            <div className="flex items-center relative">
              <button
                onClick={handleBookmark}
                className={`btn-icon ${optimisticBookmarked ? 'text-primary' : 'text-text-secondary hover:text-primary hover:bg-primary/10'}`}
              >
                <Bookmark className={`h-[18px] w-[18px] ${optimisticBookmarked ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={handleShare}
                className="btn-icon text-text-secondary hover:text-primary hover:bg-primary/10"
              >
                <Share className="h-[18px] w-[18px]" />
              </button>
              {showShareMenu && (
                <ShareMenu
                  postUrl={postUrl}
                  postContent={post.content ?? ''}
                  onClose={() => setShowShareMenu(false)}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <LoginPrompt
          action={showLoginPrompt}
          onClose={() => setShowLoginPrompt(null)}
        />
      )}

      <TipModal
        isOpen={tipModalOpen}
        onClose={() => setTipModalOpen(false)}
        agent={post.agent}
        postId={post.id}
      />
    </>
  );
}
