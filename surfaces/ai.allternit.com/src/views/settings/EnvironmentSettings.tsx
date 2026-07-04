'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowsClockwise,
  CheckCircle,
  ComputerTower,
  Globe,
  HardDrives,
  Key,
  Lock,
  Memory,
  ShieldCheck,
  Wrench,
} from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { setupApi, type SetupConfigResponse, type UserConfig } from '@/services/setup-api';
import { useToast } from '@/components/ui/toast-provider';

interface EnvField {
  key: keyof UserConfig;
  label: string;
  placeholder: string;
  companyKey?: keyof SetupConfigResponse['company'];
  icon: React.ReactNode;
  description?: string;
  secret?: boolean;
}

const ENV_FIELDS: EnvField[] = [
  {
    key: 'gatewayUrl',
    label: 'API Gateway URL',
    placeholder: 'http://localhost:8013',
    companyKey: 'gatewayUrl',
    icon: <Globe size={18} weight="bold" />,
    description: 'Where the Allternit Platform API is reachable.',
  },
  {
    key: 'terminalServerUrl',
    label: 'Gizzi Runtime URL',
    placeholder: 'http://127.0.0.1:4096',
    companyKey: 'terminalServerUrl',
    icon: <ComputerTower size={18} weight="bold" />,
    description: 'URL of the Gizzi code runtime / terminal server.',
  },
  {
    key: 'ollamaUrl',
    label: 'Ollama URL',
    placeholder: 'http://localhost:11434',
    icon: <HardDrives size={18} weight="bold" />,
    description: 'Local Ollama instance for running open-source models.',
  },
  {
    key: 'memoryUrl',
    label: 'Memory Service URL',
    placeholder: 'http://127.0.0.1:4096',
    icon: <Memory size={18} weight="bold" />,
    description: 'Allternit memory / vector service endpoint.',
  },
  {
    key: 'embeddingUrl',
    label: 'Embedding Service URL',
    placeholder: 'http://127.0.0.1:4096',
    icon: <Memory size={18} weight="bold" />,
    description: 'Embedding model endpoint (defaults to Ollama if empty).',
  },
  {
    key: 'cronDaemonUrl',
    label: 'Cron Daemon URL',
    placeholder: 'http://127.0.0.1:4096/cron',
    icon: <ArrowsClockwise size={18} weight="bold" />,
    description: 'Gizzi cron daemon endpoint for scheduled agent work.',
  },
  {
    key: 'agentWorkdir',
    label: 'Agent Working Directory',
    placeholder: '/path/to/agent/workspace',
    icon: <Wrench size={18} weight="bold" />,
    description: 'Default filesystem root for agent file operations.',
  },
];

const COMPANY_ENV_FIELDS: EnvField[] = [
  {
    key: 'clerkPublishableKey' as keyof UserConfig,
    label: 'Clerk Publishable Key',
    placeholder: 'pk_test_...',
    companyKey: 'clerkPublishableKey',
    icon: <Key size={18} weight="bold" />,
    description: 'Clerk publishable key for packaged-app auth. Leave empty to use local-dev bypass.',
  },
  {
    key: 'clerkJwksUrl' as keyof UserConfig,
    label: 'Clerk JWKS URL',
    placeholder: 'https://...clerk.accounts.dev/.well-known/jwks.json',
    companyKey: 'clerkJwksUrl',
    icon: <Lock size={18} weight="bold" />,
    description: 'JWKS endpoint the API uses to verify Clerk JWT signatures.',
  },
  {
    key: 'clerkIssuer' as keyof UserConfig,
    label: 'Clerk Issuer',
    placeholder: 'https://...clerk.accounts.dev',
    companyKey: 'clerkIssuer',
    icon: <ShieldCheck size={18} weight="bold" />,
    description: 'Expected Clerk JWT issuer (`iss` claim).',
  },
];

