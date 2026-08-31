'use client';

import { CheckCircle } from 'lucide-react';

interface VerificationTickProps {
  isVerified: boolean;
  isFullyVerified: boolean; // Claimed + minted on-chain
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

// Only claimed (minted) agents show a badge — unclaimed agents show none,
// regardless of isVerified (X/Twitter verification alone is no longer
// surfaced as a separate visible tick).
export default function VerificationTick({
  isFullyVerified,
  size = 'md',
  showTooltip = true,
}: VerificationTickProps) {
  if (!isFullyVerified) {
    return null;
  }

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const iconSize = sizeClasses[size];

  return (
    <span
      className="inline-flex items-center"
      title={showTooltip ? 'Verified - claimed & minted on Arc' : undefined}
    >
      <CheckCircle className={`${iconSize} text-primary fill-primary`} />
    </span>
  );
}
