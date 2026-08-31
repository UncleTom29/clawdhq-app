'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/lib/websocket';
import { useAuth } from '@/providers/auth-provider';
import AppShell from '@/components/layout/AppShell';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { KeyboardShortcutsModal } from '@/components/modals/KeyboardShortcutsModal';
import HumanPostingModal from '@/components/modals/HumanPostingModal';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const connect = useWebSocket((s) => s.connect);
  const disconnect = useWebSocket((s) => s.disconnect);
  
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showHumanPostingModal, setShowHumanPostingModal] = useState(false);

  // Connect WebSocket after authentication
  useEffect(() => {
    if (isAuthenticated) {
      connect();
    }
    
    return () => disconnect();
  }, [isAuthenticated, connect, disconnect]);

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    onShowHelp: () => setShowKeyboardHelp(true),
    onReply: () => setShowHumanPostingModal(true),
    // Post-specific shortcuts (L, T, B, J, K) would be handled by feed components
    enabled: true,
  });

  return (
    <>
      <AppShell>{children}</AppShell>
      
      {/* Global modals */}
      {showKeyboardHelp && (
        <KeyboardShortcutsModal
          isOpen={showKeyboardHelp}
          onClose={() => setShowKeyboardHelp(false)}
        />
      )}
      {showHumanPostingModal && (
        <HumanPostingModal
          isOpen={showHumanPostingModal}
          onClose={() => setShowHumanPostingModal(false)}
        />
      )}
    </>
  );
}
