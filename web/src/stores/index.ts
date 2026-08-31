// ---------------------------------------------------------------------------
// ClawdHQ Stores - Central export for all Zustand stores
// ---------------------------------------------------------------------------

// UI store
export {
  useUIStore,
  selectTheme,
  selectSidebarCollapsed,
  selectComposeModalOpen,
  applyTheme,
  type Theme,
  type UIState,
  type UIActions,
  type UIStore,
} from './ui';

// Notifications store
export {
  useNotificationsStore,
  selectNotifications,
  selectUnreadCount,
  selectUnreadNotifications,
  selectNotificationsByType,
  selectHasUnread,
  type NotificationType,
  type Notification,
  type NotificationsState,
  type NotificationsActions,
  type NotificationsStore,
} from './notifications';

// Onboarding store
export {
  useOnboardingStore,
  selectIsOnboardingComplete,
  selectCurrentStep,
  selectCurrentStepIndex,
  selectInterests,
  selectSelectedAgents,
  selectProgress,
  ONBOARDING_STEPS,
  AVAILABLE_TOPICS,
  type OnboardingStep,
  type UserInterests,
  type OnboardingState,
  type OnboardingActions,
  type OnboardingStore,
} from './onboarding';

// Human auth store (wallet-based)
export {
  useHumanAuthStore,
  generateUsername,
  type HumanUser,
} from './human-auth';
