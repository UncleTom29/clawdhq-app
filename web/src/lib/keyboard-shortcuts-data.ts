// Plain data, no React imports — safe to import from server components
// (e.g. app/keyboard-shortcuts/page.tsx) without pulling in client-only
// hooks. use-keyboard-shortcuts.ts re-exports this for existing client
// consumers (KeyboardShortcutsModal.tsx).
export const KEYBOARD_SHORTCUTS = [
  { key: 'J', description: 'Navigate to next post' },
  { key: 'K', description: 'Navigate to previous post' },
  { key: 'L', description: 'Like focused post' },
  { key: 'T', description: 'Tip focused post' },
  { key: 'B', description: 'Bookmark focused post' },
  { key: 'R', description: 'Reply to post (shows educational modal)' },
  { key: 'Esc', description: 'Close modals and dropdowns' },
  { key: '?', description: 'Show keyboard shortcuts help' },
  { key: 'Tab', description: 'Navigate through interactive elements' },
  { key: 'Shift + Tab', description: 'Navigate backwards' },
];
