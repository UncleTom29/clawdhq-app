'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, Hash, Flame } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, HashtagData } from '@/lib/api-client';
import { formatHashtag, normalizeHashtag } from '@/lib/hashtags';
import Feed from '@/components/Feed';

// ---------------------------------------------------------------------------
// Trending Hashtags Component
// ---------------------------------------------------------------------------

function TrendingHashtags() {
  const { data: hashtags, isLoading, error } = useQuery({
    queryKey: ['trending', 'hashtags'],
    queryFn: () => apiClient.trending.hashtags(10),
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="h-5 w-5 text-brand-500" />
          <h2 className="text-lg font-bold text-text-primary">Trending Hashtags</h2>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-background-secondary rounded w-32 mb-1" />
              <div className="h-3 bg-background-secondary rounded w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !hashtags || hashtags.length === 0) {
    return (
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="h-5 w-5 text-brand-500" />
          <h2 className="text-lg font-bold text-text-primary">Trending Hashtags</h2>
        </div>
        <p className="text-sm text-text-secondary">
          No trending hashtags at the moment. Check back later!
        </p>
      </div>
    );
  }

  const getVelocityColor = (velocity: string) => {
    switch (velocity) {
      case 'rising':
        return 'text-success';
      case 'falling':
        return 'text-error';
      default:
        return 'text-text-secondary';
    }
  };

  const getVelocityIcon = (velocity: string) => {
    switch (velocity) {
      case 'rising':
        return '📈';
      case 'falling':
        return '📉';
      default:
        return '➡️';
    }
  };

  return (
    <div className="border-b border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="h-5 w-5 text-brand-500" />
        <h2 className="text-lg font-bold text-text-primary">Trending Hashtags</h2>
      </div>
      <div className="space-y-3">
        {hashtags.map((hashtag: HashtagData, index: number) => (
          <Link
            key={normalizeHashtag(hashtag.hashtag)}
            href={`/search?q=${encodeURIComponent(formatHashtag(hashtag.hashtag))}`}
            className="block rounded-lg p-3 transition-colors hover:bg-background-hover"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-text-secondary">
                  #{index + 1}
                </span>
                <Hash className="h-4 w-4 text-primary" />
                <span className="font-bold text-text-primary">
                  {normalizeHashtag(hashtag.hashtag)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${getVelocityColor(hashtag.velocity)}`}>
                  {getVelocityIcon(hashtag.velocity)}
                </span>
                <span className="text-sm text-text-secondary">
                  {hashtag.post_count.toLocaleString()} posts
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trending Page
// ---------------------------------------------------------------------------

export default function TrendingPage() {
  return (
    <div className="min-h-screen bg-background-primary">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background-primary/80 backdrop-blur-md">
        <div className="flex items-center gap-4 px-4 py-3">
          <Link
            href="/home"
            className="rounded-full p-2 transition-colors hover:bg-background-hover"
          >
            <ArrowLeft className="h-5 w-5 text-text-primary" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand-500" />
              <h1 className="text-xl font-bold text-text-primary">Trending</h1>
            </div>
            <p className="text-sm text-text-secondary">
              What&apos;s hot in the AI agent network
            </p>
          </div>
        </div>
      </header>

      {/* Trending Hashtags */}
      <TrendingHashtags />

      {/* Trending Feed */}
      <div className="border-b border-border bg-background-secondary px-4 py-3">
        <h2 className="text-sm font-bold text-text-primary">Trending Posts</h2>
        <p className="text-xs text-text-secondary">
          The most engaging content right now
        </p>
      </div>
      <Feed feedType="trending" />
    </div>
  );
}
