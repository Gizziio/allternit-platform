/**
 * AddCloudCredentialForm - modal for connecting an AWS/GCP/Azure account.
 *
 * Mirrors AddSSHConnectionForm.tsx's pattern: multi-field, non-OAuth
 * credential entry with an authType-style discriminated union per provider,
 * per-field validation, show/hide toggle for secrets, and a live "Test
 * connection" step before save.
 */

'use client';

import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Cloud,
  CheckCircle,
  Warning,
  CircleNotch,
  Eye,
  EyeSlash,
  X,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import {
  testCloudCredential,
  type CloudProvider,
  type CreateCloudCredentialInput,
  type TestCloudCredentialResult,
} from '@/lib/design/cloud-credentials';

const PROVIDER_LABEL: Record<CloudProvider, string> = {
  aws: 'AWS',
  gcp: 'Google Cloud',
  azure: 'Azure',
};

interface CloudCredentialFormState {
  provider: CloudProvider;
  label: string;
  region: string;
  externalId: string;
  // AWS
  roleArn: string;
  // GCP
  serviceAccountJson: string;
  // Azure
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
}

const EMPTY_FORM: CloudCredentialFormState = {
  provider: 'aws',
  label: '',
  region: '',
  externalId: '',
  roleArn: '',
  serviceAccountJson: '',
  tenantId: '',
  clientId: '',
  clientSecret: '',
  subscriptionId: '',
};

function buildSecretPayload(form: CloudCredentialFormState): Record<string, unknown> {
  switch (form.provider) {
    case 'aws':
      return { role_arn: form.roleArn };
    case 'gcp':
      return { service_account_json: JSON.parse(form.serviceAccountJson || '{}') };
    case 'azure':
      return {
        tenant_id: form.tenantId,
        client_id: form.clientId,
        client_secret: form.clientSecret,
        subscription_id: form.subscriptionId,
      };
  }
}

export interface AddCloudCredentialFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateCloudCredentialInput) => Promise<void>;
}

