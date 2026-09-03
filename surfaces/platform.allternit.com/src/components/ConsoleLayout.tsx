import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  LayoutDashboardIcon,
  TeamWorkIcon,
  CpuIcon,
  DeviceAccessIcon,
  Wallet01Icon,
  Key01Icon,
  BookOpen01Icon,
  Setting07Icon,
  Search01Icon,
  Notification01Icon,
  Rocket01Icon,
  ListIcon,
  Cancel01Icon,
  LifebuoyIcon,
  CircleIcon,
  ScrollIcon,
  ChevronRightIcon,
  RocketIcon,
  Calendar02Icon,
  ShieldCheckIcon,
  CloudIcon,
} from "@hugeicons/core-free-icons";
import { UserButton } from "@clerk/clerk-react";
import { cn } from "@/lib/utils";
import {
  PlatformOrganizationSwitcher,
  usePlatformOrganization,
  usePlatformUser,
  useClerk,
} from "@/lib/platform-auth-client";
import { AllternitWordmark } from "@/components/AllternitWordmark";

type IconData = typeof LayoutDashboardIcon;

interface NavItem {
  to: string;
  label: string;
  icon: IconData;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Console",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboardIcon }],
  },
  {
    label: "Cloud",
    items: [
      { to: "/organizations", label: "Organizations", icon: TeamWorkIcon },
      { to: "/compute", label: "Compute", icon: CpuIcon },
      { to: "/devices", label: "Devices", icon: DeviceAccessIcon },
      { to: "/runs", label: "Runs", icon: RocketIcon },
      { to: "/schedules", label: "Schedules", icon: Calendar02Icon },
      { to: "/approvals", label: "Approvals", icon: ShieldCheckIcon },
      { to: "/billing", label: "Billing", icon: Wallet01Icon },
      { to: "/cloud-accounts", label: "Cloud accounts", icon: CloudIcon },
      { to: "/api-keys", label: "API Keys", icon: Key01Icon },
    ],
  },
  {
    label: "Resources",
    items: [{ to: "/docs", label: "Docs", icon: BookOpen01Icon }],
  },
  {
    label: "Settings",
    items: [{ to: "/settings", label: "Settings", icon: Setting07Icon }],
  },
];

const flatNavItems = navGroups.flatMap((g) => g.items);

function currentPageLabel(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  const match = flatNavItems.find(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`)
  );
  return match?.label || "Console";
}

function ConsoleUserButton() {
  const clerk = useClerk();
  const { user } = usePlatformUser();

  if (clerk) {
    return (
      <UserButton
        afterSignOutUrl="/sign-in"
        appearance={{
          elements: {
            userButtonAvatarBox: "size-9 rounded-full",
          },
        }}
      />
    );
  }

  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    user?.userEmail ||
    "?";
  return (
    <div className="size-9 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center text-[13px] font-semibold">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { organization } = usePlatformOrganization();
  const location = useLocation();
  const pageLabel = location.pathname === "/" ? "Overview" : currentPageLabel(location.pathname);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] lg:hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
              <AllternitWordmark variant="light" height={24} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                aria-label="Close navigation"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={20} />
              </button>
            </div>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-[var(--border-subtle)] px-4 lg:px-6 bg-[var(--bg-primary)]/80 backdrop-blur-sm gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              aria-label="Open navigation"
            >
              <HugeiconsIcon icon={ListIcon} size={20} />
            </button>

            <nav className="hidden sm:flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
              <span className="text-[var(--text-tertiary)]">Dashboard</span>
              <HugeiconsIcon icon={ChevronRightIcon} size={14} className="text-[var(--text-tertiary)]" />
              <span className="text-[var(--text-primary)] font-medium">{pageLabel}</span>
            </nav>
          </div>

          {/* Search */}
          <div className="hidden md:flex flex-1 max-w-md items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-secondary)] focus-within:border-[var(--accent-primary)]/40 focus-within:ring-1 focus-within:ring-[var(--accent-primary)]/20 transition-all">
            <HugeiconsIcon icon={Search01Icon} size={16} />
            <input
              type="text"
              placeholder="Search console..."
              className="flex-1 bg-transparent text-[13px] placeholder:text-[var(--text-tertiary)] outline-none text-[var(--text-primary)]"
              readOnly
            />
            <kbd className="hidden lg:inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)]">
              ⌘K
            </kbd>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 min-w-0 max-w-[220px]">
              {organization ? <PlatformOrganizationSwitcher /> : null}
            </div>

            <button
              type="button"
              className="relative p-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Notifications"
            >
              <HugeiconsIcon icon={Notification01Icon} size={20} />
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[var(--status-error)] ring-2 ring-[var(--bg-primary)]" />
            </button>

            <a
              href="https://ai.allternit.com/shell"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-solid border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 text-[13px] font-medium text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 transition-colors"
            >
              <HugeiconsIcon icon={Rocket01Icon} size={14} /> Launch App
            </a>

            <div className="shrink-0">
              <ConsoleUserButton />
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-4 border-b border-[var(--border-subtle)]">
        <AllternitWordmark variant="light" height={26} />
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              {group.label}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors",
                      isActive
                        ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                    )
                  }
                >
                  <HugeiconsIcon icon={item.icon} size={18} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-[var(--border-subtle)] space-y-1">
        <a
          href="https://ai.allternit.com/shell"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors"
        >
          <HugeiconsIcon icon={Rocket01Icon} size={18} /> Launch App
        </a>
        <div className="flex items-center gap-1 px-3 pt-1">
          <a
            href="mailto:support@allternit.com"
            className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <HugeiconsIcon icon={LifebuoyIcon} size={12} /> Support
          </a>
          <span className="text-[var(--border-default)]">·</span>
          <a
            href="https://status.allternit.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <HugeiconsIcon icon={CircleIcon} size={8} className="text-[var(--status-success)]" /> Status
          </a>
          <span className="text-[var(--border-default)]">·</span>
          <a
            href="https://allternit.com/changelog"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <HugeiconsIcon icon={ScrollIcon} size={12} /> Changelog
          </a>
        </div>
      </div>
    </>
  );
}
