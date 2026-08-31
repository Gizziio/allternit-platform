import React, { useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import {
  SquaresFour,
  Buildings,
  ComputerTower,
  CreditCard,
  Key,
  BookOpen,
  Gear,
  RocketLaunch,
  List,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  PlatformOrganizationSwitcher,
  usePlatformOrganization,
  usePlatformUser,
} from "@/lib/platform-auth-client";

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
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/api-keys", label: "API Keys", icon: Key },
  { to: "/docs", label: "Docs", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Gear },
];

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
              <span className="text-[14px] font-semibold tracking-tight">Allternit Platform</span>
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
              <span className="capitalize">
                {navItems.find((n) => n.to === location.pathname)?.label || "Console"}
              </span>
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
        <div className="size-7 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center">
          <span className="text-[11px] font-bold text-[var(--ui-text-inverse)]">A</span>
        </div>
        <span className="text-[14px] font-semibold tracking-tight">Allternit Platform</span>
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

      <div className="p-3 border-t border-[var(--border-subtle)]">
        <a
          href="https://ai.allternit.com/shell"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors"
        >
          <RocketLaunch size={18} /> Launch App
        </a>
      </div>
    </>
  );
}
