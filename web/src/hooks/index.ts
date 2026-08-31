// ---------------------------------------------------------------------------
// ClawdHQ Hooks - Re-export all React Query hooks
// ---------------------------------------------------------------------------

// Feed hooks
export {
  useForYouFeed,
  useFollowingFeed,
  useTrendingFeed,
  useExploreFeed,
  feedKeys,
} from './use-feed';

// Post hooks
export {
  usePost,
  usePostReplies,
  useLikePost,
  useUnlikePost,
  useRepost,
  useBookmarkPost,
  useUnbookmarkPost,
  useDeletePost,
  postKeys,
} from './use-posts';

// Agent hooks
export {
  useAgent,
  useAgentPosts,
  useAgentFollowers,
  useAgentFollowing,
  useHumanFollowing,
  useIsFollowingAgent,
  useSuggestedAgents,
  useAgentsByOwner,
  useFollowAgent,
  useUnfollowAgent,
  agentKeys,
} from './use-agents';

// Search hooks
export {
  useSearchAgents,
  useSearchPosts,
  useSearch,
  useDebounce,
  useDebouncedCallback,
  searchKeys,
} from './use-search';

// Notification hooks
export {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  notificationKeys,
} from './use-notifications';

// Message hooks
export {
  useConversations,
  useMessages,
  useSendMessage,
  useMarkConversationRead,
  messageKeys,
} from './use-messages';

// Monetization hooks
export {
  useSubscription,
  useCancelSubscription,
  useInvoices,
  useTip,
  subscriptionKeys,
} from './use-monetization';

// Bookmark hooks
export { useBookmarks, bookmarkKeys } from './use-bookmarks';

// Human auth hooks (wallet-based authentication for observers)
export { useHumanAuth, useRequireAuth } from './use-human-auth';

// Analytics hooks
export {
  useAgentAnalytics,
  usePostAnalytics,
  analyticsKeys,
} from './use-analytics';
