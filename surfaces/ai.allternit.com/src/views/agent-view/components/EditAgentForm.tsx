"use client";

import React, { useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { Agent, HarnessConfig } from "@/lib/agents/agent.types";
import { STUDIO_THEME } from "../AgentView.constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('EditAgentForm');

const HARNESS_MODES = ['cloud', 'byok', 'local', 'subprocess'] as const;

export function EditAgentForm({ agent, onCancel }: { agent: Agent; onCancel: () => void }) {
  const { updateAgent } = useAgentStore();
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [harness, setHarness] = useState<HarnessConfig>(agent.harness ?? { mode: 'cloud' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateAgent(agent.id, { name, description, harness });
      onCancel();
    } catch (err) {
      console.error("Failed to update agent:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const setHarnessMode = (mode: HarnessConfig['mode']) => {
    setHarness({ mode });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 overflow-auto">
      <div className="w-full max-w-2xl p-8 rounded-2xl border" style={{ background: STUDIO_THEME.bgCard, borderColor: STUDIO_THEME.borderSubtle }}>
        <h2 className="text-2xl font-serif mb-6" style={{ color: STUDIO_THEME.textPrimary }}>Edit Agent</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label style={{ color: STUDIO_THEME.textSecondary }}>Name</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
            />
          </div>
          <div className="space-y-2">
            <Label style={{ color: STUDIO_THEME.textSecondary }}>Description</Label>
            <Textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
            />
          </div>

          <div className="space-y-4 pt-2">
            <Label style={{ color: STUDIO_THEME.textPrimary }}>Harness Mode</Label>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
              {HARNESS_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setHarnessMode(mode)}
                  className={`rounded-[10px] border border-solid p-4 text-left transition-all duration-200 cursor-pointer ${
                    harness.mode === mode ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'border-[var(--border-subtle)] bg-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-[var(--text-primary)] capitalize">{mode}</span>
                    {harness.mode === mode && <CheckCircle size={16} className="text-[var(--accent-primary)]" />}
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)] m-0">
                    {mode === 'cloud' && 'Allternit cloud harness'}
                    {mode === 'byok' && 'Bring your own API keys'}
                    {mode === 'local' && 'Local inference endpoint'}
                    {mode === 'subprocess' && 'Spawn a subprocess'}
                  </p>
                </button>
              ))}
            </div>

            {harness.mode === 'cloud' && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
                <div>
                  <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Base URL</Label>
                  <Input
                    value={harness.cloud?.baseURL || ''}
                    onChange={(e) => setHarness({ mode: 'cloud', cloud: { baseURL: e.target.value, accessToken: harness.cloud?.accessToken || '' } })}
                    placeholder="https://api..."
                    style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
                  />
                </div>
                <div>
                  <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Access Token</Label>
                  <Input
                    type="password"
                    value={harness.cloud?.accessToken || ''}
                    onChange={(e) => setHarness({ mode: 'cloud', cloud: { baseURL: harness.cloud?.baseURL || '', accessToken: e.target.value } })}
                    placeholder="Access token"
                    style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
                  />
                </div>
                <div>
                  <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Refresh Token (optional)</Label>
                  <Input
                    type="password"
                    value={harness.cloud?.refreshToken || ''}
                    onChange={(e) => setHarness({ mode: 'cloud', cloud: { baseURL: harness.cloud?.baseURL || '', accessToken: harness.cloud?.accessToken || '', refreshToken: e.target.value } })}
                    placeholder="Refresh token"
                    style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
                  />
                </div>
              </div>
            )}

            {harness.mode === 'byok' && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
                {(['anthropic', 'openai', 'google'] as const).map((provider) => (
                  <div key={provider} className="space-y-3">
                    <Label className="text-[var(--text-primary)] text-[13px] mb-2 block capitalize">
                      {provider} API Key
                    </Label>
                    <Input
                      type="password"
                      value={harness.byok?.[provider]?.apiKey || ''}
                      onChange={(e) => setHarness({
                        mode: 'byok',
                        byok: {
                          ...(harness.byok || {}),
                          [provider]: { ...(harness.byok?.[provider] || {}), apiKey: e.target.value },
                        },
                      })}
                      placeholder={provider === 'anthropic' ? 'sk-ant-...' : provider === 'openai' ? 'sk-...' : 'AIza...'}
                      style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
                    />
                    <Label className="text-[var(--text-secondary)] text-[12px] mb-1 block capitalize">
                      {provider} Base URL (optional)
                    </Label>
                    <Input
                      value={harness.byok?.[provider]?.baseURL || ''}
                      onChange={(e) => setHarness({
                        mode: 'byok',
                        byok: {
                          ...(harness.byok || {}),
                          [provider]: { ...(harness.byok?.[provider] || {}), baseURL: e.target.value },
                        },
                      })}
                      placeholder={provider === 'anthropic' ? 'https://api.anthropic.com' : provider === 'openai' ? 'https://api.openai.com' : 'https://generativelanguage.googleapis.com'}
                      style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
                    />
                  </div>
                ))}
              </div>
            )}

            {harness.mode === 'local' && (
              <div>
                <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Base URL</Label>
                <Input
                  value={harness.local?.baseURL || ''}
                  onChange={(e) => setHarness({ mode: 'local', local: { baseURL: e.target.value } })}
                  placeholder="http://localhost:11434"
                  style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
                />
              </div>
            )}

            {harness.mode === 'subprocess' && (
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Command</Label>
                  <Input
                    value={harness.subprocess?.command || ''}
                    onChange={(e) => setHarness({ mode: 'subprocess', subprocess: { command: e.target.value, cwd: harness.subprocess?.cwd } })}
                    placeholder="python agent_server.py"
                    style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
                  />
                </div>
                <div>
                  <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Working Directory (optional)</Label>
                  <Input
                    value={harness.subprocess?.cwd || ''}
                    onChange={(e) => setHarness({ mode: 'subprocess', subprocess: { command: harness.subprocess?.command || '', cwd: e.target.value } })}
                    placeholder="/path/to/workdir"
                    style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
                  />
                </div>
                <div>
                  <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Environment Variables (KEY=value, one per line)</Label>
                  <Textarea
                    value={Object.entries(harness.subprocess?.env || {}).map(([k, v]) => `${k}=${v}`).join('\n')}
                    onChange={(e) => {
                      const env: Record<string, string> = {};
                      e.target.value.split('\n').forEach((line) => {
                        const [k, ...rest] = line.split('=');
                        if (k && rest.length > 0) env[k.trim()] = rest.join('=').trim();
                      });
                      setHarness({ mode: 'subprocess', subprocess: { command: harness.subprocess?.command || '', cwd: harness.subprocess?.cwd, env } });
                    }}
                    rows={4}
                    style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1" style={{ background: STUDIO_THEME.accent, color: 'var(--ui-text-inverse)' }}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
