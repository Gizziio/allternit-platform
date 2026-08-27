/**
 * ImageProvidersPanel
 *
 * One-click setup for image generation providers. Lists every provider from
 * the image-generation registry, shows whether it is configured, and opens a
 * focused key-entry form when the user clicks Connect.
 */

'use client';

import React, { useState } from 'react';
import {
  CheckCircle,
  Image,
  Key,
  Lightning,
  PlugsConnected,
  Warning,
  X,
} from '@phosphor-icons/react';
import {
  type ImageProviderApiKeys,
  type ImageProviderId,
  IMAGE_PROVIDERS,
} from '@/lib/agents/modes/image-generation';
import { useImageProviderAuth } from '@/hooks/useImageProviderAuth';
import { SectionHeading } from '@/components/settings/SectionHeading';
import { Badge } from '@/components/settings/Badge';
import { QUIET_BUTTON_CLASS, DESTRUCTIVE_BUTTON_CLASS } from '@/components/settings/buttonStyles';

interface ProviderField {
  key: keyof ImageProviderApiKeys;
  label: string;
  placeholder: string;
  help?: string;
}

const PROVIDER_FIELDS: Record<ImageProviderId, ProviderField[]> = {
  pollinations: [],
  'bonsai-local': [],
  'bonsai-webgpu': [],
  openai: [{ key: 'openai', label: 'OpenAI API key', placeholder: 'sk-...' }],
  cloudflare: [
    { key: 'cloudflareAccountId', label: 'Account ID', placeholder: '1a2b3c...' },
    { key: 'cloudflareToken', label: 'API token', placeholder: '...' },
  ],
  huggingface: [
    { key: 'huggingface', label: 'HuggingFace read token', placeholder: 'hf_...' },
  ],
  nvidia: [{ key: 'nvidia', label: 'NVIDIA NIM API key', placeholder: 'nvapi-...' }],
  'gemini-nano-banana': [
    { key: 'google', label: 'Google AI Studio API key', placeholder: 'AIza...' },
  ],
  'seed-dance': [
    {
      key: 'seedDance',
      label: 'Seed.Dance / fal endpoint + key',
      placeholder: 'https://fal.run/... or sk-...',
      help: 'Paste your fal.ai or BytePlus ARK endpoint URL plus key as configured by your runtime.',
    },
  ],
};

function providerTypeBadge(type: string): string {
  switch (type) {
    case 'free':
      return 'Free';
    case 'api_key':
      return 'API key';
    case 'local':
      return 'Local';
    case 'local-unverified':
      return 'Local GPU';
    default:
      return type;
  }
}

