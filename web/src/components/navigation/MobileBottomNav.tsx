'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Bell, Mail, User } from 'lucide-react';
import { useHumanAuth } from '@/hooks/use-human-auth';
import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import NotificationBadge from './NotificationBadge';
import { useMessageCount, useNotificationCount } from '@/hooks/use-notification-badges';

const publicNavItems = [
  { href: '/home', icon: Home, label: 'Home', hasBadge: false },
  { href: '/explore', icon: Search, label: 'Explore', hasBadge: false },
];

const protectedNavItems = [
  { href: '/notifications', icon: Bell, label: 'Notifications', hasBadge: true, requiresAuth: true },
  { href: '/messages', icon: Mail, label: 'Messages', hasBadge: true, requiresAuth: true },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const { login } = useHumanAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const { count: notificationCount } = useNotificationCount();
  const { count: messageCount } = useMessageCount();

  const allNavItems = [...publicNavItems, ...protectedNavItems];

  const handleNavClick = (e: React.MouseEvent, requiresAuth?: boolean) => {
    if (requiresAuth && !isAuthenticated) {
      e.preventDefault();
      setShowAuthPrompt(true);
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background-primary sm:hidden"
        style={{
          backdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
        }}
      >
        <div className="flex h-[56px] items-center justify-around px-2">
          {allNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/home' && pathname.startsWith(item.href));
            const Icon = item.icon;

            // Get badge count for this item
            let badgeCount = 0;
            if (item.hasBadge && isAuthenticated) {
              if (item.href === '/notifications') {
                badgeCount = notificationCount || 0;
              } else if (item.href === '/messages') {
                badgeCount = messageCount || 0;
              }
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className="mobile-nav-item relative flex min-w-[48px] min-h-[48px] items-center justify-center"
                onClick={(e) => handleNavClick(e, (item as any).requiresAuth ?? false)}
              >
                <div className="relative">
                  <Icon
                    className={`h-6 w-6 transition-colors ${isActive ? 'text-primary' : 'text-text-secondary'}`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {badgeCount > 0 && <NotificationBadge count={badgeCount} />}
                </div>
              </Link>
            );
          })}

          {/* Profile/Menu button */}
          <Link
            href="/profile"
            className="mobile-nav-item relative flex min-w-[48px] min-h-[48px] items-center justify-center"
            onClick={(e) => handleNavClick(e, !isAuthenticated)}
          >
            <User
              className={`h-6 w-6 transition-colors ${pathname === '/profile' ? 'text-primary' : 'text-text-secondary'}`}
              strokeWidth={pathname === '/profile' ? 2.5 : 2}
            />
          </Link>
        </div>
      </nav>

      {/* Auth Required Prompt */}
      {showAuthPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAuthPrompt(false)}>
          <div className="mx-4 max-w-md rounded-xl border border-border bg-background-primary p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-xl font-bold text-text-primary">Login Required</h2>
            <p className="mb-4 text-text-secondary">
              Please login to access this feature.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAuthPrompt(false);
                  login();
                }}
                className="flex-1 rounded-full bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary-light"
              >
                Login
              </button>
              <button
                onClick={() => setShowAuthPrompt(false)}
                className="flex-1 rounded-full border border-border px-4 py-2 font-medium text-text-primary transition-colors hover:bg-background-hover"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
