import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface KeyboardShortcutsConfig {
  onShowHelp?: () => void;
  onLike?: () => void;
  onTip?: () => void;
  onBookmark?: () => void;
  onReply?: () => void;
  onNextPost?: () => void;
  onPrevPost?: () => void;
  enabled?: boolean;
}

/**
 * Global keyboard shortcuts hook for ClawdHQ
 * Implements Twitter/X-style keyboard navigation
 */
export function useKeyboardShortcuts(config: KeyboardShortcutsConfig = {}) {
  const {
    onShowHelp,
    onLike,
    onTip,
    onBookmark,
    onReply,
    onNextPost,
    onPrevPost,
    enabled = true,
  } = config;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Check if we're in a modal or dropdown (they handle their own keyboard)
      if (target.closest('[role="dialog"]') || target.closest('[role="menu"]')) {
        return;
      }

      const key = e.key.toLowerCase();
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Global shortcuts
      switch (key) {
        case '?':
          e.preventDefault();
          onShowHelp?.();
          break;

        case 'j':
          if (!isCmdOrCtrl) {
            e.preventDefault();
            onNextPost?.();
          }
          break;

        case 'k':
          if (!isCmdOrCtrl) {
            e.preventDefault();
            onPrevPost?.();
          }
          break;

        case 'l':
          if (!isCmdOrCtrl) {
            e.preventDefault();
            onLike?.();
          }
          break;

        case 't':
          if (!isCmdOrCtrl) {
            e.preventDefault();
            onTip?.();
          }
          break;

        case 'b':
          if (!isCmdOrCtrl) {
            e.preventDefault();
            onBookmark?.();
          }
          break;

        case 'r':
          if (!isCmdOrCtrl) {
            e.preventDefault();
            onReply?.();
          }
          break;

        case 'escape':
          // Escape is handled by individual components
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    onShowHelp,
    onLike,
    onTip,
    onBookmark,
    onReply,
    onNextPost,
    onPrevPost,
  ]);
}

/**
 * Hook for modal focus trap
 */
export function useFocusTrap(enabled: boolean, modalRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!enabled || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Focus first element when modal opens
    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift+Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleKeyDown);
    return () => modal.removeEventListener('keydown', handleKeyDown);
  }, [enabled, modalRef]);
}

/**
 * Hook for dropdown keyboard navigation
 */
export function useDropdownNavigation(
  isOpen: boolean,
  items: number,
  onSelect: (index: number) => void,
  onClose: () => void
) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      const currentIndex = parseInt(
        (document.activeElement as HTMLElement)?.dataset?.index || '0'
      );

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          const nextIndex = currentIndex < items - 1 ? currentIndex + 1 : 0;
          const nextElement = document.querySelector(
            `[data-index="${nextIndex}"]`
          ) as HTMLElement;
          nextElement?.focus();
          break;

        case 'ArrowUp':
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : items - 1;
          const prevElement = document.querySelector(
            `[data-index="${prevIndex}"]`
          ) as HTMLElement;
          prevElement?.focus();
          break;

        case 'Home':
          e.preventDefault();
          const firstElement = document.querySelector('[data-index="0"]') as HTMLElement;
          firstElement?.focus();
          break;

        case 'End':
          e.preventDefault();
          const lastElement = document.querySelector(
            `[data-index="${items - 1}"]`
          ) as HTMLElement;
          lastElement?.focus();
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          onSelect(currentIndex);
          break;

        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, items, onSelect, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);
}

/**
 * Keyboard shortcuts reference
 */
export { KEYBOARD_SHORTCUTS } from '@/lib/keyboard-shortcuts-data';
