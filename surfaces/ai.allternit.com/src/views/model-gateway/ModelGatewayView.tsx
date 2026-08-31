"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Brain,
  Copy,
  Check,
  Warning,
  Spinner,
  ArrowsClockwise,
  PaperPlaneRight,
  Coins,
  Lightning,
  Gauge,
  Trophy,
  Robot,
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
import {
  listModelGatewayModels,
  sendModelGatewayResponse,
  getModelGatewayEndpoint,
  getModelGatewayToken,
  loadModelAutoPolicy,
  saveModelAutoPolicy,
  resolveAutoModel,
  type ModelGatewayModel,
  type ModelGatewayResponse,
  type ModelAutoPolicy,
  type AutoPolicyStrategy,
} from "@/lib/model-gateway-api";

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

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function maskToken(token: string): string {
  if (token.length <= 12) return "•".repeat(token.length);
  return `${token.slice(0, 6)}${"•".repeat(token.length - 12)}${token.slice(-6)}`;
}

const STRATEGY_OPTIONS: { value: AutoPolicyStrategy; label: string; icon: React.ElementType }[] = [
  { value: "manual", label: "Manual", icon: Robot },
  { value: "cheapest", label: "Cheapest", icon: Coins },
  { value: "fastest", label: "Fastest", icon: Lightning },
  { value: "strongest", label: "Strongest", icon: Trophy },
  { value: "balanced", label: "Balanced", icon: Gauge },
];

