import React, { useCallback, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  WebhookIcon,
  AlertCircleIcon,
  CheckIcon,
  CopyIcon,
} from "@hugeicons/core-free-icons";
import { formatApiError, AllternitApiError } from "@/lib/api-client";
import {
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_WILDCARD,
  type WebhookSubscription,
  type WebhookDelivery,
  type WebhookDeliveryStatus,
  type WebhookTrigger,
  type WebhookTriggerDelivery,
  getWebhookInboundUrl,
  listWebhookSubscriptions,
  createWebhookSubscription,
  updateWebhookSubscription,
  deleteWebhookSubscription,
  listWebhookDeliveries,
  listWebhookTriggers,
  createWebhookTrigger,
  updateWebhookTrigger,
  deleteWebhookTrigger,
  listWebhookTriggerDeliveries,
} from "@/lib/webhooks";
import { listAgents, type AgentRecord } from "@/lib/managed-agents";
import {
  ListPage,
  EmptyState,
  SkeletonRow,
  Badge,
  MonoChip,
  QUIET_BUTTON_CLASS,
  DESTRUCTIVE_BUTTON_CLASS,
} from "@/components/console-ui";
import { cn } from "@/lib/utils";

const TH_CLASS =
  "text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] px-3 py-2";
const TD_CLASS = "px-3 py-2.5 text-[13px] text-[var(--text-primary)]";

type ManageTab = "subscriptions" | "triggers";

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "delivered":
      return "text-[var(--status-success)] bg-[var(--status-success)]/10";
    case "pending":
      return "text-[var(--status-warning)] bg-[var(--status-warning)]/10";
    default:
      return "text-[var(--status-error)] bg-[var(--status-error)]/10";
  }
}

