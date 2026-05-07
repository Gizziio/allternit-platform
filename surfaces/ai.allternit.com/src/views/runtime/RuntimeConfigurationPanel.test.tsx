import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RuntimeConfigurationPanel } from "./RuntimeConfigurationPanel";

vi.mock("../components/StatusBadge", () => ({
  StatusBadge: ({ text }: { text?: string }) => (
    <div data-testid="status-badge">{text}</div>
  ),
}));

const settings = {
  driver: {
    driver_type: "process",
    isolation_level: "limited",
    enabled: true,
  },
  resources: {
    cpu_millicores: 1000,
    memory_mib: 2048,
    budget_credits_per_hour: 10,
  },
  replay: {
    capture_level: "minimal",
    deterministic_mode: true,
    snapshot_interval_seconds: 60,
  },
  prewarm: {
    enabled: true,
    pool_size: 2,
    warmup_commands: ["echo prewarm"],
  },
  versioning: {
    auto_commit: false,
    commit_message_template: "[allternit] {description}",
    branch_prefix: "allternit-session-",
  },
} as const;

const drivers = [
  {
    driver_type: "process",
    name: "Process Driver",
    description: "OS process execution",
    isolation: "limited",
    available: true,
    recommended: false,
    max_resources: {
      cpu_millicores: 8000,
      memory_mib: 32768,
      budget_credits_per_hour: null,
    },
    statusInfo: {
      driver_type: "process",
      status: "healthy",
      active_instances: 1,
      pool_size: 0,
      healthy: true,
      message: null,
    },
    isActive: true,
  },
  {
    driver_type: "microvm",
    name: "MicroVM Driver",
    description: "MicroVM execution",
    isolation: "maximum",
    available: false,
    recommended: true,
    max_resources: {
      cpu_millicores: 8000,
      memory_mib: 32768,
      budget_credits_per_hour: null,
    },
    statusInfo: {
      driver_type: "microvm",
      status: "unavailable",
      active_instances: 0,
      pool_size: 0,
      healthy: false,
      message: "Driver not registered",
    },
    isActive: false,
  },
] as const;

describe("RuntimeConfigurationPanel", () => {
  const onUpdateSettings = vi.fn();
  const onActivateDriver = vi.fn();
  const onResetSettings = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders live runtime settings controls", () => {
    render(
      <RuntimeConfigurationPanel
        settings={settings}
        drivers={drivers}
        onUpdateSettings={onUpdateSettings}
        onActivateDriver={onActivateDriver}
        onResetSettings={onResetSettings}
      />,
    );

    expect(screen.getByText("Active Driver Fabric")).toBeInTheDocument();
    expect(screen.getByLabelText("CPU budget")).toBeInTheDocument();
    expect(screen.getByLabelText("Commit message template")).toBeInTheDocument();
  });

  it("saves edited runtime settings", async () => {
    render(
      <RuntimeConfigurationPanel
        settings={settings}
        drivers={drivers}
        onUpdateSettings={onUpdateSettings}
        onActivateDriver={onActivateDriver}
        onResetSettings={onResetSettings}
      />,
    );

    fireEvent.change(screen.getByLabelText("Branch prefix"), {
      target: { value: "ops-" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save runtime settings" }));

    await waitFor(() => {
      expect(onUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          versioning: expect.objectContaining({
            branch_prefix: "ops-",
          }),
        }),
      );
    });
  });

  it("activates an available driver", async () => {
    const activatableDrivers = [
      drivers[0],
      { ...drivers[1], available: true },
    ];

    render(
      <RuntimeConfigurationPanel
        settings={settings}
        drivers={activatableDrivers}
        onUpdateSettings={onUpdateSettings}
        onActivateDriver={onActivateDriver}
        onResetSettings={onResetSettings}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Activate" })[1]!);

    await waitFor(() => {
      expect(onActivateDriver).toHaveBeenCalledWith("microvm");
    });
  });
});
