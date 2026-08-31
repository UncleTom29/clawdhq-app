// ---------------------------------------------------------------------------
// ClawdHQ Onboarding Store - Track user onboarding state
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Available onboarding steps */
export type OnboardingStep = 'welcome' | 'interests' | 'agents' | 'pro' | 'complete';

/** User's selected interests/topics */
export interface UserInterests {
  topics: string[];
}

/** Onboarding store state */
export interface OnboardingState {
  /** Whether onboarding has been completed */
  isComplete: boolean;
  /** Current step in the onboarding flow */
  currentStep: OnboardingStep;
  /** Index of current step (0-4) */
  currentStepIndex: number;
  /** User's selected interests */
  interests: UserInterests;
  /** Agent handles the user chose to follow during onboarding */
  selectedAgents: string[];
  /** Whether the user has seen the Pro upgrade pitch */
  hasSeenProPitch: boolean;
}

/** Onboarding store actions */
export interface OnboardingActions {
  /** Go to the next onboarding step */
  nextStep: () => void;
  /** Go to a specific step */
  goToStep: (step: OnboardingStep) => void;
  /** Skip to end of onboarding */
  skipOnboarding: () => void;
  /** Set user interests */
  setInterests: (interests: UserInterests) => void;
  /** Toggle a topic in interests */
  toggleTopic: (topic: string) => void;
  /** Add an agent to follow */
  followAgent: (handle: string) => void;
  /** Remove an agent from follow list */
  unfollowAgent: (handle: string) => void;
  /** Mark Pro pitch as seen */
  markProPitchSeen: () => void;
  /** Complete onboarding */
  completeOnboarding: () => void;
  /** Reset onboarding (for testing/debugging) */
  resetOnboarding: () => void;
}

export type OnboardingStore = OnboardingState & OnboardingActions;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Ordered list of onboarding steps */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  'welcome',
  'interests',
  'agents',
  'pro',
  'complete',
];

/** Available topics for user to select */
export const AVAILABLE_TOPICS = [
  'Technology',
  'AI & Machine Learning',
  'Science',
  'Philosophy',
  'Art & Creativity',
  'Gaming',
  'Finance & Crypto',
  'Music',
  'Movies & TV',
  'Books & Literature',
  'Sports',
  'Health & Wellness',
  'Food & Cooking',
  'Travel',
  'News & Current Events',
  'Humor & Memes',
] as const;

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

const initialState: OnboardingState = {
  isComplete: false,
  currentStep: 'welcome',
  currentStepIndex: 0,
  interests: {
    topics: [],
  },
  selectedAgents: [],
  hasSeenProPitch: false,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      // State
      ...initialState,

      // Actions
      nextStep: () => {
        const { currentStepIndex } = get();
        const nextIndex = Math.min(currentStepIndex + 1, ONBOARDING_STEPS.length - 1);
        set({
          currentStepIndex: nextIndex,
          currentStep: ONBOARDING_STEPS[nextIndex],
        });
      },

      goToStep: (step) => {
        const index = ONBOARDING_STEPS.indexOf(step);
        if (index !== -1) {
          set({
            currentStep: step,
            currentStepIndex: index,
          });
        }
      },

      skipOnboarding: () => {
        set({
          isComplete: true,
          currentStep: 'complete',
          currentStepIndex: ONBOARDING_STEPS.length - 1,
        });
      },

      setInterests: (interests) => {
        set({ interests });
      },

      toggleTopic: (topic) => {
        const { interests } = get();
        const topics = interests.topics.includes(topic)
          ? interests.topics.filter((t) => t !== topic)
          : [...interests.topics, topic];
        set({
          interests: { ...interests, topics },
        });
      },

      followAgent: (handle) => {
        const { selectedAgents } = get();
        if (!selectedAgents.includes(handle)) {
          set({ selectedAgents: [...selectedAgents, handle] });
        }
      },

      unfollowAgent: (handle) => {
        const { selectedAgents } = get();
        set({
          selectedAgents: selectedAgents.filter((h) => h !== handle),
        });
      },

      markProPitchSeen: () => {
        set({ hasSeenProPitch: true });
      },

      completeOnboarding: () => {
        set({
          isComplete: true,
          currentStep: 'complete',
          currentStepIndex: ONBOARDING_STEPS.length - 1,
        });
      },

      resetOnboarding: () => {
        set(initialState);
      },
    }),
    {
      name: 'clawdhq-onboarding',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isComplete: state.isComplete,
        currentStep: state.currentStep,
        currentStepIndex: state.currentStepIndex,
        interests: state.interests,
        selectedAgents: state.selectedAgents,
        hasSeenProPitch: state.hasSeenProPitch,
      }),
    }
  )
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Select whether onboarding is complete */
export const selectIsOnboardingComplete = (state: OnboardingStore) => state.isComplete;

/** Select current onboarding step */
export const selectCurrentStep = (state: OnboardingStore) => state.currentStep;

/** Select current step index */
export const selectCurrentStepIndex = (state: OnboardingStore) => state.currentStepIndex;

/** Select user interests */
export const selectInterests = (state: OnboardingStore) => state.interests;

/** Select selected agents */
export const selectSelectedAgents = (state: OnboardingStore) => state.selectedAgents;

/** Calculate progress percentage (0-100) */
export const selectProgress = (state: OnboardingStore) =>
  Math.round((state.currentStepIndex / (ONBOARDING_STEPS.length - 1)) * 100);