function EventPicker({
  selected,
  onChange,
  disabled,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}): React.ReactNode {
  const toggle = (event: string) => {
    if (event === WEBHOOK_EVENT_WILDCARD) {
      onChange(selected.includes(WEBHOOK_EVENT_WILDCARD) ? [] : [WEBHOOK_EVENT_WILDCARD]);
      return;
    }
    const withoutWildcard = selected.filter((item) => item !== WEBHOOK_EVENT_WILDCARD);
    onChange(
      selected.includes(WEBHOOK_EVENT_WILDCARD)
        ? [event]
        : withoutWildcard.includes(event)
          ? withoutWildcard.filter((item) => item !== event)
          : [...withoutWildcard, event]
    );
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {[WEBHOOK_EVENT_WILDCARD, ...WEBHOOK_EVENTS].map((event) => (
        <label
          key={event}
          className={cn(
            "inline-flex cursor-pointer items-center rounded-md border border-solid px-2 py-1 font-mono text-[11px] transition-colors",
            selected.includes(event)
              ? "border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
              : "border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--border-default)]",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <input
            type="checkbox"
            className="sr-only"
            disabled={disabled}
            checked={selected.includes(event)}
            onChange={() => toggle(event)}
          />
          {event}
        </label>
      ))}
    </div>
  );
}

// ─── Tab 1 — outbound subscriptions ─────────────────────────────────────────

function SubscriptionsTab(): React.ReactNode {
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [noOrg, setNoOrg] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formSecret, setFormSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editEvents, setEditEvents] = useState<string[]>([]);
  const [editSecret, setEditSecret] = useState("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSubscriptions(await listWebhookSubscriptions());
      setNoOrg(false);
    } catch (err) {
      setSubscriptions([]);
      // The subscription handlers answer 400 "organization required" when no
      // org is active — surface that as an honest notice, not an error wall.
      if (err instanceof AllternitApiError && err.statusCode === 400) {
        setNoOrg(true);
      } else {
        setError(formatApiError(err, "Unable to load webhook subscriptions."));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyText = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // leave selectable
    }
  }, []);

  const toggleDeliveries = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setDeliveriesLoading(true);
    try {
      setDeliveries(await listWebhookDeliveries(id, { limit: 50 }));
    } catch {
      setDeliveries([]);
    } finally {
      setDeliveriesLoading(false);
    }
  }, [expandedId]);

  const handleCreate = useCallback(async () => {
    if (!formUrl.trim() || formEvents.length === 0 || !formSecret.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createWebhookSubscription({
        url: formUrl.trim(),
        events: formEvents,
        secret: formSecret.trim(),
      });
      setShowCreate(false);
      setFormUrl("");
      setFormEvents([]);
      setFormSecret("");
      await load();
    } catch (err) {
      setError(formatApiError(err, "Unable to create the subscription."));
    } finally {
      setSaving(false);
    }
  }, [formUrl, formEvents, formSecret, load]);

  const startEdit = useCallback((subscription: WebhookSubscription) => {
    setEditingId(subscription.id);
    setEditUrl(subscription.url);
    setEditEvents(subscription.events);
    setEditSecret("");
  }, []);

  const handleSaveEdit = useCallback(
    async (subscription: WebhookSubscription) => {
      setBusyId(subscription.id);
      setError(null);
      try {
        const body: { url?: string; events?: string[]; secret?: string } = {};
        if (editUrl.trim() !== subscription.url) body.url = editUrl.trim();
        if (editEvents.join(",") !== subscription.events.join(",")) body.events = editEvents;
        if (editSecret.trim()) body.secret = editSecret.trim();
        if (Object.keys(body).length === 0) {
          setEditingId(null);
          return;
        }
        await updateWebhookSubscription(subscription.id, body);
        setEditingId(null);
        await load();
      } catch (err) {
        setError(formatApiError(err, "Unable to update the subscription."));
      } finally {
        setBusyId(null);
      }
    },
    [editUrl, editEvents, editSecret, load]
  );

  const handleToggleActive = useCallback(
    async (subscription: WebhookSubscription) => {
      setBusyId(subscription.id);
      setError(null);
      try {
        await updateWebhookSubscription(subscription.id, { active: !subscription.active });
        await load();
      } catch (err) {
        setError(formatApiError(err, "Unable to update the subscription."));
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  const handleDelete = useCallback(
    async (subscription: WebhookSubscription) => {
      setBusyId(subscription.id);
      setError(null);
      try {
        await deleteWebhookSubscription(subscription.id);
        setConfirmDeleteId(null);
        if (expandedId === subscription.id) setExpandedId(null);
        await load();
      } catch (err) {
        setError(formatApiError(err, "Unable to delete the subscription."));
      } finally {
        setBusyId(null);
      }
    },
    [expandedId, load]
  );

  if (noOrg) {
    return (
      <EmptyState
        icon={<HugeiconsIcon icon={WebhookIcon} size={32} />}
        title="No active organization"
        caption="Webhook subscriptions are scoped to an organization. Select one to manage subscriptions."
      />
    );
  }

  return (
    <>
      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-solid border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-3 py-2 text-[13px] text-[var(--status-error)]">
          <HugeiconsIcon icon={AlertCircleIcon} size={14} />
          {error}
        </p>
      )}

      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-[13px] font-semibold text-[var(--ui-text-inverse)] transition-colors hover:brightness-110"
          onClick={() => setShowCreate((prev) => !prev)}
        >
          {showCreate ? "Close" : "Add subscription"}
        </button>
      </div>

      {showCreate && (
        <div className="mb-5 max-w-2xl rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
          <div className="grid grid-cols-1 gap-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-[var(--text-secondary)]">
                Endpoint URL
              </span>
              <input
                value={formUrl}
                onChange={(event) => setFormUrl(event.target.value)}
                placeholder="https://example.com/allternit-events"
                className="w-full rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-default)]"
              />
            </label>
            <div>
              <span className="mb-1 block text-[12px] font-semibold text-[var(--text-secondary)]">
                Events
              </span>
              <EventPicker selected={formEvents} onChange={setFormEvents} />
            </div>
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-[var(--text-secondary)]">
                Signing secret
              </span>
              <input
                value={formSecret}
                onChange={(event) => setFormSecret(event.target.value)}
                placeholder="Used to sign the X-Allternit-Signature header"
                className="w-full rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-default)]"
              />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !formUrl.trim() || formEvents.length === 0 || !formSecret.trim()}
              onClick={() => void handleCreate()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-[13px] font-semibold text-[var(--ui-text-inverse)] transition-colors hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Adding…" : "Add subscription"}
            </button>
          </div>
        </div>
      )}

      {loading && subscriptions.length === 0 ? (
        <SkeletonRow lines={4} />
      ) : subscriptions.length === 0 ? (
        <EmptyState
          icon={<HugeiconsIcon icon={WebhookIcon} size={32} />}
          title="No webhook subscriptions"
          caption="Subscribe an HTTPS endpoint to organization events — sessions, deployments, billing, and key lifecycle. Payloads are signed and retried."
          ctaLabel="Add subscription"
          onCtaClick={() => setShowCreate(true)}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40">
          <table className="w-full">
            <thead>
              <tr className="border-b border-solid border-[var(--border-subtle)]">
                <th className={TH_CLASS}>Endpoint</th>
                <th className={cn(TH_CLASS, "hidden lg:table-cell")}>Events</th>
                <th className={TH_CLASS}>Status</th>
                <th className={cn(TH_CLASS, "hidden md:table-cell")}>Created</th>
                <th className={cn(TH_CLASS, "text-right")}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((subscription) => (
                <React.Fragment key={subscription.id}>
                  <tr className="border-b border-solid border-[var(--border-subtle)] last:border-b-0">
                    {editingId === subscription.id ? (
                      <td className={cn(TD_CLASS, "align-top")} colSpan={2}>
                        <div className="space-y-3">
                          <input
                            value={editUrl}
                            onChange={(event) => setEditUrl(event.target.value)}
                            className="w-full rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-default)]"
                          />
                          <EventPicker selected={editEvents} onChange={setEditEvents} />
                          <input
                            value={editSecret}
                            onChange={(event) => setEditSecret(event.target.value)}
                            placeholder="New signing secret (blank = unchanged)"
                            className="w-full rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-default)]"
                          />
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className={TD_CLASS}>
                          <div className="flex min-w-0 items-center gap-2">
                            <code className="truncate font-mono text-[12px] text-[var(--text-primary)]">
                              {subscription.url}
                            </code>
                            <button
                              type="button"
                              aria-label="Copy endpoint URL"
                              className="shrink-0 p-0.5 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
                              onClick={() => void copyText(subscription.url, subscription.id)}
                            >
                              <HugeiconsIcon
                                icon={copiedId === subscription.id ? CheckIcon : CopyIcon}
                                size={11}
                                className={copiedId === subscription.id ? "text-[var(--status-success)]" : undefined}
                              />
                            </button>
                          </div>
                          <div className="mt-0.5 lg:hidden">
                            {subscription.events.map((event) => (
                              <Badge key={event}>{event}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className={cn(TD_CLASS, "hidden lg:table-cell")}>
                          <div className="flex flex-wrap gap-1">
                            {subscription.events.map((event) => (
                              <Badge key={event}>{event}</Badge>
                            ))}
                          </div>
                        </td>
                      </>
                    )}
                    <td className={TD_CLASS}>
                      <button
                        type="button"
                        disabled={busyId === subscription.id}
                        onClick={() => void handleToggleActive(subscription)}
                        className={cn(
                          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50",
                          subscription.active ? "bg-[var(--accent-primary)]" : "bg-[var(--border-default)]"
                        )}
                        aria-label={subscription.active ? "Disable subscription" : "Enable subscription"}
                      >
                        <span
                          className={cn(
                            "inline-block size-4 transform rounded-full bg-white transition-transform",
                            subscription.active ? "translate-x-[18px]" : "translate-x-0.5"
                          )}
                        />
                      </button>
                      <span className="ml-2 text-[12px] text-[var(--text-tertiary)]">
                        {subscription.active ? "active" : "paused"}
                      </span>
                    </td>
                    <td className={cn(TD_CLASS, "hidden text-[var(--text-secondary)] md:table-cell")}>
                      {formatDateTime(subscription.created_at)}
                    </td>
                    <td className={cn(TD_CLASS, "text-right")}>
                      <span className="inline-flex items-center gap-1">
                        {editingId === subscription.id ? (
                          <>
                            <button
                              type="button"
                              className={QUIET_BUTTON_CLASS}
                              disabled={busyId === subscription.id}
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={busyId === subscription.id || !editUrl.trim() || editEvents.length === 0}
                              onClick={() => void handleSaveEdit(subscription)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 text-[13px] font-semibold text-[var(--ui-text-inverse)] transition-colors hover:brightness-110 disabled:opacity-50"
                            >
                              Save
                            </button>
                          </>
                        ) : confirmDeleteId === subscription.id ? (
                          <>
                            <span className="text-[12px] text-[var(--text-secondary)]">Delete?</span>
                            <button
                              type="button"
                              className={QUIET_BUTTON_CLASS}
                              disabled={busyId === subscription.id}
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className={DESTRUCTIVE_BUTTON_CLASS}
                              disabled={busyId === subscription.id}
                              onClick={() => void handleDelete(subscription)}
                            >
                              {busyId === subscription.id ? "Deleting…" : "Delete"}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={QUIET_BUTTON_CLASS}
                              onClick={() => void toggleDeliveries(subscription.id)}
                            >
                              Deliveries
                            </button>
                            <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => startEdit(subscription)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className={DESTRUCTIVE_BUTTON_CLASS}
                              onClick={() => setConfirmDeleteId(subscription.id)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                  {expandedId === subscription.id && (
                    <tr className="border-b border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="mb-2 text-[13px] font-semibold text-[var(--text-primary)]">
                          Recent deliveries
                        </div>
                        {deliveriesLoading ? (
                          <SkeletonRow lines={2} />
                        ) : deliveries.length === 0 ? (
                          <p className="m-0 text-[13px] text-[var(--text-secondary)]">
                            No deliveries recorded yet. Deliveries appear when a subscribed
                            event fires.
                          </p>
                        ) : (
                          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                            {deliveries.map((delivery) => (
                              <div
                                key={delivery.id}
                                className="flex items-center justify-between gap-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[12px] text-[var(--text-primary)]">
                                      {delivery.event_type}
                                    </span>
                                    <Badge className={statusBadgeClass(delivery.status)}>
                                      {delivery.status}
                                    </Badge>
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                                    {formatDateTime(delivery.created_at)} · {delivery.attempts} attempt
                                    {delivery.attempts === 1 ? "" : "s"}
                                    {delivery.response_status !== null && ` · HTTP ${delivery.response_status}`}
                                  </div>
                                  {delivery.error && (
                                    <div className="mt-0.5 truncate text-[11px] text-[var(--status-error)]">
                                      {delivery.error}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── Tab 2 — inbound triggers ───────────────────────────────────────────────

function TriggersTab(): React.ReactNode {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [triggers, setTriggers] = useState<WebhookTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [noOrg, setNoOrg] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState("");
  const [formBotId, setFormBotId] = useState("");
  const [saving, setSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookTriggerDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listAgents()
      .then((rows) => {
        if (active) setAgents(rows);
      })
      .catch(() => {
        if (active) setAgents([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTriggers(await listWebhookTriggers());
      setNoOrg(false);
    } catch (err) {
      setTriggers([]);
      if (err instanceof AllternitApiError && err.statusCode === 400) {
        setNoOrg(true);
      } else {
        setError(formatApiError(err, "Unable to load webhook triggers."));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyUrl = useCallback(async (id: string) => {
    try {
      await navigator.clipboard.writeText(getWebhookInboundUrl(id));
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // leave selectable
    }
  }, []);

  const toggleDeliveries = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setDeliveriesLoading(true);
    try {
      setDeliveries(await listWebhookTriggerDeliveries(id));
    } catch {
      setDeliveries([]);
    } finally {
      setDeliveriesLoading(false);
    }
  }, [expandedId]);

  const handleCreate = useCallback(async () => {
    if (!formName.trim() || !formBotId) return;
    setSaving(true);
    setError(null);
    try {
      await createWebhookTrigger({ name: formName.trim(), target_bot_id: formBotId });
      setShowCreate(false);
      setFormName("");
      await load();
    } catch (err) {
      setError(formatApiError(err, "Unable to create the trigger."));
    } finally {
      setSaving(false);
    }
  }, [formName, formBotId, load]);

  const handleToggleActive = useCallback(
    async (trigger: WebhookTrigger) => {
      setBusyId(trigger.id);
      setError(null);
      try {
        await updateWebhookTrigger(trigger.id, { active: !trigger.active });
        await load();
      } catch (err) {
        setError(formatApiError(err, "Unable to update the trigger."));
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  const handleDelete = useCallback(
    async (trigger: WebhookTrigger) => {
      setBusyId(trigger.id);
      setError(null);
      try {
        await deleteWebhookTrigger(trigger.id);
        setConfirmDeleteId(null);
        if (expandedId === trigger.id) setExpandedId(null);
        await load();
      } catch (err) {
        setError(formatApiError(err, "Unable to delete the trigger."));
      } finally {
        setBusyId(null);
      }
    },
    [expandedId, load]
  );

  const botName = useCallback(
    (botId: string) => agents.find((agent) => agent.id === botId)?.name ?? botId,
    [agents]
  );

  if (noOrg) {
    return (
      <EmptyState
        icon={<HugeiconsIcon icon={WebhookIcon} size={32} />}
        title="No active organization"
        caption="Webhook triggers are scoped to an organization. Select one to manage inbound triggers."
      />
    );
  }

  return (
    <>
      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-solid border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-3 py-2 text-[13px] text-[var(--status-error)]">
          <HugeiconsIcon icon={AlertCircleIcon} size={14} />
          {error}
        </p>
      )}

      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-[13px] font-semibold text-[var(--ui-text-inverse)] transition-colors hover:brightness-110"
          onClick={() => {
            setShowCreate((prev) => !prev);
            if (!showCreate && agents.length > 0 && !formBotId) {
              setFormBotId(agents[0].id);
            }
          }}
        >
          {showCreate ? "Close" : "New trigger"}
        </button>
      </div>

      {showCreate && (
        <div className="mb-5 max-w-xl rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-[var(--text-secondary)]">
                Name
              </span>
              <input
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                placeholder="e.g. GitHub issues → support bot"
                className="w-full rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-default)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-[var(--text-secondary)]">
                Target bot
              </span>
              <select
                value={formBotId}
                onChange={(event) => setFormBotId(event.target.value)}
                className="w-full rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-default)]"
              >
                <option value="" disabled>
                  Select a bot
                </option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="m-0 mt-2 text-[11px] text-[var(--text-tertiary)]">
            External systems POST a JSON body to the inbound URL with an
            X-Webhook-Signature header (hex HMAC-SHA256 of the body). Each verified
            delivery opens a Rails ticket assigned to the target bot.
          </p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !formName.trim() || !formBotId}
              onClick={() => void handleCreate()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-[13px] font-semibold text-[var(--ui-text-inverse)] transition-colors hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Creating…" : "Create trigger"}
            </button>
          </div>
        </div>
      )}

      {loading && triggers.length === 0 ? (
        <SkeletonRow lines={4} />
      ) : triggers.length === 0 ? (
        <EmptyState
          icon={<HugeiconsIcon icon={WebhookIcon} size={32} />}
          title="No webhook triggers"
          caption="Create an inbound trigger to let external systems hand work to one of your bots over a signed HTTP endpoint."
          ctaLabel="New trigger"
          onCtaClick={() => setShowCreate(true)}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40">
          <table className="w-full">
            <thead>
              <tr className="border-b border-solid border-[var(--border-subtle)]">
                <th className={TH_CLASS}>Name</th>
                <th className={cn(TH_CLASS, "hidden md:table-cell")}>Target bot</th>
                <th className={TH_CLASS}>Inbound URL</th>
                <th className={TH_CLASS}>Status</th>
                <th className={cn(TH_CLASS, "text-right")}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {triggers.map((trigger) => (
                <React.Fragment key={trigger.id}>
                  <tr className="border-b border-solid border-[var(--border-subtle)] last:border-b-0">
                    <td className={cn(TD_CLASS, "font-medium")}>
                      {trigger.name}
                      <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)] md:hidden">
                        → {botName(trigger.target_bot_id)}
                      </div>
                    </td>
                    <td className={cn(TD_CLASS, "hidden text-[var(--text-secondary)] md:table-cell")}>
                      {botName(trigger.target_bot_id)}
                    </td>
                    <td className={TD_CLASS}>
                      <div className="flex min-w-0 items-center gap-2">
                        <code className="max-w-[240px] truncate font-mono text-[11px] text-[var(--text-secondary)]">
                          {getWebhookInboundUrl(trigger.id)}
                        </code>
                        <button
                          type="button"
                          aria-label="Copy inbound URL"
                          className="shrink-0 p-0.5 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
                          onClick={() => void copyUrl(trigger.id)}
                        >
                          <HugeiconsIcon
                            icon={copiedId === trigger.id ? CheckIcon : CopyIcon}
                            size={11}
                            className={copiedId === trigger.id ? "text-[var(--status-success)]" : undefined}
                          />
                        </button>
                      </div>
                    </td>
                    <td className={TD_CLASS}>
                      <button
                        type="button"
                        disabled={busyId === trigger.id}
                        onClick={() => void handleToggleActive(trigger)}
                        className={cn(
                          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50",
                          trigger.active ? "bg-[var(--accent-primary)]" : "bg-[var(--border-default)]"
                        )}
                        aria-label={trigger.active ? "Disable trigger" : "Enable trigger"}
                      >
                        <span
                          className={cn(
                            "inline-block size-4 transform rounded-full bg-white transition-transform",
                            trigger.active ? "translate-x-[18px]" : "translate-x-0.5"
                          )}
                        />
                      </button>
                      <span className="ml-2 text-[12px] text-[var(--text-tertiary)]">
                        {trigger.active ? "active" : "paused"}
                      </span>
                    </td>
                    <td className={cn(TD_CLASS, "text-right")}>
                      {confirmDeleteId === trigger.id ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-[12px] text-[var(--text-secondary)]">Delete?</span>
                          <button
                            type="button"
                            className={QUIET_BUTTON_CLASS}
                            disabled={busyId === trigger.id}
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className={DESTRUCTIVE_BUTTON_CLASS}
                            disabled={busyId === trigger.id}
                            onClick={() => void handleDelete(trigger)}
                          >
                            {busyId === trigger.id ? "Deleting…" : "Delete"}
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            className={QUIET_BUTTON_CLASS}
                            onClick={() => void toggleDeliveries(trigger.id)}
                          >
                            Deliveries
                          </button>
                          <button
                            type="button"
                            className={DESTRUCTIVE_BUTTON_CLASS}
                            onClick={() => setConfirmDeleteId(trigger.id)}
                          >
                            Delete
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                  {expandedId === trigger.id && (
                    <tr className="border-b border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="mb-2 text-[13px] font-semibold text-[var(--text-primary)]">
                          Recent deliveries
                        </div>
                        {deliveriesLoading ? (
                          <SkeletonRow lines={2} />
                        ) : deliveries.length === 0 ? (
                          <p className="m-0 text-[13px] text-[var(--text-secondary)]">
                            No inbound deliveries yet.
                          </p>
                        ) : (
                          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                            {deliveries.map((delivery) => (
                              <div
                                key={delivery.id}
                                className="flex items-center justify-between gap-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[12px] text-[var(--text-primary)]">
                                      {delivery.event ?? "webhook.received"}
                                    </span>
                                    <Badge className={statusBadgeClass(delivery.status)}>
                                      {delivery.status}
                                    </Badge>
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                                    {formatDateTime(delivery.created_at)}
                                    {delivery.response_status !== null && ` · HTTP ${delivery.response_status}`}
                                  </div>
                                  {delivery.error && (
                                    <div className="mt-0.5 truncate text-[11px] text-[var(--status-error)]">
                                      {delivery.error}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── Page shell with tabs ───────────────────────────────────────────────────

export function WebhooksPage(): React.ReactNode {
  const [tab, setTab] = useState<ManageTab>("subscriptions");

  return (
    <ListPage
      title="Webhooks"
      subtitle="Outbound event subscriptions and inbound triggers that hand external events to your bots."
      filters={
        <div className="inline-flex rounded-lg border border-solid border-[var(--border-subtle)] p-0.5">
          {(
            [
              { id: "subscriptions", label: "Subscriptions" },
              { id: "triggers", label: "Triggers" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                tab === item.id
                  ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
    >
      {tab === "subscriptions" ? <SubscriptionsTab /> : <TriggersTab />}
    </ListPage>
  );
}

export default WebhooksPage;
