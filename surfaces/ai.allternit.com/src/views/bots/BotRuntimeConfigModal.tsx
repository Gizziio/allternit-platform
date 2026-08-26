"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X, Plugs, Key, ShieldCheck, Plus, Trash, Lightning, Robot, Envelope, Phone, Wallet, ComputerTower, Desktop, Globe, FileCode, Terminal, SquaresFour } from "@phosphor-icons/react";
import type { Agent, AgentConnectorBinding, AgentSecretRef, AgentWalletPaymentMethod, AgentVMAction, AgentVMProvider, AgentVMNetworkPolicy, AgentVMPersistence } from "@/lib/agents/agent.types";
import { updateAgent } from "@/lib/agents/agent.service";
import type { Connector } from "@/plugins/capability.types";
import { useConnectors } from "@/plugins/useCapabilities";
import { sealAgentSecret } from "@/lib/agents/agent-secrets.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassSurface } from "@/design/GlassSurface";
import { cn } from "@/lib/utils";

type RuntimeSection = "connectors" | "secrets" | "harness" | "identity" | "vm";

interface BotRuntimeConfigModalProps {
  bot: Agent;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialSection?: RuntimeSection;
}

const COMMON_CONNECTORS = [
  { provider: "slack", label: "Slack", capabilities: ["chat", "notify"] },
  { provider: "gmail", label: "Gmail", capabilities: ["email_send", "email_read"] },
  { provider: "github", label: "GitHub", capabilities: ["code", "issues"] },
  { provider: "linear", label: "Linear", capabilities: ["issues", "project"] },
  { provider: "notion", label: "Notion", capabilities: ["docs", "knowledge"] },
  { provider: "calendar", label: "Calendar", capabilities: ["calendar_read", "calendar_write"] },
];

function connectorProviderSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "connector";
}

