"use client";

/**
 * WebhookTriggersView — bot-owned webhook trigger management.
 *
 * Lists inbound webhook triggers, lets the user create/activate/delete them,
 * copies the inbound URL, and inspects recent delivery logs.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Plus,
  Trash,
  Pencil,
  Check,
  Warning,
  Link,
  Spinner,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import GlassSurface from "@/design/GlassSurface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { Agent } from "@/lib/agents/agent.types";
import {
  listWebhookTriggers,
  createWebhookTrigger,
  updateWebhookTrigger,
  deleteWebhookTrigger,
  listWebhookTriggerDeliveries,
  getWebhookInboundUrl,
  type WebhookTrigger,
  type WebhookTriggerDelivery,
} from "@/lib/webhook-api";
import { formatRelativeTime } from "@/lib/time";

interface WebhookTriggersViewProps {
  agentId?: string;
  title?: string;
  hideAgentSelector?: boolean;
  receiverPort?: number;
}

export function WebhookTriggersView({
  agentId,
  title = "Webhook Triggers",
  hideAgentSelector,
  receiverPort,
}: WebhookTriggersViewProps) {
  const [triggers, setTriggers] = useState<WebhookTrigger[]>([]);
  const [deliveries, setDeliveries] = useState<Record<string, WebhookTriggerDelivery[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<WebhookTrigger | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedDeliveries, setExpandedDeliveries] = useState<Set<string>>(new Set());
  const [deliveriesLoading, setDeliveriesLoading] = useState<Set<string>>(new Set());

  const { agents } = useAgentStore();
  const bots = useMemo(() => agents.filter((a) => a.isBot) as Agent[], [agents]);

  const visibleTriggers = useMemo(
    () => (agentId ? triggers.filter((t) => t.target_bot_id === agentId) : triggers),
    [triggers, agentId]
  );

  const [form, setForm] = useState({
    name: "",
    target_bot_id: agentId || "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listWebhookTriggers();
      setTriggers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load webhook triggers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setForm({ name: "", target_bot_id: agentId || "" });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.target_bot_id) return;
    try {
      await createWebhookTrigger({
        name: form.name.trim(),
        target_bot_id: form.target_bot_id,
      });
      resetForm();
      setIsCreating(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create trigger");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrigger) return;
    try {
      await updateWebhookTrigger(editingTrigger.id, {
        name: form.name.trim(),
        target_bot_id: form.target_bot_id,
      });
      setEditingTrigger(null);
      resetForm();
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update trigger");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWebhookTrigger(id);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete trigger");
    }
  };

  const handleToggleActive = async (trigger: WebhookTrigger) => {
    try {
      await updateWebhookTrigger(trigger.id, { active: !trigger.active });
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update trigger");
    }
  };

  const handleCopy = async (triggerId: string) => {
    const url = getWebhookInboundUrl(triggerId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(triggerId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore copy errors.
    }
  };

  const toggleDeliveries = async (triggerId: string) => {
    setExpandedDeliveries((prev) => {
      const next = new Set(prev);
      if (next.has(triggerId)) {
        next.delete(triggerId);
        return next;
      }
      next.add(triggerId);
      return next;
    });

    if (deliveries[triggerId]) return;

    setDeliveriesLoading((prev) => new Set(prev).add(triggerId));
    try {
      const data = await listWebhookTriggerDeliveries(triggerId);
      setDeliveries((prev) => ({ ...prev, [triggerId]: data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load deliveries");
    } finally {
      setDeliveriesLoading((prev) => {
        const next = new Set(prev);
        next.delete(triggerId);
        return next;
      });
    }
  };

  const startEdit = (trigger: WebhookTrigger) => {
    setEditingTrigger(trigger);
    setForm({ name: trigger.name, target_bot_id: trigger.target_bot_id });
    setIsCreating(false);
  };

  const deliveryStatusColor: Record<WebhookTriggerDelivery["status"], string> = {
    pending: "var(--status-warning)",
    delivered: "var(--status-success)",
    failed: "var(--status-error)",
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: "var(--bg-secondary)" }}
          >
            <Link size={24} style={{ color: "var(--accent-primary)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {title}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {agentId
                ? "Inbound webhooks that start jobs for this bot."
                : "Inbound webhook triggers that dispatch to bots."}
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setIsCreating(true);
            setEditingTrigger(null);
            resetForm();
          }}
          className="flex items-center gap-2"
          style={{ backgroundColor: "var(--accent-primary)", color: "var(--ui-text-inverse)" }}
        >
          <Plus size={18} />
          New Trigger
        </Button>
      </div>

      {receiverPort && (
        <GlassSurface className="p-4 rounded-lg border-l-4" style={{ borderLeftColor: "var(--accent-primary)" }}>
          <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            <Link size={16} />
            <span>
              Dedicated webhook receiver listening on port{" "}
              <span className="font-mono font-medium text-[var(--text-primary)]">{receiverPort}</span>
            </span>
          </div>
        </GlassSurface>
      )}

      {error && (
        <GlassSurface className="p-4 rounded-lg border-l-4" style={{ borderLeftColor: "var(--status-error)" }}>
          <div className="flex items-start gap-2">
            <Warning size={16} className="mt-0.5 shrink-0" style={{ color: "var(--status-error)" }} />
            <p className="text-sm" style={{ color: "var(--status-error)" }}>
              {error}
            </p>
          </div>
        </GlassSurface>
      )}

      {(isCreating || editingTrigger) && (
        <GlassSurface className="p-6 rounded-lg">
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
            {editingTrigger ? "Edit Webhook Trigger" : "Create Webhook Trigger"}
          </h2>
          <form onSubmit={editingTrigger ? handleUpdate : handleCreate} className="flex flex-col gap-4">
            <div>
              <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. GitHub push → deploy"
                className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>
            {!hideAgentSelector && (
              <div>
                <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Target bot</Label>
                <Select
                  value={form.target_bot_id || "none"}
                  onValueChange={(value) => setForm((f) => ({ ...f, target_bot_id: value === "none" ? "" : value }))}
                >
                  <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                    <SelectValue placeholder="Select a bot" />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
                    <SelectItem value="none">No bot selected</SelectItem>
                    {bots.map((bot) => (
                      <SelectItem key={bot.id} value={bot.id}>
                        {bot.botProfile?.displayName ?? bot.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsCreating(false);
                  setEditingTrigger(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                style={{ backgroundColor: "var(--accent-primary)", color: "var(--ui-text-inverse)" }}
              >
                {editingTrigger ? "Save Changes" : "Create Trigger"}
              </Button>
            </div>
          </form>
        </GlassSurface>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="size-8 border-2 border-solid border-[rgba(212,176,140,0.2)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
        </div>
      ) : visibleTriggers.length === 0 ? (
        <GlassSurface className="p-8 rounded-lg text-center">
          <Link size={40} className="mx-auto mb-4" style={{ color: "var(--accent-primary)" }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            {agentId ? "No webhook triggers for this bot yet" : "No webhook triggers yet"}
          </h3>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            Create a trigger to let external services start this bot.
          </p>
          <Button
            onClick={() => {
              setIsCreating(true);
              setEditingTrigger(null);
              resetForm();
            }}
            style={{ backgroundColor: "var(--accent-primary)", color: "var(--ui-text-inverse)" }}
          >
            Create Trigger
          </Button>
        </GlassSurface>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleTriggers.map((trigger) => (
            <GlassSurface key={trigger.id} className="p-5 rounded-lg">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {trigger.name}
                  </h3>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code
                      className="text-[12px] px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] truncate"
                      title={getWebhookInboundUrl(trigger.id)}
                    >
                      {getWebhookInboundUrl(trigger.id)}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(trigger.id)}
                      className="p-1.5 rounded-md hover:bg-white/5 transition-colors text-[var(--text-secondary)]"
                      aria-label="Copy webhook URL"
                    >
                      {copiedId === trigger.id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={trigger.active}
                    onCheckedChange={() => handleToggleActive(trigger)}
                    aria-label={trigger.active ? "Deactivate trigger" : "Activate trigger"}
                  />
                  <button
                    type="button"
                    onClick={() => toggleDeliveries(trigger.id)}
                    disabled={deliveriesLoading.has(trigger.id)}
                    className="p-1.5 rounded-md hover:bg-white/5 transition-colors disabled:opacity-50"
                    style={{ color: "var(--text-secondary)" }}
                    aria-label="View delivery logs"
                  >
                    {deliveriesLoading.has(trigger.id) ? (
                      <Spinner size={16} className="animate-spin" />
                    ) : (
                      <ArrowsClockwise size={16} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(trigger)}
                    className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                    style={{ color: "var(--text-secondary)" }}
                    aria-label="Edit trigger"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(trigger.id)}
                    className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                    style={{ color: "var(--status-error)" }}
                    aria-label="Delete trigger"
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
                <span
                  className={cn(
                    "px-2 py-1 rounded border",
                    trigger.active
                      ? "border-[var(--status-success)] text-[var(--status-success)]"
                      : "border-[var(--ui-text-muted)]"
                  )}
                >
                  {trigger.active ? "Active" : "Inactive"}
                </span>
                {!agentId && (
                  <span className="px-2 py-1 rounded border border-[var(--border-subtle)]">
                    Bot: {bots.find((b) => b.id === trigger.target_bot_id)?.botProfile?.displayName ?? trigger.target_bot_id}
                  </span>
                )}
                <span>Updated {formatRelativeTime(trigger.updated_at)}</span>
              </div>

              {expandedDeliveries.has(trigger.id) && (
                <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
                  <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                    Recent deliveries
                  </h4>
                  {deliveries[trigger.id]?.length === 0 ? (
                    <p className="text-[12px] text-[var(--text-tertiary)]">No deliveries yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {(deliveries[trigger.id] ?? []).slice(0, 10).map((d) => (
                        <div
                          key={d.id}
                          className="flex items-start justify-between gap-3 rounded-md bg-[var(--bg-primary)] px-3 py-2 text-[12px]"
                        >
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: deliveryStatusColor[d.status] }}
                              />
                              <span className="font-medium text-[var(--text-primary)] capitalize">
                                {d.status}
                              </span>
                              {d.response_status && (
                                <span className="text-[var(--text-tertiary)]">
                                  HTTP {d.response_status}
                                </span>
                              )}
                            </div>
                            {d.error && (
                              <p className="text-[var(--status-error)] truncate">{d.error}</p>
                            )}
                            {d.event && <p className="text-[var(--text-secondary)] truncate">{d.event}</p>}
                          </div>
                          <div className="text-right shrink-0 text-[var(--text-tertiary)]">
                            {d.attempts > 1 && <div>{d.attempts} attempts</div>}
                            <div>{formatRelativeTime(d.created_at)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </GlassSurface>
          ))}
        </div>
      )}
    </div>
  );
}

export default WebhookTriggersView;
