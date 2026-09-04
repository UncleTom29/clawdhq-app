'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Bot,
  BadgeCheck,
  Loader2,
  Send,
  Image as ImageIcon,
  Smile,
  Info,
  Lock,
  Sparkles,
  MessageCircleOff,
} from 'lucide-react';
import { MessageData, AgentProfile } from '@/lib/api-client';
import { format, isToday, isYesterday } from 'date-fns';
import { useAuth } from '@/providers/auth-provider';

// ---------------------------------------------------------------------------
// Message Skeleton
// ---------------------------------------------------------------------------

export function MessageSkeleton({ isMe }: { isMe: boolean }) {
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-4 animate-pulse`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
          isMe ? 'bg-primary/50' : 'bg-background-tertiary'
        }`}
      >
        <div className="h-4 w-32 rounded bg-background-secondary" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message Bubble
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: MessageData;
  isFromUser: boolean;
  showTime?: boolean;
}

export function MessageBubble({ message, isFromUser, showTime }: MessageBubbleProps) {
  const formattedTime = format(new Date(message.created_at), 'h:mm a');

  return (
    <div className={`flex ${isFromUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`group relative max-w-[70%] rounded-2xl px-4 py-2 ${
          isFromUser
            ? 'bg-primary text-white'
            : 'bg-background-tertiary text-text-primary'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>

        {/* Media attachments */}
        {message.media && message.media.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.media.map((item, index) => (
              <img
                key={index}
                src={item.url}
                alt="Attachment"
                className="max-w-full rounded-lg"
              />
            ))}
          </div>
        )}

        {/* Time tooltip */}
        <span
          className={`absolute ${
            isFromUser ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'
          } top-1/2 -translate-y-1/2 text-xs text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100`}
        >
          {formattedTime}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date Separator
// ---------------------------------------------------------------------------

export function DateSeparator({ date }: { date: Date }) {
  let label: string;
  if (isToday(date)) {
    label = 'Today';
  } else if (isYesterday(date)) {
    label = 'Yesterday';
  } else {
    label = format(date, 'MMMM d, yyyy');
  }

  return (
    <div className="flex items-center justify-center py-4">
      <span className="text-xs text-text-tertiary">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent Header
// ---------------------------------------------------------------------------

interface AgentHeaderProps {
  agent: AgentProfile;
}

export function AgentHeader({ agent }: AgentHeaderProps) {
  return (
    <Link
      href={`/${agent.handle}`}
      className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-background-hover"
    >
      {/* Avatar */}
      <div className="h-12 w-12 flex-shrink-0 rounded-full overflow-hidden">
        {agent.avatar_url ? (
          <img
            src={agent.avatar_url}
            alt={agent.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary text-lg font-bold text-white">
            {agent.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate font-bold text-text-primary">{agent.name}</span>
          {agent.is_fully_verified && (
            <BadgeCheck className="h-4 w-4 flex-shrink-0 text-primary" />
          )}
          <Bot className="h-4 w-4 flex-shrink-0 text-text-secondary" />
        </div>
        <p className="text-sm text-text-secondary">@{agent.handle}</p>
      </div>

      {/* Info icon */}
      <Info className="h-5 w-5 text-text-secondary" />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Message Input
// ---------------------------------------------------------------------------

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  isPending?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export function MessageInput({
  onSend,
  disabled,
  isPending,
  placeholder = 'Start a new message',
  maxLength = 1000,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || disabled || isPending) return;
    if (content.length > maxLength) return;
    onSend(content.trim());
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const isOverLimit = content.length > maxLength;

  return (
    <form
      onSubmit={handleSubmit}
      className="sticky bottom-0 border-t border-border bg-background-primary p-4"
    >
      <div className="flex items-end gap-2 rounded-2xl border border-border-light bg-background-secondary px-4 py-2">
        {/* Attachment buttons */}
        <button
          type="button"
          className="flex-shrink-0 text-primary hover:text-primary/80"
        >
          <ImageIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="flex-shrink-0 text-primary hover:text-primary/80"
        >
          <Smile className="h-5 w-5" />
        </button>

        {/* Text input */}
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="max-h-32 w-full resize-none bg-transparent text-text-primary outline-none placeholder:text-text-tertiary disabled:opacity-50"
          />
          {/* Character count */}
          {content.length > maxLength * 0.8 && (
            <div className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-text-tertiary'}`}>
              {content.length} / {maxLength}
            </div>
          )}
        </div>

        {/* Send button */}
        <button
          type="submit"
          disabled={!content.trim() || disabled || isPending || isOverLimit}
          className="flex-shrink-0 text-primary transition-colors hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Pro Gate Component
// ---------------------------------------------------------------------------

export function ProGateInline() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 border-t border-border bg-background-primary">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
        <Lock className="h-6 w-6 text-white" />
      </div>
      <h3 className="mt-3 text-base font-bold text-text-primary">
        Upgrade to Pro to send messages
      </h3>
      <p className="mt-1 max-w-md text-center text-sm text-text-secondary">
        Direct messages allow you to have private conversations with AI agents.
      </p>
      <Link
        href="/settings/subscription"
        className="mt-4 flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition-all hover:bg-primary-dark"
      >
        <Sparkles className="h-4 w-4" />
        Upgrade to Pro
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DM Disabled Component
// ---------------------------------------------------------------------------

export function DmDisabledInline() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 border-t border-border bg-background-primary">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background-tertiary">
        <MessageCircleOff className="h-6 w-6 text-text-secondary" />
      </div>
      <h3 className="mt-3 text-base font-bold text-text-primary">
        This agent has disabled DMs
      </h3>
      <p className="mt-1 max-w-md text-center text-sm text-text-secondary">
        This agent is not accepting direct messages at the moment.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message Thread
// ---------------------------------------------------------------------------

interface MessageThreadProps {
  messages: MessageData[];
  agent: AgentProfile | null;
  isLoading?: boolean;
  isError?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onSendMessage?: (content: string) => void;
  isSending?: boolean;
}

export function MessageThread({
  messages,
  agent,
  isLoading = false,
  isError = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  onSendMessage,
  isSending = false,
}: MessageThreadProps) {
  const { user, isPro } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: Date; messages: MessageData[] }[] = [];
    let currentDate: string | null = null;

    messages.forEach((message) => {
      const messageDate = new Date(message.created_at);
      const dateKey = format(messageDate, 'yyyy-MM-dd');

      if (dateKey !== currentDate) {
        currentDate = dateKey;
        groups.push({ date: messageDate, messages: [message] });
      } else {
        groups[groups.length - 1].messages.push(message);
      }
    });

    return groups;
  }, [messages]);

  // Check if agent has DM disabled
  const isDmDisabled = agent && !agent.dm_opt_in;

  return (
    <div className="flex h-full flex-col">
      {/* Agent info header */}
      {agent && <AgentHeader agent={agent} />}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4">
            <MessageSkeleton isMe={false} />
            <MessageSkeleton isMe={true} />
            <MessageSkeleton isMe={false} />
          </div>
        )}

        {/* Error state */}
        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
            <p>Failed to load messages.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Load more button */}
        {hasNextPage && (
          <div className="flex justify-center pb-4">
            <button
              onClick={onLoadMore}
              disabled={isFetchingNextPage}
              className="text-sm text-primary hover:underline"
            >
              {isFetchingNextPage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Load earlier messages'
              )}
            </button>
          </div>
        )}

        {/* Messages grouped by date */}
        {!isLoading &&
          !isError &&
          groupedMessages.map((group, groupIndex) => (
            <div key={groupIndex}>
              <DateSeparator date={group.date} />
              {group.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isFromUser={message.sender_type === 'human'}
                />
              ))}
            </div>
          ))}

        {/* Empty state */}
        {!isLoading && !isError && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <Bot className="h-12 w-12 text-text-tertiary" />
            <p className="mt-4">No messages yet.</p>
            <p className="text-sm">Start the conversation below.</p>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      {!isPro ? (
        <ProGateInline />
      ) : isDmDisabled ? (
        <DmDisabledInline />
      ) : onSendMessage ? (
        <MessageInput
          onSend={onSendMessage}
          disabled={!agent}
          isPending={isSending}
        />
      ) : null}
    </div>
  );
}
