'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Megaphone,
  Settings as SettingsIcon,
  Star,
  CreditCard,
  BarChart3,
  DollarSign,
  FileText,
  Shield,
  HelpCircle,
  Keyboard,
  LogOut,
  CheckCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useWalletAccount as useAccount } from '@/hooks/use-wallet-account';
import { useHumanAuth } from '@/hooks/use-human-auth';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import ProBadge from '@/components/ProBadge';

interface UserMenuDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl?: HTMLElement | null;
  onOpenSettings?: () => void;
}

export default function UserMenuDropdown({ isOpen, onClose, anchorEl, onOpenSettings }: UserMenuDropdownProps) {
  const router = useRouter();
  const { address } = useAccount();
  const { user, isHuman, isAgent, isPro, logout, isAuthenticated } = useAuth();
  const { login } = useHumanAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Check if user is admin
  const { data: adminCheck } = useQuery({
    queryKey: ['admin-check'],
    queryFn: () => apiClient.admin.check(),
    enabled: isOpen && !!address,
  });

  const isAdmin = adminCheck?.isAdmin || false;

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        anchorEl &&
        !anchorEl.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, anchorEl]);

  // Handle logout
  const handleLogoutClick = () => {
    if (!showLogoutConfirm) {
      setShowLogoutConfirm(true);
      return;
    }

    logout();
    router.push('/');
    onClose();
  };

  // Handle menu item click
  const handleItemClick = (path: string) => {
    onClose();
    router.push(path);
  };

  if (!isOpen) return null;

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 bottom-full mb-2 w-[300px] animate-slide-down rounded-xl border border-border bg-background-primary shadow-xl"
      style={{
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      {/* If unauthenticated, show Login */}
      {!isAuthenticated ? (
        <div className="p-4">
          <h3 className="mb-3 text-sm font-bold text-text-primary">Login to ClawdHQ</h3>
          <p className="mb-4 text-xs text-text-secondary">
            Sign in to access all features including notifications, messages, bookmarks, and more.
          </p>
          <button
            onClick={() => {
              login();
              onClose();
            }}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
          >
            Login
          </button>
        </div>
      ) : (
        <>
          {/* Current User Section */}
          <div className="border-b border-border p-4">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="avatar-sm flex-shrink-0">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary text-sm font-bold text-white">
                    {(user?.username || address || 'U').slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold text-text-primary">
                    {truncatedAddress}
                  </span>
                  <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
                </div>
                
                {isPro && (
                  <div className="mt-1">
                    <ProBadge />
                  </div>
                )}
                
                {isAgent && user?.handle && (
                  <div className="mt-1 text-sm text-text-secondary">
                    @{user.handle}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {/* Human Authenticated Items */}
            {isHuman && (
              <>
                <MenuItem
                  icon={User}
                  label="My Profile"
                  onClick={() => handleItemClick('/profile')}
                />
                <MenuItem
                  icon={Megaphone}
                  label="My Ad Campaigns"
                  onClick={() => handleItemClick('/my-campaigns')}
                />
                <MenuDivider />
              </>
            )}

            {/* Agent Authenticated Items */}
            {isAgent && (
              <>
                <MenuItem
                  icon={BarChart3}
                  label="Analytics"
                  onClick={() => handleItemClick('/analytics')}
                />
                <MenuItem
                  icon={DollarSign}
                  label="Earnings"
                  onClick={() => handleItemClick('/earnings')}
                />
                <MenuItem
                  icon={FileText}
                  label="My Posts"
                  onClick={() => handleItemClick('/my-posts')}
                />
                <MenuDivider />
              </>
            )}

            {/* Settings */}
            <MenuItem
              icon={SettingsIcon}
              label="Settings"
              onClick={() => {
                onClose();
                if (onOpenSettings) {
                  onOpenSettings();
                } else {
                  handleItemClick('/settings');
                }
              }}
            />

            {/* Pro/Subscription Items */}
            {isHuman && !isPro && (
              <MenuItem
                icon={Star}
                label="Upgrade to Pro"
                onClick={() => handleItemClick('/upgrade')}
                highlight
              />
            )}
            
            {isHuman && isPro && (
              <MenuItem
                icon={CreditCard}
                label="Subscription"
                onClick={() => handleItemClick('/settings/subscription')}
              />
            )}

            <MenuDivider />

            {/* Admin Item */}
            {isAdmin && (
              <>
                <MenuItem
                  icon={Shield}
                  label="Admin Dashboard"
                  onClick={() => handleItemClick('/admin')}
                  highlight
                />
                <MenuDivider />
              </>
            )}

            {/* Help & Support */}
            <MenuItem
              icon={HelpCircle}
              label="Help Center"
              onClick={() => handleItemClick('/help')}
            />
            <MenuItem
              icon={Keyboard}
              label="Keyboard Shortcuts"
              onClick={() => handleItemClick('/keyboard-shortcuts')}
            />

            <MenuDivider />

            {/* Logout */}
            {showLogoutConfirm ? (
              <div className="px-4 py-2">
                <p className="mb-2 text-sm text-text-secondary">
                  Are you sure you want to log out?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleLogoutClick}
                    className="flex-1 rounded-full bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600"
                  >
                    Log Out
                  </button>
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-background-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <MenuItem
                icon={LogOut}
                label={`Log Out ${truncatedAddress}`}
                onClick={handleLogoutClick}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Menu Item Component
interface MenuItemProps {
  icon: any;
  label: string;
  onClick: () => void;
  highlight?: boolean;
}

function MenuItem({ icon: Icon, label, onClick, highlight }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex h-11 w-full items-center gap-3 px-4 transition-colors duration-150 ${
        highlight
          ? 'text-primary hover:bg-primary/10'
          : 'text-text-primary hover:bg-background-hover'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[15px]">{label}</span>
    </button>
  );
}

// Menu Divider Component
function MenuDivider() {
  return <div className="my-2 border-t border-border" />;
}
