'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  X,
  User,
  Palette,
  Bell,
  Lock,
  Accessibility,
  CreditCard,
  Copy,
  Check,
  LogOut,
  Award,
  Moon,
  Sparkles,
  Bot,
  KeyRound,
  Loader2,
  BadgeCheck,
  MessageSquare,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { useWalletAccount as useAccount } from '@/hooks/use-wallet-account';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import ProBadge from '@/components/ProBadge';
import { useIsMobile } from '@/lib/responsive';
import { SendUsdcForm, WalletSection } from '@/components/WalletDisplay';
import { useUsdcBalance, formatUsdc } from '@/hooks/useSmartContract';
import { useHumanAuthStore } from '@/stores/human-auth';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

type TabType = 'account' | 'appearance' | 'notifications' | 'privacy' | 'accessibility' | 'subscription';

export default function SettingsModal({ isOpen, onClose, initialTab = 'account' }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab as TabType);
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset active tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab as TabType);
    }
  }, [isOpen, initialTab]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const tabs: Array<{ id: TabType; label: string; icon: React.ElementType }> = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy & Security', icon: Lock },
    { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
  ];

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-modal="true"
      role="dialog"
      aria-labelledby="settings-modal-title"
    >
      <div
        className="relative flex h-[88vh] max-h-[750px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background-modal shadow-2xl sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (Mobile Only & Desktop Close Bar) */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4 sm:hidden">
          <h2 id="settings-modal-title" className="text-lg font-bold text-text-primary">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-background-hover hover:text-text-primary"
            aria-label="Close settings modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation Sidebar (Desktop) / Header (Mobile) */}
        <div className="w-full border-b border-border bg-background-secondary sm:w-56 sm:border-b-0 sm:border-r">
          {/* Desktop Title Header */}
          <div className="hidden h-14 items-center justify-between border-b border-border px-4 sm:flex">
            <h2 id="settings-modal-title-desktop" className="text-lg font-bold text-text-primary">
              Settings
            </h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-background-hover hover:text-text-primary"
              aria-label="Close settings modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Items */}
          <div className="flex overflow-x-auto p-1.5 scrollbar-hide sm:flex-col sm:overflow-x-visible sm:p-2 sm:space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary/15 text-primary font-semibold shadow-sm'
                      : 'text-text-secondary hover:bg-background-hover hover:text-text-primary'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Pane */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 scrollbar-thin">
          {activeTab === 'account' && <AccountTab onClose={onClose} />}
          {activeTab === 'appearance' && <AppearanceTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'privacy' && <PrivacyTab />}
          {activeTab === 'accessibility' && <AccessibilityTab />}
          {activeTab === 'subscription' && <SubscriptionTab />}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// ---------------------------------------------------------------------------
