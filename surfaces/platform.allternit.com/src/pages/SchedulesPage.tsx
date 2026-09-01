import React, { useCallback, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar02Icon,
  PlayIcon,
  PowerServiceIcon,
  PowerOffIcon,
  TrashIcon,
  PlusSignIcon,
  Refresh01Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/lib/api-client";
import {
  type ScheduleSummary,
  type MisfirePolicy,
  listSchedules,
  createSchedule,
  enableSchedule,
  disableSchedule,
  triggerSchedule,
  deleteSchedule,
} from "@/lib/schedules";
import { EmptyState } from "@/components/settings/EmptyState";
import { SkeletonRow } from "@/components/settings/SkeletonRow";
import { Badge } from "@/components/settings/Badge";
import { QUIET_BUTTON_CLASS, DESTRUCTIVE_BUTTON_CLASS } from "@/components/settings/buttonStyles";

function formatTime(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  return date.toLocaleDateString();
}

export function SchedulesPage() {
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [name, setName] = useState("");
  const [cron, setCron] = useState("");
  const [command, setCommand] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSchedules();
      setSchedules(data);
    } catch (err) {
      setError(formatApiError(err, "Unable to load schedules"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !cron.trim() || !command.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createSchedule({
        name: name.trim(),
        description: description.trim() || undefined,
        cron_expr: cron.trim(),
        timezone: timezone.trim() || "UTC",
        job_template: { command: command.trim() },
        enabled,
        misfire_policy: "ignore" as MisfirePolicy,
      });
      setName("");
      setCron("");
      setCommand("");
      setTimezone("UTC");
      setDescription("");
      setEnabled(true);
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(formatApiError(err, "Unable to create schedule"));
    } finally {
      setCreating(false);
    }
  }, [name, cron, command, timezone, description, enabled, load]);

  const action = useCallback(
    async (id: string, fn: (id: string) => Promise<unknown>) => {
      setBusyId(id);
      setError(null);
      try {
        await fn(id);
        await load();
      } catch (err) {
        setError(formatApiError(err, "Unable to update schedule"));
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
            Schedules
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Recurring jobs that trigger runs on your chosen runtime.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={QUIET_BUTTON_CLASS}
          >
            <HugeiconsIcon
              icon={Refresh01Icon}
              size={13}
              className={cn(loading && "animate-spin")}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowCreate((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] hover:brightness-110 transition-all disabled:opacity-50"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={13} />
            New schedule
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)] mb-4">
            Create schedule
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-tertiary)]">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="nightly-sync"
                className="w-full p-2 px-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-tertiary)]">
                Cron expression
              </label>
              <input
                value={cron}
                onChange={(e) => setCron(e.target.value)}
                placeholder="0 2 * * *"
                className="w-full p-2 px-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-tertiary)]">Command</label>
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="allternit run --workspace ./project"
                className="w-full p-2 px-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-tertiary)]">Timezone</label>
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="UTC"
                className="w-full p-2 px-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-tertiary)]">
                Description (optional)
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this schedule do?"
                className="w-full p-2 px-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
              />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-[13px] text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--accent-primary)]"
              />
              Enabled
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className={QUIET_BUTTON_CLASS}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={creating || !name.trim() || !cron.trim() || !command.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] hover:brightness-110 transition-all disabled:opacity-50"
            >
              {creating && <HugeiconsIcon icon={Refresh01Icon} size={13} className="animate-spin" />}
              Create schedule
            </button>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-dashed border-[var(--status-error)]/30 bg-[var(--status-error)]/10 p-4">
          <div className="flex items-start gap-2 text-[13px] text-[var(--status-error)]">
            <HugeiconsIcon icon={AlertCircleIcon} size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
          <SkeletonRow lines={5} />
        </div>
      ) : schedules.length === 0 ? (
        <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <EmptyState
            icon={<HugeiconsIcon icon={Calendar02Icon} size={32} />}
            title="No schedules"
            caption="Create a schedule to run agent workflows on a recurring cron expression."
            ctaLabel="Refresh"
            onCtaClick={() => void load()}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">
                  <th className="px-4 py-3 font-semibold">Schedule</th>
                  <th className="px-4 py-3 font-semibold">Cron</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Next run</th>
                  <th className="px-4 py-3 font-semibold">Runs</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)]">
                {schedules.map((schedule) => (
                  <tr
                    key={schedule.id}
                    className="border-b border-[var(--border-subtle)] last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="text-[var(--text-primary)] font-medium">{schedule.name}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px]">{schedule.cron_expr}</td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          schedule.enabled
                            ? "text-[var(--status-success)] bg-[var(--status-success)]/10"
                            : "text-[var(--text-tertiary)] bg-[var(--bg-primary)]"
                        }
                      >
                        {schedule.enabled ? "enabled" : "disabled"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{formatTime(schedule.next_run_at)}</td>
                    <td className="px-4 py-3">{schedule.run_count.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {schedule.enabled ? (
                          <button
                            type="button"
                            title="Disable"
                            disabled={busyId === schedule.id}
                            onClick={() => void action(schedule.id, disableSchedule)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--status-warning)] hover:bg-[var(--status-warning)]/10 transition-colors disabled:opacity-50"
                          >
                            <HugeiconsIcon icon={PowerOffIcon} size={12} />
                            Disable
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Enable"
                            disabled={busyId === schedule.id}
                            onClick={() => void action(schedule.id, enableSchedule)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium bg-[var(--status-success)]/10 text-[var(--status-success)] hover:bg-[var(--status-success)]/20 transition-colors disabled:opacity-50"
                          >
                            <HugeiconsIcon icon={PowerServiceIcon} size={12} />
                            Enable
                          </button>
                        )}
                        <button
                          type="button"
                          title="Trigger now"
                          disabled={busyId === schedule.id}
                          onClick={() => void action(schedule.id, triggerSchedule)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium bg-[var(--accent-highlight)]/10 text-[var(--accent-highlight)] hover:bg-[var(--accent-highlight)]/20 transition-colors disabled:opacity-50"
                        >
                          <HugeiconsIcon icon={PlayIcon} size={12} />
                          Run now
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          disabled={busyId === schedule.id}
                          onClick={() => void action(schedule.id, deleteSchedule)}
                          className={DESTRUCTIVE_BUTTON_CLASS}
                        >
                          <HugeiconsIcon icon={TrashIcon} size={12} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
