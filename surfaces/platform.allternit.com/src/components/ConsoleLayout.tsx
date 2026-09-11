import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
  ChevronDownIcon,
  RocketIcon,
  Calendar02Icon,
  ShieldCheckIcon,
  CloudIcon,
  PanelLeftIcon,
  BookOpen02Icon,
} from "@hugeicons/core-free-icons";
import { UserButton } from "@clerk/clerk-react";
import { cn } from "@/lib/utils";
import {
  PlatformOrganizationSwitcher,
  usePlatformOrganization,
  usePlatformUser,
  usePlatformAuth,
  useClerk,
} from "@/lib/platform-auth-client";
import { getCreditsBalance, formatCreditsUsd } from "@/lib/credits";
import { AllternitWordmark } from "@/components/AllternitWordmark";

type IconData = typeof LayoutDashboardIcon;

interface NavItem {
  to: string;
  label: string;
}

interface NavGroup {
  label: string;
  icon: IconData;
  defaultOpen?: boolean;
  items: NavItem[];
}

const dashboardItem: NavItem = { to: "/", label: "Dashboard" };

const navGroups: NavGroup[] = [
  {
    label: "Cloud",
    icon: CloudIcon,
    defaultOpen: true,
    items: [
      { to: "/organizations", label: "Organizations" },
      { to: "/compute", label: "Compute" },
      { to: "/agents", label: "Agents" },
      { to: "/devices", label: "Devices" },
      { to: "/fabric", label: "Fabric" },
      { to: "/runs", label: "Runs" },
      { to: "/schedules", label: "Schedules" },
      { to: "/approvals", label: "Approvals" },
      { to: "/billing", label: "Billing" },
      { to: "/cloud-accounts", label: "Cloud accounts" },
      { to: "/api-keys", label: "API keys" },
    ],
  },
  {
    label: "Resources",
    icon: BookOpen01Icon,
    items: [{ to: "/docs", label: "Docs" }],
  },
  {
    label: "Settings",
    icon: Setting07Icon,
    items: [{ to: "/settings", label: "Settings" }],
  },
];

const flatNavItems = [dashboardItem, ...navGroups.flatMap((g) => g.items)];

