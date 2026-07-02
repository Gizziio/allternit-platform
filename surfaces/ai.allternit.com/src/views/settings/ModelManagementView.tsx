import React, { useState, useEffect } from "react";
import { GlassCard } from "../../design/GlassCard";
import { OpenAIIcon, AnthropicIcon, OllamaIcon } from "../../components/icons/ModelIcons";
import { CheckCircle, Warning, Gear, TerminalWindow, CircleNotch } from "@phosphor-icons/react";
import { api } from "@/integration/api-client";
import type { ProviderInfo, ProviderAuthStatus } from "@/integration/api-client";

interface EngineEntry {
  id: string;
  name: string;
  type: string;
  status: 'ready' | 'missing' | 'unknown';
  modelCount: number;
  provider: string;
}

function providerIcon(id: string) {
  if (id === 'openai' || id === 'azure-openai') return <OpenAIIcon className="size-6" />;
  if (id === 'anthropic') return <AnthropicIcon className="size-6" />;
  if (id === 'ollama') return <OllamaIcon className="size-6" />;
  return <TerminalWindow size={24} />;
}

export function ModelManagementView(): React.ReactNode {
  const [engines, setEngines] = useState<EngineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [providersRes, authRes] = await Promise.all([
          api.listProviders(),
          api.listProviderAuthStatus(),
        ]);
        if (cancelled) return;

        const authMap = new Map<string, ProviderAuthStatus['status']>();
        for (const a of authRes.providers) {
          authMap.set(a.provider_id, a.status);
        }

        const entries: EngineEntry[] = (providersRes.all as ProviderInfo[]).map((p) => {
          const authStatus = authMap.get(p.id) ?? 'unknown';
          return {
            id: p.id,
            name: p.name,
            type: p.id === 'ollama' ? 'Local' : 'Cloud',
            status: authStatus === 'ok' || authStatus === 'not_required' ? 'ready'
              : authStatus === 'missing' ? 'missing'
              : 'unknown',
            modelCount: p.models?.length ?? 0,
            provider: p.id,
          };
        });

        setEngines(entries);
      } catch {
        // no-op — leave empty, no fake fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: 40, maxWidth: 1000, margin: '0 auto', height: '100%', overflow: 'auto' }}>
      <header style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px 0' }}>Models & Engines</h1>
          <p style={{ opacity: 0.6, fontSize: 14 }}>Manage your cloud model providers and local runtimes.</p>
        </div>
      </header>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <CircleNotch size={32} className="animate-spin" style={{ opacity: 0.4 }} />
        </div>
      ) : engines.length === 0 ? (
        <div style={{ textAlign: 'center', opacity: 0.5, paddingTop: 80 }}>
          <p>No providers configured.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {engines.map(engine => (
            <GlassCard key={engine.id} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: 'rgba(0,0,0,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {providerIcon(engine.provider)}
                </div>
                <div style={{
                  padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 800,
                  background: engine.status === 'ready' ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)',
                  color: engine.status === 'ready' ? 'var(--status-success)' : 'var(--status-error)',
                  display: 'flex', alignItems: 'center', gap: 4
                }}>
                  {engine.status === 'ready' ? <CheckCircle size={12} weight="fill" /> : <Warning size={12} weight="fill" />}
                  {engine.status.toUpperCase()}
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 700 }}>{engine.name}</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, opacity: 0.5, fontWeight: 600 }}>{engine.type}</span>
                  {engine.modelCount > 0 && (
                    <>
                      <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'currentColor', opacity: 0.2 }} />
                      <span style={{ fontSize: 12, opacity: 0.5, fontWeight: 600 }}>{engine.modelCount} models</span>
                    </>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 'auto' }}>
                <button type="button" style={{
                  width: '100%', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 6,
                  padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}>
                  <Gear size={14} />
                  CONFIGURE
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
