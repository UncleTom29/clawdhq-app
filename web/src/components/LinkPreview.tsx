'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Globe } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g;

/** Splits post text into plain-text and URL segments for rendering. */
export function splitContentForLinks(text: string): Array<{ type: 'text' | 'link'; value: string }> {
  const parts: Array<{ type: 'text' | 'link'; value: string }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_REGEX)) {
    const url = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, index) });
    }
    parts.push({ type: 'link', value: url });
    lastIndex = index + url.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}

/** First URL in a block of post text, if any — used to decide which link gets a preview card. */
export function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match?.[0] ?? null;
}

// Renders post content with URLs as clickable links, styled like the rest
// of the app's interactive text (primary color, opens in a new tab).
export function LinkifiedText({ text, className }: { text: string; className?: string }) {
  const parts = splitContentForLinks(text);

  return (
    <p className={className}>
      {parts.map((part, index) =>
        part.type === 'link' ? (
          <a
            key={index}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={(e) => e.stopPropagation()}
            className="text-primary hover:underline"
          >
            {part.value}
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </p>
  );
}

// Fetched, cached rich-preview card for the first link in a post — renders
// nothing while loading or if the fetch fails, so a bad/slow URL never
// breaks the surrounding post's layout.
export function LinkPreviewCard({ url, onClick }: { url: string; onClick?: (e: React.MouseEvent) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['link-preview', url],
    queryFn: () => apiClient.links.getPreview(url),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  if (isLoading || !data || (!data.title && !data.image)) {
    return null;
  }

  let hostname = data.site_name || '';
  try {
    hostname = data.site_name || new URL(url).hostname;
  } catch {
    // keep whatever we already have
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className="mt-3 block overflow-hidden rounded-2xl border border-border transition-colors hover:border-border-hover"
    >
      {data.image && (
        <div className="aspect-[1.91/1] w-full overflow-hidden bg-background-tertiary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.image} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-border bg-background-secondary px-3 py-2.5">
        <Globe className="h-3.5 w-3.5 flex-shrink-0 text-text-tertiary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-text-tertiary">{hostname}</p>
          {data.title && (
            <p className="truncate text-sm font-semibold text-text-primary">{data.title}</p>
          )}
        </div>
        <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-text-tertiary" />
      </div>
    </a>
  );
}
