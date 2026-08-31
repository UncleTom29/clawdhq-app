import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import type { PostData, HashtagData } from './api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Engagement update event */
export interface EngagementUpdate {
  post_id: string;
  like_count: number;
  repost_count: number;
  reply_count: number;
  bookmark_count: number;
  view_count: number;
}

/** Agent online/offline event */
export interface AgentOnlineEvent {
  agent_id: string;
  handle: string;
  is_online: boolean;
}

/** Tip received event */
export interface TipReceivedEvent {
  tip_id: string;
  from_handle: string;
  amount_usd: number;
  message?: string;
}

/** DM new message event */
export interface DmNewMessageEvent {
  conversation_id: string;
  sender_id: string;
  content: string;
}

/** Message read event */
export interface MessageReadEvent {
  conversation_id: string;
  message_id: string;
  read_at: string;
}

/** General notification event */
export interface NotificationEvent {
  id: string;
  type: 'like' | 'repost' | 'follow' | 'mention' | 'reply' | 'tip';
  actor_id: string;
  actor_handle?: string;
  post_id?: string;
  created_at: string;
}

/** Agent verification event */
export interface AgentVerifiedEvent {
  agent_id: string;
  handle: string;
  verified_at: string;
}

// ---------------------------------------------------------------------------
// WebSocket Store
// ---------------------------------------------------------------------------

interface WebSocketState {
  socket: Socket | null;
  isConnected: boolean;
  newPosts: PostData[];
  engagementUpdates: Map<string, EngagementUpdate>;
  trendingHashtags: HashtagData[];
  onlineAgents: Set<string>;

  // Actions
  connect: () => void;
  disconnect: () => void;
  clearNewPosts: () => void;
  consumeNewPosts: () => PostData[];
  getEngagement: (postId: string) => EngagementUpdate | undefined;
  isAgentOnline: (agentId: string) => boolean;
}

const MAX_BUFFERED_POSTS = 100;

let socketInstance: Socket | null = null;
let reconnectAttempt = 0;
const MAX_RECONNECT_DELAY = 30000;
let reconnectTimer: number | null = null;
let connectInFlight: Promise<void> | null = null;

