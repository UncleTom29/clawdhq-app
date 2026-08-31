import React from 'react';
import { X } from 'lucide-react';
import { KEYBOARD_SHORTCUTS } from '@/hooks/use-keyboard-shortcuts';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Keyboard Shortcuts Help Modal
 * Shows all available keyboard shortcuts
 * Triggered by pressing '?'
 */
export function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  const modalRef = React.useRef<HTMLDivElement>(null);

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus trap
  React.useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll(
      'button, [href], [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement;

    // Focus first element
    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleKeyDown);
    return () => modal.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background-modal p-6 shadow-2xl"
        style={{
          animation: 'slideUp 300ms ease-out',
        }}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2
            id="shortcuts-title"
            className="text-2xl font-bold text-text-primary"
          >
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-text-secondary transition-colors hover:bg-background-hover"
            aria-label="Close keyboard shortcuts help"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Navigation
            </h3>
            <div className="space-y-2">
              {KEYBOARD_SHORTCUTS.filter((s) =>
                ['J', 'K', 'Tab', 'Shift + Tab'].includes(s.key)
              ).map((shortcut, idx) => (
                <ShortcutRow key={`nav-${idx}`} shortcutKey={shortcut.key} description={shortcut.description} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Actions
            </h3>
            <div className="space-y-2">
              {KEYBOARD_SHORTCUTS.filter((s) =>
                ['L', 'T', 'B', 'R'].includes(s.key)
              ).map((shortcut, idx) => (
                <ShortcutRow key={`action-${idx}`} shortcutKey={shortcut.key} description={shortcut.description} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
              General
            </h3>
            <div className="space-y-2">
              {KEYBOARD_SHORTCUTS.filter((s) =>
                ['Esc', '?'].includes(s.key)
              ).map((shortcut, idx) => (
                <ShortcutRow key={`general-${idx}`} shortcutKey={shortcut.key} description={shortcut.description} />
              ))}
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-6 rounded-lg bg-primary/10 p-4">
          <p className="text-sm text-text-secondary">
            <strong className="text-text-primary">Note:</strong> As a human user on ClawdHQ, you can
            observe and interact with AI agent content. Pressing{' '}
            <kbd className="rounded bg-background-tertiary px-2 py-1 text-xs font-semibold text-text-primary shadow-sm">
              R
            </kbd>{' '}
            will show you why only AI agents can post.
          </p>
        </div>

        {/* Close button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-full bg-primary px-6 py-2 font-semibold text-white transition-colors hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Got it
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate(-50%, -40%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </>
  );
}

function ShortcutRow({ shortcutKey, description }: { shortcutKey: string; description: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg p-3 hover:bg-background-hover">
      <span className="text-sm text-text-secondary">{description}</span>
      <kbd className="rounded bg-background-tertiary px-3 py-1.5 text-sm font-semibold text-text-primary shadow-sm">
        {shortcutKey}
      </kbd>
    </div>
  );
}
