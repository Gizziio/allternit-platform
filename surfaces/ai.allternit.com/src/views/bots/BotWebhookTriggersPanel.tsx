"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  WebhooksLogo,
  Plus,
  Trash,
  PencilSimple,
  Copy,
  Check,
  Play,
  Warning,
  Clock,
  X,
  Globe,
} from "@phosphor-icons/react";
import type { Agent } from "@/lib/agents/agent.types";
import { getBotDisplayName } from "@/lib/bots/bot-profile";
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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GlassSurface from "@/design/GlassSurface";
import { Switch } from "@/components/ui/switch";

interface BotWebhookTriggersPanelProps {
  bot: Agent;
  accentColor: string;
}

const RECEIVER_PORT_KEY = "allternit_webhook_receiver_port";

function defaultReceiverPort(): number {
  if (typeof window === "undefined") return 8013;
  const stored = window.localStorage.getItem(RECEIVER_PORT_KEY);
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  try {
    return parseInt(window.location.port, 10) || 8013;
  } catch {
    return 8013;
  }
}

function buildInboundUrl(triggerId: string, port: number): string {
  if (typeof window === "undefined") return getWebhookInboundUrl(triggerId);
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:${port}/webhooks/inbound/${triggerId}`;
}

export function BotWebhookTriggersPanel({ bot, accentColor }: BotWebhookTriggersPanelProps) {
  const [triggers, setTriggers] = useState<WebhookTrigger[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<WebhookTrigger | null>(null);
  const [formName, setFormName] = useState("");

  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookTriggerDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const [receiverPort, setReceiverPort] = useState<number>(defaultReceiverPort);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const selectedTrigger = useMemo(
    () => triggers.find((t) => t.id === selectedTriggerId) || null,
    [triggers, selectedTriggerId]
  );

  const fetchTriggers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listWebhookTriggers();
      setTriggers(rows.filter((t) => t.target_bot_id === bot.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load webhook triggers");
      setTriggers([]);
    } finally {
      setLoading(false);
    }
  }, [bot.id]);

  useEffect(() => {
    void fetchTriggers();
  }, [fetchTriggers]);

  useEffect(() => {
    if (!selectedTriggerId) {
      setDeliveries([]);
      return;
    }
    let cancelled = false;
    setDeliveriesLoading(true);
    listWebhookTriggerDeliveries(selectedTriggerId)
      .then((rows) => {
        if (!cancelled) setDeliveries(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load deliveries");
      })
      .finally(() => {
        if (!cancelled) setDeliveriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTriggerId]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formName.trim()) return;
      setError(null);
      try {
        await createWebhookTrigger({ name: formName.trim(), target_bot_id: bot.id });
        setFormName("");
        setIsCreating(false);
        await fetchTriggers();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create trigger");
      }
    },
    [bot.id, formName, fetchTriggers]
  );

  const handleUpdate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingTrigger || !formName.trim()) return;
      setError(null);
      try {
        await updateWebhookTrigger(editingTrigger.id, { name: formName.trim() });
        setEditingTrigger(null);
        setFormName("");
        await fetchTriggers();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update trigger");
      }
    },
    [editingTrigger, formName, fetchTriggers]
  );

  const handleToggleActive = useCallback(
    async (trigger: WebhookTrigger) => {
      setError(null);
      try {
        await updateWebhookTrigger(trigger.id, { active: !trigger.active });
        await fetchTriggers();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update trigger");
      }
    },
    [fetchTriggers]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await deleteWebhookTrigger(id);
        if (selectedTriggerId === id) setSelectedTriggerId(null);
        await fetchTriggers();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete trigger");
      }
    },
    [fetchTriggers, selectedTriggerId]
  );

  const handleCopy = useCallback(
    async (triggerId: string) => {
      const url = buildInboundUrl(triggerId, receiverPort);
      try {
        await navigator.clipboard.writeText(url);
        setCopiedId(triggerId);
        setTimeout(() => setCopiedId((id) => (id === triggerId ? null : id)), 2000);
      } catch {
        // ignore
      }
    },
    [receiverPort]
  );

  const startCreate = useCallback(() => {
    setIsCreating(true);
    setEditingTrigger(null);
    setFormName("");
  }, []);

  const startEdit = useCallback((trigger: WebhookTrigger) => {
    setEditingTrigger(trigger);
    setIsCreating(false);
    setFormName(trigger.name);
  }, []);

  const cancelForm = useCallback(() => {
    setIsCreating(false);
    setEditingTrigger(null);
    setFormName("");
  }, []);

  const updateReceiverPort = useCallback((value: string) => {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 65535) {
      setReceiverPort(parsed);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(RECEIVER_PORT_KEY, String(parsed));
      }
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <WebhooksLogo size={18} style={{ color: accentColor }} />
          Webhook Triggers
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)]">
          External systems can wake {getBotDisplayName(bot)} by POSTing to these inbound URLs.
        </p>
      </div>

      {/* Receiver port config */}
      <GlassSurface className="p-5 rounded-xl">
        <div className="flex items-center gap-3 mb-3">
          <Globe size={18} style={{ color: accentColor }} />
          <h4 className="text-[14px] font-semibold text-[var(--text-primary)]">
            Webhook receiver port
          </h4>
        </div>
        <p className="text-[13px] text-[var(--text-secondary)] mb-4">
          The port used to construct inbound webhook URLs. If you run the API on a dedicated
          public port, set it here so copy-paste URLs are correct.
        </p>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            value={receiverPort}
            onChange={(e) => updateReceiverPort(e.target.value)}
            className="w-32 bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
          <span className="text-[12px] text-[var(--text-tertiary)]">
            Inbound URLs use this port value for display only.
          </span>
        </div>
      </GlassSurface>

      {error && (
        <GlassSurface
          className="p-4 rounded-lg border-l-4"
          style={{ borderLeftColor: "var(--status-error)" }}
        >
          <div className="flex items-start gap-2 text-[13px] text-[var(--status-error)]">
            <Warning size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        </GlassSurface>
      )}

      {/* Create / Edit form */}
      {(isCreating || editingTrigger) && (
        <GlassSurface className="p-5 rounded-xl">
          <h4 className="text-[14px] font-semibold text-[var(--text-primary)] mb-4">
            {editingTrigger ? "Edit trigger" : "Create webhook trigger"}
          </h4>
          <form onSubmit={editingTrigger ? handleUpdate : handleCreate} className="space-y-4">
            <div>
              <Label className="text-[13px] text-[var(--text-primary)] mb-2 block">Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. GitHub push"
                className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={cancelForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!formName.trim()}
                style={{ backgroundColor: accentColor, color: "#fff" }}
              >
                {editingTrigger ? "Save changes" : "Create trigger"}
              </Button>
            </div>
          </form>
        </GlassSurface>
      )}

      {/* Trigger list */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="size-6 border-2 border-[var(--border-subtle)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
        </div>
      ) : triggers.length === 0 ? (
        <GlassSurface className="p-8 rounded-xl text-center">
          <WebhooksLogo size={40} className="mx-auto mb-4" style={{ color: accentColor }} />
          <h4 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">
            No webhook triggers for this bot
          </h4>
          <p className="text-[13px] text-[var(--text-secondary)] mb-4">
            Create a trigger to receive external events.
          </p>
          <Button
            onClick={startCreate}
            size="sm"
            className="gap-1.5"
            style={{ backgroundColor: accentColor, color: "#fff" }}
          >
            <Plus size={14} />
            Create trigger
          </Button>
        </GlassSurface>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button
              onClick={startCreate}
              size="sm"
              className="gap-1.5"
              style={{ backgroundColor: accentColor, color: "#fff" }}
            >
              <Plus size={14} />
              New trigger
            </Button>
          </div>

          {triggers.map((trigger) => (
            <GlassSurface key={trigger.id} className="p-4 rounded-xl">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                      {trigger.name}
                    </h4>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase",
                        trigger.active
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : "bg-zinc-500/10 text-[var(--text-tertiary)] border border-[var(--border-subtle)]"
                      )}
                    >
                      {trigger.active ? "Active" : "Paused"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                    <code className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded px-2 py-1 truncate max-w-[380px]">
                      {buildInboundUrl(trigger.id, receiverPort)}
                    </code>
                    <button
                      type="button"
                      onClick={() => void handleCopy(trigger.id)}
                      className="p-1 rounded hover:bg-white/5 transition-colors"
                      aria-label="Copy inbound URL"
                    >
                      {copiedId === trigger.id ? (
                        <Check size={14} className="text-emerald-500" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={trigger.active}
                    onCheckedChange={() => void handleToggleActive(trigger)}
                  />
                  <button
                    type="button"
                    onClick={() => startEdit(trigger)}
                    className="p-1.5 rounded hover:bg-white/5 transition-colors"
                    aria-label="Edit trigger"
                  >
                    <PencilSimple size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(trigger.id)}
                    className="p-1.5 rounded hover:bg-white/5 transition-colors text-[var(--status-error)]"
                    aria-label="Delete trigger"
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedTriggerId((id) => (id === trigger.id ? null : trigger.id))
                  }
                  className="text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5"
                >
                  <Clock size={14} />
                  {selectedTriggerId === trigger.id ? "Hide run history" : "Show run history"}
                </button>
                <span className="text-[11px] text-[var(--text-tertiary)]">
                  Updated {new Date(trigger.updated_at).toLocaleDateString()}
                </span>
              </div>

              {/* Delivery history */}
              {selectedTriggerId === trigger.id && (
                <div className="mt-4 space-y-2">
                  {deliveriesLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="size-5 border-2 border-[var(--border-subtle)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
                    </div>
                  ) : deliveries.length === 0 ? (
                    <p className="text-[12px] text-[var(--text-secondary)] py-2">
                      No deliveries yet.
                    </p>
                  ) : (
                    deliveries.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] p-3 text-[12px]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={cn(
                                "size-2 rounded-full",
                                d.status === "delivered"
                                  ? "bg-emerald-500"
                                  : d.status === "failed"
                                  ? "bg-[var(--status-error)]"
                                  : "bg-[var(--status-warning)]"
                              )}
                            />
                            <span className="font-medium text-[var(--text-primary)] capitalize">
                              {d.status}
                            </span>
                            {d.event && (
                              <span className="text-[var(--text-tertiary)]">· {d.event}</span>
                            )}
                          </div>
                          {d.error && (
                            <p className="text-[var(--status-error)] truncate">{d.error}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[var(--text-secondary)]">
                            {d.response_status ?? "—"}
                          </div>
                          <div className="text-[var(--text-tertiary)]">
                            {new Date(d.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))
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
