"use client";

import React from "react";
import { ComputerTower, CheckCircle, Desktop, Globe, FileCode, Terminal, SquaresFour } from "@phosphor-icons/react";
import type { CreateAgentInput, AgentVMOperatorConfig, AgentVMAction, AgentVMProvider, AgentVMNetworkPolicy, AgentVMPersistence } from "@/lib/agents/agent.types";
import { Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui";
import { cn } from "@/lib/utils";

interface VMOperatorStepProps {
  formData: Partial<CreateAgentInput>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<CreateAgentInput>>>;
}

const PROVIDERS: { id: AgentVMProvider; label: string; description: string }[] = [
  { id: "opensandbox", label: "OpenSandbox", description: "General-purpose sandbox runtime for AI agents (Docker/Kubernetes)." },
  { id: "docker", label: "Docker", description: "Run tasks in local Docker containers." },
  { id: "kubernetes", label: "Kubernetes", description: "Schedule sandbox workloads on a Kubernetes cluster." },
  { id: "local", label: "Local Runner", description: "Execute tasks on the local machine with process isolation." },
  { id: "custom", label: "Custom Provider", description: "Connect to your own VM operator endpoint." },
];

const IMAGES: { id: string; label: string; description: string; provider: AgentVMProvider }[] = [
  { id: "opensandbox/code-interpreter:v1.1.0", label: "Code Interpreter", description: "Python/Node sandbox for code execution.", provider: "opensandbox" },
  { id: "opensandbox/desktop:v1.0.0", label: "Desktop", description: "Full desktop environment with VNC access.", provider: "opensandbox" },
  { id: "opensandbox/chrome:v1.0.0", label: "Browser", description: "Chromium sandbox for web automation.", provider: "opensandbox" },
  { id: "opensandbox/playwright:v1.0.0", label: "Playwright", description: "Headless browser automation with Playwright.", provider: "opensandbox" },
  { id: "custom", label: "Custom Image", description: "Provide your own sandbox image.", provider: "opensandbox" },
];

const ACTIONS: { id: AgentVMAction; label: string; icon: React.ElementType }[] = [
  { id: "command", label: "Shell commands", icon: Terminal },
  { id: "browser", label: "Browser automation", icon: Globe },
  { id: "file", label: "File operations", icon: SquaresFour },
  { id: "desktop", label: "Desktop / VNC", icon: Desktop },
  { id: "code", label: "Code execution", icon: FileCode },
];

const NETWORK_POLICIES: { id: AgentVMNetworkPolicy; label: string; description: string }[] = [
  { id: "isolated", label: "Isolated", description: "No outbound network access." },
  { id: "restricted", label: "Restricted", description: "Limited outbound access to known endpoints." },
  { id: "open", label: "Open", description: "Full outbound network access." },
];

const PERSISTENCE_OPTIONS: { id: AgentVMPersistence; label: string; description: string }[] = [
  { id: "ephemeral", label: "Ephemeral", description: "Sandbox is destroyed after each task." },
  { id: "session", label: "Session", description: "Sandbox persists for the duration of a session." },
  { id: "persistent", label: "Persistent", description: "Sandbox filesystem is kept across tasks." },
];

export function VMOperatorStep({ formData, setFormData }: VMOperatorStepProps) {
  const vm = formData.vmOperator;
  const enabled = vm?.enabled ?? false;

  const updateVM = (updates: Partial<AgentVMOperatorConfig>) => {
    setFormData((prev) => ({
      ...prev,
      vmOperator: {
        enabled: prev.vmOperator?.enabled ?? false,
        provider: prev.vmOperator?.provider ?? "opensandbox",
        ...(prev.vmOperator || {}),
        ...updates,
      },
    }));
  };

  const toggleAction = (action: AgentVMAction) => {
    const current = vm?.allowedActions ?? [];
    const next = current.includes(action) ? current.filter((a) => a !== action) : [...current, action];
    updateVM({ allowedActions: next });
  };

  const selectedImage = IMAGES.find((i) => i.id === vm?.image) ?? IMAGES[0];

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="mb-6">
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)] m-0 mb-4 font-research flex items-center gap-2">
            <ComputerTower size={20} className="text-[var(--accent-primary)]" />
            Virtual Computer Operator
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)] m-0">
            Let this bot run tasks inside a sandboxed virtual computer. The bot can execute commands,
            operate browsers, edit files, and stream a desktop when enabled.
          </p>
        </div>

        {/* Enable toggle */}
        <button
          type="button"
          onClick={() => updateVM({ enabled: !enabled })}
          className={cn(
            "w-full rounded-[10px] border border-solid p-4 text-left transition-all duration-200 cursor-pointer flex items-start gap-3 mb-6",
            enabled
              ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
              : "border-[var(--border-subtle)] bg-transparent hover:bg-[var(--surface-hover)]"
          )}
        >
          <div className="mt-0.5">
            {enabled ? (
              <CheckCircle size={20} className="text-[var(--accent-primary)]" />
            ) : (
              <ComputerTower size={20} className="text-[var(--text-secondary)]" />
            )}
          </div>
          <div>
            <div className="font-medium text-[var(--text-primary)]">Enable Virtual Computer</div>
            <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">
              {enabled
                ? "Bot can launch sandboxes and operate apps on your behalf."
                : "Bot is chat-only until you turn this on."}
            </div>
          </div>
        </button>

        {enabled && (
          <div className="space-y-6">
            {/* Provider */}
            <div>
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4">Provider</h3>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => updateVM({ provider: provider.id })}
                    className={cn(
                      "rounded-[10px] border border-solid p-4 text-left transition-all duration-200 cursor-pointer",
                      vm?.provider === provider.id
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                        : "border-[var(--border-subtle)] bg-transparent hover:bg-[var(--surface-hover)]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-[var(--text-primary)]">{provider.label}</span>
                      {vm?.provider === provider.id && <CheckCircle size={16} className="text-[var(--accent-primary)]" />}
                    </div>
                    <p className="text-[12px] text-[var(--text-secondary)] m-0">{provider.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Image */}
            <div>
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4">Environment Image</h3>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 mb-3">
                {IMAGES.filter((i) => i.provider === "opensandbox").map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => updateVM({ image: image.id === "custom" ? "" : image.id })}
                    className={cn(
                      "rounded-[10px] border border-solid p-4 text-left transition-all duration-200 cursor-pointer",
                      selectedImage.id === image.id
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                        : "border-[var(--border-subtle)] bg-transparent hover:bg-[var(--surface-hover)]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-[var(--text-primary)]">{image.label}</span>
                      {selectedImage.id === image.id && <CheckCircle size={16} className="text-[var(--accent-primary)]" />}
                    </div>
                    <p className="text-[12px] text-[var(--text-secondary)] m-0">{image.description}</p>
                  </button>
                ))}
              </div>
              {(selectedImage.id === "custom" || !IMAGES.some((i) => i.id === vm?.image)) && (
                <div>
                  <Label className="text-[12px] text-[var(--text-secondary)]">Custom Image</Label>
                  <Input
                    value={vm?.image || ""}
                    onChange={(e) => updateVM({ image: e.target.value })}
                    placeholder="e.g. opensandbox/desktop:v1.0.0"
                    className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </div>
              )}
            </div>

            {/* Allowed actions */}
            <div>
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4">Allowed Actions</h3>
              <div className="flex flex-wrap gap-3">
                {ACTIONS.map((action) => {
                  const active = (vm?.allowedActions ?? []).includes(action.id);
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => toggleAction(action.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] border border-solid transition-all duration-200",
                        active
                          ? "bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]"
                          : "bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]"
                      )}
                    >
                      <Icon size={14} />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4">Resources</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-[12px] text-[var(--text-secondary)]">CPU</Label>
                  <Input
                    value={vm?.resources?.cpu || ""}
                    onChange={(e) =>
                      updateVM({
                        resources: { ...(vm?.resources || {}), cpu: e.target.value },
                      })
                    }
                    placeholder="1"
                    className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <Label className="text-[12px] text-[var(--text-secondary)]">Memory</Label>
                  <Input
                    value={vm?.resources?.memory || ""}
                    onChange={(e) =>
                      updateVM({
                        resources: { ...(vm?.resources || {}), memory: e.target.value },
                      })
                    }
                    placeholder="2Gi"
                    className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <Label className="text-[12px] text-[var(--text-secondary)]">Disk</Label>
                  <Input
                    value={vm?.resources?.disk || ""}
                    onChange={(e) =>
                      updateVM({
                        resources: { ...(vm?.resources || {}), disk: e.target.value },
                      })
                    }
                    placeholder="10Gi"
                    className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </div>
              </div>
            </div>

            {/* Policy */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-[13px] text-[var(--text-primary)] mb-2 block">Network Policy</Label>
                <Select
                  value={vm?.networkPolicy || "restricted"}
                  onValueChange={(value) => updateVM({ networkPolicy: value as AgentVMNetworkPolicy })}
                >
                  <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NETWORK_POLICIES.map((policy) => (
                      <SelectItem key={policy.id} value={policy.id}>
                        <div className="flex flex-col">
                          <span>{policy.label}</span>
                          <span className="text-[11px] text-[var(--text-secondary)]">{policy.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[13px] text-[var(--text-primary)] mb-2 block">Persistence</Label>
                <Select
                  value={vm?.persistence || "session"}
                  onValueChange={(value) => updateVM({ persistence: value as AgentVMPersistence })}
                >
                  <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSISTENCE_OPTIONS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-[11px] text-[var(--text-secondary)]">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-[12px] text-[var(--text-secondary)]">Timeout (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={vm?.timeoutMinutes ?? ""}
                  onChange={(e) => updateVM({ timeoutMinutes: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="30"
                  className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
                <input
                  id="vmVncEnabled"
                  type="checkbox"
                  checked={vm?.vncEnabled ?? false}
                  onChange={(e) => updateVM({ vncEnabled: e.target.checked })}
                  className="size-4 accent-[var(--accent-primary)]"
                />
                <Label htmlFor="vmVncEnabled" className="text-[var(--text-primary)] text-[13px] m-0 cursor-pointer">
                  Enable VNC / desktop stream
                </Label>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
                <input
                  id="vmAutoStart"
                  type="checkbox"
                  checked={vm?.autoStart ?? true}
                  onChange={(e) => updateVM({ autoStart: e.target.checked })}
                  className="size-4 accent-[var(--accent-primary)]"
                />
                <Label htmlFor="vmAutoStart" className="text-[var(--text-primary)] text-[13px] m-0 cursor-pointer">
                  Auto-start on task
                </Label>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
