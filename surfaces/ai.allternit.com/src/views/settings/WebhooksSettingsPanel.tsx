'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Warning,
  X,
  Copy,
  CheckCircle,
  PencilSimple,
  Trash,
  Eye,
  EyeSlash,
  ArrowsClockwise,
  Robot,
  Lightning,
  ShieldCheck,
  PlayCircle,
  Note,
} from '@phosphor-icons/react';
import { useAgentStore } from '@/lib/agents/agent.store';
import {
  listWebhookTriggers,
  createWebhookTrigger,
  updateWebhookTrigger,
  deleteWebhookTrigger,
  getWebhookInboundUrl,
  type WebhookTrigger,
  type WebhookExecutionMode,
} from '@/lib/webhook-api';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { PanelHeader } from '@/components/settings/PanelHeader';
import { SkeletonRow } from '@/components/settings/SkeletonRow';
import { EmptyState } from '@/components/settings/EmptyState';
import { QUIET_BUTTON_CLASS, DESTRUCTIVE_BUTTON_CLASS } from '@/components/settings/buttonStyles';
import { cn } from '@/lib/utils';

const EXECUTION_MODES: { value: WebhookExecutionMode; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'REQUIRE_APPROVAL',
    label: 'Require approval',
    icon: <ShieldCheck size={16} />,
    description: 'Creates a ticket the bot must accept before acting.',
  },
  {
    value: 'PLAN_ONLY',
    label: 'Plan only',
    icon: <Note size={16} />,
    description: 'Bot drafts a plan and waits for human review.',
  },
  {
    value: 'ACCEPT_EDITS',
    label: 'Accept edits',
    icon: <PencilSimple size={16} />,
    description: 'Bot may apply edits inside its sandbox.',
  },
  {
    value: 'BYPASS_PERMISSIONS',
    label: 'Bypass permissions',
    icon: <Lightning size={16} />,
    description: 'Bot acts immediately with elevated trust.',
  },
];

