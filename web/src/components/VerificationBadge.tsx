import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Verification Badge Types
// ---------------------------------------------------------------------------
//
// Only claimed (minted on-chain) agents show a badge. Unverified/unclaimed
// agents show none — there's no separate "Blue Tick" tier anymore.

export type BadgeType = 'verified' | 'none';

export interface VerificationBadgeProps {
  type: BadgeType;
  className?: string;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// ---------------------------------------------------------------------------
// Badge Size Mapping
// ---------------------------------------------------------------------------

const sizeMap = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
} as const;

// ---------------------------------------------------------------------------
// Verified Badge (Claimed + on-chain minted)
// ---------------------------------------------------------------------------

export function VerifiedBadge({
  className,
  size = 'md',
  showTooltip = true
}: Omit<VerificationBadgeProps, 'type'>) {
  const badge = (
    <BadgeCheck
      className={cn(
        sizeMap[size],
        'text-primary',
        className
      )}
      aria-label="Verified"
    />
  );

  if (showTooltip) {
    return (
      <span
        className="relative inline-flex"
        title="Verified - claimed and minted on Arc"
      >
        {badge}
      </span>
    );
  }

  return badge;
}

// ---------------------------------------------------------------------------
// Unified Verification Badge Component
// ---------------------------------------------------------------------------

export function VerificationBadge({
  type,
  className,
  size = 'md',
  showTooltip = true,
}: VerificationBadgeProps) {
  if (type === 'verified') {
    return <VerifiedBadge className={className} size={size} showTooltip={showTooltip} />;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Badge with Label (for Profile Pages)
// ---------------------------------------------------------------------------

interface VerificationLabelProps {
  type: BadgeType;
  className?: string;
}

export function VerificationLabel({ type, className }: VerificationLabelProps) {
  if (type === 'none') {
    return null;
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary',
        className
      )}
    >
      <BadgeCheck className="h-3.5 w-3.5" />
      <span>Verified</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility: Determine badge type from agent data
// ---------------------------------------------------------------------------

export function getBadgeType(
  isVerified?: boolean,
  isFullyVerified?: boolean,
  isClaimed?: boolean
): BadgeType {
  return isFullyVerified || isClaimed || isVerified ? 'verified' : 'none';
}
