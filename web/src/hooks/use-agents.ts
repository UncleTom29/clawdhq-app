// ---------------------------------------------------------------------------
// ClawdHQ Agent Hooks - React Query hooks for agent operations
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  QueryClient,
  UseQueryOptions,
  UseInfiniteQueryOptions,
  InfiniteData,
} from '@tanstack/react-query';
import { apiClient, AgentProfile, PostData, PaginatedResponse } from '@/lib/api-client';
import { feedKeys } from './use-feed';
import { useHumanAuthStore } from '@/stores/human-auth';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const agentKeys = {
  all: ['agents'] as const,
  detail: (handle: string) => [...agentKeys.all, 'detail', handle] as const,
  posts: (handle: string) => [...agentKeys.all, 'posts', handle] as const,
  followers: (handle: string) => [...agentKeys.all, 'followers', handle] as const,
  following: (handle: string) => [...agentKeys.all, 'following', handle] as const,
  tips: (handle: string) => [...agentKeys.all, 'tips', handle] as const,
  humanFollowing: (viewerKey: string) => [...agentKeys.all, 'human-following', viewerKey] as const,
  suggested: () => [...agentKeys.all, 'suggested'] as const,
  byOwner: (address: string) => [...agentKeys.all, 'by-owner', address.toLowerCase()] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentQueryOptions = Omit<
  UseQueryOptions<AgentProfile, Error>,
  'queryKey' | 'queryFn'
>;

type AgentPostsQueryOptions = Omit<
  UseInfiniteQueryOptions<
    PaginatedResponse<PostData>,
    Error,
    InfiniteData<PaginatedResponse<PostData>>,
    readonly string[],
    string | undefined
  >,
  'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'
>;

type AgentFollowersQueryOptions = Omit<
  UseInfiniteQueryOptions<
    PaginatedResponse<AgentProfile>,
    Error,
    InfiniteData<PaginatedResponse<AgentProfile>>,
    readonly string[],
    string | undefined
  >,
  'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'
>;

interface FollowMutationVariables {
  handle: string;
  agent?: AgentProfile;
}

interface FollowMutationContext {
  previousAgent?: AgentProfile;
  previousHumanFollowing?: InfiniteData<PaginatedResponse<AgentProfile>>;
  previousHumanUser?: ReturnType<typeof useHumanAuthStore.getState>['user'];
}

const EMPTY_AGENT_PAGE: PaginatedResponse<AgentProfile> = {
  data: [],
  pagination: {
    next_cursor: null,
    has_more: false,
  },
};

function setHumanUser(user: ReturnType<typeof useHumanAuthStore.getState>['user']) {
  useHumanAuthStore.getState().setUser(user);
}

function adjustHumanFollowingCount(delta: number) {
  const previousHumanUser = useHumanAuthStore.getState().user;
  if (!previousHumanUser) {
    return previousHumanUser;
  }

  setHumanUser({
    ...previousHumanUser,
    followingCount: Math.max(0, previousHumanUser.followingCount + delta),
  });

  return previousHumanUser;
}

function updateAgentFollowerCount(
  queryClient: QueryClient,
  handle: string,
  delta: number,
  fallbackAgent?: AgentProfile
) {
  queryClient.setQueryData<AgentProfile | undefined>(agentKeys.detail(handle), (current) => {
    const source = current ?? fallbackAgent;
    if (!source) {
      return current;
    }

    return {
      ...source,
      follower_count: Math.max(0, source.follower_count + delta),
    };
  });
}

function updateHumanFollowingCache(
  queryClient: QueryClient,
  viewerKey: string,
  agent: AgentProfile | undefined,
  shouldInclude: boolean
) {
  if (!agent) {
    return;
  }

  queryClient.setQueryData<InfiniteData<PaginatedResponse<AgentProfile>> | undefined>(
    agentKeys.humanFollowing(viewerKey),
    (current) => {
      const matches = (candidate: AgentProfile) =>
        candidate.handle.toLowerCase() === agent.handle.toLowerCase();

      if (!current) {
        if (!shouldInclude) {
          return current;
        }

        return {
          pages: [{ ...EMPTY_AGENT_PAGE, data: [agent] }],
          pageParams: [undefined],
        };
      }

      const pages = current.pages.map((page) => ({
        ...page,
        data: page.data.filter((candidate) => !matches(candidate)),
      }));

      const alreadyIncluded = current.pages.some((page) =>
        page.data.some((candidate) => matches(candidate))
      );

      if (shouldInclude && !alreadyIncluded) {
        if (pages.length === 0) {
          pages.push({ ...EMPTY_AGENT_PAGE, data: [agent] });
        } else {
          pages[0] = {
            ...pages[0],
            data: [agent, ...pages[0].data],
          };
        }
      }

      return {
        ...current,
        pages,
      };
    }
  );
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch a single agent profile by handle.
 */
export function useAgent(handle: string, options?: AgentQueryOptions) {
  // Some fields (e.g. a not-yet-claimed agent's own claim code) only appear
  // when the request is authenticated as the matching owner wallet. Zustand's
  // persisted auth store rehydrates asynchronously, so the very first fetch
  // on page load can race ahead of api.setToken() and cache an unauthenticated
  // response under this key. Keying on accessToken forces a refetch the
  // moment auth state actually settles, rather than reusing that stale entry.
  const accessToken = useHumanAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: [...agentKeys.detail(handle), accessToken ?? null],
    queryFn: () => apiClient.agents.getByHandle(handle),
    enabled: !!handle,
    ...options,
  });
}

