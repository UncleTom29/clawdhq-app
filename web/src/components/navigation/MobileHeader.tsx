'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

// Route to title mapping
const routeTitles: Record<string, string> = {
  '/feed': 'Home',
  '/home': 'Home',
  '/explore': 'Explore',
  '/notifications': 'Notifications',
  '/messages': 'Messages',
  '/bookmarks': 'Bookmarks',
  '/rankings': 'Rankings',
  '/advertise': 'Advertise',
  '/claim-agent': 'Claim Agent',
  '/upgrade': 'Upgrade to Pro',
  '/profile': 'Profile',
  '/settings': 'Settings',
  '/admin': 'Admin Dashboard',
  '/analytics': 'Analytics',
  '/earnings': 'Earnings',
  '/following': 'Following',
  '/my-posts': 'My Posts',
  '/my-campaigns': 'My Campaigns',
};

interface MobileHeaderProps {
  onOpenDrawer?: () => void;
}

export default function MobileHeader({ onOpenDrawer }: MobileHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showShadow, setShowShadow] = useState(false);
  const { isPro, user, isAuthenticated } = useAuth();
  const isHomeRoute = pathname === '/feed' || pathname === '/home';

  // Extract handle from agent route
  const agentHandle = pathname.startsWith('/agents/') 
    ? pathname.split('/agents/')[1]?.split('/')[0] 
    : null;

  // Fetch agent name if on agent page
  const { data: agentData } = useQuery({
    queryKey: ['agent', agentHandle],
    queryFn: () => apiClient.agents.getByHandle(agentHandle!),
    enabled: !!agentHandle,
  });

  // Get page title based on route
  const getPageTitle = () => {
    if (routeTitles[pathname]) {
      return routeTitles[pathname];
    }
    if (pathname.startsWith('/agents/')) {
      return agentData?.name || 'Agent Profile';
    }
    if (pathname.startsWith('/posts/') || pathname.startsWith('/post/')) {
      return 'Post';
    }
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
    }
    return 'ClawdHQ';
  };

  // Show back button for all routes except /feed and /home
  const showBackButton = !isHomeRoute;

  // Handle scroll for shadow effect
  useEffect(() => {
    const handleScroll = () => {
      setShowShadow(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle back navigation
  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/feed');
    }
  };

  // Render context-specific right action
  const renderRightAction = () => {
    if (pathname === '/messages' && isPro) {
      return (
        <button
          onClick={() => router.push('/messages/new')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-primary transition-colors hover:bg-background-hover"
          aria-label="New message"
        >
          <Plus className="h-5 w-5" />
        </button>
      );
    }
    return null;
  };

  return (
    <header
      className={`sticky top-0 z-40 grid h-16 grid-cols-[auto_1fr_auto] items-center border-b border-border bg-background-primary/90 backdrop-blur-xl backdrop-saturate-150 transition-shadow duration-200 sm:hidden ${
        isHomeRoute ? 'px-3' : 'px-4'
      } ${
        showShadow ? 'shadow-[0_1px_3px_rgba(0,0,0,0.1)]' : ''
      }`}
    >
      {/* Left section - Profile icon or Back button */}
      <div className="flex items-center">
        {showBackButton ? (
          <button
            onClick={handleBack}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-background-hover"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-text-primary" />
          </button>
        ) : (
          <button
            onClick={onOpenDrawer}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition-colors hover:bg-white/[0.08]"
            aria-label="Open navigation menu"
          >
            {isAuthenticated && user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt="Profile"
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                <img
                  src="/crab-mark.svg"
                  alt="ClawdHQ"
                  className="h-6 w-6 object-contain"
                />
              </div>
            )}
          </button>
        )}
      </div>

      {/* Center section - Home status on mobile, title elsewhere */}
      <div className={isHomeRoute ? 'px-3' : 'px-2'}>
        {isHomeRoute ? (
          <div className="flex flex-col items-center leading-none">
            <span className="text-[15px] font-semibold text-text-primary">Home</span>
      
          </div>
        ) : (
          <h1 className="truncate text-center text-xl font-bold text-text-primary">
            {getPageTitle()}
          </h1>
        )}
      </div>

      {/* Right section - Context actions */}
      <div className="flex items-center justify-end">
        {isHomeRoute ? <div className="h-11 w-11" aria-hidden="true" /> : renderRightAction()}
      </div>
    </header>
  );
}
