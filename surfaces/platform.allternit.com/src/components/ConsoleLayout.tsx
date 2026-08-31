import React, { useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import {
  SquaresFour,
  Buildings,
  ComputerTower,
  Desktop,
  CreditCard,
  Key,
  BookOpen,
  Gear,
  RocketLaunch,
  List,
  X,
  Lifebuoy,
  Circle,
  Scroll,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  PlatformOrganizationSwitcher,
  usePlatformOrganization,
  usePlatformUser,
} from "@/lib/platform-auth-client";
import { AllternitWordmark } from "@/components/AllternitWordmark";

type PhosphorIcon = React.ComponentType<any>;

interface NavItem {
  to: string;
  label: string;
  icon: PhosphorIcon;
}

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: SquaresFour },
  { to: "/organizations", label: "Organizations", icon: Buildings },
  { to: "/compute", label: "Compute", icon: ComputerTower },
  { to: "/devices", label: "Devices", icon: Desktop },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/api-keys", label: "API Keys", icon: Key },
  { to: "/docs", label: "Docs", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Gear },
];

function currentPageLabel(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  const match = navItems.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
  return match?.label || "Console";
}

export function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = usePlatformUser();
  const { organization } = usePlatformOrganization();
  const location = useLocation();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
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
                <X size={20} />
              </button>
            </div>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] px-4 lg:px-6 bg-[var(--bg-primary)]/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              aria-label="Open navigation"
            >
              <List size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
              <span className="text-[var(--text-tertiary)]">/</span>
              <span className="capitalize">{currentPageLabel(location.pathname)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex items-center gap-2 min-w-0 max-w-[220px]">
              {organization ? (
                <PlatformOrganizationSwitcher />
              ) : (
                <span className="text-[12px] text-[var(--text-tertiary)] truncate">
                  {user?.primaryEmailAddress?.emailAddress || user?.userEmail || "Personal"}
                </span>
              )}
            </div>

            <a
              href="https://ai.allternit.com/shell"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-solid border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 text-[13px] font-medium text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 transition-colors"
            >
              <RocketLaunch size={14} /> Launch App
            </a>

            <div className="shrink-0">
              <UserButton
                afterSignOutUrl="/sign-in"
                appearance={{
                  elements: {
                    userButtonAvatarBox: "size-8 rounded-full",
                  },
                }}
              />
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-subtle)]">
        <AllternitWordmark variant="light" height={26} />
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              )
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-[var(--border-subtle)] space-y-1">
        <a
          href="https://ai.allternit.com/shell"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors"
        >
          <RocketLaunch size={18} /> Launch App
        </a>
        <div className="flex items-center gap-1 px-3 pt-1">
          <a
            href="mailto:support@allternit.com"
            className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <Lifebuoy size={12} /> Support
          </a>
          <span className="text-[var(--border-default)]">·</span>
          <a
            href="https://status.allternit.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <Circle size={8} weight="fill" className="text-[var(--status-success)]" /> Status
          </a>
          <span className="text-[var(--border-default)]">·</span>
          <a
            href="https://allternit.com/changelog"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <Scroll size={12} /> Changelog
          </a>
        </div>
      </div>
    </>
  );
}
