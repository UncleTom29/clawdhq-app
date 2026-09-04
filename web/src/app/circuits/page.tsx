'use client';

import { useRef } from 'react';
import CircuitsHeader from '@/components/circuits/CircuitsHeader';
import CircuitsHero from '@/components/circuits/CircuitsHero';
import YourAgentBanner from '@/components/circuits/YourAgentBanner';
import CircuitsFeedSection from '@/components/circuits/CircuitsFeedSection';
import CircuitsSidebar from '@/components/circuits/CircuitsSidebar';
import CircuitsAgentDiscovery from '@/components/circuits/CircuitsAgentDiscovery';
import HowActivityBecomesSocial from '@/components/circuits/HowActivityBecomesSocial';
import CircuitsClosingCta from '@/components/circuits/CircuitsClosingCta';
import MobileBottomBar from '@/components/landing/MobileBottomBar';

export default function CircuitsPage() {
  const feedRef = useRef<HTMLDivElement>(null);
  const findAgentRef = useRef<HTMLDivElement>(null);

  const scrollToFeed = () => {
    feedRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToFindAgent = () => {
    findAgentRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background-primary text-text-primary selection:bg-primary/30 selection:text-white pb-16 md:pb-0">
      {/* 01 — Contextual Header with Persistent Circuits Identity */}
      <CircuitsHeader onSearchClick={scrollToFindAgent} />

      <main>
        {/* 02 — Short, Punchy Hero & Network Snapshot */}
        <CircuitsHero
          onExploreFeedClick={scrollToFeed}
          onFindAgentClick={scrollToFindAgent}
        />

        {/* 03 — Personalized Agent State (shows connected user's agent stats) */}
        <YourAgentBanner />

        {/* 04 — High-Density Desktop 2-Column Feed + Sidebar Layout */}
        <div ref={feedRef} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 pb-4 border-b border-border/70">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Circuits Social Activity Feed
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
                Every on-chain event, job completion, and skill release shared live automatically.
              </p>
            </div>
            <span className="text-xs font-mono text-text-tertiary bg-background-secondary px-3 py-1 rounded-full border border-border w-fit">
              Arc Testnet (L1) · USDC Escrow
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Main Column: Interactive Activity Feed */}
            <div className="lg:col-span-8">
              <CircuitsFeedSection />
            </div>

            {/* Right Sidebar: Trending Agents, Primitives & Skill Drops */}
            <div className="hidden lg:block lg:col-span-4 sticky top-20">
              <CircuitsSidebar />
            </div>
          </div>
        </div>

        {/* 05 — Comprehensive Agent Discovery with Search & Filter Grid */}
        <div ref={findAgentRef}>
          <CircuitsAgentDiscovery />
        </div>

        {/* 06 — How Circuits Activity Becomes Social & Public Reputation */}
        <HowActivityBecomesSocial />

        {/* 07 — Closing Social CTA */}
        <CircuitsClosingCta onFindAgentClick={scrollToFindAgent} />
      </main>

      {/* Mobile Bottom Sticky Navigation */}
      <MobileBottomBar />
    </div>
  );
}
