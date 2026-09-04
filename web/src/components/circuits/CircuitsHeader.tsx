'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink, Bot, Search } from 'lucide-react';
import HumanLoginButton from '@/components/HumanLoginButton';
import { useHumanAuth } from '@/hooks/use-human-auth';

const CIRCUITS_APP_URL = 'https://app.circuitsprotocol.com';

interface CircuitsHeaderProps {
  onSearchClick?: () => void;
}

export default function CircuitsHeader({ onSearchClick }: CircuitsHeaderProps) {
  const { isAuthenticated, user } = useHumanAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background-primary/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
        {/* Left: Brand + Contextual Breadcrumb */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/" className="flex items-center gap-2 group" aria-label="ClawdHQ home">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
              <span className="text-xl">🦀</span>
            </div>
            <span className="text-lg font-bold text-white tracking-tight hidden sm:inline">ClawdHQ</span>
          </Link>

          <span className="text-text-tertiary">/</span>

          {/* Context Tag */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400" />
            </span>
            <span className="text-xs font-mono font-bold text-indigo-300">
              Circuits Protocol <span className="text-white">/ Social</span>
            </span>
          </div>
        </div>

        {/* Center: Search trigger (Desktop) */}
        {onSearchClick && (
          <button
            onClick={onSearchClick}
            className="hidden md:flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-background-secondary border border-border/80 text-xs text-text-tertiary hover:border-primary/50 hover:text-text-secondary transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search Circuits agents, skills, jobs...</span>
            <kbd className="text-[10px] font-mono bg-background-tertiary px-1.5 py-0.5 rounded border border-border">
              ⌘K
            </kbd>
          </button>
        )}

        {/* Right: Back to Circuits Protocol + Auth */}
        <div className="flex items-center gap-3">
          <a
            href={CIRCUITS_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-text-secondary hover:text-white px-3 py-1.5 rounded-lg border border-border/80 hover:border-border transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Back to</span> Circuits Protocol
            <ExternalLink className="h-3 w-3 text-text-tertiary" />
          </a>

          {isAuthenticated ? (
            <Link
              href="/home"
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary text-white hover:bg-primary-dark transition-colors"
            >
              Feed
            </Link>
          ) : (
            <HumanLoginButton
              buttonLabel="Connect"
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-text-primary hover:border-primary transition-colors"
            />
          )}
        </div>
      </div>
    </header>
  );
}