export function EnvironmentSettings(): React.ReactNode {
  const { addToast } = useToast();
  const [config, setConfig] = useState<SetupConfigResponse | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const data = await setupApi.getConfig();
      setConfig(data);
      setValues({
        gatewayUrl: data.user.gatewayUrl ?? '',
        terminalServerUrl: data.user.terminalServerUrl ?? '',
        ollamaUrl: data.user.ollamaUrl ?? '',
        memoryUrl: data.user.memoryUrl ?? '',
        embeddingUrl: data.user.embeddingUrl ?? '',
        cronDaemonUrl: data.user.cronDaemonUrl ?? '',
        agentWorkdir: data.user.agentWorkdir ?? '',
        clerkPublishableKey: data.company.clerkPublishableKey ?? '',
        clerkJwksUrl: (data.company as any).clerkJwksUrl ?? '',
        clerkIssuer: (data.company as any).clerkIssuer ?? '',
      });
    } catch (err) {
      addToast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load environment configuration',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const updateValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty((prev) => new Set(prev).add(key));
  };

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      const userUpdates: Partial<UserConfig> = {};
      for (const key of dirty) {
        if (ENV_FIELDS.some((f) => f.key === key)) {
          const value = values[key];
          const trimmed = value.trim();
          (userUpdates as Record<string, unknown>)[key] = trimmed.length > 0 ? trimmed : undefined;
        }
      }
      const payload: UserConfig = { ...config.user, ...userUpdates };
      await setupApi.saveConfig(payload);
      addToast({ title: 'Saved', description: 'Environment configuration updated.', type: 'success' });
      setDirty(new Set());
      await load();
    } catch (err) {
      addToast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save environment configuration',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const companyValue = (field: EnvField): string | undefined => {
    if (!field.companyKey || !config) return undefined;
    const value = config.company[field.companyKey];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  };

  const renderFields = (fields: EnvField[]) => (
    <div className="space-y-5">
      {fields.map((field) => {
        const company = companyValue(field);
        const isDirty = dirty.has(field.key);
        const value = values[field.key] ?? '';
        return (
          <div key={field.key} className="group">
            <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-primary)] mb-1.5">
              <span className="text-[var(--accent-primary)]">{field.icon}</span>
              {field.label}
              {company && (
                <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-[var(--status-success)]">
                  Baked in
                </span>
              )}
            </label>
            {field.description && (
              <p className="text-[11px] text-[var(--text-tertiary)] mb-1.5 leading-relaxed">
                {field.description}
              </p>
            )}
            <Input
              type={field.secret ? 'password' : 'text'}
              value={value}
              onChange={(e) => updateValue(field.key as string, e.target.value)}
              placeholder={company ?? field.placeholder}
              disabled={Boolean(company)}
              className={cn(
                'font-mono text-[12px]',
                isDirty && 'border-[var(--accent-primary)]',
                company && 'opacity-70 cursor-not-allowed'
              )}
            />
            {company && (
              <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                Set by your organization: <span className="font-mono text-[var(--text-secondary)]">{company}</span>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[13px] text-[var(--text-tertiary)]">
        Loading environment configuration…
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <section className="mb-8">
        <div className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-widest font-black mb-4 opacity-60">
          Service Endpoints
        </div>
        {renderFields(ENV_FIELDS)}
      </section>

      <section className="mb-8">
        <div className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-widest font-black mb-4 opacity-60">
          Authentication (Company)
        </div>
        {renderFields(COMPANY_ENV_FIELDS)}
        <p className="mt-4 text-[11px] text-[var(--text-tertiary)] leading-relaxed">
          Auth values are normally baked into the app bundle via{' '}
          <code className="font-mono text-[var(--text-secondary)]">resources/company.json</code>. Values shown
          here reflect the active company config. Use{' '}
          <code className="font-mono text-[var(--text-secondary)]">pnpm config:company</code> to regenerate the
          bundle config from environment variables.
        </p>
      </section>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || dirty.size === 0}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all active:scale-95',
            dirty.size === 0
              ? 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] cursor-not-allowed'
              : 'bg-[var(--accent-primary)] text-white hover:opacity-90'
          )}
        >
          {isSaving ? (
            <>Saving…</>
          ) : (
            <>
              <CheckCircle size={16} weight="bold" />
              Save {dirty.size > 0 && `(${dirty.size})`}
            </>
          )}
        </button>
        {dirty.size > 0 && <span className="text-[11px] text-[var(--text-tertiary)]">Unsaved changes</span>}
      </div>
    </div>
  );
}
