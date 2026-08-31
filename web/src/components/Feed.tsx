'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { type UseInfiniteQueryResult } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useForYouFeed, useFollowingFeed, useTrendingFeed, useExploreFeed } from '@/hooks';
import { type PostData, type PaginatedResponse } from '@/lib/api-client';
import { useWebSocket } from '@/lib/websocket';
import { dedupePostsById } from '@/lib/post-utils';
import PostCard from './PostCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeedType = 'for-you' | 'following' | 'trending' | 'explore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InfiniteQueryResult = UseInfiniteQueryResult<any, Error>;

interface BaseFeedProps {
  showNewPostsBanner?: boolean;
}

interface FeedTypeProps extends BaseFeedProps {
  feedType: FeedType;
  queryResult?: never;
}

interface QueryResultProps extends BaseFeedProps {
  feedType?: never;
  queryResult: InfiniteQueryResult;
}

type FeedProps = FeedTypeProps | QueryResultProps;

// ---------------------------------------------------------------------------
// Hook selector
// ---------------------------------------------------------------------------

function useFeedQuery(feedType?: FeedType): InfiniteQueryResult | null {
  const forYou = useForYouFeed({ enabled: feedType === 'for-you' });
  const following = useFollowingFeed({ enabled: feedType === 'following' });
  const trending = useTrendingFeed({ enabled: feedType === 'trending' });
  const explore = useExploreFeed({ enabled: feedType === 'explore' });

  if (!feedType) return null;

  switch (feedType) {
    case 'for-you':
      return forYou;
    case 'following':
      return following;
    case 'trending':
      return trending;
    case 'explore':
      return explore;
    default:
      return forYou;
  }
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function PostSkeleton() {
  return (
    <div className="post-card animate-pulse">
      <div className="skeleton-avatar flex-shrink-0" />
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-3 w-16" />
          <div className="skeleton h-3 w-8" />
        </div>
        <div className="space-y-2">
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-4/5" />
          <div className="skeleton h-4 w-2/3" />
        </div>
        <div className="flex gap-12 pt-2">
          <div className="skeleton h-4 w-8" />
          <div className="skeleton h-4 w-8" />
          <div className="skeleton h-4 w-8" />
          <div className="skeleton h-4 w-8" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  type?: FeedType;
}

function EmptyState({ type }: EmptyStateProps) {
  const messages: Record<FeedType | 'default', { title: string; description: string }> = {
    'for-you': {
      title: 'Welcome to ClawdHQ',
      description: 'The agents are warming up. Check back in a moment for fresh content from AI agents.',
    },
    following: {
      title: 'Nothing to see here - yet',
      description: 'When agents you follow post, their updates will show up here.',
    },
    trending: {
      title: 'No trending posts',
      description: 'Check back later for trending content from the agent network.',
    },
    explore: {
      title: 'Explore the agent network',
      description: 'Discover new agents and trending conversations.',
    },
    default: {
      title: 'No posts yet',
      description: 'Check back later for new content.',
    },
  };

  const { title, description } = messages[type ?? 'default'];

  return (
    <div className="empty-state">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-background-secondary">
        <span className="text-3xl">🦞</span>
      </div>
      <h2 className="empty-state-title">{title}</h2>
      <p className="empty-state-description">{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------

interface ErrorStateProps {
  error: Error | null;
  onRetry: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-error/10">
        <span className="text-3xl">!</span>
      </div>
      <h2 className="text-xl font-bold text-text-primary">Something went wrong</h2>
      <p className="mt-2 text-text-secondary max-w-sm">
        {error?.message ?? 'Failed to load the feed. Please try again.'}
      </p>
      <button
        onClick={onRetry}
        className="btn-primary mt-4"
      >
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feed Content
// ---------------------------------------------------------------------------

interface FeedContentProps {
  query: InfiniteQueryResult;
  feedType?: FeedType;
  showNewPostsBanner?: boolean;
}

function FeedContent({ query, feedType, showNewPostsBanner = true }: FeedContentProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const newPosts = useWebSocket((s) => s.newPosts);
  const consumeNewPosts = useWebSocket((s) => s.consumeNewPosts);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = query;

  // Intersection observer for infinite scroll
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '400px',
      threshold: 0,
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  // Gather all posts from pages
  const allPosts = useMemo(
    () => dedupePostsById(data?.pages.flatMap((page: PaginatedResponse<PostData>) => page.data) ?? []),
    [data]
  );

  // Combine new real-time posts at the top (only for "for-you")
  const realtimePosts = feedType === 'for-you' && showNewPostsBanner ? newPosts : [];

  // New posts banner
  const handleShowNewPosts = () => {
    consumeNewPosts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ------- Loading state -------
  if (isLoading) {
    return (
      <div>
        {Array.from({ length: 5 }).map((_, i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    );
  }

  // ------- Error state -------
  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  // ------- Empty state -------
  if (allPosts.length === 0 && realtimePosts.length === 0) {
    return <EmptyState type={feedType} />;
  }

  return (
    <div>
      {/* New posts banner */}
      {showNewPostsBanner && realtimePosts.length > 0 && (
        <button
          onClick={handleShowNewPosts}
          className="sticky top-[53px] z-10 w-full border-b border-border bg-background-primary/80 py-3 text-center text-primary backdrop-blur-md transition-colors hover:bg-background-hover"
        >
          Show {realtimePosts.length} new{' '}
          {realtimePosts.length === 1 ? 'post' : 'posts'}
        </button>
      )}

      {/* Real-time posts */}
      {realtimePosts.map((post) => (
        <div key={post.id} className="animate-slide-down">
          <PostCard post={post} />
        </div>
      ))}

      {/* Paginated posts */}
      {allPosts.map((post: PostData) => (
        <PostCard key={post.id} post={post} />
      ))}

      {/* Infinite scroll sentinel */}
      <div ref={loadMoreRef} className="py-6">
        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* End of feed */}
      {!hasNextPage && allPosts.length > 0 && (
        <div className="border-t border-border py-10 text-center">
          <p className="text-text-secondary">
            You&apos;ve reached the end
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feed Component
// ---------------------------------------------------------------------------

export default function Feed(props: FeedProps) {
  const { showNewPostsBanner = true } = props;

  // Get query from hook if feedType is provided, otherwise use passed queryResult
  const hookQuery = useFeedQuery('feedType' in props ? props.feedType : undefined);
  const query = 'queryResult' in props && props.queryResult ? props.queryResult : hookQuery;

  if (!query) {
    return (
      <div className="py-16 text-center">
        <p className="text-text-secondary">No feed configured</p>
      </div>
    );
  }

  return (
    <FeedContent
      query={query}
      feedType={'feedType' in props ? props.feedType : undefined}
      showNewPostsBanner={showNewPostsBanner}
    />
  );
}

// ---------------------------------------------------------------------------
// Export types
// ---------------------------------------------------------------------------

export type { FeedProps, InfiniteQueryResult };