export function ImageProvidersPanel(): React.ReactNode {
  const { providers, keys, updateKeys, removeKey } = useImageProviderAuth();
  const [selectedProvider, setSelectedProvider] = useState<ImageProviderId | null>(null);

  const configuredCount = providers.filter((p) => p.configured).length;
  const selectedFields = selectedProvider ? PROVIDER_FIELDS[selectedProvider] : [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/45 p-4">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center shrink-0">
            <Image size={18} weight="duotone" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <SectionHeading className="m-0">Image providers</SectionHeading>
              <Badge>{configuredCount} connected</Badge>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1 mb-0 leading-relaxed">
              Connect the image generation backends you want to use. Pollinations is free and works
              without a key. API-key providers keep credentials in this browser.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {providers.map((provider) => {
          const entry = IMAGE_PROVIDERS[provider.id];
          const needsKey = provider.type === 'api_key';
          return (
            <div
              key={provider.id}
              className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30 p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                      {entry.name}
                    </span>
                    {provider.isDefault && <Badge>default</Badge>}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                    {entry.description}
                  </p>
                </div>
                <Badge>{providerTypeBadge(provider.type)}</Badge>
              </div>

              <div className="mt-auto flex items-center gap-2">
                {provider.configured ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--status-success)]">
                      <CheckCircle size={13} weight="fill" /> Ready
                    </span>
                    {needsKey && (
                      <button
                        type="button"
                        onClick={() => setSelectedProvider(provider.id)}
                        className="ml-auto text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
                      >
                        Edit
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedProvider(provider.id)}
                    className={QUIET_BUTTON_CLASS}
                    disabled={!needsKey}
                    title={needsKey ? 'Connect provider' : 'No key required'}
                  >
                    {needsKey ? (
                      <>
                        <PlugsConnected size={15} weight="bold" /> Connect
                      </>
                    ) : provider.type === 'local' || provider.type === 'local-unverified' ? (
                      <>
                        <Lightning size={15} weight="bold" /> Local
                      </>
                    ) : (
                      <>
                        <CheckCircle size={15} weight="bold" /> Ready
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedProvider && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Close provider connection dialog"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedProvider(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
                  Connect {IMAGE_PROVIDERS[selectedProvider].name}
                </h3>
                <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                  {IMAGE_PROVIDERS[selectedProvider].description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProvider(null)}
                className="shrink-0 flex size-8 items-center justify-center rounded-full border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X size={14} />
              </button>
            </div>

            <ConnectForm
              providerId={selectedProvider}
              fields={selectedFields}
              existing={keys}
              onSave={(patch) => {
                updateKeys(patch);
                setSelectedProvider(null);
              }}
              onCancel={() => setSelectedProvider(null)}
              onDisconnect={() => {
                selectedFields.forEach((f) => removeKey(f.key));
                setSelectedProvider(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface ConnectFormProps {
  providerId: ImageProviderId;
  fields: ProviderField[];
  existing: ImageProviderApiKeys;
  onSave: (patch: Partial<ImageProviderApiKeys>) => void;
  onCancel: () => void;
  onDisconnect: () => void;
}

function ConnectForm({ providerId, fields, existing, onSave, onCancel, onDisconnect }: ConnectFormProps): React.ReactNode {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    fields.forEach((f) => {
      initial[f.key] = (existing[f.key] as string) ?? '';
    });
    return initial;
  });
  const [showSecrets, setShowSecrets] = useState(false);

  const isConfigured = fields.every((f) => values[f.key]?.trim());
  const hasExisting = fields.some((f) => existing[f.key]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isConfigured) return;
        const patch: Partial<ImageProviderApiKeys> = {};
        fields.forEach((f) => {
          patch[f.key] = values[f.key].trim();
        });
        onSave(patch);
      }}
    >
      {fields.map((field) => (
        <div key={String(field.key)} className="space-y-1.5">
          <label className="text-[12px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
            <Key size={12} />
            {field.label}
          </label>
          <input
            type={showSecrets ? 'text' : 'password'}
            value={values[field.key] ?? ''}
            placeholder={field.placeholder}
            onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
            className="w-full rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)]"
          />
          {field.help && (
            <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">{field.help}</p>
          )}
        </div>
      ))}

      <label className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)] cursor-pointer">
        <input
          type="checkbox"
          checked={showSecrets}
          onChange={(e) => setShowSecrets(e.target.checked)}
          className="rounded border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
        />
        Show values
      </label>

      <div className="flex items-center gap-3 pt-2">
        {hasExisting && (
          <button
            type="button"
            onClick={onDisconnect}
            className={DESTRUCTIVE_BUTTON_CLASS}
          >
            Disconnect
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCancel}
          className={QUIET_BUTTON_CLASS}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!isConfigured}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-solid border-transparent bg-[var(--accent-primary)] text-[13px] font-medium text-white cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save connection
        </button>
      </div>

      <p className="text-[11px] text-[var(--text-tertiary)] flex items-start gap-1.5">
        <Warning size={13} className="shrink-0 mt-0.5" />
        Keys are stored in this browser&apos;s localStorage. They are never sent to Allternit servers.
      </p>
    </form>
  );
}

export default ImageProvidersPanel;
