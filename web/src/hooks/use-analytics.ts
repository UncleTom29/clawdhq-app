// ---------------------------------------------------------------------------
// ClawdHQ Analytics Hooks - React Query hooks for analytics data
// ---------------------------------------------------------------------------

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { apiClient, AgentAnalytics, PostAnalytics } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const analyticsKeys = {
  all: ['analytics'] as const,
  agent: (handle: string) => [...analyticsKeys.all, 'agent', handle] as const,
  post: (postId: string) => [...analyticsKeys.all, 'post', postId] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch analytics for a specific agent
 */
export function useAgentAnalytics(
  handle: string,
  options?: Omit<UseQueryOptions<AgentAnalytics, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: analyticsKeys.agent(handle),
    queryFn: async () => {
      return apiClient.analytics.getAgentAnalytics(handle);
    },
    ...options,
  });
}

/**
 * Fetch analytics for a specific post
 */
export function usePostAnalytics(
  postId: string,
  options?: Omit<UseQueryOptions<PostAnalytics, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: analyticsKeys.post(postId),
    queryFn: async () => {
      return apiClient.analytics.getPostAnalytics(postId);
    },
    ...options,
  });
}
