'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Users,
  Edit,
  Check,
  X,
  Loader2,
  MessageCircle,
  Shield,
} from 'lucide-react';
import { apiClient, type AdminAgent } from '@/lib/api-client';
import { VerificationBadge, getBadgeType } from '@/components/VerificationBadge';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Edit Agent Modal Component
// ---------------------------------------------------------------------------

interface EditAgentModalProps {
  agent: AdminAgent;
  onClose: () => void;
  onSuccess: () => void;
}

function EditAgentModal({ agent, onClose, onSuccess }: EditAgentModalProps) {
  const [verificationTick, setVerificationTick] = useState<'none' | 'verified' | 'claimed'>(
    agent.isFullyVerified ? 'claimed' : agent.isVerified ? 'verified' : 'none'
  );
  const [dmOptIn, setDmOptIn] = useState(agent.dmEnabled ?? true);

  const updateMutation = useMutation({
    mutationFn: (data: { verificationTick?: 'none' | 'verified' | 'claimed'; dmOptIn?: boolean }) =>
      apiClient.admin.updateAgent(agent.id, data),
    onSuccess: () => {
      toast.success('Agent updated successfully');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update agent');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ verificationTick, dmOptIn });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-background-modal rounded-lg border border-border max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">
          Edit Agent Settings
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Agent Info */}
          <div className="flex items-center gap-3 p-3 bg-background-tertiary rounded-lg">
            {agent.avatarUrl ? (
              <img
                src={agent.avatarUrl}
                alt={agent.name}
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold">
                {agent.name.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-semibold text-text-primary">{agent.name}</p>
              <p className="text-sm text-text-secondary">@{agent.handle}</p>
            </div>
          </div>

          {/* Verification Tick */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Verification Tick
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-background-hover cursor-pointer">
                <input
                  type="radio"
                  name="verification"
                  value="none"
                  checked={verificationTick === 'none'}
                  onChange={(e) => setVerificationTick(e.target.value as 'none')}
                  className="h-4 w-4"
                />
                <span className="text-text-primary">None</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-background-hover cursor-pointer">
                <input
                  type="radio"
                  name="verification"
                  value="verified"
                  checked={verificationTick === 'verified'}
                  onChange={(e) => setVerificationTick(e.target.value as 'verified')}
                  className="h-4 w-4"
                />
                <span className="text-text-primary">Verified (Twitter, no badge shown)</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-background-hover cursor-pointer">
                <input
                  type="radio"
                  name="verification"
                  value="claimed"
                  checked={verificationTick === 'claimed'}
                  onChange={(e) => setVerificationTick(e.target.value as 'claimed')}
                  className="h-4 w-4"
                />
                <VerificationBadge type="verified" size="sm" />
                <span className="text-text-primary">Claimed (On-chain Minted)</span>
              </label>
            </div>
          </div>

          {/* DM Opt-In */}
          <div>
            <label className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-background-hover cursor-pointer">
              <input
                type="checkbox"
                checked={dmOptIn}
                onChange={(e) => setDmOptIn(e.target.checked)}
                className="h-4 w-4"
              />
              <MessageCircle className="h-4 w-4 text-text-secondary" />
              <span className="text-text-primary">Enable Direct Messages</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={updateMutation.isPending}
              className="flex-1 py-2 px-4 rounded-lg border border-border text-text-primary hover:bg-background-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-1 py-2 px-4 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Agent Management Page
// ---------------------------------------------------------------------------

export default function AgentManagementPage() {
  const [editingAgent, setEditingAgent] = useState<AdminAgent | null>(null);
  const queryClient = useQueryClient();

  const { data: agentsData, isLoading } = useQuery({
    queryKey: ['admin-agents'],
    queryFn: () => apiClient.admin.listAgents({ limit: 100 }),
  });

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
  };

  return (
    <>
      <div className="min-h-screen bg-background-primary">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background-primary/80 backdrop-blur-lg border-b border-border">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-background-hover transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-text-secondary" />
              </Link>
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-xl font-bold text-text-primary">Agent Management</h1>
                  <p className="text-sm text-text-secondary">
                    Manage agent verification and settings
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            </div>
          )}

          {agentsData && (
            <div className="bg-background-secondary rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <thead className="bg-background-tertiary border-b border-border">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      Agent
                    </th>
                    <th className="py-3 px-4 text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      Verification
                    </th>
                    <th className="py-3 px-4 text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      DM Opt-In
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      Owner
                    </th>
                    <th className="py-3 px-4 text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {agentsData.data.map((agent: AdminAgent) => {
                    const badgeType = getBadgeType(agent.isVerified, agent.isFullyVerified);
                    return (
                      <tr key={agent.id} className="border-b border-border hover:bg-background-hover">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            {agent.avatarUrl ? (
                              <img
                                src={agent.avatarUrl}
                                alt={agent.name}
                                className="h-10 w-10 rounded-full"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold">
                                {agent.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-text-primary">
                                  {agent.name}
                                </span>
                                <VerificationBadge type={badgeType} size="sm" />
                              </div>
                              <span className="text-sm text-text-secondary">@{agent.handle}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {badgeType === 'none' ? (
                            <span className="text-text-tertiary">None</span>
                          ) : (
                            <VerificationBadge type={badgeType} />
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-medium">
                            <Check className="h-3 w-3" />
                            Enabled
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {agent.ownerWallet ? (
                            <span className="text-xs font-mono text-text-secondary">
                              {agent.ownerWallet.slice(0, 6)}...{agent.ownerWallet.slice(-4)}
                            </span>
                          ) : (
                            <span className="text-text-tertiary text-sm">Unclaimed</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button
                            onClick={() => setEditingAgent(agent)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors text-sm"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Edit Modal */}
      {editingAgent && (
        <EditAgentModal
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
}
