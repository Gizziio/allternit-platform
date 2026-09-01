import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  User03Icon,
  TeamWorkIcon,
  DeviceAccessIcon,
  CpuIcon,
  Calendar03Icon,
  Download04Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import {
  usePlatformOrganization,
  usePlatformUser,
  usePlatformAuth,
} from "@/lib/platform-auth-client";
import { PlatformUsageDashboard } from "@/components/PlatformUsageDashboard";
import { listRuntimeDevices, type RuntimeDevice } from "@/lib/devices";
import { getHostedEntitlement, type HostedRuntimeEntitlement } from "@/lib/hosted-compute";

function StatCard({
  icon,
  label,
  value,
  subtitle,
  to,
  accent = false,
}: {
  icon: typeof User03Icon;
  label: string;
  value: React.ReactNode;
  subtitle: string;
  to?: string;
  accent?: boolean;
}) {
  const content = (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-solid p-5 transition-all duration-200",
        accent
          ? "border-[var(--accent-highlight)]/30 bg-gradient-to-br from-[var(--accent-highlight-subtle)] to-[var(--bg-secondary)]"
          : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--accent-highlight)]/30 hover:bg-[var(--bg-secondary)]/80"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="relative z-10 min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {label}
          </div>
          <div className="mt-2 text-[26px] font-semibold tracking-tight text-[var(--text-primary)] truncate">
            {value}
          </div>
          <div className="mt-1 text-[12px] text-[var(--text-secondary)]">{subtitle}</div>
        </div>
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            accent
              ? "bg-[var(--accent-highlight)] text-[var(--ui-text-inverse)]"
              : "bg-[var(--accent-highlight-subtle)] text-[var(--accent-highlight)]"
          )}
        >
          <HugeiconsIcon icon={icon} size={22} />
        </div>
      </div>
    </div>
  );

  if (to) {
    return <Link to={to}>{content}</Link>;
  }
  return content;
}

function RecentActivity({ devices }: { devices: RuntimeDevice[] }) {
  const rows = devices.slice(0, 5).map((d) => ({
    id: d.id,
    event: `Device "${d.name}" paired`,
    resource: d.runtimeType,
    time: d.lastSeenAt
      ? new Date(d.lastSeenAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Never seen",
  }));

  return (
    <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Recent activity</h2>
          <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">
            Latest events across your cloud resources
          </p>
        </div>
        <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
          <HugeiconsIcon icon={Clock01Icon} size={18} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-primary)] py-10 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-tertiary)]">
            <HugeiconsIcon icon={Clock01Icon} size={20} />
          </div>
          <p className="mt-3 text-[13px] font-medium text-[var(--text-secondary)]">No recent activity</p>
          <p className="mt-1 max-w-xs text-[12px] text-[var(--text-tertiary)]">
            Activity will appear here once the cloud API is connected and devices or jobs start reporting.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">
                <th className="pb-3 font-semibold">Event</th>
                <th className="pb-3 font-semibold">Resource</th>
                <th className="pb-3 font-semibold text-right">Time</th>
              </tr>
            </thead>
            <tbody className="text-[var(--text-secondary)]">
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="py-3 text-[var(--text-primary)]">{row.event}</td>
                  <td className="py-3 capitalize">{row.resource}</td>
                  <td className="py-3 text-right">{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { user } = usePlatformUser();
  const { organization, membership } = usePlatformOrganization();
  const { getToken, isSignedIn } = usePlatformAuth();

  const [deviceCount, setDeviceCount] = useState<number | null>(null);
  const [devices, setDevices] = useState<RuntimeDevice[]>([]);
  const [hostedCount, setHostedCount] = useState<number | null>(null);
  const [entitlement, setEntitlement] = useState<HostedRuntimeEntitlement | null>(null);

  const loadCounts = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const [deviceList, token] = await Promise.all([
        listRuntimeDevices(),
        getToken(),
      ]);
      setDevices(deviceList);
      setDeviceCount(deviceList.length);
      if (token) {
        const entitlementData = await getHostedEntitlement(token);
        setEntitlement(entitlementData);
        setHostedCount(entitlementData.activeInstances);
      }
    } catch {
      // Non-fatal; cards will show placeholders.
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  const firstName =
    user?.firstName || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "there";

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]">
            Welcome back, {firstName}
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Here is what is happening across your Allternit cloud.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
            <HugeiconsIcon icon={Calendar03Icon} size={14} />
            {today}
          </div>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-[13px] font-medium text-[var(--ui-text-inverse)] opacity-60 cursor-not-allowed"
            title="Export will be available once usage data loads"
          >
            <HugeiconsIcon icon={Download04Icon} size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={User03Icon}
          label="Signed in as"
          value={
            user?.primaryEmailAddress?.emailAddress ||
            user?.userEmail ||
            user?.emailAddresses?.[0]?.emailAddress ||
            "—"
          }
          subtitle="Your Allternit account"
        />
        <StatCard
          icon={TeamWorkIcon}
          label="Organization"
          value={organization?.name || "Personal"}
          subtitle={membership?.role ? `Role: ${membership.role}` : "No organization selected"}
          to="/organizations"
        />
        <StatCard
          icon={DeviceAccessIcon}
          label="Paired devices"
          value={deviceCount !== null ? deviceCount.toLocaleString() : "—"}
          subtitle={deviceCount === 0 ? "No devices paired yet" : "Active runtimes"}
          to="/devices"
        />
        <StatCard
          icon={CpuIcon}
          label="Hosted runtimes"
          value={
            hostedCount !== null && entitlement
              ? `${hostedCount} / ${entitlement.maxHostedRuntimes}`
              : "—"
          }
          subtitle={entitlement?.planDisplayName || "Free plan"}
          to="/compute"
          accent
        />
      </div>

      {/* Usage + breakdown */}
      <PlatformUsageDashboard />

      {/* Recent activity */}
      <RecentActivity devices={devices} />
    </div>
  );
}
