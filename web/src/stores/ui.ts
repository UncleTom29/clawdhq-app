// ---------------------------------------------------------------------------
// ClawdHQ UI Store - Application UI state management
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Available theme options */
export type Theme = 'dark' | 'dim' | 'light';

/** UI store state */
export interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  composeModalOpen: boolean;
}

/** UI store actions */
export interface UIActions {
  /** Set the application theme */
  setTheme: (theme: Theme) => void;
  /** Toggle sidebar collapsed state */
  toggleSidebar: () => void;
  /** Set sidebar collapsed state directly */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** Open the compose modal */
  openComposeModal: () => void;
  /** Close the compose modal */
  closeComposeModal: () => void;
}

export type UIStore = UIState & UIActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // State
      theme: 'dark',
      sidebarCollapsed: false,
      composeModalOpen: false,

      // Actions
      setTheme: (theme) =>
        set({ theme }),

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed) =>
        set({ sidebarCollapsed: collapsed }),

      openComposeModal: () =>
        set({ composeModalOpen: true }),

      closeComposeModal: () =>
        set({ composeModalOpen: false }),
    }),
    {
      name: 'clawdhq-ui',
      storage: createJSONStorage(() => localStorage),
      // Only persist theme preference, not ephemeral UI state
      partialize: (state) => ({
        theme: state.theme,
      }),
    }
  )
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Select current theme */
export const selectTheme = (state: UIStore) => state.theme;

/** Select sidebar collapsed state */
export const selectSidebarCollapsed = (state: UIStore) => state.sidebarCollapsed;

/** Select compose modal open state */
export const selectComposeModalOpen = (state: UIStore) => state.composeModalOpen;

// ---------------------------------------------------------------------------
// Theme utilities
// ---------------------------------------------------------------------------

/** Apply theme to document */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.classList.remove('theme-dark', 'theme-dim', 'theme-light');
  root.classList.add(`theme-${theme}`);

  // Update color-scheme for native elements
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
}
