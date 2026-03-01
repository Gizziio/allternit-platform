import React, { useState, useEffect } from "react";
import { GlassCard } from "../../design/GlassCard";
import { OpenAIIcon, AnthropicIcon, OllamaIcon, MetaIcon } from "../../components/icons/ModelIcons";
import { CheckCircle, Warning, Gear, TerminalWindow, Cloud, DownloadSimple, ChartBar } from "@phosphor-icons/react";

export function ModelManagementView() {
  const [engines, setEngines] = useState([
    { id: 'codex', name: 'OpenAI Codex', type: 'CLI', status: 'installed', version: 'v0.93.0', provider: 'OpenAI' },
    { id: 'claude-code', name: 'Claude Code', type: 'CLI', status: 'missing', version: '-', provider: 'Anthropic' },
    { id: 'aider', name: 'Aider AI', type: 'CLI', status: 'installed', version: 'v0.68.0', provider: 'Aider' },
    { id: 'ollama', name: 'Ollama', type: 'Local', status: 'installed', version: 'v0.5.7', provider: 'Local' },
    { id: 'gpt-4o', name: 'GPT-4o', type: 'Cloud', status: 'ready', version: 'API', provider: 'OpenAI' },
  ]);

  return (
    <div style={{ padding: 40, maxWidth: 1000, margin: '0 auto', height: '100%', overflow: 'auto' }}>
      <header style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px 0' }}>Models & Engines</h1>
          <p style={{ opacity: 0.6, fontSize: 14 }}>Manage your local CLI drivers and cloud model providers.</p>
        </div>
        <button style={{ 
          background: 'var(--accent-chat)', color: 'white', border: 'none', 
          borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 13,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
        }}>
          <DownloadSimple size={18} weight="bold" />
          INSTALL NEW ENGINE
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
        {engines.map(engine => (
          <GlassCard key={engine.id} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ 
                width: 40, height: 40, borderRadius: 10, background: 'rgba(0,0,0,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {engine.provider === 'OpenAI' && <OpenAIIcon className="w-6 h-6" />}
                {engine.provider === 'Anthropic' && <AnthropicIcon className="w-6 h-6" />}
                {engine.provider === 'Local' && <OllamaIcon className="w-6 h-6" />}
                {engine.provider === 'Aider' && <TerminalWindow size={24} />}
              </div>
              <div style={{ 
                padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800,
                background: engine.status === 'installed' || engine.status === 'ready' ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)',
                color: engine.status === 'installed' || engine.status === 'ready' ? '#34c759' : '#ff3b30',
                display: 'flex', alignItems: 'center', gap: 4
              }}>
                {engine.status === 'installed' || engine.status === 'ready' ? <CheckCircle size={12} weight="fill" /> : <Warning size={12} weight="fill" />}
                {engine.status.toUpperCase()}
              </div>
            </div>

            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 700 }}>{engine.name}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 600 }}>{engine.type}</span>
                <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'currentColor', opacity: 0.2 }} />
                <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 600 }}>{engine.version}</span>
              </div>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
              <button style={{ 
                flex: 1, background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 6,
                padding: '8px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}>
                <Gear size={14} />
                CONFIGURE
              </button>
              <button style={{ 
                background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 6,
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: engine.status === 'installed' ? 'pointer' : 'not-allowed', opacity: engine.status === 'installed' ? 1 : 0.3
              }}>
                <ChartBar size={16} />
              </button>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
