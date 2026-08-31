import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  SquaresFour,
  Buildings,
  ComputerTower,
  Desktop,
  CreditCard,
  Key,
  ArrowRight,
  ChartBar,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  usePlatformOrganization,
  usePlatformUser,
  usePlatformAuth,
} from "@/lib/platform-auth-client";
import { PlatformUsageDashboard } from "@/components/PlatformUsageDashboard";
import { listRuntimeDevices } from "@/lib/devices";
import { getHostedEntitlement, type HostedRuntimeEntitlement } from "@/lib/hosted-compute";

function DashboardCard({
  icon: Icon,
  title,
  value,
  subtitle,
  to,
}: {
  icon: React.ComponentType<any>;
  title: string;
  value: React.ReactNode;
  subtitle: string;
  to?: string;
}) {
  const content = (
    <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-4 hover:border-[var(--accent-primary)]/30 hover:bg-[var(--bg-secondary)] transition-colors">
      <div className="flex items-start gap-3">
        <div className="size-9 shrink-0 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center">
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">{title}</div>
          <div className="text-[14px] font-semibold text-[var(--text-primary)] mt-0.5 truncate">{value}</div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">{subtitle}</div>
        </div>
      </div>
    </div>
  );

  if (to) {
    return <Link to={to}>{content}</Link>;
  }
  return content;
}

export function DashboardPage() {
  const { user } = usePlatformUser();
  const { organization, membership } = usePlatformOrganization();
  const { getToken, isSignedIn } = usePlatformAuth();

  const [deviceCount, setDeviceCount] = useState<number | null>(null);
  const [hostedCount, setHostedCount] = useState<number | null>(null);
  const [entitlement, setEntitlement] = useState<HostedRuntimeEntitlement | null>(null);

  const loadCounts = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const [devices, token] = await Promise.all([
        listRuntimeDevices(),
        getToken(),
      ]);
      setDeviceCount(devices.length);
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

  const email =
    user?.primaryEmailAddress?.emailAddress ||
    user?.userEmail ||
    user?.emailAddresses?.[0]?.emailAddress ||
    "—";

  const quickLinks = [
    { to: "/organizations", icon: Buildings, label: "Manage organization" },
    { to: "/compute", icon: ComputerTower, label: "Configure compute" },
    { to: "/devices", icon: Desktop, label: "Review devices" },
    { to: "/billing", icon: CreditCard, label: "Billing overview" },
    { to: "/api-keys", icon: Key, label: "API keys" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
          Platform Console
        </h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">
          Manage your organization, compute, billing, and API access.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <DashboardCard
          icon={SquaresFour}
          title="Signed in as"
          value={email}
          subtitle="Your Allternit account"
        />
        <DashboardCard
          icon={Buildings}
          title="Current organization"
          value={organization?.name || "Personal"}
          subtitle={membership?.role ? `Role: ${membership.role}` : "No organization selected"}
          to="/organizations"
        />
        <DashboardCard
          icon={Desktop}
          title="Paired devices"
          value={deviceCount !== null ? deviceCount.toLocaleString() : "—"}
          subtitle={deviceCount === 0 ? "No devices paired yet" : "Active runtimes"}
          to="/devices"
        />
        <DashboardCard
          icon={ComputerTower}
          title="Hosted runtimes"
          value={
            hostedCount !== null && entitlement
              ? `${hostedCount} / ${entitlement.maxHostedRuntimes}`
              : "—"
          }
          subtitle={entitlement?.planDisplayName || "Free plan"}
          to="/compute"
        />
      </div>

      <PlatformUsageDashboard />

      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-5">
        <h2 className="text-[14px] font-semibold text-[var(--text-primary)] mb-3">
          Quick links
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {quickLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center justify-between gap-2 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <link.icon size={16} /> {link.label}
              </span>
              <ArrowRight size={14} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
