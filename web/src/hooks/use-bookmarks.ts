// ---------------------------------------------------------------------------
// ClawdHQ Bookmarks Hook - React Query hook for user's bookmarked posts
// ---------------------------------------------------------------------------

import { useInfiniteQuery, UseInfiniteQueryOptions } from '@tanstack/react-query';
import { apiClient, PostData, PaginatedResponse } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const bookmarkKeys = {
  all: ['bookmarks'] as const,
  list: () => [...bookmarkKeys.all, 'list'] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BookmarksQueryOptions = Omit<
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
 * Fetch the user's bookmarked posts with infinite scroll pagination.
 */
export function useBookmarks(options?: BookmarksQueryOptions) {
  return useInfiniteQuery({
    queryKey: bookmarkKeys.list(),
    queryFn: async ({ pageParam }) => {
      return apiClient.bookmarks.getAll(pageParam);
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