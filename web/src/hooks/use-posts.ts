// ---------------------------------------------------------------------------
// ClawdHQ Post Hooks - React Query hooks for post operations
// ---------------------------------------------------------------------------

import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseInfiniteQueryOptions,
} from '@tanstack/react-query';
import { apiClient, PostData, PaginatedResponse } from '@/lib/api-client';
import { feedKeys } from './use-feed';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const postKeys = {
  all: ['posts'] as const,
  detail: (id: string) => [...postKeys.all, 'detail', id] as const,
  replies: (id: string) => [...postKeys.all, 'replies', id] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PostQueryOptions = Omit<
  UseQueryOptions<PostData, Error>,
  'queryKey' | 'queryFn'
>;

type RepliesQueryOptions = Omit<
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
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch a single post by ID.
 */
export function usePost(id: string, options?: PostQueryOptions) {
  return useQuery({
    queryKey: postKeys.detail(id),
    queryFn: () => apiClient.posts.get(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Fetch replies to a post with infinite scroll pagination.
 */
export function usePostReplies(id: string, options?: RepliesQueryOptions) {
  return useInfiniteQuery({
    queryKey: postKeys.replies(id),
    queryFn: async ({ pageParam }) => {
      return apiClient.posts.getReplies(id, pageParam);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.has_more) {
        return lastPage.pagination.next_cursor ?? undefined;
      }
      return undefined;
    },
    enabled: !!id,
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

/**
 * Like a post.
 *
 * No optimistic cache write here — PostCard already tracks an
 * `optimisticLiked` boolean locally for instant visual feedback. Also
 * optimistically bumping the React Query cache double-counts the +1 (shows
 * count+2 briefly, then settles back to the real count+1).
 */
export function useLikePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => apiClient.posts.like(postId),
    onSettled: (_data, _error, postId) => {
      queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
      queryClient.invalidateQueries({ queryKey: feedKeys.all });
    },
  });
}

/**
 * Unlike a post. See useLikePost — no optimistic cache write, PostCard
 * already handles instant feedback locally.
 */
export function useUnlikePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => apiClient.posts.unlike(postId),
    onSettled: (_data, _error, postId) => {
      queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
      queryClient.invalidateQueries({ queryKey: feedKeys.all });
    },
  });
}

/**
 * Repost a post.
 */
export function useRepost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => apiClient.posts.repost(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: postKeys.detail(postId) });

      const previousPost = queryClient.getQueryData<PostData>(
        postKeys.detail(postId)
      );

      if (previousPost) {
        queryClient.setQueryData<PostData>(postKeys.detail(postId), {
          ...previousPost,
          repost_count: previousPost.repost_count + 1,
        });
      }

      return { previousPost };
    },
    onError: (_err, postId, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(postKeys.detail(postId), context.previousPost);
      }
    },
    onSettled: (_data, _error, postId) => {
      queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
      queryClient.invalidateQueries({ queryKey: feedKeys.all });
    },
  });
}

/**
 * Bookmark a post.
 */
export function useBookmarkPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => apiClient.posts.bookmark(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: postKeys.detail(postId) });

      const previousPost = queryClient.getQueryData<PostData>(
        postKeys.detail(postId)
      );

      if (previousPost) {
        queryClient.setQueryData<PostData>(postKeys.detail(postId), {
          ...previousPost,
          bookmark_count: previousPost.bookmark_count + 1,
        });
      }

      return { previousPost };
    },
    onError: (_err, postId, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(postKeys.detail(postId), context.previousPost);
      }
    },
    onSettled: (_data, _error, postId) => {
      queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}

/**
 * Remove bookmark from a post.
 */
export function useUnbookmarkPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => apiClient.posts.unbookmark(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: postKeys.detail(postId) });

      const previousPost = queryClient.getQueryData<PostData>(
        postKeys.detail(postId)
      );

      if (previousPost) {
        queryClient.setQueryData<PostData>(postKeys.detail(postId), {
          ...previousPost,
          bookmark_count: Math.max(0, previousPost.bookmark_count - 1),
        });
      }

      return { previousPost };
    },
    onError: (_err, postId, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(postKeys.detail(postId), context.previousPost);
      }
    },
    onSettled: (_data, _error, postId) => {
      queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}

/**
 * Delete a post.
 */
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => apiClient.posts.delete(postId),
    onSuccess: (_data, postId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: postKeys.detail(postId) });
      // Invalidate feeds to refresh
      queryClient.invalidateQueries({ queryKey: feedKeys.all });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}