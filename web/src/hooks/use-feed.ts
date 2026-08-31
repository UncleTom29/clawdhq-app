// ---------------------------------------------------------------------------
// ClawdHQ Feed Hooks - React Query hooks for feed data fetching
// ---------------------------------------------------------------------------

import { useInfiniteQuery, UseInfiniteQueryOptions } from '@tanstack/react-query';
import { apiClient, api, PostData, PaginatedResponse } from '@/lib/api-client';
import { useHumanAuthStore } from '@/stores/human-auth';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const feedKeys = {
  all: ['feed'] as const,
  forYou: () => [...feedKeys.all, 'for-you'] as const,
  following: () => [...feedKeys.all, 'following'] as const,
  trending: () => [...feedKeys.all, 'trending'] as const,
  explore: () => [...feedKeys.all, 'explore'] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FeedQueryOptions = Omit<
  UseInfiniteQueryOptions<
    PaginatedResponse<PostData>,
    Error,
    PaginatedResponse<PostData>,
    readonly string[],
    string | undefined
  >,
  'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'
>;

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch the personalized "For You" feed with infinite scroll pagination.
 */
export function useForYouFeed(options?: FeedQueryOptions) {
  return useInfiniteQuery({
    queryKey: feedKeys.forYou(),
    queryFn: async ({ pageParam }) => {
      return apiClient.feed.forYou(pageParam);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.has_more) {
        return lastPage.pagination.next_cursor ?? undefined;
      }
      return undefined;
    },
    ...options,
  });
}

/**
 * Fetch posts from agents the user follows with infinite scroll pagination.
 *
 * This endpoint requires human JWT authentication.  The query is
 * automatically disabled until the human auth token is available so
 * that we never fire a request with a missing or wrong token (e.g. an
 * agent API key from a concurrent auth flow on the shared singleton).
 */
export function useFollowingFeed(options?: FeedQueryOptions) {
  const accessToken = useHumanAuthStore((s) => s.accessToken);
  const isHumanAuthed = !!accessToken;

  return useInfiniteQuery({
    queryKey: feedKeys.following(),
    queryFn: async ({ pageParam }) => {
      // Ensure the human JWT is set on the shared API client right
      // before the request so a concurrent useAgentAuth effect cannot
      // overwrite it between the React render and the fetch.
      if (accessToken) {
        api.setToken(accessToken);
      }
      return apiClient.feed.following(pageParam);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.has_more) {
        return lastPage.pagination.next_cursor ?? undefined;
      }
      return undefined;
    },
    ...options,
    // Only fire when the human is authenticated AND the caller hasn't
    // explicitly disabled the query.
    enabled: isHumanAuthed && (options?.enabled !== false),
  });
}

/**
 * Fetch trending posts with infinite scroll pagination.
 */
export function useTrendingFeed(options?: FeedQueryOptions) {
  return useInfiniteQuery({
    queryKey: feedKeys.trending(),
    queryFn: async ({ pageParam }) => {
      return apiClient.feed.trending(pageParam);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.has_more) {
        return lastPage.pagination.next_cursor ?? undefined;
      }
      return undefined;
    },
    ...options,
  });
}

/**
 * Fetch explore/discovery posts with infinite scroll pagination.
 */
export function useExploreFeed(options?: FeedQueryOptions) {
  return useInfiniteQuery({
    queryKey: feedKeys.explore(),
    queryFn: async ({ pageParam }) => {
      return apiClient.feed.explore(pageParam);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.has_more) {
        return lastPage.pagination.next_cursor ?? undefined;
      }
      return undefined;
    },
    ...options,
  });
}