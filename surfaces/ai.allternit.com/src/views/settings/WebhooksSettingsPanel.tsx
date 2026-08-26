'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  WebhooksLogo,
  Plus,
  ArrowsClockwise,
  Copy,
  Trash,
  PencilSimple,
  X,
  Check,
  MagnifyingGlass,
  CaretDown,
  Robot,
} from '@phosphor-icons/react';
import { useAgentStore } from '@/lib/agents/agent.store';
import { usePlatformOrganization } from '@/lib/platform-auth-client';
import { PanelHeader } from '@/components/settings/PanelHeader';
import { SettingsTable, SettingsTableCell } from '@/components/settings/SettingsTable';
import { SkeletonRow } from '@/components/settings/SkeletonRow';
import { EmptyState } from '@/components/settings/EmptyState';
import { Toggle } from '@/components/settings/Toggle';
import { QUIET_BUTTON_CLASS, DESTRUCTIVE_BUTTON_CLASS } from '@/components/settings/buttonStyles';
import { cn } from '@/lib/utils';
import {
  listWebhookTriggers,
  createWebhookTrigger,
  updateWebhookTrigger,
  deleteWebhookTrigger,
  listWebhookTriggerDeliveries,
  getWebhookInboundUrl,
  type WebhookTrigger,
  type WebhookTriggerDelivery,
} from '@/lib/webhook-api';

