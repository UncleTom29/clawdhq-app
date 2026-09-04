'use client';

import Link from 'next/link';
import { Bot, BadgeCheck, Loader2 } from 'lucide-react';
import { ConversationData } from '@/lib/api-client';
import { formatDistanceToNow } from 'date-fns';
import { useWebSocket } from '@/lib/websocket';

// ---------------------------------------------------------------------------
// Conversation Skeleton
// ---------------------------------------------------------------------------

export function ConversationSkeleton() {
  return (
    <div className="flex gap-3 border-b border-border px-4 py-3 animate-pulse">
      <div className="h-12 w-12 flex-shrink-0 rounded-full bg-background-tertiary" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 rounded bg-background-tertiary" />
          <div className="h-3 w-12 rounded bg-background-tertiary" />
        </div>
        <div className="h-4 w-3/4 rounded bg-background-tertiary" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversation Item
// ---------------------------------------------------------------------------

interface ConversationItemProps {
  conversation: ConversationData;
  isActive?: boolean;
}

export function ConversationItem({ conversation, isActive = false }: ConversationItemProps) {
  const { isAgentOnline } = useWebSocket();
  
  // Get the agent participant (first non-current-user participant)
  const agent = conversation.participants[0];
  const isOnline = agent ? isAgentOnline(agent.id) : false;

  const timeAgo = conversation.last_message
    ? formatDistanceToNow(new Date(conversation.last_message.created_at), {
        addSuffix: false,
      })
    : '';

  const isUnread = conversation.unread_count > 0;

  return (
    <Link
      href={`/messages?id=${conversation.id}`}
      className={`flex gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-background-hover ${
        isActive ? 'bg-background-hover' : ''
      } ${isUnread ? 'bg-primary/5' : ''}`}
    >
      {/* Avatar with online indicator */}
      <div className="relative h-12 w-12 flex-shrink-0">
        <div className="h-12 w-12 rounded-full overflow-hidden">
          {agent?.avatar_url ? (
            <img
              src={agent.avatar_url}
              alt={agent.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary text-base font-bold text-white">
              {agent?.name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
          )}
        </div>
        {/* Online status indicator */}
        {isOnline && (
          <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0">
            <span className="truncate font-bold text-text-primary">
              {agent?.name ?? 'Unknown Agent'}
            </span>
            {agent?.is_fully_verified && (
              <BadgeCheck className="h-4 w-4 flex-shrink-0 text-primary" />
            )}
            <Bot className="h-4 w-4 flex-shrink-0 text-text-secondary" />
            <span className="text-text-secondary truncate">
              @{agent?.handle ?? 'unknown'}
            </span>
          </div>
          {timeAgo && (
            <span className="text-sm text-text-secondary flex-shrink-0">
              {timeAgo}
            </span>
          )}
        </div>
        <p
          className={`mt-0.5 truncate text-sm ${
            isUnread ? 'text-text-primary font-medium' : 'text-text-secondary'
          }`}
        >
          {conversation.last_message?.sender_type === 'human' && 'You: '}
          {conversation.last_message?.content ?? 'No messages yet'}
        </p>
      </div>

      {/* Unread badge */}
      {isUnread && (
        <div className="flex items-center">
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">
            {conversation.unread_count}
          </span>
        </div>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Conversation List
// ---------------------------------------------------------------------------

interface ConversationListProps {
  conversations: ConversationData[];
  isLoading?: boolean;
  isError?: boolean;
  activeConversationId?: string;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

export function ConversationList({
  conversations,
  isLoading = false,
  isError = false,
  activeConversationId,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
}: ConversationListProps) {
  // Sort conversations by last message time (most recent first)
  const sortedConversations = [...conversations].sort((a, b) => {
    const aTime = a.last_message?.created_at ?? a.updated_at;
    const bTime = b.last_message?.created_at ?? b.updated_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  return (
    <div className="flex flex-col">
      {/* Loading state */}
      {isLoading && (
        <>
          <ConversationSkeleton />
          <ConversationSkeleton />
          <ConversationSkeleton />
        </>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div className="py-8 text-center text-text-secondary">
          Failed to load conversations. Please try again.
        </div>
      )}

      {/* Conversations */}
      {!isLoading &&
        !isError &&
        sortedConversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            isActive={conversation.id === activeConversationId}
          />
        ))}

      {/* Load more */}
      {hasNextPage && (
        <button
          onClick={onLoadMore}
          disabled={isFetchingNextPage}
          className="flex w-full items-center justify-center py-4 text-primary hover:bg-background-hover"
        >
          {isFetchingNextPage ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            'Load more'
          )}
        </button>
      )}
    </div>
  );
}
