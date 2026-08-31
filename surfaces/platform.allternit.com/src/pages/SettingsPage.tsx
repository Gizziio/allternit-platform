import React from "react";
import { SignOutButton } from "@clerk/clerk-react";
import { Gear, Moon, Sun, SignOut } from "@phosphor-icons/react";
import { usePlatformUser, usePlatformOrganization } from "@/lib/platform-auth-client";

export function SettingsPage() {
  const { user } = usePlatformUser();
  const { organization, membership } = usePlatformOrganization();
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("light", next === "light");
  };

  const email =
    user?.primaryEmailAddress?.emailAddress || user?.userEmail || user?.emailAddresses?.[0]?.emailAddress || "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
          Settings
        </h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">
          Console preferences and account session.
        </p>
      </div>

      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-9 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center">
            <Gear size={18} />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-[var(--text-primary)]">Account</div>
            <div className="text-[12px] text-[var(--text-secondary)]">{email}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Organization</div>
            <div className="text-[13px] text-[var(--text-primary)]">{organization?.name || "Personal"}</div>
          </div>
          <div className="rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Role</div>
            <div className="text-[13px] text-[var(--text-primary)]">{membership?.role || "—"}</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-solid border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
          >
            {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
            {theme === "dark" ? "Dark mode" : "Light mode"}
          </button>

          <SignOutButton redirectUrl="/sign-in">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-solid border-[var(--status-error)]/30 bg-[var(--status-error)]/10 text-[13px] font-medium text-[var(--status-error)] hover:bg-[var(--status-error)]/20 transition-colors"
            >
              <SignOut size={16} /> Sign out
            </button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}
