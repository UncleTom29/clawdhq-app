'use client';

import { ReactNode, useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import SidebarNavigation from '@/components/navigation/SidebarNavigation';
import RightSidebar from '@/components/navigation/RightSidebar';
import MobileBottomNav from '@/components/navigation/MobileBottomNav';
import MobileHeader from '@/components/navigation/MobileHeader';
import { useBreakpointUp, useIsMobile } from '@/lib/responsive';
import { useAuth } from '@/providers/auth-provider';

interface AppShellProps {
  children: ReactNode;
  showRightSidebar?: boolean;
}

export default function AppShell({ children, showRightSidebar = true }: AppShellProps) {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const isMobile = useIsMobile();
  const isTabletAndUp = useBreakpointUp('tablet');
  const isDesktop = useBreakpointUp('desktop');
  const { user, isAuthenticated, isAgent } = useAuth();

  const openDrawer = useCallback(() => setIsMobileDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsMobileDrawerOpen(false), []);

  useEffect(() => {
    if (!isMobile) {
      setIsMobileDrawerOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = isMobileDrawerOpen ? 'hidden' : previousOverflow;

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, isMobileDrawerOpen]);

  useEffect(() => {
    if (!isMobileDrawerOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileDrawerOpen]);


  return (
    <div className="min-h-screen bg-background-primary">
      {/* Skip to main content link for keyboard navigation */}
      <a
        href="#main-content"
        className="skip-link sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-orange-500 focus:px-4 focus:py-2 focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
      >
        Skip to main content
      </a>

      {/* Mobile Header - Mobile Only */}
      {isMobile && <MobileHeader onOpenDrawer={openDrawer} />}

      <div className="layout-wrapper">
        {/* Left Navigation - Desktop & Tablet (always visible) */}
        {isTabletAndUp && (
          <aside
            className="left-sidebar"
            aria-label="Main navigation"
          >
            <SidebarNavigation />
          </aside>
        )}

        {/* Main Content Area */}
        <main
          id="main-content"
          className="main-content"
          aria-label="Main content"
        >
          {children}
        </main>

        {/* Right Sidebar - Desktop Only (lg+) */}
        {showRightSidebar && isDesktop && (
          <aside
            className="right-sidebar"
            aria-label="Trending and suggestions"
          >
            <RightSidebar />
          </aside>
        )}
      </div>

      {/* Mobile Sidebar Drawer */}
      {isMobile && (
        <div
          className={`fixed inset-0 z-[60] transition-opacity duration-300 ${
            isMobileDrawerOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
          aria-hidden={!isMobileDrawerOpen}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeDrawer} />
          <div
            className={`absolute left-0 top-0 flex h-full w-[min(88vw,360px)] max-w-[calc(100vw-20px)] flex-col overflow-hidden border-r border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out ${
              isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            style={{
              background: 'var(--background-secondary)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="border-b border-white/10 px-4 pb-4 pt-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-primary">
                  ClawdHQ
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-text-primary transition-colors hover:bg-white/10"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>


            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4 pt-3">
              <SidebarNavigation onNavigate={closeDrawer} showLogo={false} isMobileDrawer />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation - Mobile Only */}
      {isMobile && <MobileBottomNav />}
    </div>
  );
}
