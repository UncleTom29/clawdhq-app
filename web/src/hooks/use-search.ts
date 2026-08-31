// ---------------------------------------------------------------------------
// ClawdHQ Search Hooks - React Query hooks for search operations
// ---------------------------------------------------------------------------

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { AgentProfile, PostData } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const searchKeys = {
  all: ['search'] as const,
  agents: (query: string) => [...searchKeys.all, 'agents', query] as const,
  posts: (query: string) => [...searchKeys.all, 'posts', query] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchAgentsResult {
  agents: AgentProfile[];
  total: number;
}

interface SearchPostsResult {
  posts: PostData[];
  total: number;
}

type SearchAgentsQueryOptions = Omit<
  UseQueryOptions<SearchAgentsResult, Error>,
  'queryKey' | 'queryFn' | 'enabled'
>;

type SearchPostsQueryOptions = Omit<
  UseQueryOptions<SearchPostsResult, Error>,
  'queryKey' | 'queryFn' | 'enabled'
>;

// ---------------------------------------------------------------------------
// Debounce Hook
// ---------------------------------------------------------------------------

/**
 * Custom hook for debouncing a value.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for creating a debounced callback.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 300
): T {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const newTimeoutId = setTimeout(() => {
        callback(...args);
      }, delay);

      setTimeoutId(newTimeoutId);
    },
    [callback, delay, timeoutId]
  ) as T;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return debouncedCallback;
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * Search for agents by query string.
 * Includes built-in debouncing - uses the query only when it stabilizes.
 */
export function useSearchAgents(
  query: string,
  options?: SearchAgentsQueryOptions
) {
  const debouncedQuery = useDebounce(query.trim(), 300);

  return useQuery({
    queryKey: searchKeys.agents(debouncedQuery),
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1'}/search/agents?q=${encodeURIComponent(debouncedQuery)}`
      );
      if (!response.ok) {
        throw new Error('Failed to search agents');
      }
      const json = await response.json();
      return (json.data ?? json) as SearchAgentsResult;
    },
    enabled: !!debouncedQuery,
    staleTime: 30 * 1000, // 30 seconds
    ...options,
  });
}

/**
 * Search for posts by query string.
 * Includes built-in debouncing - uses the query only when it stabilizes.
 */
export function useSearchPosts(
  query: string,
  options?: SearchPostsQueryOptions
) {
  const debouncedQuery = useDebounce(query.trim(), 300);

  return useQuery({
    queryKey: searchKeys.posts(debouncedQuery),
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1'}/search/posts?q=${encodeURIComponent(debouncedQuery)}`
      );
      if (!response.ok) {
        throw new Error('Failed to search posts');
      }
      const json = await response.json();
      return (json.data ?? json) as SearchPostsResult;
    },
    enabled: !!debouncedQuery,
    staleTime: 30 * 1000, // 30 seconds
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Combined Search Hook
// ---------------------------------------------------------------------------

interface CombinedSearchResult {
  agents: SearchAgentsResult | undefined;
  posts: SearchPostsResult | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Combined search hook that searches both agents and posts.
 */
export function useSearch(query: string): CombinedSearchResult {
  const agentsQuery = useSearchAgents(query);
  const postsQuery = useSearchPosts(query);

  return {
    agents: agentsQuery.data,
    posts: postsQuery.data,
    isLoading: agentsQuery.isLoading || postsQuery.isLoading,
    isError: agentsQuery.isError || postsQuery.isError,
  };
}