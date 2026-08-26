import React from "react";
import { Plugs, Key, ShieldCheck, Robot } from "@phosphor-icons/react";
import type { CreateAgentInput, AgentConnectorBinding, AgentSecretRef } from "@/lib/agents/agent.types";
import type { Connector } from "@/plugins/capability.types";
import { Input, Label } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { useConnectors } from "@/plugins/useCapabilities";

interface ConnectorsStepProps {
  formData: Partial<CreateAgentInput>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<CreateAgentInput>>>;
  isBotMode?: boolean;
}

function connectorProviderSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'connector';
}

const COMMON_CONNECTORS = [
  { provider: 'slack', label: 'Slack', capabilities: ['chat', 'notify'] },
  { provider: 'gmail', label: 'Gmail', capabilities: ['email_send', 'email_read'] },
  { provider: 'github', label: 'GitHub', capabilities: ['code', 'issues'] },
  { provider: 'linear', label: 'Linear', capabilities: ['issues', 'project'] },
  { provider: 'notion', label: 'Notion', capabilities: ['docs', 'knowledge'] },
  { provider: 'calendar', label: 'Calendar', capabilities: ['calendar_read', 'calendar_write'] },
];

export function ConnectorsStep({ formData, setFormData, isBotMode }: ConnectorsStepProps) {
  const { connectors, enabledIds } = useConnectors();
  const bindings = formData.connectorBindings ?? [];
  const secrets = formData.secretRefs ?? [];

  const installedConnectors = connectors.filter((c) => enabledIds.has(c.id));

  const toggleInstalledBinding = (connector: Connector) => {
    const existing = bindings.find((b) => b.connectorId === connector.id);
    if (existing) {
      setFormData((prev) => ({
        ...prev,
        connectorBindings: bindings.filter((b) => b.connectorId !== connector.id),
      }));
      return;
    }
    const provider = connectorProviderSlug(connector.appName || connector.name);
    const actions = connector.actions || [];
    const next: AgentConnectorBinding = {
      connectorId: connector.id,
      provider,
      label: connector.appName || connector.name,
      capabilities: actions.length > 0
        ? actions.map((a) => a.id || a.name)
        : ['read'],
      autonomous: true,
    };
    setFormData((prev) => ({
      ...prev,
      connectorBindings: [...bindings, next],
    }));
  };

  const addBinding = (provider: string, label: string, capabilities: string[]) => {
    const exists = bindings.some((b) => b.provider === provider);
    if (exists) return;
    const next: AgentConnectorBinding = {
      connectorId: `${provider}-${Date.now()}`,
      provider,
      label,
      capabilities,
      autonomous: true,
    };
    setFormData((prev) => ({
      ...prev,
      connectorBindings: [...bindings, next],
    }));
  };

  const removeBinding = (connectorId: string) => {
    setFormData((prev) => ({
      ...prev,
      connectorBindings: bindings.filter((b) => b.connectorId !== connectorId),
    }));
  };

  const addSecret = () => {
    const next: AgentSecretRef = {
      name: '',
      key: '',
      description: '',
      required: true,
    };
    setFormData((prev) => ({
      ...prev,
      secretRefs: [...secrets, next],
    }));
  };

  const updateSecret = (index: number, updates: Partial<AgentSecretRef>) => {
    const next = secrets.map((s, i) => (i === index ? { ...s, ...updates } : s));
    setFormData((prev) => ({ ...prev, secretRefs: next }));
  };

  const removeSecret = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      secretRefs: secrets.filter((_, i) => i !== index),
    }));
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="mb-6">
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)] m-0 mb-4 font-research flex items-center gap-2">
            <Plugs size={20} className="text-[var(--accent-primary)]" />
            Connectors & Integrations
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)] m-0">
            Choose the external services this {isBotMode ? 'bot' : 'agent'} can access autonomously.
            Credentials are stored in the vault; only capability bindings are kept here.
          </p>
        </div>

        {installedConnectors.length > 0 && (
          <div className="mb-6">
            <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3">Installed connectors</h4>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
              {installedConnectors.map((connector) => {
                const active = bindings.some((b) => b.connectorId === connector.id);
                return (
                  <button
                    key={connector.id}
                    type="button"
                    onClick={() => toggleInstalledBinding(connector)}
                    className={`rounded-[10px] border border-solid p-4 text-left transition-all duration-200 cursor-pointer flex items-start gap-3 ${
                      active
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                        : 'border-[var(--border-subtle)] bg-transparent hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <div className="mt-0.5">
                      {active ? (
                        <ShieldCheck size={18} className="text-[var(--accent-primary)]" />
                      ) : (
                        <Plugs size={18} className="text-[var(--text-secondary)]" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-[var(--text-primary)] text-[14px]">{connector.appName || connector.name}</div>
                      <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        {connector.authType}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3">Quick-pick integrations</h4>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          {COMMON_CONNECTORS.map((connector) => {
            const active = bindings.some((b) => b.provider === connector.provider);
            return (
              <button
                key={connector.provider}
                type="button"
                onClick={() =>
                  active
                    ? removeBinding(bindings.find((b) => b.provider === connector.provider)!.connectorId)
                    : addBinding(connector.provider, connector.label, connector.capabilities)
                }
                className={`rounded-[10px] border border-solid p-4 text-left transition-all duration-200 cursor-pointer flex items-start gap-3 ${
                  active
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                    : 'border-[var(--border-subtle)] bg-transparent hover:bg-[var(--surface-hover)]'
                }`}
              >
                <div className="mt-0.5">
                  {active ? (
                    <ShieldCheck size={18} className="text-[var(--accent-primary)]" />
                  ) : (
                    <Plugs size={18} className="text-[var(--text-secondary)]" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-[var(--text-primary)] text-[14px]">{connector.label}</div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 capitalize">
                    {connector.capabilities.join(', ')}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {bindings.length > 0 && (
          <div className="mt-6">
            <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Robot size={14} className="text-[var(--accent-primary)]" />
              Bound connectors
            </h4>
            <div className="flex flex-wrap gap-2">
              {bindings.map((binding) => (
                <span
                  key={binding.connectorId}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-primary)] px-3 py-1 text-[12px] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                >
                  {binding.label || binding.provider}
                  <button
                    type="button"
                    onClick={() => removeBinding(binding.connectorId)}
                    className="text-[var(--text-tertiary)] hover:text-[var(--status-error)]"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="mb-6">
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)] m-0 mb-4 font-research flex items-center gap-2">
            <Key size={20} className="text-[var(--accent-primary)]" />
            Secrets & API Keys
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)] m-0">
            Declare the secrets the runtime needs. The actual values are sealed in the vault and injected at runtime —
            they are never stored in this form.
          </p>
        </div>

        <div className="space-y-4">
          {secrets.map((secret, index) => (
            <div key={index} className="grid grid-cols-1 gap-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1.5">
                <Label className="text-[12px] text-[var(--text-secondary)]">Label</Label>
                <Input
                  value={secret.name}
                  onChange={(e) => updateSecret(index, { name: e.target.value })}
                  placeholder="e.g. Stripe API Key"
                  className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-[var(--text-secondary)]">Env / Config Key</Label>
                <Input
                  value={secret.key}
                  onChange={(e) => updateSecret(index, { key: e.target.value })}
                  placeholder="e.g. STRIPE_API_KEY"
                  className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSecret(index)}
                  className="text-[var(--status-error)] hover:bg-[var(--status-error)]/10"
                >
                  Remove
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-[var(--text-secondary)]">Value</Label>
                <Input
                  type="password"
                  value={secret.value || ''}
                  onChange={(e) => updateSecret(index, { value: e.target.value })}
                  placeholder="Stored encrypted; never shown again"
                  className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[12px] text-[var(--text-secondary)]">Description / Hint</Label>
                <Input
                  value={secret.description || ''}
                  onChange={(e) => updateSecret(index, { description: e.target.value })}
                  placeholder="Where to find or how to generate this secret"
                  className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addSecret}
            className="w-full border-dashed border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          >
            + Add Secret Reference
          </Button>
        </div>
      </div>
    </section>
  );
}
