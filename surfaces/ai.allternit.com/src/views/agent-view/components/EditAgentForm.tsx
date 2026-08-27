"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { Agent, CreateAgentInput, HarnessConfig, AppMode, AgentType, BotProfile, BotCategory, AgentConnectorBinding, AgentSecretRef, AgentMessagingConfig, AgentIdentityChannels, AgentVMOperatorConfig } from "@/lib/agents/agent.types";
import { STUDIO_THEME } from "../AgentView.constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { validateAgentCreationChecklist } from "@/lib/agents";
import { createModuleLogger } from "@/lib/logger";
import { ConnectorsStep } from "../steps/ConnectorsStep";
import { IdentityChannelsStep } from "../steps/IdentityChannelsStep";
import { VMOperatorStep } from "../steps/VMOperatorStep";

const logger = createModuleLogger('EditAgentForm');

const HARNESS_MODES = ['cloud', 'byok', 'local', 'subprocess'] as const;
const SURFACES: AppMode[] = ['chat', 'cowork', 'code', 'design', 'browser'];
const AGENT_TYPES: AgentType[] = ['orchestrator', 'sub-agent', 'worker', 'specialist', 'reviewer'];
const TRUST_TIERS: NonNullable<Agent['trustTier']>[] = ['safe', 'low', 'standard', 'elevated', 'admin', 'critical'];

