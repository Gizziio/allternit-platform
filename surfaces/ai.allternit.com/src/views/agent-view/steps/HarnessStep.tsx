import React from "react";
import {
  Network,
  CheckCircle,
} from "@phosphor-icons/react";
import type { CreateAgentInput, HarnessConfig, AppMode } from "@/lib/agents/agent.types";
import {
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Label,
} from "@/components/ui";
import { TagInput } from "@/components/ui/tag-input";

interface HarnessStepProps {
  formData: Partial<CreateAgentInput>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<CreateAgentInput>>>;
}

export function HarnessStep({ formData, setFormData }: HarnessStepProps) {
  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
        <div className="mb-6">
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)] m-0 mb-4 font-research flex items-center gap-2">
            <Network size={20} className="text-[var(--accent-primary)]" />
            Harness & Routing
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)] m-0 mb-5">
            Configure how this agent routes AI requests and which surfaces it can use.
          </p>
        </div>

        <div className="mb-6">
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4">Harness Mode</h3>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            {(['cloud', 'byok', 'local', 'subprocess'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`rounded-[10px] border border-solid p-4 text-left transition-all duration-200 cursor-pointer ${
                  formData.harness?.mode === mode ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'border-[var(--border-subtle)] bg-transparent'
                }`}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    harness: { mode } as HarnessConfig,
                  }))
                }
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-[var(--text-primary)] capitalize">{mode}</span>
                  {formData.harness?.mode === mode && <CheckCircle size={16} className="text-[var(--accent-primary)]" />}
                </div>
                <p className="text-[12px] text-[var(--text-secondary)] m-0">
                  {mode === 'cloud' && 'Route requests through the Allternit cloud harness.'}
                  {mode === 'byok' && 'Bring your own API keys for direct provider access.'}
                  {mode === 'local' && 'Connect to a local inference endpoint.'}
                  {mode === 'subprocess' && 'Spawn a local subprocess for execution.'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {formData.harness?.mode === 'cloud' && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 mb-6">
            <div>
              <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Base URL</Label>
              <Input
                value={formData.harness.cloud?.baseURL || ''}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  harness: { ...prev.harness, mode: 'cloud', cloud: { ...(prev.harness?.cloud || {}), baseURL: e.target.value } } as HarnessConfig,
                }))}
                placeholder="https://api..."
                className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>
            <div>
              <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Access Token</Label>
              <Input
                type="password"
                value={formData.harness.cloud?.accessToken || ''}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  harness: { ...prev.harness, mode: 'cloud', cloud: { ...(prev.harness?.cloud || {}), accessToken: e.target.value } } as HarnessConfig,
                }))}
                placeholder="Access token"
                className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>
          </div>
        )}

        {formData.harness?.mode === 'byok' && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 mb-6">
            {(['anthropic', 'openai', 'google'] as const).map((provider) => (
              <div key={provider} className="space-y-3">
                <Label className="text-[var(--text-primary)] text-[13px] mb-2 block capitalize">
                  {provider} API Key
                </Label>
                <Input
                  type="password"
                  value={formData.harness?.byok?.[provider]?.apiKey || ''}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    harness: {
                      ...prev.harness,
                      mode: 'byok',
                      byok: {
                        ...(prev.harness?.byok || {}),
                        [provider]: {
                          ...(prev.harness?.byok?.[provider] || {}),
                          apiKey: e.target.value,
                        },
                      },
                    } as HarnessConfig,
                  }))}
                  placeholder={provider === 'anthropic' ? 'sk-ant-...' : provider === 'openai' ? 'sk-...' : 'AIza...'}
                  className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
                <Label className="text-[var(--text-secondary)] text-[12px] mb-1 block capitalize">
                  {provider} Base URL (optional)
                </Label>
                <Input
                  value={formData.harness?.byok?.[provider]?.baseURL || ''}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    harness: {
                      ...prev.harness,
                      mode: 'byok',
                      byok: {
                        ...(prev.harness?.byok || {}),
                        [provider]: {
                          ...(prev.harness?.byok?.[provider] || {}),
                          baseURL: e.target.value,
                        },
                      },
                    } as HarnessConfig,
                  }))}
                  placeholder={provider === 'anthropic' ? 'https://api.anthropic.com' : provider === 'openai' ? 'https://api.openai.com' : 'https://generativelanguage.googleapis.com'}
                  className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
            ))}
          </div>
        )}

        {formData.harness?.mode === 'local' && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 mb-6">
            <div>
              <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Base URL</Label>
              <Input
                value={formData.harness.local?.baseURL || ''}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  harness: { ...prev.harness, mode: 'local', local: { ...(prev.harness?.local || {}), baseURL: e.target.value } } as HarnessConfig,
                }))}
                placeholder="http://localhost:11434"
                className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>
          </div>
        )}

        {formData.harness?.mode === 'subprocess' && (
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div>
              <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Command</Label>
              <Input
                value={formData.harness.subprocess?.command || ''}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  harness: { ...prev.harness, mode: 'subprocess', subprocess: { ...(prev.harness?.subprocess || {}), command: e.target.value } } as HarnessConfig,
                }))}
                placeholder="python agent_server.py"
                className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>
            <div>
              <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Working Directory (optional)</Label>
              <Input
                value={formData.harness.subprocess?.cwd || ''}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  harness: { ...prev.harness, mode: 'subprocess', subprocess: { ...(prev.harness?.subprocess || {}), cwd: e.target.value } } as HarnessConfig,
                }))}
                placeholder="/path/to/workdir"
                className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>
            <div>
              <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Environment Variables (KEY=value, one per line)</Label>
              <Textarea
                value={Object.entries(formData.harness.subprocess?.env || {}).map(([k, v]) => `${k}=${v}`).join('\n')}
                onChange={(e) => {
                  const env: Record<string, string> = {};
                  e.target.value.split('\n').forEach((line) => {
                    const [k, ...rest] = line.split('=');
                    if (k && rest.length > 0) env[k.trim()] = rest.join('=').trim();
                  });
                  setFormData((prev) => ({
                    ...prev,
                    harness: { ...prev.harness, mode: 'subprocess', subprocess: { ...(prev.harness?.subprocess || {}), env } } as HarnessConfig,
                  }));
                }}
                rows={4}
                className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>
          </div>
        )}

        <div className="h-px bg-[var(--border-subtle)] my-6" />

        <div className="mb-6">
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4">Allowed Surfaces</h3>
          <div className="flex flex-wrap gap-3">
            {(['chat', 'cowork', 'code', 'design', 'browser'] as AppMode[]).map((surface) => (
              <button
                key={surface}
                type="button"
                onClick={() => {
                  setFormData((prev) => {
                    const current = prev.allowedSurfaces || [];
                    const next = current.includes(surface)
                      ? current.filter((s) => s !== surface)
                      : [...current, surface];
                    return { ...prev, allowedSurfaces: next as AppMode[] };
                  });
                }}
                className={`px-3 py-1.5 rounded-md text-[12px] border border-solid transition-all duration-200 ${
                  (formData.allowedSurfaces || []).includes(surface)
                    ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                }`}
              >
                {surface}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-[var(--border-subtle)] my-6" />

        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-[var(--text-primary)] text-[13px]">Trust Tier</Label>
            <Select
              value={formData.trustTier}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, trustTier: value as CreateAgentInput['trustTier'] }))}
            >
              <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)]">
                <SelectItem value="safe">Safe</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="elevated">Elevated</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-[var(--text-primary)] text-[13px]">Write Scope</Label>
            <Input
              value={formData.writeScope}
              onChange={(e) => setFormData((prev) => ({ ...prev, writeScope: e.target.value }))}
              placeholder="workspace"
              className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-[var(--text-primary)] text-[13px]">Data Classification</Label>
            <Input
              value={formData.dataClassification}
              onChange={(e) => setFormData((prev) => ({ ...prev, dataClassification: e.target.value }))}
              placeholder="internal"
              className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-[var(--text-primary)] text-[13px]">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value as CreateAgentInput['category'] }))}
            >
              <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)]">
                <SelectItem value="engineering">Engineering</SelectItem>
                <SelectItem value="design">Design</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="research">Research</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
                <SelectItem value="creative">Creative</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-6">
          <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Tags</Label>
          <TagInput
            value={formData.tags || []}
            onChange={(tags) => setFormData((prev) => ({ ...prev, tags }))}
            placeholder="Add tags..."
          />
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Allowed Skills</Label>
            <TagInput
              value={formData.allowedSkills || []}
              onChange={(tags) => setFormData((prev) => ({ ...prev, allowedSkills: tags }))}
              placeholder="Add allowed skills..."
            />
          </div>
          <div>
            <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Allowed Tools</Label>
            <TagInput
              value={formData.allowedTools || []}
              onChange={(tags) => setFormData((prev) => ({ ...prev, allowedTools: tags }))}
              placeholder="Add allowed tools..."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