function groupContainsPath(group: NavGroup, pathname: string): boolean {
  return group.items.some(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
}

function currentPageLabel(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  const match = flatNavItems.find(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`)
  );
  return match?.label || "Console";
}

function RailUserCard({ collapsed }: { collapsed: boolean }) {
  const clerk = useClerk();
  const { user } = usePlatformUser();
  const { organization, membership } = usePlatformOrganization();

  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    user?.userEmail ||
    "Account";
  const role = membership?.role
    ? membership.role.replace(/^org:/, "")
    : organization
      ? "Member"
      : "Personal";
  const orgName = organization?.name || "Allternit";
  const initials = name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (collapsed) {
    return clerk ? (
      <div className="flex justify-center px-2 py-2">
        <UserButton
          afterSignOutUrl="/sign-in"
          appearance={{ elements: { userButtonAvatarBox: "size-8 rounded-lg" } }}
        />
      </div>
    ) : (
      <div className="flex justify-center px-2 py-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--accent-primary)]/10 text-[10px] font-semibold text-[var(--accent-primary)]">
          {initials.charAt(0)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-[var(--surface-hover)]">
      <div className="shrink-0">
        {clerk ? (
          <UserButton
            afterSignOutUrl="/sign-in"
            appearance={{ elements: { userButtonAvatarBox: "size-8 rounded-lg" } }}
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--accent-primary)]/10 text-[10px] font-semibold text-[var(--accent-primary)]">
            {initials.charAt(0)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">{name}</div>
        <div className="truncate text-[11px] capitalize text-[var(--text-tertiary)]">
          {role} · {orgName}
        </div>
      </div>
      <HugeiconsIcon
        icon={ChevronDownIcon}
        size={14}
        className="shrink-0 text-[var(--text-tertiary)]"
      />
    </div>
  );
}

function SidebarContent({
  onNavigate,
  collapsed,
  onExpand,
}: {
  onNavigate?: () => void;
  collapsed: boolean;
  onExpand?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = usePlatformAuth();
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [creditsBalance, setCreditsBalance] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.isSignedIn) return;
    const controller = new AbortController();
    let active = true;
    (async () => {
      try {
        const token = await auth.getToken();
        if (!token || !active) return;
        const balance = await getCreditsBalance(token, controller.signal);
        if (active) setCreditsBalance(formatCreditsUsd(balance.balance_usd));
      } catch {
        // Balance stays hidden; the row still links to billing.
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [auth.isSignedIn, auth.getToken]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = (label: string) => !q || label.toLowerCase().includes(q);

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({ ...group, items: group.items.filter((item) => matches(item.label)) }))
        .filter((group) => group.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q]
  );

  const dashboardVisible = matches(dashboardItem.label);

  const isGroupOpen = (group: NavGroup) => {
    if (q) return true;
    if (groupContainsPath(group, location.pathname)) return true;
    return openGroups[group.label] ?? group.defaultOpen ?? false;
  };

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [label]: !(prev[label] ?? navGroups.find((g) => g.label === label)?.defaultOpen ?? false),
    }));
  };

  const firstFiltered = q
    ? (dashboardVisible ? dashboardItem : null) ??
      visibleGroups[0]?.items[0] ??
      null
    : null;

  if (collapsed) {
    return (
      <>
        <div className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-2 py-3">
          {dashboardVisible && (
            <NavLink
              to={dashboardItem.to}
              title={dashboardItem.label}
              className={({ isActive }) =>
                cn(
                  "flex size-10 items-center justify-center rounded-lg transition-colors",
                  isActive
                    ? "bg-[var(--surface-hover)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                )
              }
            >
              <HugeiconsIcon icon={LayoutDashboardIcon} size={19} />
            </NavLink>
          )}
          {visibleGroups.map((group) => (
            <button
              key={group.label}
              type="button"
              title={group.label}
              onClick={onExpand}
              className="flex size-10 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            >
              <HugeiconsIcon icon={group.icon} size={19} />
            </button>
          ))}
        </div>
        <div className="border-t border-[var(--border-subtle)] py-2">
          <RailUserCard collapsed />
        </div>
      </>
    );
  }

  return (
    <>
      {/* Search */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-secondary)] focus-within:border-[var(--border-default)] transition-colors">
          <HugeiconsIcon icon={Search01Icon} size={15} />
          <input
            ref={searchRef}
            id="console-rail-search"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuery("");
                searchRef.current?.blur();
              }
              if (event.key === "Enter" && firstFiltered) {
                navigate(firstFiltered.to);
                setQuery("");
                onNavigate?.();
              }
            }}
            placeholder="Search Console..."
            className="flex-1 bg-transparent text-[13px] placeholder:text-[var(--text-tertiary)] outline-none text-[var(--text-primary)]"
          />
          <kbd className="inline-flex items-center rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)]">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {dashboardVisible && (
          <NavLink
            to={dashboardItem.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-[var(--surface-hover)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              )
            }
          >
            <HugeiconsIcon icon={LayoutDashboardIcon} size={17} />
            {dashboardItem.label}
          </NavLink>
        )}

        {visibleGroups.map((group) => {
          const open = isGroupOpen(group);
          return (
            <div key={group.label} className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                  groupContainsPath(group, location.pathname) && !q
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                )}
              >
                <HugeiconsIcon icon={group.icon} size={17} />
                <span className="flex-1 text-left">{group.label}</span>
                <HugeiconsIcon
                  icon={ChevronDownIcon}
                  size={14}
                  className={cn(
                    "text-[var(--text-tertiary)] transition-transform",
                    open && "rotate-180"
                  )}
                />
              </button>
              {open && (
                <div className="ml-[26px] border-l border-solid border-[var(--border-subtle)] pb-1 pt-1">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "block rounded-md py-1.5 pl-4 pr-3 text-[13px] transition-colors",
                          isActive
                            ? "bg-[var(--surface-hover)] font-medium text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {q && !dashboardVisible && visibleGroups.length === 0 && (
          <p className="px-3 py-4 text-[12px] text-[var(--text-tertiary)]">
            No matches for “{query}”.
          </p>
        )}
      </nav>

      {/* Bottom block */}
      <div className="border-t border-[var(--border-subtle)] p-2.5">
        <NavLink
          to="/docs"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
              isActive
                ? "bg-[var(--surface-hover)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            )
          }
        >
          <HugeiconsIcon icon={BookOpen02Icon} size={17} />
          Documentation
        </NavLink>
        <NavLink
          to="/billing"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
              isActive
                ? "bg-[var(--surface-hover)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            )
          }
        >
          <span className="flex items-center gap-3">
            <HugeiconsIcon icon={Wallet01Icon} size={17} />
            Credits
          </span>
          <span className="text-[12px] text-[var(--text-tertiary)]">
            {creditsBalance ?? "—"}
          </span>
        </NavLink>
        <RailUserCard collapsed={false} />
        <div className="mt-1 flex items-center gap-1 px-2.5">
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
            <HugeiconsIcon icon={CircleIcon} size={8} className="text-[var(--status-success)]" />{" "}
            Status
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

export function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem("console-rail-collapsed") === "1"
  );
  const { organization } = usePlatformOrganization();
  const location = useLocation();
  const pageLabel = location.pathname === "/" ? "Overview" : currentPageLabel(location.pathname);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      window.localStorage.setItem("console-rail-collapsed", prev ? "0" : "1");
      return !prev;
    });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] transition-[width] duration-200",
          collapsed ? "w-[68px]" : "w-64"
        )}
      >
        <div
          className={cn(
            "flex items-center border-b border-[var(--border-subtle)]",
            collapsed ? "justify-center px-2 py-3.5" : "justify-between px-4 py-3.5"
          )}
        >
          {!collapsed && <AllternitWordmark variant="light" height={22} />}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            <HugeiconsIcon icon={PanelLeftIcon} size={17} />
          </button>
        </div>

        {!collapsed && (
          <div className="px-3 pt-3">
            {organization ? (
              <PlatformOrganizationSwitcher />
            ) : (
              <div className="flex items-center gap-2.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] text-[var(--text-secondary)]">
                <HugeiconsIcon icon={TeamWorkIcon} size={15} />
                Personal workspace
              </div>
            )}
          </div>
        )}

        <SidebarContent collapsed={collapsed} onExpand={() => setCollapsed(false)} />
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
            <SidebarContent
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
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

          <div className="flex items-center gap-3 shrink-0">
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

            <div className="lg:hidden shrink-0">
              <RailUserCard collapsed />
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