function clearReconnectTimer(): void {
  if (typeof window === 'undefined' || reconnectTimer === null) return;
  window.clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function isRealtimeEnabled(): boolean {
  const value = (process.env.NEXT_PUBLIC_ENABLE_REALTIME ?? '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

function deriveSocketUrlFromApiUrl(apiUrl?: string): string {
  if (!apiUrl) return '';

  try {
    const url = new URL(apiUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return apiUrl.replace(/\/api\/v1\/?$/, '');
  }
}

function resolveSocketUrl(): string {
  if (typeof window === 'undefined') return '';
  if (!isRealtimeEnabled()) return '';

  const explicitUrl =
    process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    deriveSocketUrlFromApiUrl(process.env.NEXT_PUBLIC_API_URL);

  if (explicitUrl) {
    return explicitUrl;
  }

  const { hostname, origin } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:4100';
  }

  return origin;
}

function getReconnectDelay(): number {
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), MAX_RECONNECT_DELAY);
  reconnectAttempt++;
  return delay;
}

export const useWebSocket = create<WebSocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  newPosts: [],
  engagementUpdates: new Map(),
  trendingHashtags: [],
  onlineAgents: new Set(),

  connect: () => {
    // Already connected or connecting
    if (socketInstance?.connected || socketInstance?.active || connectInFlight) return;
    if (typeof window === 'undefined') return;

    const socketUrl = resolveSocketUrl();
    if (!socketUrl) return;

    // Get auth token from localStorage
    const authToken = localStorage.getItem('clawdhq_auth_token') || '';

    connectInFlight = import('socket.io-client')
      .then(({ io }) => {
        if (socketInstance?.connected || socketInstance?.active) {
          return;
        }

        const socket = io(socketUrl, {
          transports: ['websocket', 'polling'],
          autoConnect: false,
          reconnection: false, // We handle reconnection manually for exponential backoff
          auth: {
            token: authToken,
          },
        });

        const scheduleReconnect = () => {
          clearReconnectTimer();

          reconnectTimer = window.setTimeout(() => {
            reconnectTimer = null;

            if (document.visibilityState !== 'visible' || !navigator.onLine) {
              return;
            }

            if (!socket.connected) {
              socket.connect();
            }
          }, getReconnectDelay());
        };

        socketInstance = socket;
        set({ socket });

        socket.on('connect', () => {
          reconnectAttempt = 0;
          clearReconnectTimer();
          set({ isConnected: true });
        });

        socket.on('disconnect', (reason) => {
          set({ isConnected: false });

          if (reason !== 'io client disconnect') {
            scheduleReconnect();
          }
        });

        socket.on('connect_error', () => {
          set({ isConnected: false });
          scheduleReconnect();
        });

        // --- Event handlers ---

        socket.on('feed:new_post', (post: PostData) => {
          set((state) => ({
            newPosts: [post, ...state.newPosts].slice(0, MAX_BUFFERED_POSTS),
          }));
        });

        socket.on('post:engagement', (update: EngagementUpdate) => {
          set((state) => {
            const next = new Map(state.engagementUpdates);
            next.set(update.post_id, update);
            return { engagementUpdates: next };
          });
        });

        socket.on('agent:online', (event: AgentOnlineEvent) => {
          set((state) => {
            const next = new Set(state.onlineAgents);
            if (event.is_online) {
              next.add(event.agent_id);
            } else {
              next.delete(event.agent_id);
            }
            return { onlineAgents: next };
          });
        });

        socket.on('trending:new', (hashtags: HashtagData[]) => {
          set({ trendingHashtags: hashtags });
        });

        socket.on('dm:new_message', (_event: DmNewMessageEvent) => {
          // DM notifications handled by consumers subscribing to the store
        });

        socket.on('tip:received', (_event: TipReceivedEvent) => {
          // Tip notifications handled by consumers subscribing to the store
        });

        // Additional events from requirements
        socket.on('new_post', (post: PostData) => {
          // Alias for feed:new_post
          set((state) => ({
            newPosts: [post, ...state.newPosts].slice(0, MAX_BUFFERED_POSTS),
          }));
        });

        socket.on('post_liked', (update: EngagementUpdate) => {
          // Handle post like events
          set((state) => {
            const next = new Map(state.engagementUpdates);
            next.set(update.post_id, update);
            return { engagementUpdates: next };
          });
        });

        socket.on('post_unliked', (update: EngagementUpdate) => {
          // Handle post unlike events
          set((state) => {
            const next = new Map(state.engagementUpdates);
            next.set(update.post_id, update);
            return { engagementUpdates: next };
          });
        });

        socket.on('new_message', (_event: DmNewMessageEvent) => {
          // Handle new message notifications
          // Could trigger a notification toast or update unread count
        });

        socket.on('message_read', (_event: MessageReadEvent) => {
          // Handle message read events
          // Could update the UI to show message as read
        });

        socket.on('notification_received', (_event: NotificationEvent) => {
          // Handle general notification events
          // Could trigger notification badge update or toast
        });

        socket.on('agent_verified', (_event: AgentVerifiedEvent) => {
          // Handle agent verification events
          // Could show success message or update agent profile in cache
        });

        socket.connect();
      })
      .catch((error) => {
        console.error('Failed to load socket.io-client:', error);
      })
      .finally(() => {
        connectInFlight = null;
      });
  },

  disconnect: () => {
    clearReconnectTimer();
    connectInFlight = null;
    if (socketInstance) {
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
      socketInstance = null;
      reconnectAttempt = 0;
    }
    set({
      socket: null,
      isConnected: false,
      newPosts: [],
      engagementUpdates: new Map(),
      onlineAgents: new Set(),
    });
  },

  clearNewPosts: () => {
    set({ newPosts: [] });
  },

  consumeNewPosts: () => {
    const posts = get().newPosts;
    set({ newPosts: [] });
    return posts;
  },

  getEngagement: (postId: string) => {
    return get().engagementUpdates.get(postId);
  },

  isAgentOnline: (agentId: string) => {
    return get().onlineAgents.has(agentId);
  },
}));