export function BotRuntimeConfigModal({ bot, isOpen, onClose, onSaved, initialSection = "connectors" }: BotRuntimeConfigModalProps) {
  const { connectors, enabledIds } = useConnectors();
  const installedConnectors = useMemo(() => connectors.filter((c) => enabledIds.has(c.id)), [connectors, enabledIds]);

  const [activeSection, setActiveSection] = useState<RuntimeSection>(initialSection);

  const [bindings, setBindings] = useState<AgentConnectorBinding[]>(bot.connectorBindings ?? []);
  const [secrets, setSecrets] = useState<AgentSecretRef[]>(bot.secretRefs ?? []);
  const [secretValues, setSecretValues] = useState<Record<number, string>>({});

  const [harnessMode, setHarnessMode] = useState(bot.harness?.mode || "cloud");
  const [byokAnthropicKey, setByokAnthropicKey] = useState(bot.harness?.byok?.anthropic?.apiKey || "");
  const [byokOpenAIKey, setByokOpenAIKey] = useState(bot.harness?.byok?.openai?.apiKey || "");
  const [byokGoogleKey, setByokGoogleKey] = useState(bot.harness?.byok?.google?.apiKey || "");

  const [emailAddress, setEmailAddress] = useState(bot.identityChannels?.email?.address || "");
  const [emailProvider, setEmailProvider] = useState(bot.identityChannels?.email?.provider || "commrails");
  const [emailSend, setEmailSend] = useState(bot.identityChannels?.email?.sendEnabled ?? true);
  const [emailReceive, setEmailReceive] = useState(bot.identityChannels?.email?.receiveEnabled ?? true);

  const [phoneNumber, setPhoneNumber] = useState(bot.identityChannels?.phone?.number || "");
  const [phoneProvider, setPhoneProvider] = useState(bot.identityChannels?.phone?.provider || "vapi");
  const [phoneVoice, setPhoneVoice] = useState(bot.identityChannels?.phone?.voiceEnabled ?? true);
  const [phoneSms, setPhoneSms] = useState(bot.identityChannels?.phone?.smsEnabled ?? true);

  const [walletAddress, setWalletAddress] = useState(bot.identityChannels?.wallet?.address || "");
  const [walletProvider, setWalletProvider] = useState(bot.identityChannels?.wallet?.provider || "etrid");
  const [walletChainId, setWalletChainId] = useState(String(bot.identityChannels?.wallet?.chainId || ""));
  const [walletMethods, setWalletMethods] = useState<string[]>(bot.identityChannels?.wallet?.allowedMethods || ["receive", "invoice"]);

  const [vmEnabled, setVMEnabled] = useState(bot.vmOperator?.enabled ?? false);
  const [vmProvider, setVMProvider] = useState<AgentVMProvider>(bot.vmOperator?.provider || "opensandbox");
  const [vmImage, setVMImage] = useState(bot.vmOperator?.image || "");
  const [vmCpu, setVMCpu] = useState(bot.vmOperator?.resources?.cpu || "");
  const [vmMemory, setVMMemory] = useState(bot.vmOperator?.resources?.memory || "");
  const [vmDisk, setVMDisk] = useState(bot.vmOperator?.resources?.disk || "");
  const [vmActions, setVMActions] = useState<AgentVMAction[]>(bot.vmOperator?.allowedActions || []);
  const [vmNetworkPolicy, setVMNetworkPolicy] = useState<AgentVMNetworkPolicy>(bot.vmOperator?.networkPolicy || "restricted");
  const [vmPersistence, setVMPersistence] = useState<AgentVMPersistence>(bot.vmOperator?.persistence || "session");
  const [vmTimeout, setVMTimeout] = useState(bot.vmOperator?.timeoutMinutes ?? 30);
  const [vmVncEnabled, setVMVncEnabled] = useState(bot.vmOperator?.vncEnabled ?? false);
  const [vmAutoStart, setVMAutoStart] = useState(bot.vmOperator?.autoStart ?? true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveSection(initialSection);
      setBindings(bot.connectorBindings ?? []);
      setSecrets(bot.secretRefs ?? []);
      setSecretValues({});
      setHarnessMode(bot.harness?.mode || "cloud");
      setByokAnthropicKey(bot.harness?.byok?.anthropic?.apiKey || "");
      setByokOpenAIKey(bot.harness?.byok?.openai?.apiKey || "");
      setByokGoogleKey(bot.harness?.byok?.google?.apiKey || "");
      setEmailAddress(bot.identityChannels?.email?.address || "");
      setEmailProvider(bot.identityChannels?.email?.provider || "commrails");
      setEmailSend(bot.identityChannels?.email?.sendEnabled ?? true);
      setEmailReceive(bot.identityChannels?.email?.receiveEnabled ?? true);
      setPhoneNumber(bot.identityChannels?.phone?.number || "");
      setPhoneProvider(bot.identityChannels?.phone?.provider || "vapi");
      setPhoneVoice(bot.identityChannels?.phone?.voiceEnabled ?? true);
      setPhoneSms(bot.identityChannels?.phone?.smsEnabled ?? true);
      setWalletAddress(bot.identityChannels?.wallet?.address || "");
      setWalletProvider(bot.identityChannels?.wallet?.provider || "etrid");
      setWalletChainId(String(bot.identityChannels?.wallet?.chainId || ""));
      setWalletMethods(bot.identityChannels?.wallet?.allowedMethods || ["receive", "invoice"]);
      setVMEnabled(bot.vmOperator?.enabled ?? false);
      setVMProvider(bot.vmOperator?.provider || "opensandbox");
      setVMImage(bot.vmOperator?.image || "");
      setVMCpu(bot.vmOperator?.resources?.cpu || "");
      setVMMemory(bot.vmOperator?.resources?.memory || "");
      setVMDisk(bot.vmOperator?.resources?.disk || "");
      setVMActions(bot.vmOperator?.allowedActions || []);
      setVMNetworkPolicy(bot.vmOperator?.networkPolicy || "restricted");
      setVMPersistence(bot.vmOperator?.persistence || "session");
      setVMTimeout(bot.vmOperator?.timeoutMinutes ?? 30);
      setVMVncEnabled(bot.vmOperator?.vncEnabled ?? false);
      setVMAutoStart(bot.vmOperator?.autoStart ?? true);
      setError(null);
    }
  }, [isOpen, initialSection, bot]);

  const toggleInstalledBinding = useCallback((connector: Connector) => {
    setBindings((prev) => {
      const existing = prev.find((b) => b.connectorId === connector.id);
      if (existing) {
        return prev.filter((b) => b.connectorId !== connector.id);
      }
      const provider = connectorProviderSlug(connector.appName || connector.name);
      const actions = connector.actions || [];
      const next: AgentConnectorBinding = {
        connectorId: connector.id,
        provider,
        label: connector.appName || connector.name,
        capabilities: actions.length > 0 ? actions.map((a) => a.id || a.name) : ["read"],
        autonomous: true,
      };
      return [...prev, next];
    });
  }, []);

  const addQuickBinding = useCallback((provider: string, label: string, capabilities: string[]) => {
    setBindings((prev) => {
      if (prev.some((b) => b.provider === provider)) return prev;
      const next: AgentConnectorBinding = {
        connectorId: `${provider}-${Date.now()}`,
        provider,
        label,
        capabilities,
        autonomous: true,
      };
      return [...prev, next];
    });
  }, []);

  const removeBinding = useCallback((connectorId: string) => {
    setBindings((prev) => prev.filter((b) => b.connectorId !== connectorId));
  }, []);

  const addSecret = useCallback(() => {
    setSecrets((prev) => [...prev, { name: "", key: "", description: "", required: true }]);
  }, []);

  const updateSecret = useCallback((index: number, updates: Partial<AgentSecretRef>) => {
    setSecrets((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  }, []);

  const removeSecret = useCallback((index: number) => {
    setSecrets((prev) => prev.filter((_, i) => i !== index));
    setSecretValues((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  const toggleWalletMethod = useCallback((method: string) => {
    setWalletMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const validSecrets = secrets.filter((s) => s.name.trim() && s.key.trim());

      const harness = {
        mode: harnessMode as "cloud" | "byok" | "local" | "subprocess",
        ...(harnessMode === "byok" && {
          byok: {
            ...(byokAnthropicKey ? { anthropic: { apiKey: byokAnthropicKey } } : {}),
            ...(byokOpenAIKey ? { openai: { apiKey: byokOpenAIKey } } : {}),
            ...(byokGoogleKey ? { google: { apiKey: byokGoogleKey } } : {}),
          },
        }),
      };

      const identityChannels = {
        ...(emailAddress.trim()
          ? {
              email: {
                address: emailAddress.trim(),
                provider: emailProvider,
                sendEnabled: emailSend,
                receiveEnabled: emailReceive,
              },
            }
          : {}),
        ...(phoneNumber.trim()
          ? {
              phone: {
                number: phoneNumber.trim(),
                provider: phoneProvider,
                voiceEnabled: phoneVoice,
                smsEnabled: phoneSms,
              },
            }
          : {}),
        ...(walletAddress.trim() || walletProvider === "etrid"
          ? {
              wallet: {
                provider: walletProvider,
                ...(walletAddress.trim() ? { address: walletAddress.trim() } : {}),
                ...(walletChainId.trim() ? { chainId: walletChainId.trim() } : {}),
                allowedMethods: walletMethods as AgentWalletPaymentMethod[],
              },
            }
          : {}),
      };

      const vmOperator = vmEnabled
        ? {
            enabled: true,
            provider: vmProvider,
            ...(vmImage.trim() ? { image: vmImage.trim() } : {}),
            resources: {
              ...(vmCpu.trim() ? { cpu: vmCpu.trim() } : {}),
              ...(vmMemory.trim() ? { memory: vmMemory.trim() } : {}),
              ...(vmDisk.trim() ? { disk: vmDisk.trim() } : {}),
            },
            allowedActions: vmActions,
            networkPolicy: vmNetworkPolicy,
            persistence: vmPersistence,
            timeoutMinutes: vmTimeout,
            vncEnabled: vmVncEnabled,
            autoStart: vmAutoStart,
          }
        : { enabled: false, provider: vmProvider };

      await updateAgent(bot.id, {
        connectorBindings: bindings,
        secretRefs: validSecrets,
        harness,
        identityChannels,
        vmOperator,
      });

      const sealTasks: Promise<void>[] = [];
      for (const [idx, value] of Object.entries(secretValues)) {
        const secret = validSecrets[Number(idx)];
        if (secret && value.trim()) {
          sealTasks.push(sealAgentSecret({ agentId: bot.id, key: secret.key, value: value.trim() }));
        }
      }
      if (sealTasks.length > 0) {
        await Promise.all(sealTasks);
      }

      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save runtime config");
    } finally {
      setSaving(false);
    }
  }, [
    bot.id,
    bindings,
    secrets,
    secretValues,
    harnessMode,
    byokAnthropicKey,
    byokOpenAIKey,
    byokGoogleKey,
    emailAddress,
    emailProvider,
    emailSend,
    emailReceive,
    phoneNumber,
    phoneProvider,
    phoneVoice,
    phoneSms,
    walletAddress,
    walletProvider,
    walletChainId,
    walletMethods,
    onClose,
    onSaved,
  ]);

  if (!isOpen) return null;

  const sectionTabs = [
    { id: "connectors" as const, label: "Connectors", icon: Plugs },
    { id: "secrets" as const, label: "Secrets", icon: Key },
    { id: "harness" as const, label: "Harness", icon: Lightning },
    { id: "identity" as const, label: "Identity", icon: Robot },
    { id: "vm" as const, label: "Computer", icon: ComputerTower },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <GlassSurface className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)] shrink-0">
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
              Bot Runtime Configuration
            </h2>
            <p className="text-[13px] text-[var(--text-secondary)]">
              Connectors, secrets, harness, and identity channels for {bot.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1 border-b border-[var(--border-subtle)] px-5 shrink-0">
          {sectionTabs.map((tab) => {
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors",
                  isActive
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                <tab.icon size={14} />
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-[var(--accent-primary)]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {error && (
            <div className="rounded-lg border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 p-3 text-[13px] text-[var(--status-error)]">
              {error}
            </div>
          )}

          {activeSection === "connectors" && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Plugs size={18} className="text-[var(--accent-primary)]" />
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Connectors</h3>
              </div>

              {installedConnectors.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">
                    Installed connectors
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {installedConnectors.map((connector) => {
                      const active = bindings.some((b) => b.connectorId === connector.id);
                      return (
                        <button
                          key={connector.id}
                          type="button"
                          onClick={() => toggleInstalledBinding(connector)}
                          className={cn(
                            "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                            active
                              ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                              : "border-[var(--border-subtle)] bg-transparent hover:bg-[var(--surface-hover)]"
                          )}
                        >
                          {active ? (
                            <ShieldCheck size={18} className="text-[var(--accent-primary)] shrink-0 mt-0.5" />
                          ) : (
                            <Plugs size={18} className="text-[var(--text-secondary)] shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="text-[13px] font-medium text-[var(--text-primary)]">
                              {connector.appName || connector.name}
                            </div>
                            <div className="text-[11px] text-[var(--text-secondary)] capitalize">
                              {connector.authType}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <h4 className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">
                Quick-pick integrations
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {COMMON_CONNECTORS.map((connector) => {
                  const active = bindings.some((b) => b.provider === connector.provider);
                  return (
                    <button
                      key={connector.provider}
                      type="button"
                      onClick={() =>
                        active
                          ? removeBinding(bindings.find((b) => b.provider === connector.provider)!.connectorId)
                          : addQuickBinding(connector.provider, connector.label, connector.capabilities)
                      }
                      className={cn(
                        "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                        active
                          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                          : "border-[var(--border-subtle)] bg-transparent hover:bg-[var(--surface-hover)]"
                      )}
                    >
                      {active ? (
                        <ShieldCheck size={18} className="text-[var(--accent-primary)] shrink-0 mt-0.5" />
                      ) : (
                        <Plugs size={18} className="text-[var(--text-secondary)] shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="text-[13px] font-medium text-[var(--text-primary)]">
                          {connector.label}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] capitalize">
                          {connector.capabilities.join(", ")}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {bindings.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">
                    Bound connectors
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {bindings.map((binding) => (
                      <span
                        key={binding.connectorId}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] px-3 py-1 text-[12px] text-[var(--text-primary)]"
                      >
                        {binding.label || binding.provider}
                        <button
                          type="button"
                          onClick={() => removeBinding(binding.connectorId)}
                          className="text-[var(--text-tertiary)] hover:text-[var(--status-error)] transition-colors"
                        >
                          <X size={12} weight="bold" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {activeSection === "secrets" && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Key size={18} className="text-[var(--accent-primary)]" />
                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Secrets & API Keys</h3>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addSecret} className="gap-1.5">
                  <Plus size={14} />
                  Add secret
                </Button>
              </div>

              {secrets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-center">
                  <p className="text-[13px] text-[var(--text-secondary)]">No secrets declared yet.</p>
                  <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
                    Add API keys or tokens the bot needs at runtime.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {secrets.map((secret, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div className="space-y-1.5">
                          <Label className="text-[12px] text-[var(--text-secondary)]">Label</Label>
                          <Input
                            value={secret.name}
                            onChange={(e) => updateSecret(index, { name: e.target.value })}
                            placeholder="e.g. Stripe API Key"
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[12px] text-[var(--text-secondary)]">Env / Config Key</Label>
                          <Input
                            value={secret.key}
                            onChange={(e) => updateSecret(index, { key: e.target.value })}
                            placeholder="e.g. STRIPE_API_KEY"
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5 mb-3">
                        <Label className="text-[12px] text-[var(--text-secondary)]">Description</Label>
                        <Input
                          value={secret.description || ""}
                          onChange={(e) => updateSecret(index, { description: e.target.value })}
                          placeholder="What is this secret for?"
                          className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div className="space-y-1.5">
                          <Label className="text-[12px] text-[var(--text-secondary)]">
                            Value {secret.vaultRef ? "(sealed — enter to update)" : ""}
                          </Label>
                          <Input
                            type="password"
                            value={secretValues[index] || ""}
                            onChange={(e) =>
                              setSecretValues((prev) => ({ ...prev, [index]: e.target.value }))
                            }
                            placeholder={secret.vaultRef ? "••••••" : "Leave blank to declare only"}
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                        <div className="flex items-center gap-3 pt-5">
                          <label className="inline-flex items-center gap-2 text-[12px] text-[var(--text-secondary)] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={secret.required}
                              onChange={(e) => updateSecret(index, { required: e.target.checked })}
                              className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                            />
                            Required to start
                          </label>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeSecret(index)}
                          className="gap-1.5 text-[var(--status-error)] border-[var(--status-error)]/30 hover:bg-[var(--status-error)]/10"
                        >
                          <Trash size={14} />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeSection === "harness" && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Lightning size={18} className="text-[var(--accent-primary)]" />
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Harness</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-[12px] text-[var(--text-secondary)]">Execution Mode</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                    {(["cloud", "byok", "local", "subprocess"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setHarnessMode(mode)}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-colors",
                          harnessMode === mode
                            ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                            : "border-[var(--border-subtle)] bg-transparent hover:bg-[var(--surface-hover)]"
                        )}
                      >
                        <div className="text-[13px] font-medium text-[var(--text-primary)] capitalize">
                          {mode.replace("-", " ")}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          {mode === "cloud" && "Allternit-managed runners"}
                          {mode === "byok" && "Bring your own API keys"}
                          {mode === "local" && "Local runtime endpoint"}
                          {mode === "subprocess" && "Spawn a local process"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {harnessMode === "byok" && (
                  <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                    <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">Provider API Keys</h4>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Anthropic API Key</Label>
                      <Input
                        type="password"
                        value={byokAnthropicKey}
                        onChange={(e) => setByokAnthropicKey(e.target.value)}
                        placeholder="sk-ant-..."
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">OpenAI API Key</Label>
                      <Input
                        type="password"
                        value={byokOpenAIKey}
                        onChange={(e) => setByokOpenAIKey(e.target.value)}
                        placeholder="sk-..."
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Google API Key</Label>
                      <Input
                        type="password"
                        value={byokGoogleKey}
                        onChange={(e) => setByokGoogleKey(e.target.value)}
                        placeholder="AIza..."
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeSection === "identity" && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Robot size={18} className="text-[var(--accent-primary)]" />
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Identity Channels</h3>
              </div>

              <div className="space-y-4">
                {/* Email */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Envelope size={16} className="text-[var(--accent-primary)]" />
                    <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">Email</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Address</Label>
                      <Input
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        placeholder="bot@yourdomain.com"
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Provider</Label>
                      <select
                        value={emailProvider}
                        onChange={(e) => setEmailProvider(e.target.value as any)}
                        className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[13px] px-2"
                      >
                        <option value="commrails">CommRails</option>
                        <option value="google_workspace">Google Workspace</option>
                        <option value="microsoft_365">Microsoft 365</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emailSend}
                          onChange={(e) => setEmailSend(e.target.checked)}
                          className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                        />
                        Send
                      </label>
                      <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emailReceive}
                          onChange={(e) => setEmailReceive(e.target.checked)}
                          className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                        />
                        Receive
                      </label>
                    </div>
                  </div>
                </div>

                {/* Phone */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Phone size={16} className="text-[var(--accent-primary)]" />
                    <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">Phone</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Number</Label>
                      <Input
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+1 555 000 0000"
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Provider</Label>
                      <select
                        value={phoneProvider}
                        onChange={(e) => setPhoneProvider(e.target.value as any)}
                        className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[13px] px-2"
                      >
                        <option value="vapi">Vapi</option>
                        <option value="twilio">Twilio</option>
                        <option value="telnyx">Telnyx</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={phoneVoice}
                          onChange={(e) => setPhoneVoice(e.target.checked)}
                          className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                        />
                        Voice
                      </label>
                      <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={phoneSms}
                          onChange={(e) => setPhoneSms(e.target.checked)}
                          className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                        />
                        SMS
                      </label>
                    </div>
                  </div>
                </div>

                {/* Wallet */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet size={16} className="text-[var(--accent-primary)]" />
                    <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">Wallet</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Provider</Label>
                      <select
                        value={walletProvider}
                        onChange={(e) => setWalletProvider(e.target.value as any)}
                        className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[13px] px-2"
                      >
                        <option value="etrid">Etrid (native)</option>
                        <option value="metamask">MetaMask</option>
                        <option value="coinbase_wallet">Coinbase Wallet</option>
                        <option value="rainbow">Rainbow</option>
                        <option value="phantom">Phantom</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Chain ID</Label>
                      <Input
                        value={walletChainId}
                        onChange={(e) => setWalletChainId(e.target.value)}
                        placeholder="e.g. 1, 8453, solana"
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Address</Label>
                      <Input
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                        placeholder="0x... or address"
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Allowed Methods</Label>
                      <div className="flex flex-wrap gap-3">
                        {(["send", "receive", "swap", "stake", "invoice"] as const).map((method) => (
                          <label key={method} className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={walletMethods.includes(method)}
                              onChange={() => toggleWalletMethod(method)}
                              className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                            />
                            <span className="capitalize">{method}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSection === "vm" && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ComputerTower size={18} className="text-[var(--accent-primary)]" />
                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Virtual Computer</h3>
                </div>
                <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vmEnabled}
                    onChange={(e) => setVMEnabled(e.target.checked)}
                    className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                  />
                  Enabled
                </label>
              </div>

              {vmEnabled ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Provider</Label>
                      <select
                        value={vmProvider}
                        onChange={(e) => setVMProvider(e.target.value as AgentVMProvider)}
                        className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[13px] px-2"
                      >
                        <option value="opensandbox">OpenSandbox</option>
                        <option value="docker">Docker</option>
                        <option value="kubernetes">Kubernetes</option>
                        <option value="local">Local Runner</option>
                        <option value="custom">Custom Provider</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Image</Label>
                      <Input
                        value={vmImage}
                        onChange={(e) => setVMImage(e.target.value)}
                        placeholder="opensandbox/desktop:v1.0.0"
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[12px] text-[var(--text-secondary)] mb-2 block">Allowed Actions</Label>
                    <div className="flex flex-wrap gap-3">
                      {([
                        { id: "command" as const, label: "Shell commands", icon: Terminal },
                        { id: "browser" as const, label: "Browser", icon: Globe },
                        { id: "file" as const, label: "Files", icon: FileCode },
                        { id: "desktop" as const, label: "Desktop / VNC", icon: Desktop },
                        { id: "code" as const, label: "Code execution", icon: SquaresFour },
                      ]).map((action) => {
                        const Icon = action.icon;
                        return (
                          <label
                            key={action.id}
                            className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={vmActions.includes(action.id)}
                              onChange={(e) => {
                                setVMActions((prev) =>
                                  e.target.checked ? [...prev, action.id] : prev.filter((a) => a !== action.id)
                                );
                              }}
                              className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                            />
                            <Icon size={14} className="text-[var(--text-secondary)]" />
                            {action.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">CPU</Label>
                      <Input
                        value={vmCpu}
                        onChange={(e) => setVMCpu(e.target.value)}
                        placeholder="1"
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Memory</Label>
                      <Input
                        value={vmMemory}
                        onChange={(e) => setVMMemory(e.target.value)}
                        placeholder="2Gi"
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Disk</Label>
                      <Input
                        value={vmDisk}
                        onChange={(e) => setVMDisk(e.target.value)}
                        placeholder="10Gi"
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Network Policy</Label>
                      <select
                        value={vmNetworkPolicy}
                        onChange={(e) => setVMNetworkPolicy(e.target.value as AgentVMNetworkPolicy)}
                        className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[13px] px-2"
                      >
                        <option value="isolated">Isolated</option>
                        <option value="restricted">Restricted</option>
                        <option value="open">Open</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Persistence</Label>
                      <select
                        value={vmPersistence}
                        onChange={(e) => setVMPersistence(e.target.value as AgentVMPersistence)}
                        className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[13px] px-2"
                      >
                        <option value="ephemeral">Ephemeral</option>
                        <option value="session">Session</option>
                        <option value="persistent">Persistent</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Timeout (min)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={1440}
                        value={vmTimeout}
                        onChange={(e) => setVMTimeout(Number(e.target.value))}
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer self-end pb-2">
                      <input
                        type="checkbox"
                        checked={vmVncEnabled}
                        onChange={(e) => setVMVncEnabled(e.target.checked)}
                        className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                      />
                      VNC stream
                    </label>
                    <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer self-end pb-2">
                      <input
                        type="checkbox"
                        checked={vmAutoStart}
                        onChange={(e) => setVMAutoStart(e.target.checked)}
                        className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                      />
                      Auto-start on task
                    </label>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-center">
                  <p className="text-[13px] text-[var(--text-secondary)]">Virtual computer is disabled.</p>
                  <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
                    Enable it to let this bot run tasks inside a sandbox.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-5 border-t border-[var(--border-subtle)] shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving}
            className="gap-1.5"
            style={{ background: "var(--accent-primary)", color: "#fff" }}
          >
            {saving ? "Saving…" : "Save runtime config"}
          </Button>
        </div>
      </GlassSurface>
    </div>
  );
}
