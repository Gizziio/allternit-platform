import React, { useState, useEffect } from 'react';
import GlassSurface from '@/design/GlassSurface';
import type { HarnessConfig, HarnessBYOKConfig } from '@/lib/agents/agent.types';

interface HarnessConfigPanelProps {
  agentId: string;
  value?: HarnessConfig;
  onChange?: (config: HarnessConfig) => void;
}

const defaultHarness: HarnessConfig = { mode: 'cloud' };

const HarnessConfigPanel: React.FC<HarnessConfigPanelProps> = ({
  agentId,
  value,
  onChange,
}) => {
  const [config, setConfig] = useState<HarnessConfig>(() => {
    if (value) return value;
    const cached = typeof window !== 'undefined'
      ? window.localStorage.getItem(`allternit-harness-${agentId}`)
      : null;
    if (cached) {
      try {
        return JSON.parse(cached) as HarnessConfig;
      } catch {
        return defaultHarness;
      }
    }
    return defaultHarness;
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (value) setConfig(value);
  }, [value]);

  const update = (next: HarnessConfig) => {
    setConfig(next);
    onChange?.(next);
  };

  const setMode = (mode: HarnessConfig['mode']) => {
    update({ mode });
  };

  const setByokProvider = (
    provider: keyof NonNullable<HarnessBYOKConfig>,
    field: 'apiKey' | 'baseURL',
    value: string,
  ) => {
    update({
      ...config,
      mode: 'byok',
      byok: {
        ...config.byok,
        [provider]: {
          ...(config.byok?.[provider] || {}),
          [field]: value,
        },
      },
    });
  };

  const setCloud = (field: keyof NonNullable<HarnessConfig['cloud']>, value: string) => {
    update({
      ...config,
      mode: 'cloud',
      cloud: { ...(config.cloud || { baseURL: '', accessToken: '' }), [field]: value },
    });
  };

  const setLocal = (baseURL: string) => {
    update({ ...config, mode: 'local', local: { baseURL } });
  };

  const setSubprocess = (field: keyof NonNullable<HarnessConfig['subprocess']>, value: string | Record<string, string>) => {
    update({
      ...config,
      mode: 'subprocess',
      subprocess: { ...(config.subprocess || { command: '' }), [field]: value },
    });
  };

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`allternit-harness-${agentId}`, JSON.stringify(config));
    }
    onChange?.(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const envToString = (env?: Record<string, string>) =>
    env ? Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') : '';

  const stringToEnv = (text: string): Record<string, string> => {
    const env: Record<string, string> = {};
    text.split('\n').forEach((line) => {
      const [k, ...rest] = line.split('=');
      if (k && rest.length > 0) env[k.trim()] = rest.join('=').trim();
    });
    return env;
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 style={{ color: 'var(--text-primary)' }} className="text-xl font-bold">Harness Configuration</h2>
          <p style={{ color: 'var(--text-secondary)' }} className="text-sm">Canonical per-agent model routing and execution backend</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <GlassSurface className="p-6 rounded-lg flex flex-col gap-3">
          <h3 style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold">Execution Mode</h3>
          <div className="flex gap-2 flex-wrap">
            {(['byok', 'cloud', 'local', 'subprocess'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                style={{
                  backgroundColor: config.mode === m ? 'var(--accent-primary)' : 'transparent',
                  color: config.mode === m ? 'var(--ui-text-inverse)' : 'var(--text-primary)',
                  borderColor: config.mode === m ? 'var(--accent-primary)' : 'var(--border-primary)',
                }}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </GlassSurface>

        {config.mode === 'cloud' && (
          <GlassSurface className="p-6 rounded-lg flex flex-col gap-4">
            <h3 style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold">Cloud Harness</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={{ color: 'var(--text-primary)' }} className="text-xs font-semibold block mb-1">Base URL</label>
                <input
                  type="text"
                  value={config.cloud?.baseURL || ''}
                  onChange={(e) => setCloud('baseURL', e.target.value)}
                  placeholder="https://api..."
                  className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none bg-[var(--bg-secondary)]"
                  style={{ color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                />
              </div>
              <div>
                <label style={{ color: 'var(--text-primary)' }} className="text-xs font-semibold block mb-1">Access Token</label>
                <input
                  type="password"
                  value={config.cloud?.accessToken || ''}
                  onChange={(e) => setCloud('accessToken', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none bg-[var(--bg-secondary)]"
                  style={{ color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                />
              </div>
            </div>
          </GlassSurface>
        )}

        {config.mode === 'byok' && (
          <GlassSurface className="p-6 rounded-lg flex flex-col gap-6">
            <h3 style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold">Bring Your Own Keys</h3>
            {(['anthropic', 'openai', 'google'] as const).map((provider) => (
              <div key={provider} className="flex flex-col gap-3">
                <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  {provider}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label style={{ color: 'var(--text-primary)' }} className="text-xs font-semibold block mb-1">API Key</label>
                    <input
                      type="password"
                      value={config.byok?.[provider]?.apiKey || ''}
                      onChange={(e) => setByokProvider(provider, 'apiKey', e.target.value)}
                      placeholder={provider === 'anthropic' ? 'sk-ant-...' : provider === 'openai' ? 'sk-...' : 'AIza...'}
                      className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none bg-[var(--bg-secondary)]"
                      style={{ color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                    />
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-primary)' }} className="text-xs font-semibold block mb-1">Base URL (optional)</label>
                    <input
                      type="text"
                      value={config.byok?.[provider]?.baseURL || ''}
                      onChange={(e) => setByokProvider(provider, 'baseURL', e.target.value)}
                      placeholder={provider === 'anthropic' ? 'https://api.anthropic.com' : provider === 'openai' ? 'https://api.openai.com' : 'https://generativelanguage.googleapis.com'}
                      className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none bg-[var(--bg-secondary)]"
                      style={{ color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </GlassSurface>
        )}

        {config.mode === 'local' && (
          <GlassSurface className="p-6 rounded-lg flex flex-col gap-4">
            <h3 style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold">Local Inference</h3>
            <div>
              <label style={{ color: 'var(--text-primary)' }} className="text-xs font-semibold block mb-1">Base URL</label>
              <input
                type="text"
                value={config.local?.baseURL || ''}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none bg-[var(--bg-secondary)]"
                style={{ color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
              />
            </div>
          </GlassSurface>
        )}

        {config.mode === 'subprocess' && (
          <GlassSurface className="p-6 rounded-lg flex flex-col gap-4">
            <h3 style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold">Subprocess Harness</h3>
            <div>
              <label style={{ color: 'var(--text-primary)' }} className="text-xs font-semibold block mb-1">Command</label>
              <input
                type="text"
                value={config.subprocess?.command || ''}
                onChange={(e) => setSubprocess('command', e.target.value)}
                placeholder="python agent_server.py"
                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none bg-[var(--bg-secondary)]"
                style={{ color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
              />
            </div>
            <div>
              <label style={{ color: 'var(--text-primary)' }} className="text-xs font-semibold block mb-1">Working Directory (optional)</label>
              <input
                type="text"
                value={config.subprocess?.cwd || ''}
                onChange={(e) => setSubprocess('cwd', e.target.value)}
                placeholder="/path/to/workdir"
                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none bg-[var(--bg-secondary)]"
                style={{ color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
              />
            </div>
            <div>
              <label style={{ color: 'var(--text-primary)' }} className="text-xs font-semibold block mb-1">Environment Variables (KEY=value, one per line)</label>
              <textarea
                value={envToString(config.subprocess?.env)}
                onChange={(e) => setSubprocess('env', stringToEnv(e.target.value))}
                rows={4}
                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none bg-[var(--bg-secondary)]"
                style={{ color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
              />
            </div>
          </GlassSurface>
        )}

        <div className="flex justify-end items-center gap-3">
          {saved && <span style={{ color: 'var(--status-success)' }} className="text-sm font-medium">Saved Successfully!</span>}
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 rounded-lg font-medium text-sm transition-colors"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--ui-text-inverse)' }}
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export { HarnessConfigPanel };
export default HarnessConfigPanel;
