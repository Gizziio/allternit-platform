import React, { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Refresh01Icon,
  DollarIcon,
  Clock01Icon,
  BarChartIcon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { getCostSummary, getCostBreakdown, type CostSummary, type CostBreakdownItem } from "@/lib/usage";
import { formatApiError } from "@/lib/api-client";
import { SkeletonRow } from "@/components/settings/SkeletonRow";

const ACCENT = "#9A7658";
const MUTED = "#71717a";

function formatCost(cost: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cost);
}

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours.toFixed(1)} hr`;
}

type Period = "weekly" | "monthly" | "yearly";

export function PlatformUsageDashboard() {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [breakdown, setBreakdown] = useState<CostBreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("monthly");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, b] = await Promise.all([
        getCostSummary(),
        getCostBreakdown("provider"),
      ]);
      setSummary(s);
      setBreakdown(b);
    } catch (err) {
      setError(formatApiError(err, "Unable to load usage"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !summary) {
    return (
      <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
        <SkeletonRow lines={4} />
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
        <div className="flex items-start gap-2 text-[13px] text-[var(--status-error)]">
          <HugeiconsIcon icon={AlertCircleIcon} size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[12px] font-medium"
        >
          <HugeiconsIcon icon={Refresh01Icon} size={13} /> Retry
        </button>
      </div>
    );
  }

  if (!summary) return null;

  const chartData = breakdown.length
    ? breakdown.map((item) => ({
        name: item.provider || "Unknown",
        cost: item.total_cost,
      }))
    : [{ name: "No data", cost: 0 }];

  const budgetPercent = Math.min(100, summary.budget_utilization_percent);

  return (
    <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="size-10 rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center">
            <HugeiconsIcon icon={BarChartIcon} size={20} />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Cloud usage trend</h2>
            <p className="text-[11px] text-[var(--text-tertiary)]">Runtime spend and utilization</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-1">
            {(["weekly", "monthly", "yearly"] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1 rounded-lg text-[11px] font-medium capitalize transition-colors",
                  period === p
                    ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-xs font-medium transition-colors disabled:opacity-50"
          >
            <HugeiconsIcon icon={Refresh01Icon} size={13} className={cn(loading && "animate-spin")} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <MetricCard
          label="Current cost"
          value={formatCost(summary.current_month_cost, summary.currency)}
          icon={DollarIcon}
        />
        <MetricCard
          label="Runtime hours"
          value={formatDuration(summary.total_duration_hours)}
          icon={Clock01Icon}
        />
        <MetricCard label="Runs" value={summary.run_count.toLocaleString()} icon={BarChartIcon} />
      </div>

      <div className="mb-5">
        <div className="flex items-center justify-between gap-3 text-[12px] mb-2">
          <span className="text-[var(--text-secondary)]">Budget utilization</span>
          <span
            className={cn(
              "font-medium",
              summary.budget_status === "over_budget"
                ? "text-[var(--status-error)]"
                : summary.budget_status === "warning"
                ? "text-[var(--status-warning)]"
                : "text-[var(--text-primary)]"
            )}
          >
            {summary.budget_utilization_percent.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              summary.budget_status === "over_budget"
                ? "bg-[var(--status-error)]"
                : summary.budget_status === "warning"
                ? "bg-[var(--status-warning)]"
                : "bg-[var(--accent-primary)]"
            )}
            style={{ width: `${budgetPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--text-tertiary)] mt-1.5">
          <span>Budget {formatCost(summary.monthly_budget, summary.currency)}</span>
          <span>
            {formatCost(Math.max(0, summary.monthly_budget - summary.current_month_cost), summary.currency)} remaining
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[220px]">
        <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
            Cost by provider
          </h3>
          {breakdown.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-[12px] text-[var(--text-tertiary)]">
              No cost data yet.
            </div>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: -20, right: 0, top: 4, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: MUTED, fontSize: 10 }}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "var(--surface-hover)" }}
                    contentStyle={{
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "8px",
                    }}
                    formatter={(v: number) => formatCost(v, summary.currency)}
                  />
                  <Bar dataKey="cost" fill={ACCENT} radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
            Cost distribution
          </h3>
          {breakdown.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-[12px] text-[var(--text-tertiary)]">
              No cost data yet.
            </div>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="cost"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "8px",
                    }}
                    formatter={(v: number) => formatCost(v, summary.currency)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const PIE_COLORS = [ACCENT, "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#a855f7"];

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: typeof DollarIcon;
}) {
  return (
    <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
      <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-1">
        <HugeiconsIcon icon={icon} size={14} />
        <span className="text-[11px]">{label}</span>
      </div>
      <div className="text-[16px] font-semibold text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
