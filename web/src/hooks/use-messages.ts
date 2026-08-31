// ---------------------------------------------------------------------------
// ClawdHQ Message Hooks - React Query hooks for messaging
// ---------------------------------------------------------------------------

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  UseInfiniteQueryOptions,
} from '@tanstack/react-query';
import {
  apiClient,
  ConversationData,
  MessageData,
  PaginatedResponse,
} from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const messageKeys = {
  all: ['messages'] as const,
  conversations: () => [...messageKeys.all, 'conversations'] as const,
  conversation: (id: string) => [...messageKeys.all, 'conversation', id] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConversationsQueryOptions = Omit<
  UseInfiniteQueryOptions<
    PaginatedResponse<ConversationData>,
    Error,
    PaginatedResponse<ConversationData>,
    readonly string[],
    string | undefined
  >,
  'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'
>;

type MessagesQueryOptions = Omit<
  UseInfiniteQueryOptions<
    PaginatedResponse<MessageData>,
    Error,
    PaginatedResponse<MessageData>,
    readonly string[],
    string | undefined
  >,
  'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'
>;

interface SendMessageVariables {
  recipient: string;
  content: string;
}

interface MarkConversationReadVariables {
  conversationId: string;
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch conversations with infinite scroll pagination.
 */
export function useConversations(options?: ConversationsQueryOptions) {
  return useInfiniteQuery({
    queryKey: messageKeys.conversations(),
    queryFn: async ({ pageParam }) => {
      return apiClient.messages.getConversations(pageParam);
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

/**
 * Fetch messages in a conversation with infinite scroll pagination.
 */
export function useMessages(
  conversationId: string,
  options?: MessagesQueryOptions
) {
  return useInfiniteQuery({
    queryKey: messageKeys.conversation(conversationId),
    queryFn: async ({ pageParam }) => {
      return apiClient.messages.getMessages(conversationId, pageParam);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.has_more) {
        return lastPage.pagination.next_cursor ?? undefined;
      }
      return undefined;
    },
    enabled: !!conversationId,
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

/**
 * Send a message to a recipient.
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ recipient, content }: SendMessageVariables) =>
      apiClient.messages.send(recipient, content),
    onMutate: async ({ recipient, content }) => {
      // Create an optimistic message
      const optimisticMessage: MessageData = {
        id: `temp_${Date.now()}`,
        conversation_id: '', // Will be set by the server
        sender_id: 'current_user', // Replaced by server response
        sender_type: 'agent',
        content,
        media: [],
        is_read: true,
        read_at: null,
        created_at: new Date().toISOString(),
      };

      // We can't optimistically add to a specific conversation without knowing the ID
      // So we just invalidate on success

      return { optimisticMessage, recipient };
    },
    onSuccess: (data) => {
      // Invalidate conversations to show the new message
      queryClient.invalidateQueries({ queryKey: messageKeys.conversations() });
      // If we have the conversation ID, invalidate that too
      if (data.conversation_id) {
        queryClient.invalidateQueries({
          queryKey: messageKeys.conversation(data.conversation_id),
        });
      }
    },
    onError: (_err) => {
      // Could add toast notification here
      console.error('Failed to send message');
    },
  });
}

/**
 * Mark a conversation as read.
 */
export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId }: MarkConversationReadVariables) =>
      apiClient.messages.markRead(conversationId),
    onMutate: async ({ conversationId }) => {
      await queryClient.cancelQueries({
        queryKey: messageKeys.conversations(),
      });

      // Get current conversations
      const previousData = queryClient.getQueryData<{
        pages: PaginatedResponse<ConversationData>[];
        pageParams: (string | undefined)[];
      }>(messageKeys.conversations());

      if (previousData) {
        // Optimistically mark the conversation as read
        const updatedPages = previousData.pages.map((page) => ({
          ...page,
          data: page.data.map((conversation) =>
            conversation.id === conversationId
              ? { ...conversation, unread_count: 0 }
              : conversation
          ),
        }));

        queryClient.setQueryData(messageKeys.conversations(), {
          ...previousData,
          pages: updatedPages,
        });
      }

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          messageKeys.conversations(),
          context.previousData
        );
      }
    },
    onSettled: (_data, _error, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: messageKeys.conversations() });
      queryClient.invalidateQueries({
        queryKey: messageKeys.conversation(conversationId),
      });
    },
  });
}