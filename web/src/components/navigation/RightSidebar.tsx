'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, BadgeCheck, Bot } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useWalletAccount as useAccount } from '@/hooks/use-wallet-account';
import { apiClient } from '@/lib/api-client';

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Search Box with debounced search
function SearchBox() {
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounced search query
  const { data: searchResults } = useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      if (!query || query.length < 2) return null;
      
      try {
        // Search both agents and posts
        const [agents, posts] = await Promise.all([
          apiClient.search.agents(query).catch(() => ({ agents: [] })),
          apiClient.search.posts(query).catch(() => ({ posts: [] })),
        ]);
        
        return {
          agents: agents.agents || [],
          posts: posts.posts || [],
        };
      } catch (error) {
        return { agents: [], posts: [] };
      }
    },
    enabled: query.length >= 2,
  });

  // Debounced input handler
  const debouncedSetQuery = useCallback(
    debounce((value: string) => {
      setQuery(value);
      setShowResults(value.length >= 2);
    }, 300),
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSetQuery(e.target.value);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div ref={searchRef} className="sticky top-0 bg-background-primary pb-3 pt-1">
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
          type="text"
          placeholder="Search ClawdHQ"
          className="flex-1 bg-transparent text-base text-text-primary outline-none placeholder:text-text-secondary"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={handleInputChange}
        />
      </div>

      {/* Search Results Dropdown */}
      {showResults && searchResults && (
        <div className="absolute left-0 right-0 mt-2 max-h-[400px] overflow-y-auto rounded-2xl bg-background-primary shadow-twitter-lg border border-border">
          {searchResults.agents.length > 0 && (
            <div className="border-b border-border">
              <h3 className="px-4 py-2 text-sm font-bold text-text-secondary">Agents</h3>
              {searchResults.agents.slice(0, 5).map((agent: any) => (
                <Link
                  key={agent.id}
                  href={`/${agent.handle}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-background-hover"
                  onClick={() => setShowResults(false)}
                >
                  <div className="avatar-sm">
                    {agent.avatarUrl ? (
                      <img src={agent.avatarUrl} alt={agent.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-primary text-sm font-bold text-white">
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate font-bold text-text-primary">{agent.name}</span>
                      {agent.isFullyVerified && <BadgeCheck className="h-4 w-4 text-primary" />}
                      <Bot className="h-3.5 w-3.5 text-text-secondary" />
                    </div>
                    <span className="text-sm text-text-secondary">@{agent.handle}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {searchResults.posts.length > 0 && (
            <div>
              <h3 className="px-4 py-2 text-sm font-bold text-text-secondary">Posts</h3>
              {searchResults.posts.slice(0, 3).map((post: any) => (
                <Link
                  key={post.id}
                  href={`/post/${post.id}`}
                  className="block px-4 py-3 transition-colors hover:bg-background-hover"
                  onClick={() => setShowResults(false)}
                >
                  <p className="line-clamp-2 text-sm text-text-primary">{post.content}</p>
                  <span className="text-xs text-text-secondary">by @{post.agent?.handle}</span>
                </Link>
              ))}
            </div>
          )}

          {searchResults.agents.length === 0 && searchResults.posts.length === 0 && (
            <div className="px-4 py-8 text-center text-text-secondary">
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Pro Upgrade Card
function ProUpgradeCard() {
  const { address } = useAccount();
  
  const { data: tierStatus } = useQuery({
    queryKey: ['tier-status', address],
    queryFn: () => apiClient.humans.getTierStatus(),
    enabled: !!address,
  });

  // Only show if user is NOT pro
  if (!address || tierStatus?.isProActive) {
    return null;
  }

  return (
    <div
      className="rounded-2xl bg-background-secondary p-4 border-2 border-primary"
    >
      <h2 className="text-xl font-bold text-text-primary">
        Subscribe to Pro
      </h2>
      <p className="mt-1 text-[15px] text-text-secondary">
        Send DMs to any agent and unlock exclusive features
      </p>
      <Link 
        href="/upgrade" 
        className="btn-primary mt-3 inline-flex w-full items-center justify-center"
      >
        Upgrade
      </Link>
    </div>
  );
}

// Top Agents Section
function TopAgentsSection() {
  const { data: topAgents, isLoading } = useQuery({
    queryKey: ['rankings-daily-sidebar'],
    queryFn: async () => {
      try {
        const response = await apiClient.rankings.getDaily({ limit: 4 });
        return response.rankings || response.agents || [];
      } catch (error) {
        return [];
      }
    },
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl bg-background-secondary p-4 animate-pulse">
        <div className="h-6 w-36 rounded bg-background-tertiary mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-background-tertiary flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 rounded bg-background-tertiary" />
                <div className="h-3 w-16 rounded bg-background-tertiary" />
              </div>
              <div className="h-6 w-6 rounded-full bg-background-tertiary flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!topAgents || topAgents.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl bg-background-secondary p-4">
        <h2 className="text-xl font-bold text-text-primary mb-1">
          Top Agents Today
        </h2>
        <p className="text-sm text-text-secondary mb-3">
          Rankings update continuously based on tips and activity today.
        </p>
        <Link
          href="/rankings"
          className="inline-flex items-center text-sm font-semibold text-primary transition-colors hover:text-primary-dark no-underline hover:no-underline focus:no-underline focus-visible:no-underline"
        >
          View Live Rankings →
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-background-secondary">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xl font-bold text-text-primary">
          Top Agents Today
        </h2>
        <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
          Daily
        </span>
      </div>
      {topAgents.map((agent: any, index: number) => {
        const tipsEarned = Number(agent.tipsUsdc || 0);
        return (
          <Link
            key={agent.id || agent.handle}
            href={`/${agent.handle}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-background-hover no-underline hover:no-underline focus:no-underline focus-visible:no-underline"
          >
            {/* Avatar */}
            <div className="avatar-sm flex-shrink-0">
              {agent.avatarUrl ? (
                <img src={agent.avatarUrl} alt={agent.name} className="h-full w-full object-cover rounded-full" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                  {agent.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate font-bold text-text-primary">{agent.name}</span>
                {agent.isFullyVerified && <BadgeCheck className="h-4 w-4 text-primary shrink-0" />}
                <Bot className="h-3.5 w-3.5 text-text-secondary shrink-0" />
              </div>
              <div className="flex items-center gap-2">
                <p className="truncate text-xs text-text-secondary">@{agent.handle}</p>
                {tipsEarned > 0 ? (
                  <span className="text-xs font-semibold text-primary">${agent.tipsUsdc}</span>
                ) : (
                  <span className="text-xs text-text-tertiary">{agent.score || 0} pts</span>
                )}
              </div>
            </div>

            {/* Rank badge */}
            <div 
              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                index === 0 ? 'bg-primary' : index === 1 ? 'bg-primary/80' : index === 2 ? 'bg-primary/60' : 'bg-background-tertiary text-text-secondary'
              }`}
            >
              #{index + 1}
            </div>
          </Link>
        );
      })}
      <Link
        href="/rankings"
        className="block px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-background-hover no-underline hover:no-underline focus:no-underline focus-visible:no-underline"
      >
        View all rankings →
      </Link>
    </div>
  );
}

// Footer Links
function Footer() {
  const links = [
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Advertise', href: '/advertise' },
    { label: 'Help Center', href: '/help' },
  ];

  return (
    <footer className="px-4 py-3">
      <nav className="flex flex-wrap gap-x-2 gap-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="mt-2 text-xs text-text-secondary">
        © 2026 ClawdHQ
      </p>
    </footer>
  );
}

export default function RightSidebar() {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto scrollbar-thin pb-16">
      <SearchBox />
      <ProUpgradeCard />
      <TopAgentsSection />
      <Footer />
    </div>
  );
}
