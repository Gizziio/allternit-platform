import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { RuntimeConfigurationPanel } from "./RuntimeConfigurationPanel";

const meta: Meta<typeof RuntimeConfigurationPanel> = {
  title: "Views/Runtime Configuration Panel",
  component: RuntimeConfigurationPanel,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

function SeededRuntimeConfigurationPanel() {
  const [settings, setSettings] = useState({
    driver: {
      driver_type: "process" as const,
      isolation_level: "limited" as const,
      enabled: true,
    },
    resources: {
      cpu_millicores: 1000,
      memory_mib: 2048,
      budget_credits_per_hour: 10,
    },
    replay: {
      capture_level: "minimal" as const,
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
  });

  const drivers = [
    {
      driver_type: "process" as const,
      name: "Process Driver",
      description: "OS process execution (development only)",
      isolation: "limited" as const,
      available: true,
      recommended: false,
      max_resources: {
        cpu_millicores: 8000,
        memory_mib: 32768,
        budget_credits_per_hour: null,
      },
      statusInfo: {
        driver_type: "process" as const,
        status: "healthy",
        active_instances: 1,
        pool_size: 0,
        healthy: true,
        message: null,
      },
      isActive: settings.driver.driver_type === "process",
    },
    {
      driver_type: "microvm" as const,
      name: "MicroVM Driver",
      description: "Firecracker/Kata MicroVM execution",
      isolation: "maximum" as const,
      available: false,
      recommended: true,
      max_resources: {
        cpu_millicores: 8000,
        memory_mib: 32768,
        budget_credits_per_hour: null,
      },
      statusInfo: {
        driver_type: "microvm" as const,
        status: "unavailable",
        active_instances: 0,
        pool_size: 0,
        healthy: false,
        message: "Driver not registered",
      },
      isActive: false,
    },
    {
      driver_type: "container" as const,
      name: "Container Driver",
      description: "gVisor/container execution",
      isolation: "standard" as const,
      available: false,
      recommended: false,
      max_resources: {
        cpu_millicores: 8000,
        memory_mib: 32768,
        budget_credits_per_hour: null,
      },
      statusInfo: {
        driver_type: "container" as const,
        status: "unavailable",
        active_instances: 0,
        pool_size: 0,
        healthy: false,
        message: "Driver not registered",
      },
      isActive: false,
    },
    {
      driver_type: "wasm" as const,
      name: "WASM Driver",
      description: "WebAssembly sandboxed execution",
      isolation: "limited" as const,
      available: false,
      recommended: false,
      max_resources: {
        cpu_millicores: 8000,
        memory_mib: 32768,
        budget_credits_per_hour: null,
      },
      statusInfo: {
        driver_type: "wasm" as const,
        status: "unavailable",
        active_instances: 0,
        pool_size: 0,
        healthy: false,
        message: "Driver not registered",
      },
      isActive: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_32%),linear-gradient(180deg,rgba(8,12,18,0.94),rgba(8,12,18,1))] p-6">
      <div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-black/20 p-6">
        <RuntimeConfigurationPanel
          settings={settings}
          drivers={drivers}
          onRefresh={async () => {}}
          onResetSettings={async () => {}}
          onActivateDriver={async () => {}}
          onUpdateSettings={async () => {}}
          showManagementLinks
        />
      </div>
    </div>
  );
}

export const Default: Story = {
  render: () => <SeededRuntimeConfigurationPanel />,
};
