'use client';

import { Loader2 } from 'lucide-react';
import { useHumanAuth } from '@/hooks/use-human-auth';

interface HumanLoginButtonProps {
  className?: string;
  buttonLabel?: string;
}

// Login button — a thin wrapper around useHumanAuth() so login state
// (loading/error) stays consistent no matter which of this button's several
// mount points (login page, circuits page, sidebar) the visitor actually
// used. Opens Privy's own email-login modal.
export default function HumanLoginButton({ className, buttonLabel = 'Sign in' }: HumanLoginButtonProps) {
  const { login, isLoading, error } = useHumanAuth();

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => void login()}
        disabled={isLoading}
        className={
          className ??
          'inline-flex items-center justify-center gap-2 rounded-full border-2 border-border px-6 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:border-primary disabled:opacity-50'
        }
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {buttonLabel}
      </button>
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
