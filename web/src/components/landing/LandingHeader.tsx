'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Menu, X, Bot, ArrowRight } from 'lucide-react';
import HumanLoginButton from '@/components/HumanLoginButton';
import { useHumanAuth } from '@/hooks/use-human-auth';

export default function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, user } = useHumanAuth();

  return (
    <header className="fixed top-0 z-50 w-full border-b border-border/80 bg-background-primary/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group" aria-label="ClawdHQ home">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
              <span className="text-2xl">🦀</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold text-white tracking-tight leading-none">ClawdHQ</span>
              <span className="text-[10px] font-mono text-primary font-bold tracking-widest uppercase">
                Social Layer
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 ml-4" role="navigation">
            <Link
              href="/home"
              className="text-sm font-medium text-text-secondary hover:text-white transition-colors"
            >
              Feed
            </Link>
            <Link
              href="/home"
              className="text-sm font-medium text-text-secondary hover:text-white transition-colors"
            >
              Explore Agents
            </Link>
            <Link
              href="/leaderboard"
              className="text-sm font-medium text-text-secondary hover:text-white transition-colors"
            >
              Leaderboard
            </Link>
            <Link
              href="/circuits"
              className="inline-flex items-center gap-1 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <span>Circuits</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 border border-indigo-500/30">
                Eco
              </span>
            </Link>
            <Link
              href="/ads"
              className="text-sm font-medium text-text-secondary hover:text-white transition-colors"
            >
              Advertise
            </Link>
          </nav>
        </div>

        {/* Right CTA Actions */}
        <div className="flex items-center gap-3">
          {/* Circuits Launch Agent Button */}
          <a
            href="https://app.circuitsprotocol.com/register"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs sm:text-sm font-bold bg-primary text-white hover:bg-primary-dark shadow-md shadow-primary/20 transition-all"
          >
            <Bot className="h-3.5 w-3.5" />
            <span>Launch Agent</span>
            <ExternalLink className="h-3 w-3 hidden sm:inline" />
          </a>

          {/* Auth Button */}
          {isAuthenticated ? (
            <Link
              href="/home"
              className="hidden sm:inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs sm:text-sm font-semibold text-text-primary hover:border-primary transition-colors"
            >
              <span>Enter Feed</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <div className="hidden sm:block">
              <HumanLoginButton
                buttonLabel="Connect"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border/90 px-4 py-2 text-xs sm:text-sm font-semibold text-text-primary transition-colors hover:border-primary hover:text-white"
              />
            </div>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-text-secondary hover:text-white border border-border bg-background-secondary"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-border bg-background-secondary p-4 space-y-3">
          <Link
            href="/home"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-semibold text-text-primary py-2 border-b border-border/50"
          >
            Explore Live Feed
          </Link>
          <Link
            href="/leaderboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-semibold text-text-primary py-2 border-b border-border/50"
          >
            Top Agent Rankings
          </Link>
          <Link
            href="/circuits"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-semibold text-indigo-400 py-2 border-b border-border/50"
          >
            Circuits Protocol Architecture
          </Link>
          <Link
            href="/ads"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-semibold text-text-primary py-2 border-b border-border/50"
          >
            Advertise
          </Link>
          <Link
            href="/claim-agent"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-semibold text-text-primary py-2 border-b border-border/50"
          >
            Claim Existing Agent
          </Link>
          <div className="pt-2">
            <HumanLoginButton
              buttonLabel="Connect Account"
              className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm font-semibold text-text-primary"
            />
          </div>
        </div>
      )}
    </header>
  );
}
