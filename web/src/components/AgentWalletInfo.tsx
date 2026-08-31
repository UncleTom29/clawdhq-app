'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink, Wallet } from 'lucide-react';
import { ARCSCAN_ADDRESS_URL } from '@/contracts/addresses';

interface AgentWalletInfoProps {
  ownerWallet: string | null;
  payoutWallet: string | null;
}

export default function AgentWalletInfo({ ownerWallet, payoutWallet }: AgentWalletInfoProps) {
  const [copiedOwner, setCopiedOwner] = useState(false);
  const [copiedPayout, setCopiedPayout] = useState(false);

  const copyToClipboard = async (text: string, type: 'owner' | 'payout') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'owner') {
        setCopiedOwner(true);
        setTimeout(() => setCopiedOwner(false), 2000);
      } else {
        setCopiedPayout(true);
        setTimeout(() => setCopiedPayout(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getArcscanUrl = (address: string) => {
    return `${ARCSCAN_ADDRESS_URL}/${address}`;
  };

  if (!ownerWallet && !payoutWallet) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-background-secondary p-4">
      <div className="mb-3 flex items-center gap-2">
        <Wallet className="h-5 w-5 text-text-secondary" />
        <h3 className="font-semibold text-text-primary">Wallet Information</h3>
      </div>

      <div className="space-y-3">
        {ownerWallet && (
          <div>
            <label className="mb-1 block text-xs font-medium text-text-tertiary">
              Owner Wallet
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-background-primary px-3 py-2 text-sm text-text-secondary">
                {formatAddress(ownerWallet)}
              </code>
              <button
                onClick={() => copyToClipboard(ownerWallet, 'owner')}
                className="btn-icon"
                title="Copy address"
              >
                {copiedOwner ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
              <a
                href={getArcscanUrl(ownerWallet)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-icon"
                title="View on Arcscan"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}

        {payoutWallet && (
          <div>
            <label className="mb-1 block text-xs font-medium text-text-tertiary">
              Payout Wallet
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-background-primary px-3 py-2 text-sm text-text-secondary">
                {formatAddress(payoutWallet)}
              </code>
              <button
                onClick={() => copyToClipboard(payoutWallet, 'payout')}
                className="btn-icon"
                title="Copy address"
              >
                {copiedPayout ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
              <a
                href={getArcscanUrl(payoutWallet)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-icon"
                title="View on Arcscan"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}

        {payoutWallet && (
          <p className="text-xs text-text-tertiary">
            💡 Tips are sent to the payout wallet (80% split for minted agents)
          </p>
        )}
      </div>
    </div>
  );
}
