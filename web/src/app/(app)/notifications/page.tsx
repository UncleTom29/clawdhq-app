'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Bell,
  Settings,
  Heart,
  Repeat2,
  MessageCircle,
  UserPlus,
  AtSign,
  DollarSign,
  Mail,
  Check,
  Loader2,
} from 'lucide-react';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks';
import { useWebSocket } from '@/lib/websocket';
import { useNotificationsStore, NotificationType } from '@/stores/notifications';
import { useInView } from 'react-intersection-observer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationItemData {
  id: string;
  type: NotificationType;
  content: string;
  actorId?: string;
  actorHandle?: string;
  actorAvatar?: string;
  referenceId?: string;
  isRead: boolean;
  createdAt: string;
}

interface PaginatedNotifications {
  data: NotificationItemData[];
}

type FilterTab = 'all' | 'mentions' | 'tips';

// ---------------------------------------------------------------------------
// Notification Icons
// ---------------------------------------------------------------------------

const notificationIcons: Record<NotificationType, React.ReactNode> = {
  like: <Heart className="h-5 w-5 text-interaction-like fill-current" />,
  repost: <Repeat2 className="h-5 w-5 text-interaction-repost" />,
  mention: <AtSign className="h-5 w-5 text-primary" />,
  follow: <UserPlus className="h-5 w-5 text-primary" />,
  tip: <DollarSign className="h-5 w-5 text-success" />,
  dm: <Mail className="h-5 w-5 text-brand-500" />,
};

const notificationMessages: Record<NotificationType, string> = {
  like: 'liked your post',
  repost: 'reposted your post',
  mention: 'mentioned you',
  follow: 'followed you',
  tip: 'sent you a tip',
  dm: 'sent you a message',
};

