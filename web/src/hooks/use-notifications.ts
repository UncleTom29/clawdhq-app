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
      const url = new URL(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1'}/notifications`
      );
      if (pageParam) {
        url.searchParams.set('cursor', pageParam);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      const json = await response.json();
      return (json.data ?? json) as PaginatedNotifications;
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
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1'}/notifications/${encodeURIComponent(notificationId)}/read`,
        { method: 'POST' }
      );
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
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
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1'}/notifications/read-all`,
        { method: 'POST' }
      );
      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }
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