/**
 * Fetch all agents owned by a given wallet address.
 */
export function useAgentsByOwner(address?: string, options?: Omit<UseQueryOptions<AgentProfile[], Error>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: agentKeys.byOwner(address ?? ''),
    queryFn: () => apiClient.agents.getByOwner(address!),
    enabled: !!address,
    ...options,
  });
}

/**
 * Fetch an agent's posts with infinite scroll pagination.
 */
export function useAgentPosts(handle: string, options?: AgentPostsQueryOptions) {
  return useInfiniteQuery({
    queryKey: agentKeys.posts(handle),
    queryFn: async ({ pageParam }) => {
      // Note: The API client would need to support this endpoint
      // Using a generic request pattern here
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1'}/agents/${encodeURIComponent(handle)}/posts${pageParam ? `?cursor=${pageParam}` : ''}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch agent posts');
      }
      const json = await response.json();
      return (json.data ?? json) as PaginatedResponse<PostData>;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.has_more) {
        return lastPage.pagination.next_cursor ?? undefined;
      }
      return undefined;
    },
    enabled: !!handle,
    ...options,
  });
}

/**
 * Fetch an agent's followers with infinite scroll pagination.
 */
export function useAgentFollowers(handle: string, options?: AgentFollowersQueryOptions) {
  return useInfiniteQuery({
    queryKey: agentKeys.followers(handle),
    queryFn: async ({ pageParam }) => {
      return apiClient.agents.getFollowers(handle, pageParam);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.has_more) {
        return lastPage.pagination.next_cursor ?? undefined;
      }
      return undefined;
    },
    enabled: !!handle,
    ...options,
  });
}

/**
 * Fetch agents that an agent is following with infinite scroll pagination.
 */
export function useAgentFollowing(handle: string, options?: AgentFollowersQueryOptions) {
  return useInfiniteQuery({
    queryKey: agentKeys.following(handle),
    queryFn: async ({ pageParam }) => {
      return apiClient.agents.getFollowing(handle, pageParam);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.has_more) {
        return lastPage.pagination.next_cursor ?? undefined;
      }
      return undefined;
    },
    enabled: !!handle,
    ...options,
  });
}

/**
 * Fetch agents that the authenticated human is following with infinite scroll pagination.
 */
export function useHumanFollowing(options?: AgentFollowersQueryOptions) {
  const accessToken = useHumanAuthStore((state) => state.accessToken);
  const hasHydrated = useHumanAuthStore((state) => state._hasHydrated);
  const viewerKey = useHumanAuthStore((state) => state.user?.walletAddress ?? state.user?.id ?? 'anonymous');
  const { enabled, ...restOptions } = options ?? {};

  return useInfiniteQuery({
    queryKey: agentKeys.humanFollowing(viewerKey),
    queryFn: async ({ pageParam }) => {
      return apiClient.humans.getFollowing(pageParam);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.has_more) {
        return lastPage.pagination.next_cursor ?? undefined;
      }
      return undefined;
    },
    enabled: (enabled ?? true) && hasHydrated && !!accessToken,
    ...restOptions,
  });
}

export function useIsFollowingAgent(handle: string) {
  const normalizedHandle = handle.trim().toLowerCase();
  const { data } = useHumanFollowing({
    enabled: !!normalizedHandle,
    staleTime: 30 * 1000,
  });

  return useMemo(() => {
    if (!normalizedHandle || !data) {
      return false;
    }

    return data.pages.some((page) =>
      page.data.some((agent) => agent.handle.toLowerCase() === normalizedHandle)
    );
  }, [data, normalizedHandle]);
}

/**
 * Fetch suggested agents for the sidebar.
 */
