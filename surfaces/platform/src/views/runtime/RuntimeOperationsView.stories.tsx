import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ActivityType, PoolHealth } from "@/hooks/usePrewarm";
import type { RuntimeExecutionMode } from "@/lib/agents/native-agent-api";
import { RuntimeConfigurationPanel } from "./RuntimeConfigurationPanel";
import { RuntimeOperationsPanel } from "./RuntimeOperationsView";

const meta: Meta<typeof RuntimeOperationsPanel> = {
  title: "Views/Runtime Operations",
  component: RuntimeOperationsPanel,
  parameters: {
    layout: "fullscreen",
    a2r: {
      componentId: "runtime-operations-view",
      evidence: {
        types: ["VISUAL_SNAPSHOT"],
        dagNode: "ui/views/runtime-operations",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

function SeededRuntimeOperationsPanel() {
  const [executionMode, setExecutionMode] =
    useState<RuntimeExecutionMode>("safe");
  const [quota, setQuota] = useState(12);
  const [poolSize, setPoolSize] = useState(4);
  const [warmupCount, setWarmupCount] = useState(0);

  return (
    <RuntimeOperationsPanel
      configurationPanel={
        <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
          <RuntimeConfigurationPanel
            settings={{
              driver: {
                driver_type: "process",
                isolation_level: "limited",
                enabled: true,
              },
              resources: {
                cpu_millicores: 1000,
                memory_mib: 2048,
                budget_credits_per_hour: quota,
              },
              replay: {
                capture_level: executionMode === "plan" ? "full" : "minimal",
                deterministic_mode: true,
                snapshot_interval_seconds: 60,
              },
              prewarm: {
                enabled: true,
                pool_size: poolSize,
                warmup_commands: ["echo prewarm"],
              },
              versioning: {
                auto_commit: executionMode === "auto",
                commit_message_template: "[a2r] {description}",
                branch_prefix: "allternit-session-",
              },
            }}
            drivers={[
              {
                driver_type: "process",
                name: "Process Driver",
                description: "OS process execution (development only)",
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
                description: "Firecracker/Kata MicroVM execution",
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
            ]}
            onRefresh={async () => {}}
            onResetSettings={async () => {}}
            onActivateDriver={async () => {}}
            onUpdateSettings={async () => {}}
            showManagementLinks
          />
        </div>
      }
      executionMode={{
        mode: executionMode,
        updatedAt: "2026-02-27T16:45:00.000Z",
        supportedModes: ["plan", "safe", "auto"],
      }}
      onSetExecutionMode={async (mode) => {
        setExecutionMode(mode);
      }}
      onRefreshExecutionMode={async () => {}}
      budget={{
        credits_remaining: quota,
        credits_consumed_this_hour: 2.8,
        projected_hourly_cost: 5.6,
        status: executionMode === "auto" ? "warning" : "healthy",
        cpu_percent: executionMode === "auto" ? 82 : 41,
        memory_percent: 37,
        network_percent: 24,
        worker_percent: executionMode === "auto" ? 79 : 54,
      }}
      budgetMetrics={[
        {
          key: "cpu",
          label: "CPU",
          percent: executionMode === "auto" ? 82 : 41,
          tone: executionMode === "auto" ? "warning" : "healthy",
          detail:
            executionMode === "auto" ? "82.0% utilized" : "41.0% utilized",
        },
        {
          key: "memory",
          label: "Memory",
          percent: 37,
          tone: "healthy",
          detail: "37.0% utilized",
        },
        {
          key: "network",
          label: "Network",
          percent: 24,
          tone: "healthy",
          detail: "24.0% utilized",
        },
        {
          key: "workers",
          label: "Workers",
          percent: executionMode === "auto" ? 79 : 54,
          tone: executionMode === "auto" ? "warning" : "healthy",
          detail:
            executionMode === "auto" ? "79.0% utilized" : "54.0% utilized",
        },
      ]}
      budgetAlerts={[
        executionMode === "auto"
          ? {
              level: "warning",
              title: "Runtime pressure climbing",
              message:
                "Auto mode is pushing the worker lane harder, so keep an eye on the shared pressure ceiling.",
            }
          : {
              level: "info",
              title: "Runtime budget healthy",
              message:
                "The shared default runtime tenant is operating inside its current budget envelope.",
            },
      ]}
      configuredCreditsPerHour={quota}
      maxPressurePercent={executionMode === "auto" ? 82 : 54}
      budgetTone={executionMode === "auto" ? "warning" : "success"}
      lastBudgetUpdatedAt="2026-02-27T16:46:00.000Z"
      lastQuotaUpdate={{
        status: "quota_updated",
        credits_per_hour: quota,
        tenant_id: "default",
      }}
      onRefreshBudget={async () => {}}
      onSetBudgetQuota={async (nextQuota) => {
        setQuota(nextQuota);
      }}
      replayManifests={[
        {
          run_id: "run_alpha_full_capture",
          capture_level: "full",
          output_count: 6,
          timestamp_count: 12,
        },
        {
          run_id: "run_beta_minimal_capture",
          capture_level: "minimal",
          output_count: 3,
          timestamp_count: 7,
        },
      ]}
      onRefreshReplay={async () => {}}
      onReplaySession={async () => {}}
      pools={[
        {
          name: "default",
          image: "runtime/default",
          pool_size: poolSize,
          available_count: Math.max(1, poolSize - 1),
          in_use_count: 1,
          warming_up_count: warmupCount,
          status: poolSize > 2 ? PoolHealth.Healthy : PoolHealth.Degraded,
          created_at: "",
          last_activity: "",
        },
      ]}
      activities={[
        {
          timestamp: "2026-02-27T16:47:00.000Z",
          pool_name: "default",
          activity_type: ActivityType.WarmupStarted,
          details:
            warmupCount > 0
              ? `Warmup triggered ${warmupCount} time(s) in the story surface`
              : "Warmup staged but not yet triggered in the story surface",
        },
      ]}
      stats={{
        total_pools: 1,
        total_instances: poolSize,
        total_available: Math.max(1, poolSize - 1),
        total_in_use: 1,
        total_warmups_performed: warmupCount,
        total_reuses: 0,
        avg_warmup_time_ms: 0,
      }}
      runtimeStatus={{
        enabled: true,
        pool_size: poolSize,
        available_instances: Math.max(1, poolSize - 1),
        in_use_instances: 1,
      }}
      onRefreshPrewarm={async () => {}}
      onSetPoolSize={async (nextPoolSize) => {
        setPoolSize(nextPoolSize);
      }}
      onWarmupPool={async () => {
        setWarmupCount((current) => current + 1);
      }}
      calculateHealth={() =>
        poolSize > 2 ? PoolHealth.Healthy : PoolHealth.Degraded
      }
      onRefreshAll={async () => {}}
    />
  );
}

export const CommandCenter: Story = {
  render: () => <SeededRuntimeOperationsPanel />,
};
