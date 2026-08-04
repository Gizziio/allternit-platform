"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LedgerEvent } from "@/lib/agents/rails.service";
import type { Receipt } from "@/runner/dak.types";

interface ObservabilityChartsProps {
  ledgerEvents: LedgerEvent[];
  receipts: Receipt[];
}

const KIND_COLORS: Record<string, string> = {
  tool_call_post: "#3b82f6",
  validator_report: "#22c55e",
  build_report: "#a855f7",
  gate_decision: "#eab308",
  session_start: "#6b7280",
  dag_load: "#f97316",
  node_entry: "#14b8a6",
  context_pack_sealed: "#06b6d4",
};

function formatHour(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:00`;
}

function buildLedgerSeries(events: LedgerEvent[]): { label: string; count: number }[] {
  if (events.length === 0) return [];

  const counts = new Map<string, number>();
  for (const event of events) {
    if (!event.timestamp) continue;
    const key = formatHour(new Date(event.timestamp));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  return sorted.map(([label, count]) => ({ label, count }));
}

function buildReceiptSeries(receipts: Receipt[]): { label: string; [kind: string]: string | number }[] {
  if (receipts.length === 0) return [];

  const kinds = Array.from(new Set(receipts.map((r) => r.kind)));
  const counts = new Map<string, Record<string, number>>();

  for (const receipt of receipts) {
    if (!receipt.timestamp) continue;
    const key = formatHour(new Date(receipt.timestamp));
    const bucket = counts.get(key) ?? {};
    bucket[receipt.kind] = (bucket[receipt.kind] ?? 0) + 1;
    counts.set(key, bucket);
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  return sorted.map(([label, bucket]) => {
    const row: { label: string; [kind: string]: string | number } = { label };
    for (const kind of kinds) {
      row[kind] = bucket[kind] ?? 0;
    }
    return row;
  });
}

export function LedgerEventVolume({ ledgerEvents }: { ledgerEvents: LedgerEvent[] }) {
  const data = useMemo(() => buildLedgerSeries(ledgerEvents), [ledgerEvents]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Ledger Event Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No ledger events with timestamps available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Ledger Event Volume</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <defs>
                <linearGradient id="ledgerGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                labelStyle={{ color: "hsl(var(--popover-foreground))" }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#22c55e"
                fill="url(#ledgerGradient)"
                strokeWidth={2}
                name="Events"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReceiptKindTimeline({ receipts }: { receipts: Receipt[] }) {
  const data = useMemo(() => buildReceiptSeries(receipts), [receipts]);
  const kinds = useMemo(() => Array.from(new Set(receipts.map((r) => r.kind))), [receipts]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Receipts by Kind</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No receipts with timestamps available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Receipts by Kind</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                labelStyle={{ color: "hsl(var(--popover-foreground))" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {kinds.map((kind) => (
                <Bar
                  key={kind}
                  dataKey={kind}
                  stackId="a"
                  fill={KIND_COLORS[kind] ?? "#6b7280"}
                  name={kind}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function ObservabilityCharts({ ledgerEvents, receipts }: ObservabilityChartsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <LedgerEventVolume ledgerEvents={ledgerEvents} />
      <ReceiptKindTimeline receipts={receipts} />
    </div>
  );
}