export function WebhooksSettingsPanel(): React.ReactNode {
  const { agents, fetchAgents } = useAgentStore();
  const [triggers, setTriggers] = useState<WebhookTrigger[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formBotId, setFormBotId] = useState('');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookTriggerDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { organization } = usePlatformOrganization();

  const load = useCallback(async () => {
    if (!organization?.id) {
      setTriggers([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listWebhookTriggers();
      setTriggers(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, [organization]);

  useEffect(() => {
    void load();
    void fetchAgents();
  }, [load, fetchAgents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return triggers;
    return triggers.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.target_bot_id.toLowerCase().includes(q)
    );
  }, [triggers, search]);

  const resetForm = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormName('');
    setFormBotId('');
  };

  const startCreate = () => {
    resetForm();
    setIsCreating(true);
    setFormBotId(agents[0]?.id ?? '');
  };

  const startEdit = (t: WebhookTrigger) => {
    setIsCreating(false);
    setEditingId(t.id);
    setFormName(t.name);
    setFormBotId(t.target_bot_id);
  };

  const handleSave = async () => {
    const name = formName.trim();
    if (!name || !formBotId) return;
    try {
      if (editingId) {
        await updateWebhookTrigger(editingId, { name, target_bot_id: formBotId });
      } else {
        await createWebhookTrigger({ name, target_bot_id: formBotId });
      }
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save webhook');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook trigger?')) return;
    try {
      await deleteWebhookTrigger(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete webhook');
    }
  };

  const handleToggleActive = async (t: WebhookTrigger) => {
    try {
      await updateWebhookTrigger(t.id, { active: !t.active });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update webhook');
    }
  };

  const copyUrl = async (id: string) => {
    try {
      await navigator.clipboard.writeText(getWebhookInboundUrl(id));
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
    } catch {
      // ignore
    }
  };

  const toggleDeliveries = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setDeliveriesLoading(true);
    try {
      const rows = await listWebhookTriggerDeliveries(id);
      setDeliveries(rows);
    } catch (e) {
      setDeliveries([]);
    } finally {
      setDeliveriesLoading(false);
    }
  };

  const botName = (botId: string) =>
    agents.find((a) => a.id === botId)?.name ?? botId;

  return (
    <div>
      <PanelHeader title="Webhook Triggers">
        <span className="relative">
          <MagnifyingGlass
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search triggers"
            className="w-[180px] pl-8 pr-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)]"
          />
        </span>
        <button
          type="button"
          className={QUIET_BUTTON_CLASS}
          onClick={() => void load()}
          disabled={loading}
        >
          <ArrowsClockwise size={14} className={cn(loading && 'animate-spin')} /> Refresh
        </button>
        <button
          type="button"
          className={QUIET_BUTTON_CLASS}
          onClick={startCreate}
        >
          <Plus size={14} /> New trigger
        </button>
      </PanelHeader>

      {(isCreating || editingId) && (
        <div className="mb-6 p-4 rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              {editingId ? 'Edit webhook trigger' : 'Create webhook trigger'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="bg-transparent border-none text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer p-1"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. GitHub issue opened"
                className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-[14px] outline-none focus:border-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                Target bot
              </label>
              <div className="relative">
                <select
                  value={formBotId}
                  onChange={(e) => setFormBotId(e.target.value)}
                  className="w-full p-2.5 pr-8 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-[14px] outline-none appearance-none focus:border-[var(--text-primary)]"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <CaretDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-tertiary)]"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={QUIET_BUTTON_CLASS} onClick={resetForm}>
              Cancel
            </button>
            <button
              type="button"
              className={QUIET_BUTTON_CLASS}
              onClick={() => void handleSave()}
              disabled={!formName.trim() || !formBotId}
            >
              {editingId ? 'Save changes' : 'Create trigger'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--status-error)]/10 text-[var(--status-error)] text-[13px]">
          {error}
        </div>
      )}

      {loading && triggers.length === 0 ? (
        <SkeletonRow lines={4} />
      ) : triggers.length === 0 ? (
        <EmptyState
          icon={<WebhooksLogo size={40} weight="thin" />}
          caption="No webhook triggers yet."
          ctaLabel="Create trigger"
          onCtaClick={startCreate}
        />
      ) : (
        <>
          <SettingsTable columns={['Name', 'Target bot', 'URL', 'Active', '']}>
            {filtered.map((t) => (
              <React.Fragment key={t.id}>
                <tr>
                  <SettingsTableCell>
                    <span className="block font-medium text-[var(--text-primary)]">{t.name}</span>
                    <span className="block text-[12px] text-[var(--text-tertiary)] font-mono">
                      {t.id}
                    </span>
                  </SettingsTableCell>
                  <SettingsTableCell>
                    <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)]">
                      <Robot size={14} />
                      {botName(t.target_bot_id)}
                    </span>
                  </SettingsTableCell>
                  <SettingsTableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-[12px] text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-2 py-1 rounded truncate max-w-[220px]">
                        {getWebhookInboundUrl(t.id)}
                      </code>
                      <button
                        type="button"
                        onClick={() => void copyUrl(t.id)}
                        className="bg-transparent border-none text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer p-1"
                        title="Copy URL"
                      >
                        {copiedId === t.id ? (
                          <Check size={14} className="text-[var(--status-success)]" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                  </SettingsTableCell>
                  <SettingsTableCell>
                    <Toggle
                      value={t.active}
                      onChange={() => void handleToggleActive(t)}
                      aria-label={`Toggle ${t.name}`}
                    />
                  </SettingsTableCell>
                  <SettingsTableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => void toggleDeliveries(t.id)}
                        className={QUIET_BUTTON_CLASS}
                      >
                        Deliveries
                        <CaretDown
                          size={12}
                          className={cn(
                            'transition-transform',
                            expandedId === t.id && 'rotate-180'
                          )}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        className="bg-transparent border-none text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer p-2"
                        title="Edit"
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(t.id)}
                        className="bg-transparent border-none text-[var(--text-tertiary)] hover:text-[var(--status-error)] cursor-pointer p-2"
                        title="Delete"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </SettingsTableCell>
                </tr>
                {expandedId === t.id && (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <div className="px-4 py-3 bg-[var(--bg-secondary)] border-t border-solid border-[var(--border-subtle)]">
                        <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-2">
                          Recent deliveries
                        </h4>
                        {deliveriesLoading ? (
                          <SkeletonRow lines={2} />
                        ) : deliveries.length === 0 ? (
                          <p className="text-[13px] text-[var(--text-secondary)]">
                            No deliveries yet.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-[240px] overflow-y-auto">
                            {deliveries.map((d) => (
                              <div
                                key={d.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-elevated)] border border-solid border-[var(--border-subtle)]"
                              >
                                <div className="min-w-0">
                                  <div className="text-[13px] text-[var(--text-primary)]">
                                    {d.event ?? 'webhook.received'} ·{' '}
                                    <span
                                      className={cn(
                                        'text-[12px]',
                                        d.status === 'delivered'
                                          ? 'text-[var(--status-success)]'
                                          : 'text-[var(--status-error)]'
                                      )}
                                    >
                                      {d.status}
                                    </span>
                                  </div>
                                  <div className="text-[12px] text-[var(--text-tertiary)]">
                                    {new Date(d.created_at).toLocaleString()}
                                  </div>
                                  {d.error && (
                                    <div className="text-[12px] text-[var(--status-error)] truncate">
                                      {d.error}
                                    </div>
                                  )}
                                </div>
                                {d.response_status && (
                                  <div className="text-[12px] text-[var(--text-secondary)]">
                                    HTTP {d.response_status}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </SettingsTable>
          {filtered.length === 0 && search && (
            <p className="text-[13px] text-[var(--text-tertiary)] py-6 text-center">
              No triggers match &ldquo;{search}&rdquo;.
            </p>
          )}
        </>
      )}
    </div>
  );
}
