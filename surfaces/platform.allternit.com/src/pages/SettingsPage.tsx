import React from "react";
import { SignOutButton } from "@clerk/clerk-react";
import {
  Gear,
  Moon,
  Sun,
  SignOut,
  User,
  Buildings,
  ShieldCheck,
  ArrowSquareOut,
  Globe,
  Calendar,
  Clock,
  Desktop,
  CreditCard,
  Key,
  Devices,
  Bell,
} from "@phosphor-icons/react";
import { usePlatformUser, usePlatformOrganization } from "@/lib/platform-auth-client";
import { useTheme, type ThemePreference } from "@/lib/theme";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun size={16} /> },
  { value: "dark", label: "Dark", icon: <Moon size={16} /> },
  { value: "system", label: "System", icon: <Desktop size={16} /> },
];

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}

function Section({ icon, title, description, children }: SectionProps) {
  return (
    <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
      <div className="flex items-start gap-3 p-4 border-b border-solid border-[var(--border-subtle)]">
        <div className="size-9 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <div className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</div>
          {description && (
            <div className="text-[12px] text-[var(--text-secondary)]">{description}</div>
          )}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Row({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-solid border-[var(--border-subtle)] last:border-b-0 last:pb-0 first:pt-0">
      <div>
        <div className="text-[13px] font-medium text-[var(--text-primary)]">{label}</div>
        <div className="text-[12px] text-[var(--text-secondary)]">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
    >
      {children}
      <ArrowSquareOut size={12} />
    </a>
  );
}

function InternalLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <a
      href={to}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
    >
      {children}
      <ArrowSquareOut size={12} />
    </a>
  );
}

export function SettingsPage() {
  const { user } = usePlatformUser();
  const { organization, membership } = usePlatformOrganization();
  const { theme, setTheme } = useTheme();

  const email =
    user?.primaryEmailAddress?.emailAddress ||
    user?.userEmail ||
    user?.emailAddresses?.[0]?.emailAddress ||
    "—";
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || email.split("@")[0];
  const avatarUrl = user?.imageUrl;
  const roleLabel = membership?.role
    ? membership.role.replace(/^org:/, "").replace(/_/g, " ")
    : "Member";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">Settings</h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">
          Manage your account, preferences, and console appearance.
        </p>
      </div>

      {/* Account */}
      <Section icon={<User size={18} />} title="Account" description="Your profile and session">
        <div className="flex items-center gap-3 mb-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="size-12 rounded-full object-cover border border-solid border-[var(--border-subtle)]"
            />
          ) : (
            <div className="size-12 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center text-[18px] font-semibold">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-[15px] font-semibold text-[var(--text-primary)]">{name}</div>
            <div className="text-[13px] text-[var(--text-secondary)]">{email}</div>
          </div>
        </div>

        <Row label="Clerk account" action={<ExternalLink href="https://accounts.allternit.com/user">Manage account</ExternalLink>}>
          Update your email, password, and security settings.
        </Row>

        <Row label="Organization" action={<InternalLink to="/organizations">Manage organization</InternalLink>}>
          {organization?.name || "Personal workspace"} · {roleLabel}
        </Row>
      </Section>

      {/* Appearance */}
      <Section icon={<Sun size={18} />} title="Appearance" description="Choose your console theme">
        <Row label="Theme">
          Select light, dark, or match your system preference.
        </Row>
        <div className="flex items-center gap-2 mt-3">
          {THEME_OPTIONS.map((option) => {
            const active = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={[
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium border border-solid transition-colors",
                  active
                    ? "bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] border-[var(--accent-primary)]"
                    : "bg-[var(--bg-primary)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]",
                ].join(" ")}
              >
                {option.icon}
                {option.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Platform */}
      <Section icon={<Gear size={18} />} title="Platform" description="Cloud console settings">
        <Row label="Billing & plans" action={<InternalLink to="/billing">Open billing</InternalLink>}>
          View invoices, usage, and manage your plan.
        </Row>
        <Row label="API keys" action={<InternalLink to="/api-keys">Manage keys</InternalLink>}>
          Create and revoke API keys for programmatic access.
        </Row>
        <Row label="Devices & runtimes" action={<InternalLink to="/devices">Manage devices</InternalLink>}>
          Pair desktops, VPS runtimes, and hosted machines.
        </Row>
        <Row label="Notifications" action={<span className="text-[12px] text-[var(--text-tertiary)]">Coming soon</span>}>
          Configure email and webhook alerts.
        </Row>
      </Section>

      {/* Preferences */}
      <Section icon={<Globe size={18} />} title="Preferences" description="Regional and format settings">
        <Row label="Language" action={<span className="text-[12px] text-[var(--text-tertiary)]">English (US)</span>}>
          The language used across the console.
        </Row>
        <Row label="Timezone" action={<span className="text-[12px] text-[var(--text-tertiary)]">UTC</span>}>
          Display times in your local timezone.
        </Row>
        <Row label="Date format" action={<span className="text-[12px] text-[var(--text-tertiary)]">MMM D, YYYY</span>}>
          How dates are shown in tables and charts.
        </Row>
      </Section>

      {/* Security */}
      <Section icon={<ShieldCheck size={18} />} title="Security" description="Protect your account">
        <Row label="Two-factor authentication" action={<ExternalLink href="https://accounts.allternit.com/security">Manage 2FA</ExternalLink>}>
          Add an extra layer of security to your Clerk account.
        </Row>
        <Row label="Active sessions" action={<ExternalLink href="https://accounts.allternit.com/security">View sessions</ExternalLink>}>
          Review and sign out of sessions on other devices.
        </Row>
      </Section>

      {/* Sign out */}
      <div className="rounded-2xl border border-solid border-[var(--status-error)]/20 bg-[var(--status-error)]/5 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-[var(--status-error)]/10 text-[var(--status-error)] flex items-center justify-center">
              <SignOut size={18} />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">Account session</div>
              <div className="text-[12px] text-[var(--text-secondary)]">Sign out of the Allternit platform console.</div>
            </div>
          </div>
          <SignOutButton redirectUrl="/sign-in">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--status-error)] text-white text-[13px] font-medium hover:brightness-110 transition-colors"
            >
              <SignOut size={16} /> Sign out
            </button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}
