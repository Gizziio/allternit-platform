import React from "react";
import { Plugs, Key, Robot } from "@phosphor-icons/react";
import type { CreateAgentInput, AgentConnectorBinding, AgentSecretRef } from "@/lib/agents/agent.types";
import type { OwnedConnector } from "@/lib/design/owned-connector";
import { Input, Label } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ConnectorMarketplace } from "@/components/marketplace/ConnectorMarketplace";

interface ConnectorsStepProps {
  formData: Partial<CreateAgentInput>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<CreateAgentInput>>>;
  isBotMode?: boolean;
}

function connectorProviderSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'connector';
}

function bindingFromOwned(c: OwnedConnector): AgentConnectorBinding {
  return {
    connectorId: c.id,
    provider: connectorProviderSlug(c.name),
    label: c.name,
    capabilities: ['connect'],
    autonomous: true,
  };
}

export function ConnectorsStep({ formData, setFormData, isBotMode }: ConnectorsStepProps) {
  const bindings = formData.connectorBindings ?? [];
  const secrets = formData.secretRefs ?? [];
  const boundIds = React.useMemo(() => new Set(bindings.map((b) => b.connectorId)), [bindings]);

  const bindConnector = (c: OwnedConnector) => {
    setFormData((prev) => ({
      ...prev,
      connectorBindings: [...(prev.connectorBindings ?? []), bindingFromOwned(c)],
    }));
  };

  const unbindConnector = (c: OwnedConnector) => {
    setFormData((prev) => ({
      ...prev,
      connectorBindings: (prev.connectorBindings ?? []).filter((b) => b.connectorId !== c.id),
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

        <ConnectorMarketplace
          bindOnConnect
          boundIds={boundIds}
          onBind={bindConnector}
          onUnbind={unbindConnector}
        />

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