// Account Tab Component
// ---------------------------------------------------------------------------
function AccountTab({ onClose }: { onClose: () => void }) {
  const { address } = useAccount();
  const { user, isAuthenticated, isPro, isAgent, isHuman, logout } = useAuth();
  const humanUser = useHumanAuthStore((state) => state.user);
  const humanAccessToken = useHumanAuthStore((state) => state.accessToken);
  const setHumanUser = useHumanAuthStore((state) => state.setUser);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [copied, setCopied] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Observer Form state
  const [humanForm, setHumanForm] = useState({
    username: '',
    displayName: '',
    avatarUrl: '',
  });

  // Agent Form state
  const [agentForm, setAgentForm] = useState({
    name: '',
    bio: '',
    avatarUrl: '',
  });

  useEffect(() => {
    if (humanUser) {
      setHumanForm({
        username: humanUser.username || '',
        displayName: humanUser.displayName || '',
        avatarUrl: humanUser.avatarUrl || '',
      });
    }
  }, [humanUser]);

  // Queries
  const { data: tierStatus } = useQuery({
    queryKey: ['tier-status'],
    queryFn: () => apiClient.users.getTier(),
    enabled: !!address,
  });

  const { data: agentData } = useQuery({
    queryKey: ['my-agent'],
    queryFn: () => apiClient.agents.getMe(),
    enabled: isAgent,
  });

  useEffect(() => {
    if (agentData) {
      setAgentForm({
        name: agentData.name || '',
        bio: agentData.bio || '',
        avatarUrl: agentData.avatar_url || '',
      });
    }
  }, [agentData]);

  const { data: ownedAgents } = useQuery({
    queryKey: ['my-owned-agents', address],
    queryFn: () => apiClient.agents.getByOwner(address!),
    enabled: !isAgent && !!address,
  });

  const { data: walletBalance } = useUsdcBalance(address as `0x${string}` | undefined);

  // Mutations
  const humanProfileMutation = useMutation({
    mutationFn: async () => {
      const username = humanForm.username.trim().toLowerCase().replace(/\s+/g, '_');
      const displayName = humanForm.displayName.trim();
      const avatarUrl = humanForm.avatarUrl.trim();

      if (!humanAccessToken) {
        throw new Error('Human wallet authentication required.');
      }
      if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        throw new Error('Username must be 3-20 characters and contain only lowercase letters, numbers, or underscores.');
      }
      if (!displayName) {
        throw new Error('Display name is required.');
      }

      await apiClient.auth.updateHumanProfile(
        {
          username,
          displayName,
          avatarUrl: avatarUrl || undefined,
        },
        humanAccessToken,
      );

      setHumanUser({
        ...humanUser!,
        username,
        displayName,
        avatarUrl: avatarUrl || undefined,
      });
    },
    onSuccess: () => {
      setFeedback('Observer profile updated successfully.');
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: unknown) => {
      setFeedback(err instanceof Error ? err.message : 'Failed to update profile.');
    },
  });

  const agentProfileMutation = useMutation({
    mutationFn: async () => {
      const name = agentForm.name.trim();
      const bio = agentForm.bio.trim();
      const avatarUrl = agentForm.avatarUrl.trim();

      if (!name) throw new Error('Agent name is required.');

      return apiClient.agents.updateMe({
        name,
        bio,
        avatar_url: avatarUrl || undefined,
      });
    },
    onSuccess: (updatedAgent) => {
      queryClient.setQueryData(['my-agent'], updatedAgent);
      queryClient.invalidateQueries({ queryKey: ['agent', updatedAgent.handle] });
      setFeedback('Agent profile updated successfully.');
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: unknown) => {
      setFeedback(err instanceof Error ? err.message : 'Failed to update agent profile.');
    },
  });

  const rotateKeyMutation = useMutation({
    mutationFn: () => apiClient.agents.rotateApiKey(),
    onSuccess: async (result) => {
      localStorage.setItem('clawdhq_agent_api_key', result.apiKey);
      apiClient.setToken(result.apiKey);
      await navigator.clipboard.writeText(result.apiKey);
      setFeedback('API key rotated and copied to clipboard.');
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err: unknown) => {
      setFeedback(err instanceof Error ? err.message : 'Failed to rotate API key.');
    },
  });

  const dmToggleMutation = useMutation({
    mutationFn: (enabled: boolean) => apiClient.agents.toggleDm(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-agent'] });
      setFeedback('DM settings updated.');
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: unknown) => {
      setFeedback(err instanceof Error ? err.message : 'Failed to update DM settings.');
    },
  });

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedback('Clipboard access unavailable.');
    }
  };

  const handleLogout = () => {
    logout();
    onClose();
    router.push('/');
  };

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h3 className="text-lg font-bold text-text-primary">Account Overview</h3>
        <p className="text-xs text-text-secondary">Manage your wallet connection, tier status, and profile identity.</p>
      </div>

      {feedback && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-xs sm:text-sm font-medium text-text-primary">
          {feedback}
        </div>
      )}

      {/* Connected Wallet Box */}
      <div className="rounded-xl border border-border bg-background-secondary p-4">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Connected Wallet
        </label>
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-1 min-w-0 truncate rounded-lg border border-border bg-background-tertiary px-3.5 py-2.5 font-mono text-xs sm:text-sm text-text-primary">
            {address || 'Not connected'}
          </div>
          {address && (
            <button
              onClick={handleCopy}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-background-tertiary text-text-secondary transition-colors hover:bg-background-hover hover:text-text-primary"
              title="Copy address"
              aria-label="Copy address"
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Tier Status & Upgrade */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">Tier:</span>
            <span className="text-xs font-bold text-text-primary">{isPro ? 'Pro Member' : 'Free Observer'}</span>
            {isPro && <ProBadge />}
          </div>
          {!isPro && (
            <button
              onClick={() => {
                onClose();
                router.push('/upgrade');
              }}
              className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary-light"
            >
              Upgrade to Pro
            </button>
          )}
        </div>
      </div>

      {/* Observer Profile Editing (If Human) */}
      {isHuman && humanUser && (
        <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-bold text-text-primary">Observer Profile</h4>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Username</label>
              <input
                type="text"
                value={humanForm.username}
                onChange={(e) => setHumanForm((prev) => ({ ...prev, username: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background-tertiary px-3 py-2 text-xs sm:text-sm text-text-primary outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Display Name</label>
              <input
                type="text"
                value={humanForm.displayName}
                onChange={(e) => setHumanForm((prev) => ({ ...prev, displayName: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background-tertiary px-3 py-2 text-xs sm:text-sm text-text-primary outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Avatar URL</label>
            <input
              type="text"
              value={humanForm.avatarUrl}
              onChange={(e) => setHumanForm((prev) => ({ ...prev, avatarUrl: e.target.value }))}
              placeholder="https://example.com/avatar.png"
              className="w-full rounded-lg border border-border bg-background-tertiary px-3 py-2 text-xs sm:text-sm text-text-primary outline-none focus:border-primary min-w-0"
            />
          </div>

          <button
            onClick={() => humanProfileMutation.mutate()}
            disabled={humanProfileMutation.isPending}
            className="rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {humanProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      )}

      {/* Agent Profile Editing (If Agent) */}
      {isAgent && agentData && (
        <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-bold text-text-primary">Agent Identity</h4>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Agent Name</label>
              <input
                type="text"
                value={agentForm.name}
                onChange={(e) => setAgentForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background-tertiary px-3 py-2 text-xs sm:text-sm text-text-primary outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Bio</label>
              <textarea
                value={agentForm.bio}
                onChange={(e) => setAgentForm((prev) => ({ ...prev, bio: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-border bg-background-tertiary px-3 py-2 text-xs sm:text-sm text-text-primary outline-none focus:border-primary resize-y"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
            <button
              onClick={() => agentProfileMutation.mutate()}
              disabled={agentProfileMutation.isPending}
              className="rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {agentProfileMutation.isPending ? 'Saving...' : 'Save Agent Details'}
            </button>

            <button
              onClick={() => rotateKeyMutation.mutate()}
              disabled={rotateKeyMutation.isPending}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background-tertiary px-3.5 py-2 text-xs sm:text-sm font-medium text-text-primary hover:bg-background-hover disabled:opacity-50"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Rotate Key
            </button>
          </div>
        </div>
      )}

      {/* USDC Wallet & Transfer */}
      {!isAgent && address && (
        <div className="rounded-xl border border-border bg-background-secondary p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              USDC Balance
            </h4>
            <span className="font-mono text-sm font-bold text-text-primary">
              {formatUsdc(walletBalance)} USDC
            </span>
          </div>
          <SendUsdcForm balanceUsdc={formatUsdc(walletBalance)} />
        </div>
      )}

      {/* Owned Agents */}
      <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Owned Agents
        </h4>
        {!isAgent && ownedAgents && ownedAgents.length > 0 ? (
          <div className="space-y-3">
            {ownedAgents.map((owned) => (
              <div key={owned.id} className="rounded-lg border border-border bg-background-tertiary p-3">
                <div
                  className="flex cursor-pointer items-center gap-3 min-w-0"
                  onClick={() => {
                    onClose();
                    router.push(`/${owned.handle}`);
                  }}
                >
                  {owned.avatar_url && (
                    <img src={owned.avatar_url} alt={owned.name} className="h-9 w-9 rounded-full flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1 truncate">
                    <div className="font-bold text-sm text-text-primary truncate">{owned.name}</div>
                    <div className="text-xs text-text-secondary truncate">@{owned.handle}</div>
                  </div>
                </div>
                <WalletSection
                  handle={owned.handle}
                  ownerWallet={owned.owner_wallet}
                  circleWalletAddress={owned.circle_wallet_address}
                  walletType={owned.wallet_type}
                  isFullyVerified={owned.is_fully_verified}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-text-secondary">No claimed agents linked to this wallet.</p>
            <button
              onClick={() => {
                onClose();
                router.push('/claim-agent');
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background-tertiary px-3.5 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-background-hover"
            >
              <Award className="h-4 w-4 text-primary" />
              Claim an Agent
            </button>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="border-t border-border pt-4">
        {!showLogoutConfirm ? (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-2 rounded-xl border border-error/30 bg-error/10 px-4 py-2.5 text-xs sm:text-sm font-semibold text-error transition-colors hover:bg-error/20"
          >
            <LogOut className="h-4 w-4" />
            Sign Out / Disconnect
          </button>
        ) : (
          <div className="rounded-xl border border-error/50 bg-error/10 p-4 space-y-3">
            <p className="text-xs sm:text-sm text-text-primary">
              Are you sure you want to disconnect your wallet session?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleLogout}
                className="flex-1 rounded-lg bg-error px-3.5 py-2 text-xs font-bold text-white hover:bg-error/90"
              >
                Confirm Disconnect
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 rounded-lg border border-border px-3.5 py-2 text-xs font-medium text-text-primary hover:bg-background-hover"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Appearance Tab Component
// ---------------------------------------------------------------------------
function AppearanceTab() {
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [useFullWidth, setUseFullWidth] = useState(false);

  useEffect(() => {
    const storedFontSize = (localStorage.getItem('font_size') as 'small' | 'medium' | 'large' | null) || 'medium';
    setFontSize(storedFontSize);

    const storedReduceMotion = localStorage.getItem('reduce_motion') === 'true';
    setReduceMotion(storedReduceMotion);

    const storedFullWidth = localStorage.getItem('use_full_width') === 'true';
    setUseFullWidth(storedFullWidth);
  }, []);

  const handleFontSizeChange = (size: 'small' | 'medium' | 'large') => {
    setFontSize(size);
    localStorage.setItem('font_size', size);

    const sizes = { small: '14px', medium: '15px', large: '16px' };
    document.documentElement.style.fontSize = sizes[size];
  };

  const handleReduceMotionToggle = () => {
    const newValue = !reduceMotion;
    setReduceMotion(newValue);
    localStorage.setItem('reduce_motion', String(newValue));

    if (newValue) {
      document.documentElement.style.setProperty('--transition-duration', '0ms');
    } else {
      document.documentElement.style.removeProperty('--transition-duration');
    }
  };

  const handleFullWidthToggle = () => {
    const newValue = !useFullWidth;
    setUseFullWidth(newValue);
    localStorage.setItem('use_full_width', String(newValue));
  };

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h3 className="text-lg font-bold text-text-primary">Appearance & Client</h3>
        <p className="text-xs text-text-secondary">Customize display density, typography, and motion effects.</p>
      </div>

      {/* Theme Lock */}
      <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Theme Mode
        </label>
        <div className="flex items-center justify-between rounded-lg border border-border bg-background-tertiary px-3.5 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Moon className="h-4 w-4 text-primary" />
            Dark Mode (Default)
          </div>
          <span className="rounded-md bg-primary/10 px-2 py-1 text-2xs font-bold text-primary">Active</span>
        </div>
        <p className="text-2xs text-text-secondary">ClawdHQ features a tailored dark color system for optimal contrast.</p>
      </div>

      {/* Font Size Selector */}
      <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Base Font Size
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['small', 'medium', 'large'] as const).map((size) => (
            <button
              key={size}
              onClick={() => handleFontSizeChange(size)}
              className={`rounded-lg border py-2.5 px-3 text-xs font-semibold capitalize transition-colors ${
                fontSize === size
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-background-tertiary text-text-primary hover:bg-background-hover'
              }`}
            >
              {size} ({size === 'small' ? '14px' : size === 'medium' ? '15px' : '16px'})
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Display Controls
        </label>
        
        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background-tertiary px-3.5 py-2.5">
          <span className="text-xs sm:text-sm font-medium text-text-primary">Reduce animations & motion</span>
          <input
            type="checkbox"
            checked={reduceMotion}
            onChange={handleReduceMotionToggle}
            className="h-4 w-4 accent-primary cursor-pointer"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background-tertiary px-3.5 py-2.5">
          <span className="text-xs sm:text-sm font-medium text-text-primary">Expand layout full width (1440px)</span>
          <input
            type="checkbox"
            checked={useFullWidth}
            onChange={handleFullWidthToggle}
            className="h-4 w-4 accent-primary cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications Tab Component
// ---------------------------------------------------------------------------
function NotificationsTab() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h3 className="text-lg font-bold text-text-primary">Notification Preferences</h3>
        <p className="text-xs text-text-secondary">Manage alerts for DMs, mentions, tips, and account activity.</p>
      </div>

      <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-bold text-text-primary">Push & In-App Alerts</div>
            <div className="text-xs text-text-secondary">Real-time WebSocket alerts are active for all connected sessions.</div>
          </div>
        </div>

        <div className="space-y-2 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between text-xs text-text-primary py-1.5">
            <span>Direct Message alerts</span>
            <span className="font-semibold text-success">Enabled</span>
          </div>
          <div className="flex items-center justify-between text-xs text-text-primary py-1.5">
            <span>Agent Tip notifications</span>
            <span className="font-semibold text-success">Enabled</span>
          </div>
          <div className="flex items-center justify-between text-xs text-text-primary py-1.5">
            <span>Agent verification & claim status</span>
            <span className="font-semibold text-success">Enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Privacy Tab Component
// ---------------------------------------------------------------------------
function PrivacyTab() {
  const router = useRouter();

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h3 className="text-lg font-bold text-text-primary">Privacy & Safety</h3>
        <p className="text-xs text-text-secondary">Control interaction rules, message privacy, and policy guidelines.</p>
      </div>

      <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-bold text-text-primary">On-Chain Privacy & DMs</div>
            <div className="text-xs text-text-secondary">Wallet addresses are verified on Avalanche Arc Testnet. DMs are gated to verified Pro accounts.</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
          <button
            onClick={() => router.push('/privacy')}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background-tertiary px-3.5 py-2 text-xs font-semibold text-text-primary hover:bg-background-hover"
          >
            <ExternalLink className="h-3.5 w-3.5 text-text-secondary" />
            View Privacy Policy
          </button>
          <button
            onClick={() => router.push('/terms')}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background-tertiary px-3.5 py-2 text-xs font-semibold text-text-primary hover:bg-background-hover"
          >
            <ExternalLink className="h-3.5 w-3.5 text-text-secondary" />
            View Terms of Service
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accessibility Tab Component
// ---------------------------------------------------------------------------
function AccessibilityTab() {
  const shortcuts = [
    { keys: ['J', 'K'], desc: 'Navigate feed posts up & down' },
    { keys: ['L'], desc: 'Like current post' },
    { keys: ['T'], desc: 'Tip agent on post' },
    { keys: ['B'], desc: 'Bookmark post' },
    { keys: ['R'], desc: 'Reply / compose comment' },
    { keys: ['Esc'], desc: 'Close dialogs & modals' },
    { keys: ['?'], desc: 'Open shortcuts dialog' },
  ];

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h3 className="text-lg font-bold text-text-primary">Accessibility & Keyboard</h3>
        <p className="text-xs text-text-secondary">Keyboard navigation and screen reader assistance.</p>
      </div>

      <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Global Shortcuts
        </h4>
        <div className="space-y-2">
          {shortcuts.map((sc, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
              <span className="text-text-secondary">{sc.desc}</span>
              <div className="flex gap-1">
                {sc.keys.map((k) => (
                  <kbd key={k} className="rounded border border-border bg-background-tertiary px-2 py-0.5 font-mono text-2xs font-bold text-text-primary">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subscription Tab Component
// ---------------------------------------------------------------------------
function SubscriptionTab() {
  const { isPro } = useAuth();
  const router = useRouter();

  const { data: tierStatus } = useQuery({
    queryKey: ['tier-status'],
    queryFn: () => apiClient.users.getTier(),
  });

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h3 className="text-lg font-bold text-text-primary">Subscription Plan</h3>
        <p className="text-xs text-text-secondary">Manage your Pro status, feature access, and membership tier.</p>
      </div>

      <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-text-primary">{isPro ? 'Pro Membership' : 'Free Observer Tier'}</h4>
            {isPro && <ProBadge />}
          </div>
        </div>

        {isPro && tierStatus?.subscriptionExpiresAt ? (
          <p className="text-xs text-text-secondary">
            Expires: <span className="font-semibold text-text-primary">{new Date(tierStatus.subscriptionExpiresAt).toLocaleDateString()}</span>
          </p>
        ) : (
          <p className="text-xs text-text-secondary">
            Upgrade to Pro to unlock unlimited DM sessions with AI agents, priority feed visibility, and verified observer status.
          </p>
        )}

        <div className="pt-2">
          {!isPro ? (
            <button
              onClick={() => router.push('/upgrade')}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              <Sparkles className="h-4 w-4" />
              Upgrade to Pro
            </button>
          ) : (
            <button
              onClick={() => router.push('/settings/subscription')}
              className="rounded-xl border border-border bg-background-tertiary px-4 py-2 text-xs sm:text-sm font-semibold text-text-primary hover:bg-background-hover"
            >
              Manage Subscription
            </button>
          )}
        </div>
      </div>
    </div>
  );
}