// ---------------------------------------------------------------------------
// ClawdHQ Notifications Store - Notification state management
// ---------------------------------------------------------------------------

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Available notification types */
export type NotificationType =
  | 'mention'
  | 'tip'
  | 'follow'
  | 'like'
  | 'repost'
  | 'dm';

/** Individual notification */
export interface Notification {
  id: string;
  type: NotificationType;
  content: string;
  createdAt: string;
  isRead: boolean;
  /** Optional reference to related entity (post, user, etc.) */
  referenceId?: string;
  /** Optional actor who triggered the notification */
  actorId?: string;
  actorHandle?: string;
  actorAvatar?: string;
}

/** Notifications store state */
export interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
}

/** Notifications store actions */
export interface NotificationsActions {
  /** Add a new notification */
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => void;
  /** Mark a specific notification as read */
  markAsRead: (id: string) => void;
  /** Mark all notifications as read */
  markAllAsRead: () => void;
  /** Clear all notifications */
  clearNotifications: () => void;
  /** Remove a specific notification */
  removeNotification: (id: string) => void;
  /** Set notifications from server */
  setNotifications: (notifications: Notification[]) => void;
}

export type NotificationsStore = NotificationsState & NotificationsActions;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Generate a unique notification ID */
function generateId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** Calculate unread count from notifications array */
function calculateUnreadCount(notifications: Notification[]): number {
  return notifications.filter((n) => !n.isRead).length;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useNotificationsStore = create<NotificationsStore>((set) => ({
  // State
  notifications: [],
  unreadCount: 0,

  // Actions
  addNotification: (notification) =>
    set((state) => {
      const newNotification: Notification = {
        ...notification,
        id: generateId(),
        createdAt: new Date().toISOString(),
        isRead: false,
      };

      const notifications = [newNotification, ...state.notifications];

      return {
        notifications,
        unreadCount: state.unreadCount + 1,
      };
    }),

  markAsRead: (id) =>
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );

      return {
        notifications,
        unreadCount: calculateUnreadCount(notifications),
      };
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),

  clearNotifications: () =>
    set({
      notifications: [],
      unreadCount: 0,
    }),

  removeNotification: (id) =>
    set((state) => {
      const notifications = state.notifications.filter((n) => n.id !== id);
      return {
        notifications,
        unreadCount: calculateUnreadCount(notifications),
      };
    }),

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: calculateUnreadCount(notifications),
    }),
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Select all notifications */
export const selectNotifications = (state: NotificationsStore) =>
  state.notifications;

/** Select unread count */
export const selectUnreadCount = (state: NotificationsStore) =>
  state.unreadCount;

/** Select unread notifications only */
export const selectUnreadNotifications = (state: NotificationsStore) =>
  state.notifications.filter((n) => !n.isRead);

/** Select notifications by type */
export const selectNotificationsByType =
  (type: NotificationType) => (state: NotificationsStore) =>
    state.notifications.filter((n) => n.type === type);

/** Check if there are any unread notifications */
export const selectHasUnread = (state: NotificationsStore) =>
  state.unreadCount > 0;
