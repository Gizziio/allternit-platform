import type { BrowserCompatibility } from "@/components/agents/AgentCreationWizard.validations";

interface BrowserCompatibilityWarningProps {
  compatibility: BrowserCompatibility;
  onDismiss: () => void;
  dismissed?: boolean;
}

export function BrowserCompatibilityWarningComponent({
  compatibility,
  onDismiss,
  dismissed = false,
}: BrowserCompatibilityWarningProps) {
  if (dismissed || compatibility.unsupportedFeatures.length === 0) {
    return null;
  }

  const severityColor =
    compatibility.compatibilityScore >= 80
      ? "var(--status-success)"
      : compatibility.compatibilityScore >= 60
        ? "var(--status-warning)"
        : "var(--status-error)";

  return (
    <div
      className="flex items-start gap-3 rounded-xl border p-4"
      style={{
        background: "var(--status-warning-bg)",
        borderColor: "color-mix(in srgb, var(--status-warning) 30%, transparent)",
      }}
      role="alert"
      aria-label="Browser compatibility warning"
    >
      <div
        className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
        style={{ background: severityColor }}
        aria-hidden="true"
      />
      <div className="flex-1">
        <h4 className="mb-1 text-sm font-semibold text-[var(--ui-text-primary)]">
          Limited Browser Support
        </h4>
        <p className="mb-2 text-sm text-[rgba(255,255,255,0.7)]">
          Your browser does not support every feature this agent flow can use.
        </p>
        <ul className="mb-3 space-y-1 text-xs text-[rgba(255,255,255,0.55)]">
          {compatibility.unsupportedFeatures.map((feature) => (
            <li key={feature}>
              {feature} - some setup features may be unavailable.
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md border border-solid border-[var(--border-subtle)] px-2.5 py-1 text-xs text-[var(--ui-text-primary)] transition-colors hover:bg-[var(--surface-hover)]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
