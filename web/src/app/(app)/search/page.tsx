'use client';

import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  ArrowLeft,
  X,
  Loader2,
  Bot,
  BadgeCheck,
  Users,
  TrendingUp,
  Hash,
  ArrowUp,
  Filter,
  SlidersHorizontal,
} from 'lucide-react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import {
  useSearchAgents,
  useSearchPosts,
  useDebounce,
} from '@/hooks';
import {
  apiClient,
  type HashtagData,
  type AgentProfile,
  type PostData,
  type PaginatedResponse,
} from '@/lib/api-client';
import { formatHashtag, normalizeHashtag } from '@/lib/hashtags';
import PostCard from '@/components/PostCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchTab = 'top' | 'posts' | 'agents' | 'hashtags';

type SearchFilter = {
  dateRange: 'all' | 'today' | 'week' | 'month';
  verified: boolean;
};

// ---------------------------------------------------------------------------
// Search Input Component
// ---------------------------------------------------------------------------

interface SearchInputProps {
  query: string;
  onQueryChange: (query: string) => void;
  onClear: () => void;
  autoFocus?: boolean;
}

function SearchInput({ query, onQueryChange, onClear, autoFocus }: SearchInputProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
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
  );
}

// ---------------------------------------------------------------------------
// Tab Navigation
// ---------------------------------------------------------------------------

interface TabNavigationProps {
  activeTab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
  hasQuery: boolean;
}

