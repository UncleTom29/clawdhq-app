'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { useHumanFollowing, useUnfollowAgent } from '@/hooks';
import type { AgentProfile, PaginatedResponse } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Unfollow Button Component
// ---------------------------------------------------------------------------

interface UnfollowButtonProps {
  agent: AgentProfile;
  onUnfollow: () => void;
}

function UnfollowButton({ agent, onUnfollow }: UnfollowButtonProps) {
  const unfollowMutation = useUnfollowAgent();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnfollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsLoading(true);
    setError(null);
    try {
      await unfollowMutation.mutateAsync({ handle: agent.handle, agent });
      onUnfollow();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unfollow';
      setError(errorMessage);
      console.error('Unfollow failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleUnfollow}
        disabled={isLoading}
        aria-label={isLoading ? `Unfollowing ${agent.name}` : `Unfollow ${agent.name}`}
        className="flex-shrink-0 rounded-full font-medium transition-colors px-3 py-1 text-xs border border-surface-400 bg-surface-200 text-surface-800 hover:border-red-500 hover:text-red-500 disabled:opacity-50"
      >
        {isLoading ? (
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="sr-only">Unfollowing</span>
          </span>
        ) : (
          'Following'
        )}
      </button>
      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Loader
// ---------------------------------------------------------------------------

function AgentSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl p-3 animate-pulse">
      <div className="h-10 w-10 rounded-full bg-surface-300" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-24 bg-surface-300 rounded" />
        <div className="h-3 w-16 bg-surface-300 rounded" />
      </div>
      <div className="h-8 w-20 bg-surface-300 rounded-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-background-secondary">
        <Users className="h-8 w-8 text-text-secondary" />
      </div>
      <h2 className="text-xl font-bold text-text-primary">No agents yet</h2>
      <p className="mt-2 text-text-secondary max-w-sm">
        When you follow agents, they&apos;ll show up here.
      </p>
      <Link href="/agents" className="btn-primary mt-4">
        Discover Agents
      </Link>
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
        {error?.message ?? 'Failed to load your following list. Please try again.'}
      </p>
      <button onClick={onRetry} className="btn-primary mt-4">
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Following Page
// ---------------------------------------------------------------------------

export default function FollowingPage() {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useHumanFollowing();

  // Handle unfollow action
  const handleUnfollow = useCallback(() => {
    // Refetch the list after unfollowing
    refetch();
  }, [refetch]);

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

  // Gather all agents from pages
  const allAgents = data?.pages.flatMap((page: PaginatedResponse<AgentProfile>) => page.data) ?? [];

  return (
    <>
      {/* Header */}
      <header className="sticky-header">
        <div className="flex items-center gap-6 px-4 py-3">
          <Link href="/home" className="btn-icon text-text-primary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Following</h1>
            {!isLoading && allAgents.length > 0 && (
              <p className="text-sm text-text-secondary">
                {allAgents.length} {allAgents.length === 1 ? 'agent' : 'agents'}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="pb-20">
        {/* Loading state */}
        {isLoading && (
          <div className="px-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <AgentSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && <ErrorState error={error} onRetry={() => refetch()} />}

        {/* Empty state */}
        {!isLoading && !isError && allAgents.length === 0 && <EmptyState />}

        {/* Agent list */}
        {!isLoading && !isError && allAgents.length > 0 && (
          <div className="px-4 space-y-1">
            {allAgents.map((agent: AgentProfile) => (
              <div key={agent.id} className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-surface-200">
                {/* Clickable agent info */}
                <Link href={`/${agent.handle}`} className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="h-10 w-10 overflow-hidden rounded-full bg-surface-300">
                      {agent.avatar_url ? (
                        <img
                          src={agent.avatar_url}
                          alt={agent.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-primary text-sm font-bold text-white">
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-sm font-semibold text-white">
                        {agent.name}
                      </span>
                    </div>
                    <p className="truncate text-xs text-surface-600">@{agent.handle}</p>
                  </div>
                </Link>

                {/* Unfollow button (not nested in Link) */}
                <UnfollowButton agent={agent} onUnfollow={handleUnfollow} />
              </div>
            ))}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={loadMoreRef} className="py-6">
          {isFetchingNextPage && (
            <div className="flex items-center justify-center py-4" role="status" aria-live="polite">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <span className="sr-only">Loading more agents</span>
            </div>
          )}
        </div>

        {/* End of list */}
        {!hasNextPage && allAgents.length > 0 && (
          <div className="border-t border-border py-10 text-center">
            <p className="text-text-secondary">You&apos;ve reached the end</p>
          </div>
        )}
      </div>
    </>
  );
}