function maskSecret(value: string): string {
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 3)}${'•'.repeat(value.length - 6)}${value.slice(-3)}`;
}

interface WebhookFormData {
  name: string;
  source: string;
  event_type: string;
  target_agent_id: string;
  prompt_template: string;
  execution_mode: WebhookExecutionMode;
  secret: string;
  active: boolean;
}

function emptyForm(): WebhookFormData {
  return {
    name: '',
    source: '',
    event_type: '',
    target_agent_id: '',
    prompt_template: '',
    execution_mode: 'REQUIRE_APPROVAL',
    secret: '',
    active: true,
  };
}

function formFromTrigger(trigger: WebhookTrigger): WebhookFormData {
  return {
    name: trigger.name,
    source: trigger.source,
    event_type: trigger.event_type,
    target_agent_id: trigger.target_agent_id,
    prompt_template: trigger.prompt_template ?? '',
    execution_mode: trigger.execution_mode as WebhookExecutionMode,
    secret: '',
    active: trigger.active,
  };
}

export function WebhooksSettingsPanel(): React.ReactNode {
  const { agents, fetchAgents } = useAgentStore();
  const [triggers, setTriggers] = useState<WebhookTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WebhookFormData>(emptyForm());
  const [showSecret, setShowSecret] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const bots = useMemo(
    () => agents.filter((a) => (a as any).isBot === true || (a as any).botProfile != null),
    [agents],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchAgents();
      const data = await listWebhookTriggers();
      setTriggers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhook triggers');
    } finally {
      setLoading(false);
    }
  }, [fetchAgents]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowSecret(false);
  };

  const openEdit = (trigger: WebhookTrigger) => {
    setEditingId(trigger.id);
    setForm(formFromTrigger(trigger));
    setShowSecret(false);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.source.trim() || !form.event_type.trim() || !form.target_agent_id.trim()) {
      setError('Please fill in name, source, event type, and target bot.');
      return;
    }
    if (!editingId && !form.secret.trim()) {
      setError('A signing secret is required when creating a webhook trigger.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        prompt_template: form.prompt_template.trim() || null,
        ...(editingId && !form.secret.trim() ? { secret: undefined } : {}),
      };
      if (editingId) {
        await updateWebhookTrigger(editingId, payload);
      } else {
        await createWebhookTrigger(payload);
      }
      await load();
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save webhook trigger');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook trigger? External sources will no longer be able to wake the target bot.')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteWebhookTrigger(id);
      await load();
      if (editingId === id) closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete webhook trigger');
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async (id: string) => {
    try {
      await navigator.clipboard.writeText(getWebhookInboundUrl(id));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <PanelHeader title="Webhooks" description="Route external events to bots so they wake up and start work." />
        <SkeletonRow lines={4} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelHeader title="Webhooks" description="Route external events to bots so they wake up and start work." />

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-solid border-[var(--status-error)]/40 bg-[var(--status-error)]/10 text-[12px] text-[var(--status-error)]">
          <Warning size={16} weight="fill" /> {error}
        </div>
      )}

      {!editingId && (
        <SettingsCard
          title="Triggers"
          description="Each trigger maps a source + event to a target bot."
          action={
            <button type="button" onClick={openCreate} className={QUIET_BUTTON_CLASS}>
              <Plus size={14} /> New trigger
            </button>
          }
        >
          {triggers.length === 0 ? (
            <EmptyState
              icon={<PlayCircle size={32} className="text-[var(--text-tertiary)]" />}
              title="No webhook triggers yet"
              description="Create a trigger to let external services wake up a bot via a signed inbound webhook."
              action={
                <button type="button" onClick={openCreate} className={QUIET_BUTTON_CLASS}>
                  <Plus size={14} /> Create trigger
                </button>
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {triggers.map((trigger) => {
                const url = getWebhookInboundUrl(trigger.id);
                return (
                  <div
                    key={trigger.id}
                    className="flex flex-col gap-2 p-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide',
                            trigger.active
                              ? 'bg-[var(--status-success)]/15 text-[var(--status-success)]'
                              : 'bg-[var(--text-tertiary)]/15 text-[var(--text-tertiary)]',
                          )}
                        >
                          {trigger.active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                          {trigger.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEdit(trigger)}
                          disabled={busy}
                          className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
                          aria-label="Edit"
                        >
                          <PencilSimple size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(trigger.id)}
                          disabled={busy}
                          className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error)]/10 transition-colors disabled:opacity-50"
                          aria-label="Delete"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-secondary)]">
                        {trigger.source}
                      </span>
                      <span>→</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-secondary)]">
                        <Robot size={12} />
                        {agents.find((a) => a.id === trigger.target_agent_id)?.name ?? trigger.target_agent_id}
                      </span>
                      <span className="text-[var(--text-tertiary)]">on {trigger.event_type}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--bg-secondary)] text-[11px] font-mono text-[var(--text-secondary)] truncate">
                        {url}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyUrl(trigger.id)}
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                      >
                        {copiedId === trigger.id ? <CheckCircle size={12} /> : <Copy size={12} />}
                        {copiedId === trigger.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SettingsCard>
      )}

      {editingId !== null && (
        <SettingsCard
          title={editingId ? 'Edit trigger' : 'New trigger'}
          description={editingId ? 'Update the webhook source, event, or target bot.' : 'Configure an inbound webhook that wakes a bot.'}
          action={
            <button type="button" onClick={closeForm} className={QUIET_BUTTON_CLASS}>
              <X size={14} /> Cancel
            </button>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-[var(--text-secondary)]">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Stripe bookings"
                  className="w-full rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-[var(--text-secondary)]">Source</label>
                <input
                  type="text"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="stripe"
                  className="w-full rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-[var(--text-secondary)]">Event type</label>
                <input
                  type="text"
                  value={form.event_type}
                  onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                  placeholder="checkout.session.completed"
                  className="w-full rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-[var(--text-secondary)]">Target bot</label>
                <select
                  value={form.target_agent_id}
                  onChange={(e) => setForm({ ...form, target_agent_id: e.target.value })}
                  className="w-full rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                >
                  <option value="">Select a bot…</option>
                  {bots.map((bot) => (
                    <option key={bot.id} value={bot.id}>
                      {bot.name}
                    </option>
                  ))}
                  {bots.length === 0 && agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-[var(--text-secondary)]">Prompt template (optional)</label>
              <textarea
                value={form.prompt_template}
                onChange={(e) => setForm({ ...form, prompt_template: e.target.value })}
                placeholder="Instructions prepended to the webhook payload when the bot receives the ticket."
                rows={3}
                className="w-full resize-y rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] text-[var(--text-primary)] leading-relaxed outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-medium text-[var(--text-secondary)]">Execution mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EXECUTION_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setForm({ ...form, execution_mode: mode.value })}
                    className={cn(
                      'flex items-start gap-2 p-2.5 rounded-lg border text-left transition-colors',
                      form.execution_mode === mode.value
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:border-[var(--border-default)]',
                    )}
                  >
                    <span className={cn(
                      'mt-0.5',
                      form.execution_mode === mode.value ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]',
                    )}>
                      {mode.icon}
                    </span>
                    <div>
                      <div className={cn(
                        'text-[12px] font-medium',
                        form.execution_mode === mode.value ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]',
                      )}>
                        {mode.label}
                      </div>
                      <div className="text-[11px] text-[var(--text-tertiary)] leading-tight">{mode.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-[var(--text-secondary)]">
                Signing secret {editingId && '(leave blank to keep current)'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={form.secret}
                  onChange={(e) => setForm({ ...form, secret: e.target.value })}
                  placeholder="whsec_…"
                  className="min-w-0 flex-1 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((s) => !s)}
                  className="p-2 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                  aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                >
                  {showSecret ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
                {!editingId && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, secret: `whsec_${crypto.randomUUID().replace(/-/g, '')}` })}
                    className={cn(QUIET_BUTTON_CLASS, 'shrink-0')}
                  >
                    <ArrowsClockwise size={14} /> Generate
                  </button>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                Send this secret in the <code className="text-[11px]">X-Allternit-Signature</code> header as an HMAC-SHA256 hex digest of the request body.
              </p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="size-4 accent-[var(--accent-primary)]"
              />
              <span className="text-[13px] text-[var(--text-secondary)]">Active</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-solid border-[var(--border-subtle)]">
              <button type="button" onClick={closeForm} className={QUIET_BUTTON_CLASS} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-none bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {busy ? <ArrowsClockwise size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create trigger'}
              </button>
            </div>
          </div>
        </SettingsCard>
      )}
    </div>
  );
}