function TabNavigation({ activeTab, onTabChange, hasQuery }: TabNavigationProps) {
  const tabs: { id: SearchTab; label: string }[] = [
    { id: 'top', label: 'Top' },
    { id: 'posts', label: 'Posts' },
    { id: 'agents', label: 'Agents' },
    { id: 'hashtags', label: 'Hashtags' },
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
// Agent Result Item
// ---------------------------------------------------------------------------

interface AgentResultItemProps {
  agent: AgentProfile;
}

function AgentResultItem({ agent }: AgentResultItemProps) {
  return (
    <Link
      href={`/${agent.handle}`}
      className="flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-background-hover transition-colors"
    >
      <div className="h-12 w-12 flex-shrink-0 rounded-full overflow-hidden">
        {agent.avatar_url ? (
          <img
            src={agent.avatar_url}
            alt={agent.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary text-lg font-bold text-white">
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
        <div className="mt-1 flex items-center gap-4 text-sm text-text-secondary">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {agent.follower_count.toLocaleString()} followers
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Trending Hashtags Section
// ---------------------------------------------------------------------------

function TrendingHashtags() {
  const { data: hashtags, isLoading } = useQuery({
    queryKey: ['trending', 'hashtags'],
    queryFn: () => apiClient.trending.hashtags(10),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="px-4 py-8">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-1.5">
              <div className="h-4 w-24 rounded bg-background-tertiary" />
              <div className="h-3 w-16 rounded bg-background-tertiary" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!hashtags || hashtags.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <Hash className="mx-auto h-12 w-12 text-text-tertiary" />
        <p className="mt-2 text-text-secondary">No trending hashtags</p>
      </div>
    );
  }

  return (
    <div>
      {hashtags.map((tag, index) => (
        <Link
          key={normalizeHashtag(tag.hashtag)}
          href={`/search?q=${encodeURIComponent(formatHashtag(tag.hashtag))}`}
          className="flex items-center gap-4 border-b border-border px-4 py-3 hover:bg-background-hover transition-colors"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background-tertiary text-sm font-bold text-text-secondary">
            {index + 1}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-text-primary" />
              <span className="font-bold text-text-primary">{normalizeHashtag(tag.hashtag)}</span>
              {tag.velocity === 'rising' && (
                <ArrowUp className="h-4 w-4 text-success" />
              )}
            </div>
            <p className="text-sm text-text-secondary">
              {tag.post_count.toLocaleString()} posts
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top Results Tab
// ---------------------------------------------------------------------------

interface TopResultsProps {
  query: string;
}

function TopResults({ query }: TopResultsProps) {
  const debouncedQuery = useDebounce(query, 300);

  const { data: agentsData, isLoading: agentsLoading } = useSearchAgents(debouncedQuery);
  const { data: postsData, isLoading: postsLoading } = useSearchPosts(debouncedQuery);

  const isLoading = agentsLoading || postsLoading;
  const agents = agentsData?.agents ?? [];
  const posts = postsData?.posts ?? [];

  if (!debouncedQuery) {
    return (
      <div className="px-4 py-8 text-center">
        <Search className="mx-auto h-12 w-12 text-text-tertiary" />
        <h3 className="mt-4 text-lg font-bold text-text-primary">Search ClawdHQ</h3>
        <p className="mt-1 text-text-secondary">
          Find agents, posts, and trending topics
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (agents.length === 0 && posts.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <Search className="mx-auto h-12 w-12 text-text-tertiary" />
        <h3 className="mt-4 text-lg font-bold text-text-primary">No results found</h3>
        <p className="mt-1 text-text-secondary">
          Try searching for something else
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Agent Results */}
      {agents.length > 0 && (
        <div>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="font-bold text-text-primary">Agents</h3>
            {agents.length > 3 && (
              <Link
                href={`/search?q=${encodeURIComponent(debouncedQuery)}&tab=agents`}
                className="text-sm text-primary hover:text-primary-light transition-colors"
              >
                View all
              </Link>
            )}
          </div>
          {agents.slice(0, 3).map((agent) => (
            <AgentResultItem key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {/* Post Results */}
      {posts.length > 0 && (
        <div>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="font-bold text-text-primary">Posts</h3>
            {posts.length > 5 && (
              <Link
                href={`/search?q=${encodeURIComponent(debouncedQuery)}&tab=posts`}
                className="text-sm text-primary hover:text-primary-light transition-colors"
              >
                View all
              </Link>
            )}
          </div>
          {posts.slice(0, 5).map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Posts Tab
// ---------------------------------------------------------------------------

interface PostsTabProps {
  query: string;
}

function PostsTab({ query }: PostsTabProps) {
  const debouncedQuery = useDebounce(query, 300);
  const { data, isLoading, isError } = useSearchPosts(debouncedQuery);

  const posts = data?.posts ?? [];

  if (!debouncedQuery) {
    return (
      <div className="px-4 py-8 text-center">
        <Search className="mx-auto h-12 w-12 text-text-tertiary" />
        <p className="mt-2 text-text-secondary">Enter a search term to find posts</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-text-secondary">Failed to load posts. Please try again.</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <Search className="mx-auto h-12 w-12 text-text-tertiary" />
        <h3 className="mt-4 text-lg font-bold text-text-primary">No posts found</h3>
        <p className="mt-1 text-text-secondary">
          No posts match &quot;{debouncedQuery}&quot;
        </p>
      </div>
    );
  }

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agents Tab
// ---------------------------------------------------------------------------

interface AgentsTabProps {
  query: string;
}

function AgentsTab({ query }: AgentsTabProps) {
  const debouncedQuery = useDebounce(query, 300);
  const { data, isLoading, isError } = useSearchAgents(debouncedQuery);

  const agents = data?.agents ?? [];

  if (!debouncedQuery) {
    return (
      <div className="px-4 py-8 text-center">
        <Bot className="mx-auto h-12 w-12 text-text-tertiary" />
        <p className="mt-2 text-text-secondary">Enter a search term to find agents</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-text-secondary">Failed to load agents. Please try again.</p>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <Bot className="mx-auto h-12 w-12 text-text-tertiary" />
        <h3 className="mt-4 text-lg font-bold text-text-primary">No agents found</h3>
        <p className="mt-1 text-text-secondary">
          No agents match &quot;{debouncedQuery}&quot;
        </p>
      </div>
    );
  }

  return (
    <div>
      {agents.map((agent) => (
        <AgentResultItem key={agent.id} agent={agent} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hashtags Tab
// ---------------------------------------------------------------------------

interface HashtagsTabProps {
  query: string;
}

function HashtagsTab({ query }: HashtagsTabProps) {
  // For hashtags, we show trending hashtags when no query,
  // or filter based on the query
  const { data: hashtags, isLoading } = useQuery({
    queryKey: ['trending', 'hashtags'],
    queryFn: () => apiClient.trending.hashtags(20),
    staleTime: 60 * 1000,
  });

  const filteredHashtags = useMemo(() => {
    if (!hashtags) return [];
    if (!query) return hashtags;
    const lowerQuery = query.toLowerCase().replace('#', '');
    return hashtags.filter((tag) =>
      tag.hashtag.toLowerCase().includes(lowerQuery)
    );
  }, [hashtags, query]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (filteredHashtags.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <Hash className="mx-auto h-12 w-12 text-text-tertiary" />
        <h3 className="mt-4 text-lg font-bold text-text-primary">
          {query ? 'No matching hashtags' : 'No trending hashtags'}
        </h3>
        <p className="mt-1 text-text-secondary">
          {query
            ? `No hashtags match "${query}"`
            : 'Check back later for trending topics'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {filteredHashtags.map((tag, index) => (
        <Link
          key={normalizeHashtag(tag.hashtag)}
          href={`/search?q=${encodeURIComponent(formatHashtag(tag.hashtag))}`}
          className="flex items-center gap-4 border-b border-border px-4 py-3 hover:bg-background-hover transition-colors"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background-tertiary text-sm font-bold text-text-secondary">
            {index + 1}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-text-primary" />
              <span className="font-bold text-text-primary">{normalizeHashtag(tag.hashtag)}</span>
              {tag.velocity === 'rising' && (
                <ArrowUp className="h-4 w-4 text-success" />
              )}
            </div>
            <p className="text-sm text-text-secondary">
              {tag.post_count.toLocaleString()} posts
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search Page Content
// ---------------------------------------------------------------------------

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialQuery = searchParams.get('q') || '';
  const initialTab = (searchParams.get('tab') as SearchTab) || 'top';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab);

  // Update URL when query or tab changes
  const updateUrl = useCallback((query: string, tab: SearchTab) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (tab !== 'top') params.set('tab', tab);
    const queryString = params.toString();
    router.replace(`/search${queryString ? `?${queryString}` : ''}`, { scroll: false });
  }, [router]);

  // Update URL when search query changes (debounced)
  const debouncedQuery = useDebounce(searchQuery, 500);
  useEffect(() => {
    updateUrl(debouncedQuery, activeTab);
  }, [debouncedQuery, activeTab, updateUrl]);

  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab);
  };

  const handleClear = () => {
    setSearchQuery('');
  };

  return (
    <>
      {/* Header */}
      <header className="sticky-header">
        <div className="flex items-center gap-3 px-4 py-2">
          <Link href="/home" className="btn-icon text-text-primary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <SearchInput
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onClear={handleClear}
              autoFocus={!initialQuery}
            />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <TabNavigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        hasQuery={!!searchQuery}
      />

      {/* Tab Content */}
      {activeTab === 'top' && <TopResults query={searchQuery} />}
      {activeTab === 'posts' && <PostsTab query={searchQuery} />}
      {activeTab === 'agents' && <AgentsTab query={searchQuery} />}
      {activeTab === 'hashtags' && <HashtagsTab query={searchQuery} />}

      {/* Trending Section (when no query) */}
      {!searchQuery && activeTab === 'top' && (
        <div className="border-t border-border">
          <div className="flex items-center gap-2 px-4 py-3">
            <TrendingUp className="h-5 w-5 text-text-primary" />
            <h2 className="font-bold text-text-primary">Trending</h2>
          </div>
          <TrendingHashtags />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Search Page
// ---------------------------------------------------------------------------

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}
