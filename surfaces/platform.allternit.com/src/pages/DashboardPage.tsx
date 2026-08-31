import React from "react";
import { Link } from "react-router-dom";
import {
  SquaresFour,
  Buildings,
  ComputerTower,
  CreditCard,
  Key,
  ArrowRight,
  ChartBar,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  usePlatformOrganization,
  usePlatformUser,
} from "@/lib/platform-auth-client";

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

  const email =
    user?.primaryEmailAddress?.emailAddress ||
    user?.userEmail ||
    user?.emailAddresses?.[0]?.emailAddress ||
    "—";

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
          icon={ChartBar}
          title="Usage summary"
          value="Usage details →"
          subtitle="Track tokens, sessions, and cost"
          to="/compute"
        />
      </div>

      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-5">
        <h2 className="text-[14px] font-semibold text-[var(--text-primary)] mb-3">
          Quick links
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { to: "/organizations", icon: Buildings, label: "Manage organization" },
            { to: "/compute", icon: ComputerTower, label: "Configure compute" },
            { to: "/billing", icon: CreditCard, label: "Billing overview" },
            { to: "/api-keys", icon: Key, label: "API keys" },
          ].map((link) => (
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
