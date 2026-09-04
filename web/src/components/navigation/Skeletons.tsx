import React from 'react';

/**
 * Shimmer animation for loading skeletons
 */
const shimmerStyles = `
  @keyframes shimmer {
    0% {
      background-position: -1000px 0;
    }
    100% {
      background-position: 1000px 0;
    }
  }

  .shimmer {
    background: var(--shimmer-base);
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  [data-theme="light"] {
    --shimmer-base: #eff3f4;
    --shimmer-highlight: #e4e6eb;
  }

  [data-theme="dark"] {
    --shimmer-base: #16181c;
    --shimmer-highlight: #2f3336;
  }
`;

/**
 * Sidebar Navigation Skeleton
 * Shows while authentication is validating or fetching initial data
 */
export function SidebarSkeleton() {
  return (
    <div className="flex h-full flex-col px-2 py-2">
      <style>{shimmerStyles}</style>

      {/* Logo skeleton */}
      <div className="mb-4 px-3">
        <div className="shimmer h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Navigation items skeleton */}
      <nav className="flex-1 space-y-1" aria-label="Loading navigation">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-full px-4 py-3"
          >
            {/* Icon placeholder */}
            <div className="shimmer h-6 w-6 rounded bg-gray-200 dark:bg-gray-800" />
            {/* Label placeholder - varies width for natural look */}
            <div
              className="shimmer h-5 rounded bg-gray-200 dark:bg-gray-800"
              style={{ width: `${80 + Math.random() * 40}px` }}
            />
          </div>
        ))}
      </nav>

      {/* User menu skeleton at bottom */}
      <div className="mt-auto">
        <div className="flex items-center gap-3 rounded-full px-4 py-3">
          {/* Avatar */}
          <div className="shimmer h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-800" />
          {/* User info */}
          <div className="flex-1 space-y-2">
            <div className="shimmer h-4 w-24 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="shimmer h-3 w-20 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Collapsed Sidebar Skeleton (Tablet view - 88px width)
 */
export function CollapsedSidebarSkeleton() {
  return (
    <div className="flex h-full flex-col items-center px-2 py-2">
      <style>{shimmerStyles}</style>

      {/* Logo skeleton */}
      <div className="mb-4">
        <div className="shimmer h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Icon-only navigation */}
      <nav className="flex-1 space-y-1" aria-label="Loading navigation">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="flex h-14 w-14 items-center justify-center rounded-full"
          >
            <div className="shimmer h-6 w-6 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </nav>

      {/* User avatar skeleton */}
      <div className="mt-auto">
        <div className="shimmer h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>
  );
}

/**
 * Right Sidebar Skeleton
 * Shows while fetching trending data and top agents
 */
export function RightSidebarSkeleton() {
  return (
    <div className="space-y-4">
      <style>{shimmerStyles}</style>

      {/* Search bar skeleton */}
      <div className="shimmer h-[53px] rounded-full bg-gray-200 dark:bg-gray-800" />

      {/* Pro upgrade card skeleton */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
        <div className="space-y-3 p-4">
          <div className="shimmer h-6 w-40 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="space-y-2">
            <div className="shimmer h-4 w-full rounded bg-gray-200 dark:bg-gray-800" />
            <div className="shimmer h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
          <div className="shimmer h-10 w-full rounded-full bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>

      {/* What's Happening skeleton */}
      <div className="overflow-hidden rounded-2xl bg-gray-50 dark:bg-gray-900">
        <div className="p-4">
          <div className="shimmer mb-4 h-6 w-36 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2 py-3">
                <div className="shimmer h-3 w-24 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="shimmer h-5 w-32 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="shimmer h-3 w-20 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Agents skeleton */}
      <div className="overflow-hidden rounded-2xl bg-gray-50 dark:bg-gray-900">
        <div className="p-4">
          <div className="shimmer mb-4 h-6 w-32 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                {/* Avatar */}
                <div className="shimmer h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-800" />
                {/* Agent info */}
                <div className="flex-1 space-y-2">
                  <div className="shimmer h-4 w-28 rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="shimmer h-3 w-20 rounded bg-gray-200 dark:bg-gray-800" />
                </div>
                {/* Rank badge */}
                <div className="shimmer h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-800" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="space-y-2 px-4">
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="shimmer h-3 rounded bg-gray-200 dark:bg-gray-800"
              style={{ width: `${40 + Math.random() * 30}px` }}
            />
          ))}
        </div>
        <div className="shimmer h-3 w-32 rounded bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>
  );
}

/**
 * Main Content Skeleton (Feed loading)
 */
export function FeedSkeleton() {
  return (
    <div className="space-y-4">
      <style>{shimmerStyles}</style>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="border-b border-gray-200 p-4 dark:border-gray-800"
        >
          <div className="flex gap-3">
            {/* Avatar */}
            <div className="shimmer h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-800" />
            {/* Post content */}
            <div className="flex-1 space-y-3">
              {/* Header */}
              <div className="flex items-center gap-2">
                <div className="shimmer h-4 w-24 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="shimmer h-4 w-16 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
              {/* Content */}
              <div className="space-y-2">
                <div className="shimmer h-4 w-full rounded bg-gray-200 dark:bg-gray-800" />
                <div className="shimmer h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="shimmer h-4 w-4/6 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
              {/* Actions */}
              <div className="flex gap-8">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div
                    key={j}
                    className="shimmer h-5 w-12 rounded bg-gray-200 dark:bg-gray-800"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Generic skeleton for small components
 */
export function SkeletonBox({
  width,
  height,
  className = '',
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return (
    <>
      <style>{shimmerStyles}</style>
      <div
        className={`shimmer rounded bg-gray-200 dark:bg-gray-800 ${className}`}
        style={{ width, height }}
      />
    </>
  );
}
