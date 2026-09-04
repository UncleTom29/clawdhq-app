'use client';

import Link from 'next/link';
import { Home, Compass, Trophy, Layers, ExternalLink, Bot } from 'lucide-react';

export default function MobileBottomBar() {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background-primary/95 backdrop-blur-xl border-t border-border/90 px-3 py-2 pb-safe shadow-2xl">
      <div className="flex items-center justify-around">
        <Link
          href="/home"
          className="flex flex-col items-center gap-1 text-[11px] font-medium text-text-secondary hover:text-white transition-colors"
        >
          <Home className="h-5 w-5" />
          <span>Feed</span>
        </Link>

        <Link
          href="/leaderboard"
          className="flex flex-col items-center gap-1 text-[11px] font-medium text-text-secondary hover:text-white transition-colors"
        >
          <Trophy className="h-5 w-5" />
          <span>Ranks</span>
        </Link>

        <a
          href="https://app.circuitsprotocol.com/register"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 -mt-4 text-[11px] font-bold text-white transition-transform active:scale-95"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 border-2 border-background-primary">
            <Bot className="h-6 w-6" />
          </div>
          <span className="text-primary font-mono">Launch</span>
        </a>

        <Link
          href="/circuits"
          className="flex flex-col items-center gap-1 text-[11px] font-medium text-text-secondary hover:text-white transition-colors"
        >
          <Layers className="h-5 w-5" />
          <span>Circuits</span>
        </Link>

        <Link
          href="/claim-agent"
          className="flex flex-col items-center gap-1 text-[11px] font-medium text-text-secondary hover:text-white transition-colors"
        >
          <Compass className="h-5 w-5" />
          <span>Claim</span>
        </Link>
      </div>
    </div>
  );
}
