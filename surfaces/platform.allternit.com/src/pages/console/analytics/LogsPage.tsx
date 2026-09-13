import React, { useCallback, useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  DocumentValidationIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/lib/api-client";
import {
  ListPage,
  EmptyState,
  MonoChip,
  SkeletonRow,
  CodeTemplateBlock,
  QUIET_BUTTON_CLASS,
  SETTINGS_SELECT_CLASS,
} from "@/components/console-ui";
import {
  getGatewayLogs,
  listTags,
  microdollarsToUsd,
  type GatewayLogRow,
  type ResourceTag,
} from "@/lib/gateway-analytics";

const PAGE_LIMIT = 50;
const RANGE_OPTIONS = [
  { label: "All time", days: null },
  { label: "Last 24 hours", days: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
];

function formatTime(iso: string): string {
  const date = new Date(iso.replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function statusBadgeClass(status: string): string {
  return status === "success"
    ? "bg-[var(--status-success)]/10 text-[var(--status-success)]"
    : "bg-[var(--status-error)]/10 text-[var(--status-error)]";
}

export function LogsPage(): React.ReactNode {
  const [logs, setLogs] = useState<GatewayLogRow[]>([]);
  const [tags, setTags] = useState<ResourceTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [rangeDays, setRangeDays] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [selected, setSelected] = useState<GatewayLogRow | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await getGatewayLogs({
          limit: PAGE_LIMIT,
          cursor,
          status: statusFilter || undefined,
          tag: tagFilter || undefined,
        });
        setLogs(data.logs);
        setNextCursor(data.next_cursor);
      } catch (err) {
        setError(formatApiError(err, "Unable to load logs"));
        setLogs([]);
        setNextCursor(null);
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, tagFilter]
  );

  useEffect(() => {
    setCursorStack([]);
    void load();
  }, [load]);

  useEffect(() => {
    void listTags()
      .then(setTags)
      .catch(() => setTags([]));
  }, []);

  const goNext = useCallback(() => {
    if (!nextCursor) return;
    setCursorStack((stack) => [...stack, nextCursor]);
    void load(nextCursor);
  }, [load, nextCursor]);

  const goBack = useCallback(() => {
    setCursorStack((stack) => {
      const next = stack.slice(0, -1);
      void load(next[next.length - 1]);
      return next;
    });
  }, [load]);

  const tagOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const tag of tags) {
      if (!seen.has(tag.value)) seen.set(tag.value, `${tag.key}: ${tag.value}`);
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [tags]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const cutoff =
      rangeDays === null
        ? null
        : Date.now() - rangeDays * 86_400_000;
    return logs.filter((row) => {
      if (query) {
        const haystack = `${row.id} ${row.model_id ?? ""} ${row.provider_id ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (cutoff !== null) {
        const ts = new Date(row.created_at.replace(" ", "T") + "Z").getTime();
        if (!Number.isNaN(ts) && ts < cutoff) return false;
      }
      return true;
    });
  }, [logs, search, rangeDays]);

  return (
    <ListPage
      title="Logs"
      subtitle="Request logs usually appear within a minute of completing. Batch requests are not included."
      searchPlaceholder="Search by ID, model, or provider"
      onSearch={setSearch}
      filters={
        <>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className={SETTINGS_SELECT_CLASS}
          >
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            aria-label="Filter by tag"
            className={SETTINGS_SELECT_CLASS}
          >
            <option value="">All tags</option>
            {tagOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={rangeDays === null ? "" : String(rangeDays)}
            onChange={(e) =>
              setRangeDays(e.target.value === "" ? null : Number(e.target.value))
            }
            aria-label="Filter by range"
            className={SETTINGS_SELECT_CLASS}
          >
            {RANGE_OPTIONS.map((range) => (
              <option key={range.label} value={range.days === null ? "" : String(range.days)}>
                {range.label}
              </option>
            ))}
          </select>
        </>
      }
    >
      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-solid border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-3 py-2 text-[13px] text-[var(--status-error)]">
          <HugeiconsIcon icon={AlertCircleIcon} size={14} />
          {error}
        </p>
      )}

      {loading && logs.length === 0 ? (
        <SkeletonRow lines={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<HugeiconsIcon icon={DocumentValidationIcon} size={32} />}
          title="No logs found"
          caption={
            search || statusFilter || tagFilter
              ? "No logs match the current filters. Try widening the search."
              : "Requests sent through the gateway will appear here within a minute of completing."
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-solid border-[var(--border-subtle)]">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-solid border-[var(--border-subtle)] text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Model</th>
                  <th className="px-3 py-2 font-medium">Input tokens</th>
                  <th className="px-3 py-2 font-medium">Output tokens</th>
                  <th className="px-3 py-2 font-medium">Latency</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className="cursor-pointer border-b border-solid border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--surface-hover)]"
                  >
                    <td className="px-3 py-2.5">
                      <MonoChip>{row.id.slice(0, 14)}…</MonoChip>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                          statusBadgeClass(row.status)
                        )}
                      >
                        {row.status}
                      </span>
                      {row.error_type && (
                        <span className="ml-1.5 text-[11px] text-[var(--text-tertiary)]">
                          {row.error_type}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[var(--text-secondary)]">
                      {formatTime(row.created_at)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-[var(--text-secondary)]">
                      {row.model_id ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                      {row.prompt_tokens.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                      {row.completion_tokens.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                      {row.latency_ms >= 1000
                        ? `${(row.latency_ms / 1000).toFixed(1)}s`
                        : `${row.latency_ms}ms`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 text-[12px] text-[var(--text-secondary)]">
            <button
              type="button"
              aria-label="Previous page"
              disabled={cursorStack.length === 0 || loading}
              onClick={goBack}
              className="inline-flex size-7 items-center justify-center rounded-md border border-solid border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
            </button>
            <button
              type="button"
              aria-label="Next page"
              disabled={!nextCursor || loading}
              onClick={goNext}
              className="inline-flex size-7 items-center justify-center rounded-md border border-solid border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
            </button>
          </div>
        </>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setSelected(null)}
        >
          <div
            className="h-full w-full max-w-lg overflow-y-auto border-l border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`Log ${selected.id} details`}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="m-0 text-[16px] font-semibold text-[var(--text-primary)]">
                  Log details
                </h2>
                <p className="m-0 mt-1 font-mono text-[12px] text-[var(--text-tertiary)]">
                  {selected.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className={cn(QUIET_BUTTON_CLASS, "px-2.5 py-1 text-[12px]")}
              >
                Close
              </button>
            </div>

            <dl className="m-0 mb-5 space-y-2 text-[13px]">
              {(
                [
                  ["Status", selected.status],
                  ["Error type", selected.error_type],
                  ["Time", formatTime(selected.created_at)],
                  ["Provider", selected.provider_id],
                  ["Model", selected.model_id],
                  ["Fallback from", selected.fallback_from],
                  ["Routing policy", selected.policy],
                  ["Input tokens", selected.prompt_tokens.toLocaleString()],
                  ["Output tokens", selected.completion_tokens.toLocaleString()],
                  ["Reasoning tokens", selected.reasoning_tokens.toLocaleString()],
                  ["Cached tokens", selected.cached_tokens.toLocaleString()],
                  ["Latency", `${selected.latency_ms}ms`],
                  ["Time to first token", selected.ttft_ms === null ? null : `${selected.ttft_ms}ms`],
                  ["Cost", microdollarsToUsd(selected.cost_microdollars)],
                  ["Key prefix", selected.key_prefix],
                  ["Gizzi session", selected.gizzi_session_id],
                  ["Batch", selected.batch_id],
                  ["Context cache", selected.context_cache_id],
                ] as Array<[string, string | null]>
              )
                .filter(([, value]) => value !== null)
                .map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-[var(--text-tertiary)]">{label}</dt>
                    <dd className="m-0 text-right font-mono text-[12px] text-[var(--text-secondary)]">
                      {value}
                    </dd>
                  </div>
                ))}
            </dl>

            <CodeTemplateBlock language="json" code={JSON.stringify(selected, null, 2)} />
          </div>
        </div>
      )}
    </ListPage>
  );
}

export default LogsPage;
