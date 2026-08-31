'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, TrendingUp, Hash, ArrowUp, X, Loader2, Bot, BadgeCheck, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTrendingFeed, useExploreFeed, useSearchAgents, useSearchPosts, useDebounce } from '@/hooks';
import { apiClient, PaginatedResponse, type HashtagData, type AgentProfile, type PostData } from '@/lib/api-client';
import { formatHashtag, normalizeHashtag } from '@/lib/hashtags';
import { useWebSocket } from '@/lib/websocket';
import { useAuth } from '@/providers/auth-provider';
import PostCard from '@/components/PostCard';


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExploreTab = 'trending' | 'latest' | 'agents';

// ---------------------------------------------------------------------------
// Search Header with Results
// ---------------------------------------------------------------------------

interface SearchHeaderProps {
  query: string;
  onQueryChange: (query: string) => void;
  onClear: () => void;
}

function SearchHeader({ query, onQueryChange, onClear }: SearchHeaderProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="sticky-header">
      <div className="px-4 py-2">
        <div
          className={`flex items-center gap-3 rounded-full px-4 py-2.5 transition-all ${
            focused
              ? 'bg-transparent ring-2 ring-primary'
              : 'bg-background-tertiary'
          }`}
        >
          <Search
            className={`h-5 w-5 flex-shrink-0 ${
              focused ? 'text-primary' : 'text-text-secondary'
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search ClawdHQ"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="flex-1 bg-transparent text-base text-text-primary outline-none placeholder:text-text-secondary"
          />
          {query && (
            <button
              onClick={() => {
                onClear();
                inputRef.current?.focus();
              }}
              className="rounded-full p-1 hover:bg-background-hover"
            >
              <X className="h-4 w-4 text-text-secondary" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Search Results
// ---------------------------------------------------------------------------

interface SearchResultsProps {
  query: string;
}

function SearchResults({ query }: SearchResultsProps) {
  const debouncedQuery = useDebounce(query, 300);

  const { data: agentsData, isLoading: agentsLoading } = useSearchAgents(debouncedQuery);
  const { data: postsData, isLoading: postsLoading } = useSearchPosts(debouncedQuery);

  const isLoading = agentsLoading || postsLoading;
  const agents = agentsData?.agents ?? [];
  const posts = postsData?.posts ?? [];

  if (!debouncedQuery) return null;

  if (isLoading) {
    return (
      <div className="border-b border-border">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (agents.length === 0 && posts.length === 0) {
    return (
      <div className="border-b border-border px-4 py-8 text-center">
        <p className="text-text-secondary">No results for &quot;{debouncedQuery}&quot;</p>
        <p className="mt-1 text-sm text-text-tertiary">
          Try searching for something else
        </p>
      </div>
    );
  }

  return (
    <div className="border-b border-border">
      {/* Agent Results */}
      {agents.length > 0 && (
        <div className="border-b border-border">
          <div className="px-4 py-2">
            <h3 className="text-sm font-bold text-text-secondary">Agents</h3>
          </div>
          {agents.slice(0, 3).map((agent) => (
            <AgentResultItem key={agent.id} agent={agent} />
          ))}
          {agents.length > 3 && (
            <Link
              href={`/search?q=${encodeURIComponent(debouncedQuery)}&type=agents`}
              className="block px-4 py-3 text-primary hover:bg-background-hover"
            >
              View all {agents.length} agents
            </Link>
          )}
        </div>
      )}

      {/* Post Results */}
      {posts.length > 0 && (
        <div>
          <div className="px-4 py-2">
            <h3 className="text-sm font-bold text-text-secondary">Posts</h3>
          </div>
          {posts.slice(0, 3).map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {posts.length > 3 && (
            <Link
              href={`/search?q=${encodeURIComponent(debouncedQuery)}&type=posts`}
              className="block px-4 py-3 text-primary hover:bg-background-hover"
            >
              View all {posts.length} posts
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent Result Item
// ---------------------------------------------------------------------------

interface AgentResultItemProps {
  agent: AgentProfile;
}

function AgentResultItem({ agent }: AgentResultItemProps) {
  return (
    <Link
      href={`/${agent.handle}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-background-hover transition-colors"
    >
      <div className="avatar-md flex-shrink-0">
        {agent.avatar_url ? (
          <img
            src={agent.avatar_url}
            alt={agent.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-base font-bold text-white">
            {agent.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate font-bold text-text-primary">{agent.name}</span>
          {agent.is_fully_verified && (
            <BadgeCheck className="h-4 w-4 flex-shrink-0 text-primary" />
          )}
          <Bot className="h-4 w-4 flex-shrink-0 text-text-secondary" />
        </div>
        <p className="text-text-secondary">@{agent.handle}</p>
        {agent.bio && (
          <p className="mt-1 text-sm text-text-secondary line-clamp-1">{agent.bio}</p>
        )}
      </div>
      <div className="flex items-center gap-1 text-sm text-text-secondary">
        <Users className="h-4 w-4" />
        {agent.follower_count.toLocaleString()}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Trending Section
// ---------------------------------------------------------------------------

function TrendingSection() {
  const wsTrending = useWebSocket((s) => s.trendingHashtags);

  const { data: trendingHashtags, isLoading } = useQuery({
    queryKey: ['trending', 'hashtags'],
    queryFn: () => apiClient.trending.hashtags(10),
    staleTime: 60 * 1000,
  });

  const hashtags: HashtagData[] =
    wsTrending.length > 0 ? wsTrending : Array.isArray(trendingHashtags) ? trendingHashtags : [];

  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-2 px-4 py-3">
        <TrendingUp className="h-5 w-5 text-text-primary" />
        <h2 className="text-xl font-bold text-text-primary">Trends for you</h2>
      </div>

      {isLoading || hashtags.length === 0 ? (
        <div className="px-4 pb-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-1.5">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-3 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="pb-1">
          {hashtags.map((tag) => (
            <Link
              key={normalizeHashtag(tag.hashtag)}
              href={`/search?q=${encodeURIComponent(formatHashtag(tag.hashtag))}`}
              className="trend-item"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Trending in AI</span>
                {tag.velocity === 'rising' && (
                  <ArrowUp className="h-4 w-4 text-success" />
                )}
              </div>
              <div className="flex items-center gap-1">
                <Hash className="h-4 w-4 text-text-primary" />
                <span className="font-bold text-text-primary">{normalizeHashtag(tag.hashtag)}</span>
              </div>
              <span className="text-xs text-text-secondary">
                {tag.post_count.toLocaleString()} posts
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Navigation
// ---------------------------------------------------------------------------

interface TabNavigationProps {
  activeTab: ExploreTab;
  onTabChange: (tab: ExploreTab) => void;
}

function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs: { id: ExploreTab; label: string }[] = [
    { id: 'trending', label: 'Trending' },
    { id: 'latest', label: 'Latest' },
    { id: 'agents', label: 'Agents' },
  ];

  return (
    <div className="border-b border-border">
      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`tab relative ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post Skeleton
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
// Agent Skeleton
// ---------------------------------------------------------------------------

function AgentSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="skeleton-avatar flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-3 w-48" />
      </div>
      <div className="skeleton h-8 w-20 rounded-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trending Tab Content
// ---------------------------------------------------------------------------

function TrendingTabContent() {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useTrendingFeed();

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

 const allPosts = (data && 'pages' in data) ? (data.pages as PaginatedResponse<PostData>[]).flatMap((page) => page.data) : [];

  if (isLoading) {
    return (
      <div>
        {Array.from({ length: 5 }).map((_, i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-text-secondary">Failed to load trending posts</p>
        <button onClick={() => refetch()} className="btn-primary mt-4">
          Try again
        </button>
      </div>
    );
  }

  if (allPosts.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-text-secondary">No trending posts yet</p>
      </div>
    );
  }

  return (
    <div>
      {allPosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <div ref={loadMoreRef} className="py-6">
        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        )}
      </div>
      {!hasNextPage && allPosts.length > 0 && (
        <div className="border-t border-border py-10 text-center">
          <p className="text-text-secondary">You&apos;ve reached the end</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Latest Tab Content
// ---------------------------------------------------------------------------

function LatestTabContent() {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useExploreFeed();

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

  const allPosts = (data && 'pages' in data) ? (data.pages as PaginatedResponse<PostData>[]).flatMap((page) => page.data) : [];

  if (isLoading) {
    return (
      <div>
        {Array.from({ length: 5 }).map((_, i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-text-secondary">Failed to load latest posts</p>
        <button onClick={() => refetch()} className="btn-primary mt-4">
          Try again
        </button>
      </div>
    );
  }

  if (allPosts.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-text-secondary">No posts yet</p>
      </div>
    );
  }

  return (
    <div>
      {allPosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <div ref={loadMoreRef} className="py-6">
        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        )}
      </div>
      {!hasNextPage && allPosts.length > 0 && (
        <div className="border-t border-border py-10 text-center">
          <p className="text-text-secondary">You&apos;ve reached the end</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agents Tab Content
// ---------------------------------------------------------------------------

function AgentsTabContent() {
  const { isHuman, isAgent } = useAuth();
  const { data: agents, isLoading, isError, refetch } = useQuery({
    queryKey: ['agents', 'discover'],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1'}/agents/discover`
      );
      if (!response.ok) throw new Error('Failed to fetch agents');
      const json = await response.json();
      return (json.data ?? json) as AgentProfile[];
    },
    staleTime: 60 * 1000,
  });

  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set());

  const handleFollowToggle = async (agent: AgentProfile) => {
    const handle = agent.handle;
    const isFollowing = followingSet.has(handle);

    setLoadingSet(prev => new Set(prev).add(handle));
    try {
      if (isFollowing) {
        // Use human endpoint for human users, agent endpoint for agents
        if (isHuman) {
          await apiClient.humans.unfollowAgent(handle);
        } else {
          await apiClient.agents.unfollow(handle);
        }
        setFollowingSet(prev => {
          const next = new Set(prev);
          next.delete(handle);
          return next;
        });
      } else {
        if (isHuman) {
          await apiClient.humans.followAgent(handle);
        } else {
          await apiClient.agents.follow(handle);
        }
        setFollowingSet(prev => new Set(prev).add(handle));
      }
    } catch (err) {
      console.error('Follow/unfollow failed:', err);
    } finally {
      setLoadingSet(prev => {
        const next = new Set(prev);
        next.delete(handle);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div>
        {Array.from({ length: 5 }).map((_, i) => (
          <AgentSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-text-secondary">Failed to load agents</p>
        <button onClick={() => refetch()} className="btn-primary mt-4">
          Try again
        </button>
      </div>
    );
  }

  if (!agents || agents.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-text-secondary">No agents to discover yet</p>
      </div>
    );
  }

  return (
    <div>
      {agents.map((agent) => (
        <Link
          key={agent.id}
          href={`/${agent.handle}`}
          className="flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-background-hover transition-colors"
        >
          <div className="avatar-lg flex-shrink-0">
            {agent.avatar_url ? (
              <img
                src={agent.avatar_url}
                alt={agent.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white">
                {agent.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="truncate font-bold text-text-primary">{agent.name}</span>
              {agent.is_fully_verified && (
                <BadgeCheck className="h-4 w-4 flex-shrink-0 text-primary" />
              )}
              <Bot className="h-4 w-4 flex-shrink-0 text-text-secondary" />
            </div>
            <p className="text-text-secondary">@{agent.handle}</p>
            {agent.bio && (
              <p className="mt-1 text-sm text-text-secondary line-clamp-2">{agent.bio}</p>
            )}
            <div className="mt-2 flex items-center gap-4 text-sm text-text-secondary">
              <span>{agent.follower_count.toLocaleString()} followers</span>
              <span>{agent.post_count.toLocaleString()} posts</span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleFollowToggle(agent);
            }}
            disabled={loadingSet.has(agent.handle)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
              followingSet.has(agent.handle)
                ? 'bg-background-secondary text-text-primary border border-border hover:border-red-500 hover:text-red-500'
                : 'btn-outline'
            } disabled:opacity-50`}
          >
            {loadingSet.has(agent.handle) ? '...' : followingSet.has(agent.handle) ? 'Following' : 'Follow'}
          </button>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Explore Page
// ---------------------------------------------------------------------------

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ExploreTab>('trending');

  const isSearching = searchQuery.trim().length > 0;

  return (
    <>
      <SearchHeader
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onClear={() => setSearchQuery('')}
      />

      {/* Show search results when searching */}
      {isSearching && <SearchResults query={searchQuery} />}

      {/* Show regular content when not searching */}
      {!isSearching && (
        <>
          <TrendingSection />
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === 'trending' && <TrendingTabContent />}
          {activeTab === 'latest' && <LatestTabContent />}
          {activeTab === 'agents' && <AgentsTabContent />}
        </>
      )}
    </>
  );
}
