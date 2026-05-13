"use client";

import { memo, useMemo, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  IconChartBar,
  IconChartLine,
  IconChartPie,
  IconDownload,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type ChartType = "bar" | "line" | "pie" | "area";

export type ChartDataset = {
  label: string;
  data: number[];
  color?: string;
};

export type ChartData = {
  labels: string[];
  datasets: ChartDataset[];
};

export type ChartArtifactProps = {
  data: ChartData;
  type?: ChartType;
  title?: string;
  className?: string;
};

const DEFAULT_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function normalizeToRecharts(data: ChartData, type: ChartType) {
  if (type === "pie") {
    return data.labels.map((name, i) => ({
      name,
      value: data.datasets[0]?.data[i] ?? 0,
    }));
  }
  return data.labels.map((label, i) => {
    const row: Record<string, string | number> = { name: label };
    data.datasets.forEach((ds) => {
      row[ds.label] = ds.data[i] ?? 0;
    });
    return row;
  });
}

export const ChartArtifact = memo(function ChartArtifact({
  data,
  type = "bar",
  title,
  className,
}: ChartArtifactProps) {
  const [activeType, setActiveType] = useState<ChartType>(type);

  const chartData = useMemo(
    () => normalizeToRecharts(data, activeType),
    [data, activeType]
  );

  const colors = useMemo(
    () =>
      data.datasets.map(
        (ds, i) => ds.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]
      ),
    [data.datasets]
  );

  const handleDownload = useCallback(() => {
    const svg = document.querySelector(
      `[data-chart-id="${title ?? "chart"}"] svg`
    );
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title ?? "chart"}-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [title]);

  const renderChart = () => {
    switch (activeType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              {data.datasets.map((ds, i) => (
                <Bar key={ds.label} dataKey={ds.label} fill={colors[i]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      case "line":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              {data.datasets.map((ds, i) => (
                <Line
                  key={ds.label}
                  type="monotone"
                  dataKey={ds.label}
                  stroke={colors[i]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: colors[i] }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      case "area":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              {data.datasets.map((ds, i) => (
                <Area
                  key={ds.label}
                  type="monotone"
                  dataKey={ds.label}
                  stroke={colors[i]}
                  fill={colors[i]}
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );
      case "pie":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="80%"
                label={{ fontSize: 12 }}
              >
                {(chartData as Array<{ name: string; value: number }>).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );
    }
  };

  const typeButtons: { type: ChartType; icon: React.ReactNode; label: string }[] = [
    { type: "bar", icon: <IconChartBar className="size-3.5 " />, label: "Bar" },
    { type: "line", icon: <IconChartLine className="size-3.5 " />, label: "Line" },
    { type: "area", icon: <IconChartLine className="size-3.5 " />, label: "Area" },
    { type: "pie", icon: <IconChartPie className="size-3.5 " />, label: "Pie" },
  ];

  return (
    <div
      className={cn(
        "rounded-an-tool-border-radius border border-border bg-an-tool-background overflow-hidden flex flex-col",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-an-tool-border-color bg-background/50">
        <div className="flex items-center gap-3">
          {title && (
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </span>
          )}
          <div className="flex items-center gap-1">
            {typeButtons.map((btn) => (
              <button
                key={btn.type}
                onClick={() => setActiveType(btn.type)}
                className={cn(
                  "p-1 rounded-md transition-colors",
                  activeType === btn.type
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
                title={btn.label}
              >
                {btn.icon}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleDownload}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          title="Download SVG"
        >
          <IconDownload className="size-3.5  text-muted-foreground" />
        </button>
      </div>

      {/* Chart */}
      <div
        data-chart-id={title ?? "chart"}
        className="w-full h-[300px] p-2 bg-background"
      >
        {renderChart()}
      </div>
    </div>
  );
});