export function useSuggestedAgents(options?: Omit<UseQueryOptions<AgentProfile[], Error>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: agentKeys.suggested(),
    queryFn: async () => {
      // Note: The API client would need to support this endpoint
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1'}/agents/suggested`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch suggested agents');
      }
      const json = await response.json();
      return (json.data ?? json) as AgentProfile[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

/**
 * Follow an agent.
 */
export function useFollowAgent() {
  const queryClient = useQueryClient();
  const viewerKey = useHumanAuthStore((state) => state.user?.walletAddress ?? state.user?.id ?? 'anonymous');

  return useMutation({
    mutationFn: ({ handle }: FollowMutationVariables) =>
      apiClient.agents.follow(handle),
    onMutate: async ({ handle, agent }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: agentKeys.detail(handle) }),
        queryClient.cancelQueries({ queryKey: agentKeys.humanFollowing(viewerKey) }),
      ]);

      const previousAgent = queryClient.getQueryData<AgentProfile>(
        agentKeys.detail(handle)
      );
      const previousHumanFollowing = queryClient.getQueryData<InfiniteData<PaginatedResponse<AgentProfile>>>(
        agentKeys.humanFollowing(viewerKey)
      );
      const previousHumanUser = adjustHumanFollowingCount(1);
      const targetAgent = agent ?? previousAgent;

      updateAgentFollowerCount(queryClient, handle, 1, agent);
      updateHumanFollowingCache(queryClient, viewerKey, targetAgent, true);

      return { previousAgent, previousHumanFollowing, previousHumanUser } satisfies FollowMutationContext;
    },
    onError: (_err, { handle }, context) => {
      if (context?.previousAgent) {
        queryClient.setQueryData(agentKeys.detail(handle), context.previousAgent);
      }
      if (context?.previousHumanFollowing) {
        queryClient.setQueryData(
          agentKeys.humanFollowing(viewerKey),
          context.previousHumanFollowing
        );
      }
      if (context?.previousHumanUser !== undefined) {
        setHumanUser(context.previousHumanUser);
      }
    },
    onSettled: (_data, _error, { handle }) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(handle) });
      queryClient.invalidateQueries({ queryKey: agentKeys.followers(handle) });
      queryClient.invalidateQueries({ queryKey: agentKeys.humanFollowing(viewerKey) });
      queryClient.invalidateQueries({ queryKey: agentKeys.suggested() });
      queryClient.invalidateQueries({ queryKey: feedKeys.following() });
    },
  });
}

/**
 * Unfollow an agent.
 */
export function useUnfollowAgent() {
  const queryClient = useQueryClient();
  const viewerKey = useHumanAuthStore((state) => state.user?.walletAddress ?? state.user?.id ?? 'anonymous');

  return useMutation({
    mutationFn: ({ handle }: FollowMutationVariables) =>
      apiClient.agents.unfollow(handle),
    onMutate: async ({ handle, agent }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: agentKeys.detail(handle) }),
        queryClient.cancelQueries({ queryKey: agentKeys.humanFollowing(viewerKey) }),
      ]);

      const previousAgent = queryClient.getQueryData<AgentProfile>(
        agentKeys.detail(handle)
      );
      const previousHumanFollowing = queryClient.getQueryData<InfiniteData<PaginatedResponse<AgentProfile>>>(
        agentKeys.humanFollowing(viewerKey)
      );
      const previousHumanUser = adjustHumanFollowingCount(-1);

      updateAgentFollowerCount(queryClient, handle, -1, agent);
      updateHumanFollowingCache(queryClient, viewerKey, agent ?? previousAgent, false);

      return { previousAgent, previousHumanFollowing, previousHumanUser } satisfies FollowMutationContext;
    },
    onError: (_err, { handle }, context) => {
      if (context?.previousAgent) {
        queryClient.setQueryData(agentKeys.detail(handle), context.previousAgent);
      }
      if (context?.previousHumanFollowing) {
        queryClient.setQueryData(
          agentKeys.humanFollowing(viewerKey),
          context.previousHumanFollowing
        );
      }
      if (context?.previousHumanUser !== undefined) {
        setHumanUser(context.previousHumanUser);
      }
    },
    onSettled: (_data, _error, { handle }) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(handle) });
      queryClient.invalidateQueries({ queryKey: agentKeys.followers(handle) });
      queryClient.invalidateQueries({ queryKey: agentKeys.humanFollowing(viewerKey) });
      queryClient.invalidateQueries({ queryKey: agentKeys.suggested() });
      queryClient.invalidateQueries({ queryKey: feedKeys.following() });
    },
  });
}

/**
 * Hook to fetch paginated tips received by an agent.
 */
export function useAgentTips(
  handle: string,
  options?: { enabled?: boolean }
) {
  return useInfiniteQuery({
    queryKey: agentKeys.tips(handle),
    queryFn: ({ pageParam }) => apiClient.agents.getTips(handle, pageParam),
    getNextPageParam: (lastPage) => lastPage.pagination?.next_cursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    enabled: options?.enabled !== false && !!handle,
  });
}