export function ModelGatewayView(): React.ReactNode {
  const [activeTab, setActiveTab] = useState("endpoint");
  const [models, setModels] = useState<Loadable<ModelGatewayModel[]>>(initialLoadable([]));
  const [policy, setPolicy] = useState<ModelAutoPolicy>(loadModelAutoPolicy);
  const [copied, setCopied] = useState<"endpoint" | "token" | null>(null);

  // Playground state
  const [selectedModel, setSelectedModel] = useState<string>("auto");
  const [prompt, setPrompt] = useState("");
  const [maxTokens, setMaxTokens] = useState<string>("150");
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<ModelGatewayResponse | null>(null);
  const [responseError, setResponseError] = useState<string | null>(null);

  const endpointUrl = useMemo(() => getModelGatewayEndpoint(), []);
  const token = useMemo(() => getModelGatewayToken() ?? "", []);

  const allProviders = useMemo(
    () => Array.from(new Set(models.data.map((m) => m.owned_by))).sort(),
    [models.data],
  );

  const resolvedModel = useMemo(() => {
    if (selectedModel !== "auto") return selectedModel;
    return resolveAutoModel(models.data, policy);
  }, [selectedModel, models.data, policy]);

  const loadModels = useCallback(async () => {
    setModels((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await listModelGatewayModels();
      setModels({ data, loading: false, error: null });
    } catch (err) {
      setModels((prev) => ({
        ...prev,
        loading: false,
        error: handleApiError(err, "Failed to load model catalog"),
      }));
    }
  }, []);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  useEffect(() => {
    saveModelAutoPolicy(policy);
  }, [policy]);

  const copyToClipboard = async (kind: "endpoint" | "token", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  const toggleProvider = (provider: string) => {
    setPolicy((prev) => {
      const allowed = prev.allowedProviders.includes(provider)
        ? prev.allowedProviders.filter((p) => p !== provider)
        : [...prev.allowedProviders, provider];
      return { ...prev, allowedProviders: allowed };
    });
  };

  const handleSend = async () => {
    if (!prompt.trim()) return;
    const modelId = resolvedModel;
    if (!modelId) {
      setResponseError("No model selected and auto policy could not resolve one.");
      return;
    }

    setSending(true);
    setResponse(null);
    setResponseError(null);
    try {
      const result = await sendModelGatewayResponse({
        model: modelId,
        messages: [{ role: "user", content: prompt.trim() }],
        max_tokens: parseInt(maxTokens, 10) || 150,
      });
      setResponse(result);
    } catch (err) {
      setResponseError(handleApiError(err, "Request failed"));
    } finally {
      setSending(false);
    }
  };

  const modelOptions = useMemo(() => {
    const opts = models.data.map((m) => ({ value: m.id, label: `${m.display_name} (${m.id})` }));
    return [{ value: "auto", label: `Auto — ${policy.strategy}` }, ...opts];
  }, [models.data, policy.strategy]);

  return (
    <GlassSurface className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">
            <Brain size={22} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Model Gateway</h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              OpenAI-compatible inference endpoints backed by Allternit Cloud.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadModels()} disabled={models.loading}>
          {models.loading ? <Spinner size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />}
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-4 border-b border-[var(--border-subtle)]">
          <TabsList>
            <TabsTrigger value="endpoint">Endpoint</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="policy">Model = Auto</TabsTrigger>
            <TabsTrigger value="playground">Playground</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {models.error && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 flex items-start gap-2 text-xs text-red-500">
              <Warning size={14} className="shrink-0 mt-0.5" />
              {models.error}
            </div>
          )}

          {activeTab === "endpoint" && (
            <div className="max-w-2xl space-y-6">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[var(--text-primary)]">Base URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={endpointUrl}
                    className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => void copyToClipboard("endpoint", endpointUrl)}
                    title="Copy endpoint"
                  >
                    {copied === "endpoint" ? <Check size={16} /> : <Copy size={16} />}
                  </Button>
                </div>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  Point OpenAI SDKs at this URL. Use <code>/v1/models</code> and <code>/v1/responses</code>.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[var(--text-primary)]">API Token</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={token ? maskToken(token) : "Not signed in"}
                    className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => token && void copyToClipboard("token", token)}
                    disabled={!token}
                    title="Copy token"
                  >
                    {copied === "token" ? <Check size={16} /> : <Copy size={16} />}
                  </Button>
                </div>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  Sent as <code>Authorization: Bearer &lt;token&gt;</code>.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Example curl</h3>
                <pre className="text-[11px] text-[var(--text-secondary)] font-mono whitespace-pre-wrap break-all">
                  {`curl ${endpointUrl}/responses \\\n  -H "Authorization: Bearer ${token || "<token>"}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}'`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === "models" && (
            <div className="space-y-4">
              {models.loading && models.data.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-[var(--text-tertiary)] text-sm">
                  <Spinner size={20} className="animate-spin mr-2" /> Loading models…
                </div>
              ) : models.data.length === 0 ? (
                <div className="text-center py-16 text-[var(--text-tertiary)] text-sm">
                  No models available.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Context</TableHead>
                      <TableHead className="text-right">Input / 1M</TableHead>
                      <TableHead className="text-right">Output / 1M</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {models.data.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium text-[var(--text-primary)]">
                          {m.display_name}
                          <div className="text-[10px] text-[var(--text-tertiary)] font-mono">{m.id}</div>
                        </TableCell>
                        <TableCell className="text-[var(--text-secondary)]">{m.owned_by}</TableCell>
                        <TableCell className="text-[var(--text-secondary)] capitalize">{m.quality_tier}</TableCell>
                        <TableCell className="text-[var(--text-secondary)]">{m.context_window.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-[var(--text-secondary)]">
                          {formatCurrency(m.pricing.input_cents_per_1m)}
                        </TableCell>
                        <TableCell className="text-right text-[var(--text-secondary)]">
                          {formatCurrency(m.pricing.output_cents_per_1m)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {activeTab === "policy" && (
            <div className="max-w-2xl space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-[var(--text-primary)]">Auto-selection strategy</Label>
                <Select
                  value={policy.strategy}
                  onValueChange={(value) => setPolicy((prev) => ({ ...prev, strategy: value as AutoPolicyStrategy }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    {STRATEGY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="flex items-center gap-2">
                          <opt.icon size={14} />
                          {opt.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  When the playground or an API caller sends <code>model: "auto"</code>, this strategy picks the concrete model.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-[var(--text-primary)]">Allowed providers</Label>
                <div className="flex flex-wrap gap-2">
                  {allProviders.length === 0 && (
                    <span className="text-xs text-[var(--text-tertiary)]">Load models to see providers.</span>
                  )}
                  {allProviders.map((provider) => {
                    const allowed = policy.allowedProviders.includes(provider);
                    return (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => toggleProvider(provider)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                          allowed
                            ? "bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30 text-[var(--accent-primary)]"
                            : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {allowed ? <Check size={11} className="inline mr-1" /> : null}
                        {provider}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  Leave all unchecked to allow every provider.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[var(--text-primary)]">Max input price / 1M tokens</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="No limit"
                    value={policy.maxInputCentsPer1m ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setPolicy((prev) => ({
                        ...prev,
                        maxInputCentsPer1m: raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0),
                      }));
                    }}
                    className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[var(--text-primary)]">Max output price / 1M tokens</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="No limit"
                    value={policy.maxOutputCentsPer1m ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setPolicy((prev) => ({
                        ...prev,
                        maxOutputCentsPer1m: raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0),
                      }));
                    }}
                    className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Preview</h3>
                {policy.strategy === "manual" ? (
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Manual mode — auto-resolution is disabled.
                  </p>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)]">
                    With the current filters, <code>model: "auto"</code> resolves to{" "}
                    <span className="font-semibold text-[var(--accent-primary)]">
                      {resolveAutoModel(models.data, policy) ?? "no matching model"}
                    </span>
                    .
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "playground" && (
            <div className="max-w-3xl space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-[var(--text-primary)]">Model</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedModel === "auto" && resolvedModel && (
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      Auto resolves to <span className="font-mono text-[var(--accent-primary)]">{resolvedModel}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[var(--text-primary)]">Max tokens</Label>
                  <Input
                    type="number"
                    min={1}
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(e.target.value)}
                    className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[var(--text-primary)]">Prompt</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter a message…"
                  rows={5}
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={() => void handleSend()} disabled={!prompt.trim() || sending}>
                  {sending ? <Spinner size={16} className="animate-spin mr-2" /> : <PaperPlaneRight size={16} className="mr-2" />}
                  Send
                </Button>
              </div>

              {responseError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 flex items-start gap-2 text-xs text-red-500">
                  <Warning size={14} className="shrink-0 mt-0.5" />
                  {responseError}
                </div>
              )}

              {response && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Response</h3>
                    <span className="text-[11px] text-[var(--text-tertiary)] font-mono">{response.model}</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                    {response.choices[0]?.message.content ?? "(no content)"}
                  </p>
                  <div className="flex flex-wrap gap-3 pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-tertiary)]">
                    <span>Tokens: {response.usage.total_tokens}</span>
                    <span>Cost: {formatCurrency(response.cost_cents)}</span>
                    <span>Request: {response.id}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Tabs>
    </GlassSurface>
  );
}

export default ModelGatewayView;
