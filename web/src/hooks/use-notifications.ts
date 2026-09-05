// ---------------------------------------------------------------------------
// ClawdHQ Notification Hooks - React Query hooks for notifications
// ---------------------------------------------------------------------------

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  UseInfiniteQueryOptions,
} from '@tanstack/react-query';
import { Notification } from '@/stores/notifications';
import { apiClient } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaginatedNotifications {
  data: Notification[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
}

type NotificationsQueryOptions = Omit<
  UseInfiniteQueryOptions<
    PaginatedNotifications,
    Error,
    PaginatedNotifications,
    readonly string[],
    string | undefined
  >,
  'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'
>;

interface MarkNotificationReadVariables {
  notificationId: string;
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch notifications with infinite scroll pagination.
 */
export function useNotifications(options?: NotificationsQueryOptions) {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(),
    queryFn: async ({ pageParam }) => {
      const response = await apiClient.notifications.getAll(pageParam);
      return response as unknown as PaginatedNotifications;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.has_more) {
        return lastPage.pagination.next_cursor ?? undefined;
      }
      return undefined;
    },
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

/**
 * Mark a specific notification as read.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ notificationId }: MarkNotificationReadVariables) => {
      await apiClient.notifications.markRead(notificationId);
    },
    onMutate: async ({ notificationId }) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.list() });

      // Get all pages of notifications
      const previousData = queryClient.getQueryData<{
        pages: PaginatedNotifications[];
        pageParams: (string | undefined)[];
      }>(notificationKeys.list());

      if (previousData) {
        // Optimistically update the notification
        const updatedPages = previousData.pages.map((page) => ({
          ...page,
          data: page.data.map((notification) =>
            notification.id === notificationId
              ? { ...notification, isRead: true }
              : notification
          ),
        }));

        queryClient.setQueryData(notificationKeys.list(), {
          ...previousData,
          pages: updatedPages,
        });
      }

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(notificationKeys.list(), context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/**
 * Mark all notifications as read.
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.notifications.markAllRead();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.list() });

      const previousData = queryClient.getQueryData<{
        pages: PaginatedNotifications[];
        pageParams: (string | undefined)[];
      }>(notificationKeys.list());

      if (previousData) {
        // Optimistically mark all as read
        const updatedPages = previousData.pages.map((page) => ({
          ...page,
          data: page.data.map((notification) => ({
            ...notification,
            isRead: true,
          })),
        }));

        queryClient.setQueryData(notificationKeys.list(), {
          ...previousData,
          pages: updatedPages,
        });
      }

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(notificationKeys.list(), context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}