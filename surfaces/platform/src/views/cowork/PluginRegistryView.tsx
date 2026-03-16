import React, { useMemo, useState } from 'react';
import { GlassCard } from '../../design/GlassCard';
import { Command, Brain, Globe } from '@phosphor-icons/react';
import { useTelemetryProviders } from '@/lib/telemetry/useTelemetryProviders';

export function PluginRegistryView() {
  const { providers, loading, error, refresh } = useTelemetryProviders();
  const [activeOverrides, setActiveOverrides] = useState<Record<string, boolean>>({});
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);

  const sortedProviders = useMemo(
    () => [...providers].sort((a, b) => a.name.localeCompare(b.name)),
    [providers]
  );

  const resolveActive = (provider: any) => {
    const override = activeOverrides[provider.id];
    return override === undefined ? provider.active : override;
  };

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Plugin Registry</h1>
          <p style={{ margin: '8px 0 0 0', opacity: 0.7 }}>
            A2R Operator feeds telemetry-enabled providers so you can toggle them on/off.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            padding: '10px 20px',
            borderRadius: 12,
            background: '#2563eb',
            color: 'white',
            border: 'none',
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Refreshing...' : 'Refresh providers'}
        </button>
      </div>

      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 20,
        }}
      >
        {sortedProviders.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            active={resolveActive(provider)}
            onToggle={() =>
              setActiveOverrides((prev) => ({
                ...prev,
                [provider.id]: !resolveActive(provider),
              }))
            }
            onShowDetails={() => setSelectedProvider(provider)}
          />
        ))}
      </div>

      {selectedProvider && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedProvider(null)}
        >
          <GlassCard
            style={{ width: 560, maxWidth: '90vw', padding: 24, borderRadius: 16 }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{selectedProvider.name}</h2>
            <p style={{ marginTop: 12, lineHeight: 1.6, color: '#cbd5f5' }}>
              {selectedProvider.description || 'No provider description available.'}
            </p>
            <div style={{ marginTop: 16, fontSize: 13, opacity: 0.75 }}>
              Provider ID: {selectedProvider.id}
            </div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
              Last updated: {new Date(selectedProvider.lastUpdated || Date.now()).toLocaleString()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                onClick={() => setSelectedProvider(null)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.4)',
                  background: 'transparent',
                  color: '#f1f5f9',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

function ProviderCard({
  provider,
  active,
  onToggle,
  onShowDetails,
}: {
  provider: any;
  active: boolean;
  onToggle: () => void;
  onShowDetails: () => void;
}) {
  const Icon = active ? Globe : Brain;
  return (
    <GlassCard style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: provider.brandColor ? `${provider.brandColor}20` : '#111827',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={28} color={provider.brandColor || '#a855f7'} />
        </div>
        <div
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 10,
            fontWeight: 700,
            background: active ? 'rgba(34,197,94,0.1)' : '#1f2937',
            color: active ? '#22c55e' : '#9ca3af',
          }}
        >
          {active ? 'ACTIVE' : 'INACTIVE'}
        </div>
      </div>

      <div>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{provider.name}</h3>
        {provider.description && (
          <p style={{ fontSize: 13, lineHeight: 1.6, marginTop: 12, color: '#cbd5f5' }}>
            {provider.description}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onToggle}
          style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: 10,
            border: 'none',
            background: active ? '#111827' : '#10b981',
            color: active ? '#f3f4f6' : '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: 1,
          }}
        >
          {active ? 'Deactivate' : 'Activate'}
        </button>
        <button
          onClick={onShowDetails}
          style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: 10,
            border: '1px solid rgba(148,163,184,0.4)',
            background: 'transparent',
            color: '#f1f5f9',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Details
        </button>
      </div>
    </GlassCard>
  );
}
