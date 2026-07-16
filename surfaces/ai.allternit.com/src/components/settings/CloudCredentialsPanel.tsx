/**
 * CloudCredentialsPanel - BYOC (Bring Your Own Cloud) credential management.
 *
 * Enterprise customers connect their own AWS/GCP/Azure account here so ACU
 * sandboxes provision into the customer's cloud instead of allternit's.
 * Structured exactly like VPSConnectionsPanel.tsx -- this codebase's existing
 * "bring your own server" pattern and the closest real precedent for "bring
 * your own cloud account": a thin container (state + handlers) composing a
 * dedicated list component and a dedicated add-credential modal, an intro
 * card, and an action bar, rather than one large file mixing everything.
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowClockwise, Plus, Warning } from '@phosphor-icons/react';
import { STATUS, TEXT } from '@/design/allternit.tokens';
import { SectionHeading } from '@/components/settings/SectionHeading';
import { QUIET_BUTTON_CLASS } from '@/components/settings/buttonStyles';
import { CloudCredentialsList, AddCloudCredentialForm } from '@/components/cloud';
import {
  listCloudCredentials,
  createCloudCredential,
  revokeCloudCredential,
  type CloudCredential,
  type CreateCloudCredentialInput,
} from '@/lib/design/cloud-credentials';

export function CloudCredentialsPanel() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [credentials, setCredentials] = useState<CloudCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCredentials = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await listCloudCredentials();
      setCredentials(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cloud credentials');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  const handleConnect = useCallback(async (input: CreateCloudCredentialInput) => {
    await createCloudCredential(input);
    await loadCredentials();
  }, [loadCredentials]);

  const handleRevoke = useCallback(async (id: string) => {
    try {
      await revokeCloudCredential(id);
      setCredentials((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'revoked' as const } : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke credential');
    }
  }, []);

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header Card */}
      <div
        style={{
          marginBottom: '24px',
          padding: '24px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(37,37,37,0.6) 0%, rgba(37,37,37,0.3) 100%)',
          border: '1px solid var(--ui-border-muted)',
        }}
      >
        <SectionHeading className="mb-2">Cloud credentials</SectionHeading>
        <p style={{
          fontSize: '14px',
          color: TEXT.secondary,
          margin: 0,
          lineHeight: '1.5',
        }}>
          Connect your own AWS, Google Cloud, or Azure account so Tier-3 sandboxes provision
          into your cloud instead of allternit's. Your provider bills you directly for compute;
          allternit charges a platform fee on top.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div
          style={{
            marginBottom: '20px',
            padding: '14px 18px',
            borderRadius: '10px',
            background: 'var(--status-error-bg)',
            border: '1px solid rgba(239,68,68,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: STATUS.error,
            fontSize: '13px',
          }}
        >
          <Warning size={18} weight="fill" />
          <span style={{ flex: 1 }}>{error}</span>
          <button type="button" onClick={() => setError(null)} className={QUIET_BUTTON_CLASS}>
            Dismiss
          </button>
        </div>
      )}

      {/* Action Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px',
          padding: '16px 20px',
          borderRadius: '10px',
          background: 'rgba(37,37,37,0.4)',
          border: '1px solid var(--ui-border-muted)',
        }}
      >
        <button type="button" onClick={() => setIsModalOpen(true)} className={QUIET_BUTTON_CLASS}>
          <Plus size={18} weight="bold" />
          Connect Cloud Account
        </button>

        <div style={{ flex: 1 }} />

        <button type="button" onClick={() => void loadCredentials()} disabled={isLoading} className={QUIET_BUTTON_CLASS}>
          <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Credentials List */}
      <CloudCredentialsList
        credentials={credentials}
        onAddCredential={() => setIsModalOpen(true)}
        onRevokeCredential={handleRevoke}
        isLoading={isLoading}
      />

      {/* Add Credential Modal */}
      <AddCloudCredentialForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={async (input) => {
          await handleConnect(input);
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}

export default CloudCredentialsPanel;