export function AddCloudCredentialForm({ isOpen, onClose, onSubmit }: AddCloudCredentialFormProps) {
  const [form, setForm] = useState<CloudCredentialFormState>(EMPTY_FORM);
  const [showSecret, setShowSecret] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestCloudCredentialResult | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof CloudCredentialFormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const update = useCallback(<K extends keyof CloudCredentialFormState>(field: K, value: CloudCredentialFormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSubmitError(null);
    setTestResult(null);
  }, []);

  const validate = useCallback((): boolean => {
    const next: Partial<Record<keyof CloudCredentialFormState, string>> = {};
    if (!form.label.trim()) next.label = 'A label is required';
    if (form.provider === 'aws' && !form.roleArn.trim()) next.roleArn = 'IAM role ARN is required';
    if (form.provider === 'gcp') {
      if (!form.serviceAccountJson.trim()) {
        next.serviceAccountJson = 'Service account JSON is required';
      } else {
        try {
          JSON.parse(form.serviceAccountJson);
        } catch {
          next.serviceAccountJson = 'Must be valid JSON';
        }
      }
    }
    if (form.provider === 'azure') {
      if (!form.tenantId.trim()) next.tenantId = 'Tenant ID is required';
      if (!form.clientId.trim()) next.clientId = 'Client ID is required';
      if (!form.clientSecret.trim()) next.clientSecret = 'Client secret is required';
      if (!form.subscriptionId.trim()) next.subscriptionId = 'Subscription ID is required';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form]);

  const handleClose = useCallback(() => {
    setForm(EMPTY_FORM);
    setErrors({});
    setSubmitError(null);
    setShowSecret(false);
    setTestResult(null);
    onClose();
  }, [onClose]);

  const handleTest = useCallback(async () => {
    if (!validate()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testCloudCredential({
        provider: form.provider,
        region: form.region || undefined,
        external_id: form.externalId || undefined,
        secret: buildSecretPayload(form),
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : 'Connection test failed' });
    } finally {
      setIsTesting(false);
    }
  }, [form, validate]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        await onSubmit({
          provider: form.provider,
          label: form.label,
          region: form.region || undefined,
          external_id: form.externalId || undefined,
          secret: buildSecretPayload(form),
        });
        handleClose();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to connect cloud account');
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, onSubmit, validate, handleClose],
  );

  if (!isOpen) return null;

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 bg-[var(--shell-overlay-backdrop)] backdrop-blur-sm flex items-center justify-center z-[1001] p-5 outline-none"
      onClick={handleClose}
      onKeyDown={(e) => { if (e.key === 'Escape') handleClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-cloud-account-title"
        className="w-full max-w-[520px] max-h-[90vh] bg-[var(--surface-canvas)] border border-solid border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-[0_24px_80px_var(--shell-overlay-backdrop)] flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') handleClose(); }}
      >
        <div className="flex items-center justify-between p-4 px-6 border-b border-solid border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-[var(--status-info)]/20 to-purple-500/20 border border-solid border-[var(--status-info)]/30 flex items-center justify-center">
              <Cloud size={20} className="text-[var(--status-info)]" />
            </div>
            <div>
              <h2 id="connect-cloud-account-title" className="text-[16px] font-semibold text-[var(--ui-text-primary)] m-0">Connect cloud account</h2>
              <p className="text-[12px] text-[var(--ui-text-secondary)] m-0">BYOC sandboxing for your organization</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="size-8 rounded-lg border-none bg-transparent text-[var(--ui-text-muted)] cursor-pointer flex items-center justify-center hover:bg-[var(--surface-panel)] hover:text-[var(--ui-text-primary)]">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-88px)]">
          <form onSubmit={handleSubmit}>
            {/* Provider */}
            <div className="mb-5">
              <div className="text-[13px] font-medium mb-1.5 text-[var(--ui-text-primary)]">Provider</div>
              <div className="flex gap-2 p-1 bg-[var(--surface-panel)] rounded-lg border border-solid border-[var(--border-subtle)]">
                {(['aws', 'gcp', 'azure'] as const).map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    className={cn(
                      'flex-1 p-2 rounded-md border-none text-[13px] font-medium cursor-pointer transition-all',
                      form.provider === provider ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]' : 'bg-transparent text-[var(--ui-text-secondary)]',
                    )}
                    onClick={() => update('provider', provider)}
                  >
                    {PROVIDER_LABEL[provider]}
                  </button>
                ))}
              </div>
            </div>

            {/* Label */}
            <div className="mb-5">
              <div className="text-[13px] font-medium mb-1.5 text-[var(--ui-text-primary)]">Label</div>
              <input
                type="text"
                className={cn(
                  'w-full p-[10px_12px] rounded-lg border border-solid bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[13px] outline-none focus:border-[var(--accent-primary)]',
                  errors.label ? 'border-[var(--status-error)]' : 'border-[var(--border-subtle)]',
                )}
                value={form.label}
                onChange={(e) => update('label', e.target.value)}
                placeholder="Production AWS"
              />
              {errors.label && <p className="text-[12px] text-[var(--status-error)] mt-1 m-0">{errors.label}</p>}
            </div>

            {/* Region */}
            <div className="mb-5">
              <div className="text-[13px] font-medium mb-1.5 text-[var(--ui-text-primary)]">Region (optional)</div>
              <input
                type="text"
                className="w-full p-[10px_12px] rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[13px] outline-none focus:border-[var(--accent-primary)]"
                value={form.region}
                onChange={(e) => update('region', e.target.value)}
                placeholder="us-east-1"
              />
            </div>

            {/* Provider-specific secret fields */}
            {form.provider === 'aws' && (
              <>
                <div className="mb-5">
                  <div className="text-[13px] font-medium mb-1.5 text-[var(--ui-text-primary)]">IAM role ARN</div>
                  <input
                    type="text"
                    className={cn(
                      'w-full p-[10px_12px] rounded-lg border border-solid bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[13px] font-mono outline-none focus:border-[var(--accent-primary)]',
                      errors.roleArn ? 'border-[var(--status-error)]' : 'border-[var(--border-subtle)]',
                    )}
                    value={form.roleArn}
                    onChange={(e) => update('roleArn', e.target.value)}
                    placeholder="arn:aws:iam::123456789012:role/allternit-byoc"
                  />
                  {errors.roleArn && <p className="text-[12px] text-[var(--status-error)] mt-1 m-0">{errors.roleArn}</p>}
                  <p className="text-[12px] text-[var(--ui-text-tertiary)] mt-1 m-0">
                    A role your account trusts allternit to assume. We never store static AWS keys.
                  </p>
                </div>
                <div className="mb-5">
                  <div className="text-[13px] font-medium mb-1.5 text-[var(--ui-text-primary)]">External ID (optional)</div>
                  <input
                    type="text"
                    className="w-full p-[10px_12px] rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[13px] font-mono outline-none focus:border-[var(--accent-primary)]"
                    value={form.externalId}
                    onChange={(e) => update('externalId', e.target.value)}
                    placeholder="Used in your role's trust policy"
                  />
                </div>
              </>
            )}

            {form.provider === 'gcp' && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[13px] font-medium text-[var(--ui-text-primary)]">Service account JSON key</div>
                  <button type="button" onClick={() => setShowSecret((v) => !v)} className="bg-transparent border-none text-[var(--ui-text-secondary)] cursor-pointer p-1 hover:text-[var(--ui-text-primary)]">
                    {showSecret ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <textarea
                  className={cn(
                    'w-full p-[10px_12px] rounded-lg border border-solid bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[12px] font-mono outline-none resize-none min-h-[120px] focus:border-[var(--accent-primary)] transition-[filter]',
                    errors.serviceAccountJson ? 'border-[var(--status-error)]' : 'border-[var(--border-subtle)]',
                    !showSecret && 'blur-[4px] focus:blur-none',
                  )}
                  value={form.serviceAccountJson}
                  onChange={(e) => update('serviceAccountJson', e.target.value)}
                  placeholder='{"type": "service_account", ...}'
                  rows={5}
                />
                {errors.serviceAccountJson && <p className="text-[12px] text-[var(--status-error)] mt-1 m-0">{errors.serviceAccountJson}</p>}
              </div>
            )}

            {form.provider === 'azure' && (
              <>
                <div className="mb-5">
                  <div className="text-[13px] font-medium mb-1.5 text-[var(--ui-text-primary)]">Tenant ID</div>
                  <input
                    type="text"
                    className={cn('w-full p-[10px_12px] rounded-lg border border-solid bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[13px] font-mono outline-none focus:border-[var(--accent-primary)]', errors.tenantId ? 'border-[var(--status-error)]' : 'border-[var(--border-subtle)]')}
                    value={form.tenantId}
                    onChange={(e) => update('tenantId', e.target.value)}
                  />
                  {errors.tenantId && <p className="text-[12px] text-[var(--status-error)] mt-1 m-0">{errors.tenantId}</p>}
                </div>
                <div className="mb-5">
                  <div className="text-[13px] font-medium mb-1.5 text-[var(--ui-text-primary)]">Client ID</div>
                  <input
                    type="text"
                    className={cn('w-full p-[10px_12px] rounded-lg border border-solid bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[13px] font-mono outline-none focus:border-[var(--accent-primary)]', errors.clientId ? 'border-[var(--status-error)]' : 'border-[var(--border-subtle)]')}
                    value={form.clientId}
                    onChange={(e) => update('clientId', e.target.value)}
                  />
                  {errors.clientId && <p className="text-[12px] text-[var(--status-error)] mt-1 m-0">{errors.clientId}</p>}
                </div>
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[13px] font-medium text-[var(--ui-text-primary)]">Client secret</div>
                    <button type="button" onClick={() => setShowSecret((v) => !v)} className="bg-transparent border-none text-[var(--ui-text-secondary)] cursor-pointer p-1 hover:text-[var(--ui-text-primary)]">
                      {showSecret ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <input
                    type={showSecret ? 'text' : 'password'}
                    className={cn('w-full p-[10px_12px] rounded-lg border border-solid bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[13px] font-mono outline-none focus:border-[var(--accent-primary)]', errors.clientSecret ? 'border-[var(--status-error)]' : 'border-[var(--border-subtle)]')}
                    value={form.clientSecret}
                    onChange={(e) => update('clientSecret', e.target.value)}
                  />
                  {errors.clientSecret && <p className="text-[12px] text-[var(--status-error)] mt-1 m-0">{errors.clientSecret}</p>}
                </div>
                <div className="mb-5">
                  <div className="text-[13px] font-medium mb-1.5 text-[var(--ui-text-primary)]">Subscription ID</div>
                  <input
                    type="text"
                    className={cn('w-full p-[10px_12px] rounded-lg border border-solid bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[13px] font-mono outline-none focus:border-[var(--accent-primary)]', errors.subscriptionId ? 'border-[var(--status-error)]' : 'border-[var(--border-subtle)]')}
                    value={form.subscriptionId}
                    onChange={(e) => update('subscriptionId', e.target.value)}
                  />
                  {errors.subscriptionId && <p className="text-[12px] text-[var(--status-error)] mt-1 m-0">{errors.subscriptionId}</p>}
                </div>
              </>
            )}

            {testResult && (
              <div
                className={cn(
                  'p-4 rounded-lg border border-solid mb-5',
                  testResult.success ? 'bg-[rgba(34,197,94,0.08)] border-[rgba(34,197,94,0.3)]' : 'bg-[var(--status-error-bg)] border-red-500/30',
                )}
              >
                <div className="flex items-start gap-3">
                  {testResult.success ? (
                    <CheckCircle size={20} className="text-[var(--status-success)] shrink-0 mt-0.5" />
                  ) : (
                    <Warning size={20} className="text-[var(--status-error)] shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={cn('text-[13px] m-0', testResult.success ? 'text-[var(--status-success)]' : 'text-[var(--status-error)]')}>
                      {testResult.message}
                    </p>
                    {testResult.identity && (
                      <p className="text-[12px] text-[var(--ui-text-tertiary)] mt-1 m-0 font-mono">
                        {Object.entries(testResult.identity).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {submitError && (
              <div className="p-4 rounded-lg border border-solid mb-5 bg-[var(--status-error-bg)] border-red-500/30">
                <div className="flex items-start gap-3">
                  <Warning size={20} className="text-[var(--status-error)] shrink-0 mt-0.5" />
                  <p className="text-[13px] text-[var(--status-error)] m-0">{submitError}</p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleTest()}
                disabled={isTesting || isSubmitting}
                className="flex-1 p-[10px_16px] rounded-lg border border-solid border-[var(--border-subtle)] bg-transparent text-[var(--ui-text-primary)] text-[13px] font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-all hover:bg-[var(--surface-panel)] disabled:opacity-50"
              >
                {isTesting ? <CircleNotch size={16} className="animate-spin" /> : null}
                Test connection
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isTesting}
                className="flex-1 p-[10px_16px] rounded-lg border-none bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-[13px] font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? <CircleNotch size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Connect account
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default AddCloudCredentialForm;