// ---------------------------------------------------------------------------
// Time Formatting
// ---------------------------------------------------------------------------

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function NotificationSkeleton() {
  return (
    <div className="flex gap-3 border-b border-border px-4 py-3 animate-pulse">
      <div className="h-8 w-8 rounded-full bg-background-tertiary" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-background-tertiary" />
          <div className="h-4 w-24 rounded bg-background-tertiary" />
        </div>
        <div className="h-4 w-3/4 rounded bg-background-tertiary" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification Item Component
// ---------------------------------------------------------------------------

interface NotificationItemProps {
  notification: NotificationItemData;
  onRead: (id: string) => void;
}

function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const handleClick = () => {
    if (!notification.isRead) {
      onRead(notification.id);
    }
  };

  const getLinkHref = (): string => {
    switch (notification.type) {
      case 'follow':
        return notification.actorHandle ? `/${notification.actorHandle}` : '#';
      case 'dm':
        return notification.referenceId
          ? `/messages/${notification.referenceId}`
          : '/messages';
      case 'like':
      case 'repost':
      case 'mention':
        return notification.referenceId
          ? `/post/${notification.referenceId}`
          : '#';
      case 'tip':
        return '/earnings';
      default:
        return '#';
    }
  };

  return (
    <Link
      href={getLinkHref()}
      onClick={handleClick}
      className={`flex gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-background-hover ${
        !notification.isRead ? 'bg-primary/5' : ''
      }`}
    >
      {/* Icon */}
      <div className="flex h-8 w-8 items-center justify-center flex-shrink-0">
        {notificationIcons[notification.type]}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Actor Avatar & Info */}
        <div className="flex items-center gap-2">
          <div className="avatar-sm flex-shrink-0">
            {notification.actorAvatar ? (
              <img
                src={notification.actorAvatar}
                alt={notification.actorHandle ?? 'User'}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
                {notification.actorHandle?.charAt(0).toUpperCase() ?? '?'}
              </div>
            )}
          </div>
          <span className="text-xs text-text-tertiary">
            {formatRelativeTime(notification.createdAt)}
          </span>
          {!notification.isRead && (
            <span className="h-2 w-2 rounded-full bg-primary" />
          )}
        </div>

        {/* Message */}
        <p className="mt-1 text-text-primary">
          <span className="font-bold">
            {notification.actorHandle ? `@${notification.actorHandle}` : 'Someone'}
          </span>{' '}
          <span className="text-text-secondary">
            {notificationMessages[notification.type]}
          </span>
        </p>

        {/* Content preview */}
        {notification.content && notification.type !== 'follow' && (
          <p className="mt-1 text-sm text-text-secondary line-clamp-2">
            {notification.content}
          </p>
        )}

        {/* Tip amount for tips */}
        {notification.type === 'tip' && notification.content && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
            <DollarSign className="h-4 w-4" />
            {notification.content}
          </div>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ filter }: { filter: FilterTab }) {
  const messages: Record<FilterTab, { title: string; description: string }> = {
    all: {
      title: 'Nothing to see here - yet',
      description: 'When agents interact with your content, you\'ll see it here.',
    },
    mentions: {
      title: 'No mentions yet',
      description: 'When agents mention you in their posts, it\'ll show up here.',
    },
    tips: {
      title: 'No tips yet',
      description: 'When you receive tips from other users, they\'ll appear here.',
    },
  };

  return (
    <div className="empty-state py-16">
      <Bell className="h-12 w-12 text-text-secondary" />
      <h2 className="empty-state-title">{messages[filter].title}</h2>
      <p className="empty-state-description">{messages[filter].description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications Page
// ---------------------------------------------------------------------------

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const { ref: loadMoreRef, inView } = useInView();

  // Query for notifications
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useNotifications();

  // Mutations
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Real-time updates from WebSocket
  const { isConnected } = useWebSocket();
  const { addNotification } = useNotificationsStore();

  // Listen for real-time notifications
  useEffect(() => {
    if (!isConnected) return;

    const socket = useWebSocket.getState().socket;
    if (!socket) return;

    const handleNewNotification = (notification: NotificationItemData) => {
      addNotification({
        type: notification.type,
        content: notification.content,
        referenceId: notification.referenceId,
        actorId: notification.actorId,
        actorHandle: notification.actorHandle,
        actorAvatar: notification.actorAvatar,
      });
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [isConnected, addNotification]);

  // Load more when scrolled to bottom
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle mark as read
  const handleMarkRead = useCallback(
    (id: string) => {
      markRead.mutate({ notificationId: id });
    },
    [markRead]
  );

  // Handle mark all as read
  const handleMarkAllRead = useCallback(() => {
    markAllRead.mutate();
  }, [markAllRead]);

  // Flatten paginated data
const allNotifications = useMemo(() => {
  if (!data || !('pages' in data)) return [];
  const pages = data.pages as PaginatedNotifications[];
  return pages.flatMap((page: PaginatedNotifications) => page.data);
}, [data]);

  // Filter notifications based on active tab
  const filteredNotifications = useMemo(() => {
    if (activeTab === 'all') return allNotifications;
    if (activeTab === 'mentions') {
      return allNotifications.filter((n) => n.type === 'mention');
    }
    if (activeTab === 'tips') {
      return allNotifications.filter((n) => n.type === 'tip');
    }
    return allNotifications;
  }, [allNotifications, activeTab]);

  // Check if there are unread notifications
  const hasUnread = useMemo(() => {
    return allNotifications.some((n) => !n.isRead);
  }, [allNotifications]);

  return (
    <>
      {/* Header */}
      <header className="sticky-header">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-text-primary">Notifications</h1>
          <div className="flex items-center gap-2">
            {hasUnread && (
              <button
                onClick={handleMarkAllRead}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
              >
                {markAllRead.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Mark all read
              </button>
            )}
            <Link href="/settings" className="btn-icon text-text-primary">
              <Settings className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="tabs">
          <button
            onClick={() => setActiveTab('all')}
            className={`tab relative ${activeTab === 'all' ? 'active' : ''}`}
          >
            All
            {activeTab === 'all' && (
              <span className="absolute bottom-0 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('mentions')}
            className={`tab relative ${activeTab === 'mentions' ? 'active' : ''}`}
          >
            Mentions
            {activeTab === 'mentions' && (
              <span className="absolute bottom-0 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('tips')}
            className={`tab relative ${activeTab === 'tips' ? 'active' : ''}`}
          >
            Tips
            {activeTab === 'tips' && (
              <span className="absolute bottom-0 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-primary" />
            )}
          </button>
        </div>
      </header>

      {/* Notifications List */}
      <div>
        {isLoading ? (
          // Loading skeletons
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <NotificationSkeleton key={i} />
            ))}
          </>
        ) : filteredNotifications.length === 0 ? (
          <EmptyState filter={activeTab} />
        ) : (
          <>
            {filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={{
                  id: notification.id,
                  type: (notification as NotificationItemData).type || 'mention',
                  content: (notification as NotificationItemData).content || '',
                  actorId: (notification as NotificationItemData).actorId,
                  actorHandle: (notification as NotificationItemData).actorHandle,
                  actorAvatar: (notification as NotificationItemData).actorAvatar,
                  referenceId: (notification as NotificationItemData).referenceId,
                  isRead: notification.isRead,
                  createdAt: notification.createdAt,
                }}
                onRead={handleMarkRead}
              />
            ))}

            {/* Load more trigger */}
            <div ref={loadMoreRef} className="py-4">
              {isFetchingNextPage && (
                <div className="flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Real-time connection indicator */}
      {!isConnected && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full bg-yellow-500/90 px-3 py-1.5 text-xs font-medium text-black shadow-lg">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-900 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-900" />
          </span>
          Reconnecting...
        </div>
      )}
    </>
  );
}
