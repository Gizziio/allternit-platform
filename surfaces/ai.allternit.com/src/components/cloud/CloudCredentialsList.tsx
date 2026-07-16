/**
 * CloudCredentialsList - BYOC cloud account list.
 *
 * Mirrors SSHConnectionsList.tsx's structure and polish exactly (expandable
 * rows, status dot + badge, three-dot action menu, dashed "add" button at
 * the bottom, rich empty state with a quick-start card) -- VPS connections
 * are this codebase's existing "bring your own server" pattern, the closest
 * real precedent for "bring your own cloud account."
 */

'use client';

import React, { useState } from 'react';
import {
  Cloud,
  CheckCircle,
  XCircle,
  Clock,
  Trash,
  CaretRight,
  Warning,
  DotsThreeVertical,
  Plus,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { CloudCredential, CloudProvider } from '@/lib/design/cloud-credentials';

const PROVIDER_LABEL: Record<CloudProvider, string> = {
  aws: 'AWS',
  gcp: 'Google Cloud',
  azure: 'Azure',
};

export interface CloudCredentialsListProps {
  credentials: CloudCredential[];
  onAddCredential: () => void;
  onRevokeCredential: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export function CloudCredentialsList({
  credentials,
  onAddCredential,
  onRevokeCredential,
  isLoading = false,
}: CloudCredentialsListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleToggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setActionMenuId(null);
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    setActionMenuId(null);
    try {
      await onRevokeCredential(id);
    } finally {
      setRevokingId(null);
    }
  };

  const getStatusIcon = (status: CloudCredential['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle size={16} className="text-[var(--status-success)]" />;
      case 'revoked':
        return <XCircle size={16} className="text-[var(--ui-text-secondary)]" />;
      case 'error':
        return <Warning size={16} className="text-[var(--status-error)]" />;
      default:
        return <Clock size={16} className="text-[var(--status-warning)]" />;
    }
  };

  const getStatusColorClass = (status: CloudCredential['status']) => {
    switch (status) {
      case 'active':
        return 'bg-[var(--status-success)]';
      case 'revoked':
        return 'bg-[var(--ui-text-muted)]';
      case 'error':
        return 'bg-[var(--status-error)]';
      default:
        return 'bg-[var(--status-warning)]';
    }
  };

  const getStatusText = (status: CloudCredential['status']) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'revoked':
        return 'Revoked';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--surface-hover)]">
          <div className="size-3 rounded-full animate-pulse bg-[var(--accent-primary)]/30" />
          <div className="size-10 rounded-lg animate-pulse bg-[var(--surface-hover)]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded animate-pulse bg-[var(--surface-active)]" />
            <div className="h-3 w-48 rounded animate-pulse bg-[var(--surface-hover)]" />
          </div>
          <div className="h-6 w-20 rounded-full animate-pulse bg-[var(--surface-hover)]" />
        </div>
        {[1, 2].map((i) => (
          <div key={`cloud-cred-skeleton-${i}`} className="flex items-center gap-4 p-4 rounded-xl bg-[var(--surface-hover)]">
            <div className="size-3 rounded-full animate-pulse bg-[var(--surface-hover)]" />
            <div className="size-10 rounded-lg animate-pulse bg-[var(--surface-hover)]" />
            <div className="flex-1 space-y-2">
              <div className="size-40 rounded animate-pulse bg-[var(--surface-active)]" />
              <div className="h-3 w-56 rounded animate-pulse bg-[var(--surface-hover)]" />
            </div>
            <div className="h-6 w-24 rounded-full animate-pulse bg-[var(--surface-hover)]" />
          </div>
        ))}
      </div>
    );
  }

  if (credentials.length === 0) {
    return <EmptyState onAddCredential={onAddCredential} />;
  }

  return (
    <div className="space-y-3">
      {credentials.map((credential) => (
        <div
          key={credential.id}
          className={cn(
            'rounded-xl border border-solid transition-all duration-200',
            expandedId === credential.id
              ? 'bg-[var(--surface-panel)] border-[var(--accent-primary)]/30'
              : 'bg-[var(--surface-hover)] border-[var(--ui-border-muted)]',
          )}
        >
          {/* Main Row */}
          <div
            role="button"
            tabIndex={0}
            className="flex items-center gap-4 p-4 cursor-pointer outline-none"
            onClick={() => handleToggleExpand(credential.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleToggleExpand(credential.id); }}
          >
            <div className="shrink-0">
              <div className={cn('size-3 rounded-full transition-colors', getStatusColorClass(credential.status))} />
            </div>

            <div className="shrink-0 size-10 rounded-lg flex items-center justify-center bg-[var(--surface-panel)]">
              <Cloud size={20} className="text-[var(--ui-text-secondary)]" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-[var(--ui-text-primary)] truncate m-0">{credential.label}</h4>
                {getStatusIcon(credential.status)}
              </div>
              <p className="text-sm truncate m-0 text-[var(--ui-text-secondary)]">
                {PROVIDER_LABEL[credential.provider]}{credential.region ? ` · ${credential.region}` : ''}
              </p>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <span
                className={cn(
                  'px-2 py-1 rounded-full text-xs font-medium',
                  credential.status === 'active' ? 'bg-[var(--status-success)]/20 text-[var(--status-success)]' :
                  credential.status === 'revoked' ? 'bg-[var(--surface-hover)] text-[var(--ui-text-muted)]' :
                  'bg-[var(--status-error-bg)] text-[var(--status-error)]',
                )}
              >
                {getStatusText(credential.status)}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActionMenuId(actionMenuId === credential.id ? null : credential.id);
                  }}
                  className="p-2 rounded-lg transition-colors border-none bg-transparent cursor-pointer text-[var(--ui-text-secondary)] hover:bg-[var(--surface-panel)]"
                >
                  <DotsThreeVertical size={16} />
                </button>

                {actionMenuId === credential.id && (
                  <>
                    <div
                      role="button"
                      tabIndex={0}
                      className="fixed inset-0 z-10"
                      onClick={() => setActionMenuId(null)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActionMenuId(null); }}
                    />
                    <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-floating)] backdrop-blur-md shadow-lg z-20 overflow-hidden">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRevoke(credential.id);
                        }}
                        disabled={revokingId === credential.id || credential.status !== 'active'}
                        className="w-full px-4 py-2 text-sm text-left transition-colors flex items-center gap-2 border-none bg-transparent cursor-pointer text-[var(--status-error)] hover:bg-[var(--status-error-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash size={16} />
                        Revoke
                      </button>
                    </div>
                  </>
                )}
              </div>

              <CaretRight
                className={cn('size-5 transition-transform text-[var(--ui-text-secondary)]', expandedId === credential.id ? 'rotate-90' : 'rotate-0')}
              />
            </div>
          </div>

          {/* Expanded Details */}
          {expandedId === credential.id && (
            <div className="px-4 pb-4 pt-0">
              <div className="border-l border-solid border-[var(--ui-border-muted)] ml-7 pl-4 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--ui-text-secondary)]">Provider:</span>
                    <span className="ml-2 font-mono text-[var(--ui-text-primary)]">{PROVIDER_LABEL[credential.provider]}</span>
                  </div>
                  {credential.region && (
                    <div>
                      <span className="text-[var(--ui-text-secondary)]">Region:</span>
                      <span className="ml-2 font-mono text-[var(--ui-text-primary)]">{credential.region}</span>
                    </div>
                  )}
                  {credential.external_id && (
                    <div>
                      <span className="text-[var(--ui-text-secondary)]">External ID:</span>
                      <span className="ml-2 font-mono text-[var(--ui-text-primary)]">{credential.external_id}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[var(--ui-text-secondary)]">Connected:</span>
                    <span className="ml-2 text-[var(--ui-text-primary)]">{new Date(credential.created_at).toLocaleString()}</span>
                  </div>
                  {credential.last_validated_at && (
                    <div>
                      <span className="text-[var(--ui-text-secondary)]">Last validated:</span>
                      <span className="ml-2 text-[var(--ui-text-primary)]">{new Date(credential.last_validated_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {credential.status !== 'active' && (
                  <div className="p-3 rounded-lg border border-solid bg-[var(--status-error-bg)] border-red-500/30">
                    <div className="flex items-start gap-2">
                      <Warning className="size-4 shrink-0 mt-0.5 text-[var(--status-error)]" />
                      <p className="text-sm m-0 text-[var(--status-error)]">
                        This account is {credential.status}. Sandboxes can no longer provision into it.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add Credential Button */}
      <button
        type="button"
        onClick={onAddCredential}
        className="w-full p-4 rounded-xl border border-dashed border-[var(--ui-border-muted)] bg-transparent text-[var(--ui-text-secondary)] transition-all flex items-center justify-center gap-2 cursor-pointer hover:border-[var(--accent-primary)]/50 hover:bg-[var(--surface-hover)] hover:text-[var(--ui-text-primary)]"
      >
        <Plus size={20} />
        <span className="font-medium">Connect Cloud Account</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────────────────────────────────

function EmptyState({ onAddCredential }: { onAddCredential: () => void }) {
  return (
    <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-[var(--ui-border-default)] bg-gradient-to-b from-black/20 to-[var(--surface-hover)]">
      <div className="size-20 rounded-2xl flex items-center justify-center mx-auto mb-6 relative bg-[var(--accent-primary)]/10 border border-solid border-[var(--accent-primary)]/20">
        <div className="absolute inset-0 rounded-2xl blur-xl opacity-30 bg-[var(--accent-primary)]/40" />
        <Cloud size={36} className="text-[var(--accent-primary)] relative" weight="duotone" />
      </div>

      <h3 className="text-xl font-semibold text-[var(--ui-text-primary)] mb-3">No Cloud Accounts Connected</h3>
      <p className="text-sm mb-8 max-w-md mx-auto leading-relaxed text-[var(--ui-text-secondary)]">
        Connect your own AWS, Google Cloud, or Azure account so Tier-3 sandboxes provision
        into your cloud instead of allternit's. Your provider bills you directly for compute.
      </p>

      <button
        type="button"
        onClick={onAddCredential}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold border-none cursor-pointer transition-all bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] shadow-[0_4px_14px_rgba(212,176,140,0.3)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(212,176,140,0.4)]"
      >
        <Plus size={20} weight="bold" />
        Connect Your First Account
      </button>

      <div className="mt-10 p-5 rounded-xl text-left max-w-md mx-auto bg-[var(--surface-panel)] border border-solid border-[var(--ui-border-muted)]">
        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[var(--ui-text-primary)]">
          <div className="size-6 rounded-lg flex items-center justify-center bg-[var(--status-info-bg)]">
            <Warning size={14} className="text-[var(--status-info)]" weight="fill" />
          </div>
          How BYOC works
        </h4>
        <div className="space-y-3">
          {[
            'Grant allternit a scoped role (AWS) or service account (GCP/Azure)',
            'We test the connection live before saving anything',
            'Sandboxes provision directly into your account, billed by your provider',
            'Revoke access anytime -- nothing runs without an active connection',
          ].map((step, i) => (
            <div key={`byoc-step-${i}`} className="flex items-start gap-3">
              <span className="size-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                {i + 1}
              </span>
              <span className="text-sm text-[var(--ui-text-secondary)]">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CloudCredentialsList;
