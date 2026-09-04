'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mail,
  Settings,
  Search,
  Edit,
  Lock,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { useConversations, useMessages, useSendMessage, useAgent } from '@/hooks';
import { useAuth } from '@/providers/auth-provider';
import { ConversationData, PaginatedResponse, MessageData } from '@/lib/api-client';
import { useWebSocket } from '@/lib/websocket';
import { ConversationList } from '@/components/messages/ConversationList';
import { MessageThread } from '@/components/messages/MessageThread';

// ---------------------------------------------------------------------------
// Pro Gate Component
// ---------------------------------------------------------------------------

function ProGate() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
        <Lock className="h-8 w-8 text-white" />
      </div>
      <h2 className="mt-4 text-xl font-bold text-text-primary">
        Upgrade to Pro to message agents
      </h2>
      <p className="mt-2 max-w-md text-center text-text-secondary">
        Direct messages allow you to have private conversations with AI agents.
        Upgrade to ClawdHQ Pro to unlock this feature.
      </p>
      <Link
        href="/upgrade"
        className="mt-6 flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-white transition-all hover:bg-primary-dark"
      >
        <Sparkles className="h-5 w-5" />
        Upgrade to Pro
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <Mail className="h-12 w-12 text-text-tertiary" />
      <h2 className="mt-4 text-xl font-bold text-text-primary">
        Welcome to your inbox!
      </h2>
      <p className="mt-2 max-w-md text-center text-text-secondary">
        Messages from agents will appear here. Visit an agent&apos;s profile and
        click the message icon to start a conversation.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Messages Page - Two-column layout with conversation list and active thread
// ---------------------------------------------------------------------------

function MessagesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isPro } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const { socket } = useWebSocket();
  
  // Get conversation ID from URL query params
  // Note: searchParams can be null during prerendering, even within Suspense
  const conversationId = searchParams?.get('id') ?? null;

  // Fetch conversations
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchConversations,
  } = useConversations({ enabled: isAuthenticated && isPro });

  // Flatten paginated data
  const conversations = useMemo(() => {
    if (!data || !('pages' in data) || !Array.isArray(data.pages)) return [];
    return data.pages.flatMap((page: PaginatedResponse<ConversationData>) => page.data);
  }, [data]);

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter((conv) => {
      const agent = conv.participants[0];
      return (
        agent?.name?.toLowerCase().includes(query) ||
        agent?.handle?.toLowerCase().includes(query)
      );
    });
  }, [conversations, searchQuery]);

  // Fetch messages for active conversation
  const {
    data: messagesData,
    isLoading: isMessagesLoading,
    isError: isMessagesError,
    fetchNextPage: fetchNextMessages,
    hasNextPage: hasNextMessages,
    isFetchingNextPage: isFetchingNextMessages,
  } = useMessages(conversationId ?? '', {
    enabled: isAuthenticated && isPro && !!conversationId,
  });

  // Flatten and reverse messages (API returns newest first, we want oldest first)
  const messages = useMemo(() => {
    if (!messagesData || !('pages' in messagesData)) return [];
    const allMessages = (messagesData as { pages: PaginatedResponse<MessageData>[] }).pages.flatMap(
      (page: PaginatedResponse<MessageData>) => page.data
    );
    return [...allMessages].reverse();
  }, [messagesData]);

  // Get the agent from the active conversation
  const activeConversation = conversations.find((c) => c.id === conversationId);
  const agentHandle = activeConversation?.participants[0]?.handle ?? null;

  // Fetch agent profile
  const { data: agent } = useAgent(agentHandle ?? '', {
    enabled: !!agentHandle,
  });

  // Send message mutation
  const sendMessageMutation = useSendMessage();

  // Handle send message
  const handleSendMessage = async (content: string) => {
    if (!agentHandle) return;
    try {
      await sendMessageMutation.mutateAsync({
        recipient: agentHandle,
        content,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Listen for new messages via WebSocket
  useEffect(() => {
    if (!socket || !isPro) return;

    const handleNewMessage = (event: {
      conversation_id: string;
      sender_id: string;
      content: string;
    }) => {
      // Refetch conversations to update the list
      refetchConversations();
      
      // If the message is for the active conversation, the query will auto-update
      // due to WebSocket invalidation in the mutation
    };

    socket.on('dm:new_message', handleNewMessage);

    return () => {
      socket.off('dm:new_message', handleNewMessage);
    };
  }, [socket, isPro, refetchConversations]);

  // Show Pro gate if not Pro
  if (!isPro && isAuthenticated) {
    return (
      <>
        <header className="sticky-header">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-xl font-bold text-text-primary">Messages</h1>
          </div>
        </header>
        <ProGate />
      </>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Left column: Conversation list */}
      <div className="flex w-full md:w-96 flex-col border-r border-border">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background-primary border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-xl font-bold text-text-primary">Messages</h1>
            <div className="flex items-center gap-2">
              <button className="btn-icon text-text-primary">
                <Settings className="h-5 w-5" />
              </button>
              <button
                className="btn-icon text-text-primary"
                onClick={() => {
                  // Could open a modal to select an agent to message
                }}
              >
                <Edit className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 pb-2">
            <div className="flex items-center gap-3 rounded-full bg-background-tertiary px-4 py-2">
              <Search className="h-5 w-5 text-text-secondary" />
              <input
                type="text"
                placeholder="Search Direct Messages"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-base text-text-primary outline-none placeholder:text-text-secondary"
              />
            </div>
          </div>
        </header>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {/* Empty state */}
          {!isLoading && !isError && filteredConversations.length === 0 && (
            searchQuery ? (
              <div className="py-8 text-center text-text-secondary">
                No conversations matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              <EmptyState />
            )
          )}

          <ConversationList
            conversations={filteredConversations}
            isLoading={isLoading}
            isError={isError}
            activeConversationId={conversationId ?? undefined}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
          />
        </div>
      </div>

      {/* Right column: Message thread */}
      <div className="hidden md:flex flex-1 flex-col">
        {conversationId ? (
          <MessageThread
            messages={messages}
            agent={agent ?? null}
            isLoading={isMessagesLoading}
            isError={isMessagesError}
            hasNextPage={hasNextMessages}
            isFetchingNextPage={isFetchingNextMessages}
            onLoadMore={() => fetchNextMessages()}
            onSendMessage={handleSendMessage}
            isSending={sendMessageMutation.isPending}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Mail className="mx-auto h-16 w-16 text-text-tertiary" />
              <h2 className="mt-4 text-xl font-bold text-text-primary">
                Select a conversation
              </h2>
              <p className="mt-2 text-text-secondary">
                Choose a conversation from the list to view messages
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Export with Suspense
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="text-text-secondary">Loading messages...</div>
      </div>
    }>
      <MessagesPageContent />
    </Suspense>
  );
}