export function EditAgentForm({ agent, onCancel, onSaved }: { agent: Agent; onCancel: () => void; onSaved?: () => void }) {
  const { updateAgent } = useAgentStore();
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [type, setType] = useState<AgentType>(agent.type);
  const [harness, setHarness] = useState<HarnessConfig>(agent.harness ?? { mode: 'cloud' });
  const [allowedSurfaces, setAllowedSurfaces] = useState<AppMode[]>(agent.allowedSurfaces ?? ['chat']);
  const [trustTier, setTrustTier] = useState<Agent['trustTier']>(agent.trustTier ?? 'standard');
  const [writeScope, setWriteScope] = useState(agent.writeScope ?? 'workspace');
  const [isBot, setIsBot] = useState(agent.isBot === true);
  const [botProfile, setBotProfile] = useState<BotProfile | undefined>(agent.botProfile);
  const [connectorBindings, setConnectorBindings] = useState<AgentConnectorBinding[]>(agent.connectorBindings ?? []);
  const [secretRefs, setSecretRefs] = useState<AgentSecretRef[]>(agent.secretRefs ?? []);
  const [messagingConfig, setMessagingConfig] = useState<AgentMessagingConfig | undefined>(agent.messagingConfig);
  const [identityChannels, setIdentityChannels] = useState<AgentIdentityChannels | undefined>(agent.identityChannels);
  const [vmOperator, setVMOperator] = useState<AgentVMOperatorConfig | undefined>(agent.vmOperator);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const formData: Partial<CreateAgentInput> = useMemo(() => ({
    name,
    description,
    type,
    harness,
    allowedSurfaces,
    trustTier,
    writeScope,
    isBot,
    botProfile: isBot ? botProfile : undefined,
    connectorBindings,
    secretRefs,
    messagingConfig,
    identityChannels,
    vmOperator,
  }), [name, description, type, harness, allowedSurfaces, trustTier, writeScope, isBot, botProfile, connectorBindings, secretRefs, messagingConfig, identityChannels, vmOperator]);

  const setFormData = (updater: React.SetStateAction<Partial<CreateAgentInput>>) => {
    const next = typeof updater === 'function' ? (updater as (prev: Partial<CreateAgentInput>) => Partial<CreateAgentInput>)(formData) : updater;
    if (next.connectorBindings !== undefined) setConnectorBindings(next.connectorBindings ?? []);
    if (next.secretRefs !== undefined) setSecretRefs(next.secretRefs ?? []);
    if (next.messagingConfig !== undefined) setMessagingConfig(next.messagingConfig);
    if (next.identityChannels !== undefined) setIdentityChannels(next.identityChannels);
    if (next.vmOperator !== undefined) setVMOperator(next.vmOperator);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecklistError(null);
    setSubmitError(null);
    const updates: Partial<CreateAgentInput> = {
      name,
      description,
      type,
      harness,
      allowedSurfaces,
      trustTier,
      writeScope,
      isBot,
      botProfile: isBot ? botProfile : undefined,
      connectorBindings,
      secretRefs,
      messagingConfig,
      identityChannels,
      vmOperator,
    };
    const merged = { ...agent, ...updates };
    const checklist = validateAgentCreationChecklist(merged);
    if (!checklist.isValid) {
      const failed = checklist.items
        .filter((i) => i.required && !i.satisfied)
        .map((i) => i.label)
        .join(', ');
      setChecklistError(`Checklist incomplete: ${failed}`);
      return;
    }
    setIsSubmitting(true);
    try {
      await updateAgent(agent.id, updates);
      onSaved?.();
      onCancel();
    } catch (err) {
      logger.error({ err }, 'Failed to update agent');
      setSubmitError(err instanceof Error ? err.message : 'Failed to update agent');
    } finally {
      setIsSubmitting(false);
    }
  };

  const setHarnessMode = (mode: HarnessConfig['mode']) => {
    setHarness({ mode });
  };

  return (
    <div className="flex flex-col items-center justify-start h-full p-6 overflow-auto">
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

          <div className="space-y-2">
            <Label style={{ color: STUDIO_THEME.textSecondary }}>Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as AgentType)}>
              <SelectTrigger style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label style={{ color: STUDIO_THEME.textSecondary }}>Allowed Surfaces</Label>
            <div className="flex flex-wrap gap-3">
              {SURFACES.map((surface) => (
                <label key={surface} className="flex items-center gap-2 text-[var(--text-primary)]">
                  <Checkbox
                    checked={allowedSurfaces.includes(surface)}
                    onCheckedChange={(checked) => {
                      setAllowedSurfaces((prev) =>
                        checked ? [...prev, surface] : prev.filter((s) => s !== surface)
                      );
                    }}
                  />
                  <span className="capitalize">{surface}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label style={{ color: STUDIO_THEME.textSecondary }}>Trust Tier</Label>
              <Select value={trustTier} onValueChange={(value) => setTrustTier(value as Agent['trustTier'])}>
                <SelectTrigger style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRUST_TIERS.map((tier) => (
                    <SelectItem key={tier} value={tier}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label style={{ color: STUDIO_THEME.textSecondary }}>Write Scope</Label>
              <Input
                value={writeScope}
                onChange={(e) => setWriteScope(e.target.value)}
                style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center justify-between">
              <Label style={{ color: STUDIO_THEME.textPrimary }}>Package as Bot</Label>
              <input
                type="checkbox"
                checked={isBot}
                onChange={(e) => {
                  const next = e.target.checked;
                  setIsBot(next);
                  if (next && !botProfile) {
                    setBotProfile({
                      displayName: name,
                      tagline: description,
                      welcomeMessage: `Hi, I'm ${name}. How can I help?`,
                      starterPrompts: [],
                      accentColor: '#6366f1',
                      groupChatEnabled: false,
                      botCategory: 'custom',
                    });
                  }
                }}
                className="size-4 accent-[var(--accent-primary)]"
              />
            </div>

            {isBot && botProfile && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label style={{ color: STUDIO_THEME.textSecondary }}>Display Name</Label>
                  <Input
                    value={botProfile.displayName}
                    onChange={(e) => setBotProfile({ ...botProfile, displayName: e.target.value })}
                    style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label style={{ color: STUDIO_THEME.textSecondary }}>Tagline</Label>
                  <Input
                    value={botProfile.tagline || ''}
                    onChange={(e) => setBotProfile({ ...botProfile, tagline: e.target.value })}
                    style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
                  />
                </div>
                <div className="space-y-2">
                  <Label style={{ color: STUDIO_THEME.textSecondary }}>Accent Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={botProfile.accentColor || '#6366f1'}
                      onChange={(e) => setBotProfile({ ...botProfile, accentColor: e.target.value })}
                      className="h-10 w-14"
                      style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle }}
                    />
                    <Input
                      value={botProfile.accentColor || '#6366f1'}
                      onChange={(e) => setBotProfile({ ...botProfile, accentColor: e.target.value })}
                      style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label style={{ color: STUDIO_THEME.textSecondary }}>Bot Category</Label>
                  <Select
                    value={botProfile.botCategory || 'custom'}
                    onValueChange={(value) => setBotProfile({ ...botProfile, botCategory: value as BotCategory })}
                  >
                    <SelectTrigger style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="research">Research</SelectItem>
                      <SelectItem value="code">Code</SelectItem>
                      <SelectItem value="writing">Writing</SelectItem>
                      <SelectItem value="data">Data</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="ops">Operations</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label style={{ color: STUDIO_THEME.textSecondary }}>Welcome Message</Label>
                  <Textarea
                    value={botProfile.welcomeMessage || ''}
                    onChange={(e) => setBotProfile({ ...botProfile, welcomeMessage: e.target.value })}
                    rows={2}
                    style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
                  />
                </div>
              </div>
            )}
          </div>

          <ConnectorsStep
            formData={formData}
            setFormData={setFormData}
            isBotMode={isBot}
          />

          <IdentityChannelsStep
            formData={formData}
            setFormData={setFormData}
            agentId={agent.id}
          />

          <VMOperatorStep
            formData={formData}
            setFormData={setFormData}
          />

          {checklistError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-[var(--status-error)] text-sm">
              {checklistError}
            </div>
          )}

          {submitError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-[var(--status-error)] text-sm">
              {submitError}
            </div>
          )}

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
