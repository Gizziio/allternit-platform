"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Robot,
  Plus,
  Spinner,
  ArrowsClockwise,
  Warning,
  Play,
  Stop,
  CheckCircle,
  Clock,
  XCircle,
  Cloud,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GlassSurface } from "@/design/GlassSurface";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { Agent } from "@/lib/agents/agent.types";
import {
  provisionAgentRuntime,
  terminateAgentRuntime,
  type AgentRuntimeProvisionResponse,
} from "@/lib/agent-cloud-api";

interface Loadable<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

function initialLoadable<T>(data: T): Loadable<T> {
  return { data, loading: false, error: null };
}

function handleApiError(err: unknown, context: string): string {
  const message = err instanceof Error ? err.message : String(err);
  return `${context}: ${message}`;
}

type RuntimeStatus = "active" | "terminated" | "none";

function getRuntimeStatus(agent: Agent): RuntimeStatus {
  const status = agent.config?.runtime_status as string | undefined;
  if (status === "active") return "active";
  if (status === "terminated") return "terminated";
  return "none";
}

function StatusChip({ status }: { status: RuntimeStatus }) {
  const config = {
    active: { icon: CheckCircle, color: "text-green-400 bg-green-400/10", label: "Running" },
    terminated: { icon: XCircle, color: "text-zinc-400 bg-zinc-400/10", label: "Stopped" },
    none: { icon: Clock, color: "text-blue-400 bg-blue-400/10", label: "Not provisioned" },
  }[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${config.color}`}>
      <Icon className="size-3" />
      <span>{config.label}</span>
    </span>
  );
}

const PROVIDER_OPTIONS = ["openai", "anthropic", "google", "local", "custom"] as const;
const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  google: "gemini-1.5-flash",
  local: "qwen2.5:0.5b",
  custom: "custom-model",
};

export function AgentCloudView(): React.ReactNode {
  const [activeTab, setActiveTab] = useState("agents");
  const [provisioning, setProvisioning] = useState<Record<string, boolean>>({});
  const [terminating, setTerminating] = useState<Record<string, boolean>>({});
  const [provisionResult, setProvisionResult] = useState<Record<string, AgentRuntimeProvisionResponse>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});

  // Create form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState<string>("openai");
  const [model, setModel] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const agents = useAgentStore((s) => s.agents);
  const isLoadingAgents = useAgentStore((s) => s.isLoadingAgents);
  const agentsError = useAgentStore((s) => s.error);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);
  const createAgent = useAgentStore((s) => s.createAgent);

  const loadAgents = useCallback(async () => {
    try {
      await fetchAgents();
    } catch {
      // errors are stored in the store
    }
  }, [fetchAgents]);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    setModel((prev) => prev || DEFAULT_MODELS[provider] || "");
  }, [provider]);

  const agentsLoadable = useMemo<Loadable<Agent[]>>(
    () => ({
      data: agents,
      loading: isLoadingAgents,
      error: agentsError,
    }),
    [agents, isLoadingAgents, agentsError],
  );

  const handleProvision = async (agent: Agent) => {
    setProvisioning((prev) => ({ ...prev, [agent.id]: true }));
    setActionError((prev) => ({ ...prev, [agent.id]: "" }));
    try {
      const result = await provisionAgentRuntime(agent.id);
      setProvisionResult((prev) => ({ ...prev, [agent.id]: result }));
      await loadAgents();
    } catch (err) {
      setActionError((prev) => ({ ...prev, [agent.id]: handleApiError(err, "Provision failed") }));
    } finally {
      setProvisioning((prev) => ({ ...prev, [agent.id]: false }));
    }
  };

  const handleTerminate = async (agent: Agent) => {
    setTerminating((prev) => ({ ...prev, [agent.id]: true }));
    setActionError((prev) => ({ ...prev, [agent.id]: "" }));
    try {
      await terminateAgentRuntime(agent.id);
      setProvisionResult((prev) => {
        const next = { ...prev };
        delete next[agent.id];
        return next;
      });
      await loadAgents();
    } catch (err) {
      setActionError((prev) => ({ ...prev, [agent.id]: handleApiError(err, "Terminate failed") }));
    } finally {
      setTerminating((prev) => ({ ...prev, [agent.id]: false }));
    }
  };

  const handleCreate = async () => {
    setCreateError(null);
    setCreateSuccess(null);
    if (name.trim().length < 3) {
      setCreateError("Agent name must be at least 3 characters.");
      return;
    }
    if (description.trim().length < 10) {
      setCreateError("Description must be at least 10 characters.");
      return;
    }
    if (!model.trim()) {
      setCreateError("Model is required.");
      return;
    }

    setCreating(true);
    try {
      await createAgent({
        name: name.trim(),
        description: description.trim(),
        type: "worker",
        model: model.trim(),
        provider: provider as Agent["provider"],
        capabilities: [],
        tools: [],
        harness: { mode: "cloud" },
        allowedSurfaces: ["chat"],
        trustTier: "standard",
      });
      setCreateSuccess("Agent created successfully.");
      setName("");
      setDescription("");
      setModel("");
      setProvider("openai");
      await loadAgents();
      setActiveTab("agents");
    } catch (err) {
      setCreateError(handleApiError(err, "Create agent failed"));
    } finally {
      setCreating(false);
    }
  };

  const anyLoading = isLoadingAgents || Object.values(provisioning).some(Boolean) || Object.values(terminating).some(Boolean) || creating;

  return (
    <GlassSurface className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">
            <Robot size={22} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Agent Cloud</h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              Persistent agents with Fabric-scheduled runtimes.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadAgents()} disabled={isLoadingAgents}>
          {isLoadingAgents ? <Spinner size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />}
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-4 border-b border-[var(--border-subtle)]">
          <TabsList>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="create">Create Agent</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {agentsLoadable.error && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 flex items-start gap-2 text-xs text-red-500">
              <Warning size={14} className="shrink-0 mt-0.5" />
              {agentsLoadable.error}
            </div>
          )}

          {activeTab === "agents" && (
            <div className="space-y-4">
              {agentsLoadable.loading && agentsLoadable.data.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-[var(--text-tertiary)] text-sm">
                  <Spinner size={20} className="animate-spin mr-2" /> Loading agents…
                </div>
              ) : agentsLoadable.data.length === 0 ? (
                <div className="text-center py-16 text-[var(--text-tertiary)] text-sm space-y-4">
                  <p>No agents yet.</p>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("create")}>
                    <Plus size={14} className="mr-1.5" />
                    Create your first agent
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Runtime</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentsLoadable.data.map((agent) => {
                      const runtimeStatus = getRuntimeStatus(agent);
                      const isProvisioning = provisioning[agent.id];
                      const isTerminating = terminating[agent.id];
                      const result = provisionResult[agent.id];
                      const err = actionError[agent.id];
                      return (
                        <TableRow key={agent.id}>
                          <TableCell className="font-medium text-[var(--text-primary)]">
                            {agent.name}
                            <div className="text-[10px] text-[var(--text-tertiary)] font-mono">{agent.id}</div>
                          </TableCell>
                          <TableCell className="text-[var(--text-secondary)]">
                            <div className="text-xs">{agent.model}</div>
                            <div className="text-[10px] text-[var(--text-tertiary)] capitalize">{agent.provider}</div>
                          </TableCell>
                          <TableCell className="text-[var(--text-secondary)]">
                            {result ? (
                              <div className="text-xs space-y-0.5">
                                <div className="font-mono">{result.provider_kind}</div>
                                <div className="text-[10px] text-[var(--text-tertiary)]">{result.instance_type || "—"}</div>
                                <div className="text-[10px] text-[var(--text-tertiary)]">{result.region || "—"}</div>
                              </div>
                            ) : (
                              <span className="text-xs text-[var(--text-tertiary)]">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusChip status={runtimeStatus} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {runtimeStatus !== "active" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void handleProvision(agent)}
                                  disabled={isProvisioning || anyLoading}
                                >
                                  {isProvisioning ? <Spinner size={14} className="animate-spin mr-1" /> : <Play size={14} className="mr-1" />}
                                  Provision
                                </Button>
                              )}
                              {runtimeStatus === "active" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void handleTerminate(agent)}
                                  disabled={isTerminating || anyLoading}
                                >
                                  {isTerminating ? <Spinner size={14} className="animate-spin mr-1" /> : <Stop size={14} className="mr-1" />}
                                  Terminate
                                </Button>
                              )}
                            </div>
                            {err && (
                              <div className="mt-2 text-[10px] text-red-500 text-right">{err}</div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {activeTab === "create" && (
            <div className="max-w-2xl space-y-6">
              {createError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 flex items-start gap-2 text-xs text-red-500">
                  <Warning size={14} className="shrink-0 mt-0.5" />
                  {createError}
                </div>
              )}
              {createSuccess && (
                <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 flex items-start gap-2 text-xs text-green-500">
                  <CheckCircle size={14} className="shrink-0 mt-0.5" />
                  {createSuccess}
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[var(--text-primary)]">Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Code Review Specialist"
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                />
                <p className="text-[11px] text-[var(--text-tertiary)]">At least 3 characters.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[var(--text-primary)]">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this agent does and when to use it…"
                  rows={4}
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none"
                />
                <p className="text-[11px] text-[var(--text-tertiary)]">At least 10 characters.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[var(--text-primary)]">Provider</Label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          <span className="capitalize">{p}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[var(--text-primary)]">Model</Label>
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g., gpt-4o-mini"
                    className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Cloud size={16} />
                  Cloud runtime
                </h3>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  After creation, switch to the <strong>Agents</strong> tab and click <strong>Provision</strong>
                  to schedule a Fabric compute resource for this agent. The runtime runs on Allternit Cloud
                  and draws from your organization&apos;s credit balance.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => void handleCreate()} disabled={creating || anyLoading}>
                  {creating ? <Spinner size={16} className="animate-spin mr-2" /> : <Plus size={16} className="mr-2" />}
                  Create Agent
                </Button>
              </div>
            </div>
          )}
        </div>
      </Tabs>
    </GlassSurface>
  );
}

export default AgentCloudView;
