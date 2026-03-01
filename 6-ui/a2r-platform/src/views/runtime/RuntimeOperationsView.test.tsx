import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RuntimeOperationsView } from "./RuntimeOperationsView";
import { useBudget } from "@/hooks/useBudget";
import { useReplay } from "@/hooks/useReplay";
import { PoolHealth, usePrewarm } from "@/hooks/usePrewarm";
import { useRuntimeExecutionMode } from "@/hooks/useRuntimeExecutionMode";

vi.mock("@/hooks/useBudget", () => ({
  useBudget: vi.fn(),
}));

vi.mock("@/hooks/useReplay", () => ({
  useReplay: vi.fn(),
}));

vi.mock("@/hooks/usePrewarm", () => ({
  usePrewarm: vi.fn(),
  PoolHealth: {
    Healthy: "healthy",
    Degraded: "degraded",
    Empty: "empty",
  },
}));

vi.mock("@/hooks/useRuntimeExecutionMode", () => ({
  useRuntimeExecutionMode: vi.fn(),
}));

vi.mock("@/design/GlassSurface", () => ({
  GlassSurface: ({
    children,
    className,
  }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="glass-surface" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("../components/StatCard", () => ({
  StatCard: ({
    label,
    value,
    unit,
  }: {
    label: string;
    value: string | number;
    unit?: string;
  }) => (
    <div data-testid="stat-card">
      <span>{label}</span>
      <span>{value}</span>
      {unit ? <span>{unit}</span> : null}
    </div>
  ),
}));

vi.mock("../components/ProgressBar", () => ({
  ProgressBar: ({
    label,
    value,
    used,
    limit,
  }: {
    label?: string;
    value: number;
    used?: string;
    limit?: string;
  }) => (
    <div data-testid="progress-bar">
      <span>{label}</span>
      <span>{value}</span>
      <span>{used}</span>
      <span>{limit}</span>
    </div>
  ),
}));

vi.mock("../components/StatusBadge", () => ({
  StatusBadge: ({ text }: { text?: string }) => (
    <div data-testid="status-badge">{text}</div>
  ),
}));

vi.mock("./RuntimeConfigurationPanel", () => ({
  ConnectedRuntimeConfigurationPanel: () => (
    <div data-testid="runtime-configuration-panel">Runtime configuration panel</div>
  ),
}));

describe("RuntimeOperationsView", () => {
  const mockSetMode = vi.fn();
  const mockSetQuota = vi.fn();
  const mockReplayExecution = vi.fn();
  const mockSetPoolSize = vi.fn();
  const mockWarmupPool = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    (useRuntimeExecutionMode as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      {
        executionMode: {
          mode: "safe",
          updatedAt: "2026-02-27T16:40:00.000Z",
          supportedModes: ["plan", "safe", "auto"],
        },
        isLoading: false,
        isSaving: false,
        error: null,
        refetch: vi.fn(),
        setMode: mockSetMode,
      },
    );

    (useBudget as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      budget: {
        credits_remaining: 12,
        credits_consumed_this_hour: 2,
        projected_hourly_cost: 5,
        status: "healthy",
        cpu_percent: 40,
        memory_percent: 35,
        network_percent: 20,
        worker_percent: 55,
      },
      metrics: [
        { key: "cpu", label: "CPU", percent: 40, tone: "healthy", detail: "40%" },
        { key: "memory", label: "Memory", percent: 35, tone: "healthy", detail: "35%" },
      ],
      alerts: [
        {
          level: "info",
          title: "Runtime budget healthy",
          message:
            "The shared default runtime tenant is operating inside its current budget envelope.",
        },
      ],
      configuredCreditsPerHour: 12,
      maxPressurePercent: 55,
      statusTone: "success",
      lastUpdatedAt: "2026-02-27T16:42:00.000Z",
      lastQuotaUpdate: null,
      isLoading: false,
      isSaving: false,
      error: null,
      refetch: vi.fn(),
      setQuota: mockSetQuota,
    });

    (useReplay as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      manifests: [
        {
          run_id: "run_alpha_full_capture",
          capture_level: "full",
          output_count: 6,
          timestamp_count: 12,
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      replayExecution: mockReplayExecution,
    });

    (usePrewarm as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      pools: [
        {
          name: "default",
          image: "runtime/default",
          pool_size: 4,
          available_count: 3,
          in_use_count: 1,
          warming_up_count: 0,
          status: PoolHealth.Healthy,
          created_at: "",
          last_activity: "",
        },
      ],
      activities: [
        {
          timestamp: "2026-02-27T16:41:00.000Z",
          pool_name: "default",
          activity_type: "warmup_started",
          details: "Warmup triggered from the GUI",
        },
      ],
      stats: {
        total_pools: 1,
        total_instances: 4,
        total_available: 3,
        total_in_use: 1,
        total_warmups_performed: 0,
        total_reuses: 0,
        avg_warmup_time_ms: 0,
      },
      runtimeStatus: {
        enabled: true,
        pool_size: 4,
        available_instances: 3,
        in_use_instances: 1,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      setPoolSize: mockSetPoolSize,
      warmupPool: mockWarmupPool,
      calculateHealth: () => PoolHealth.Healthy,
    });
  });

  it("renders the unified runtime command surface", () => {
    render(<RuntimeOperationsView />);

    expect(screen.getByText("Runtime Operations")).toBeInTheDocument();
    expect(screen.getByText("Shared Agent Mode")).toBeInTheDocument();
    expect(screen.getByText("Budget Pressure")).toBeInTheDocument();
    expect(screen.getByText("Prewarm Capacity")).toBeInTheDocument();
    expect(screen.getByText("Replay Readiness")).toBeInTheDocument();
    expect(screen.getByTestId("runtime-configuration-panel")).toBeInTheDocument();
  });

  it("switches the shared execution mode", async () => {
    render(<RuntimeOperationsView />);

    fireEvent.click(screen.getByRole("button", { name: /plan/i }));

    await waitFor(() => {
      expect(mockSetMode).toHaveBeenCalledWith("plan");
    });
  });

  it("updates the shared budget quota", async () => {
    render(<RuntimeOperationsView />);

    fireEvent.change(screen.getByLabelText("Shared credits per hour"), {
      target: { value: "20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply quota" }));

    await waitFor(() => {
      expect(mockSetQuota).toHaveBeenCalledWith(20);
    });
  });

  it("applies a pool size update and replays a session", async () => {
    render(<RuntimeOperationsView />);

    fireEvent.change(screen.getByLabelText("Shared pool size"), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply pool size" }));
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));

    await waitFor(() => {
      expect(mockSetPoolSize).toHaveBeenCalledWith(6);
      expect(mockReplayExecution).toHaveBeenCalledWith(
        "run_alpha_full_capture",
      );
    });
  });
});
