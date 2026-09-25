import React, { useCallback, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  CheckIcon,
  Key02Icon,
} from "@hugeicons/core-free-icons";
import { formatApiError } from "@/lib/api-client";
import {
  type RouteCredentialInfo,
  deleteRouteCredential,
  listRouteCredentials,
  putRouteCredential,
} from "@/lib/gateway-routing-policy";
import {
  ListPage,
  EmptyState,
  SkeletonRow,
  Badge,
  MonoChip,
  QUIET_BUTTON_CLASS,
  DESTRUCTIVE_BUTTON_CLASS,
} from "@/components/console-ui";
import { cn } from "@/lib/utils";

const TH_CLASS =
  "text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] px-3 py-2";
const TD_CLASS = "px-3 py-2.5 text-[13px] text-[var(--text-primary)]";
const INPUT_CLASS =
  "w-full rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-default)]";
const LABEL_CLASS = "mb-1 block text-[12px] font-semibold text-[var(--text-secondary)]";

const STATUS_TONE: Record<string, string> = {
  active: "text-[var(--status-success)] bg-[var(--status-success)]/10",
  unvalidated: "text-[var(--status-warning)] bg-[var(--status-warning)]/10",
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * BYO provider route credentials. Per-user (not org-admin gated): when a
 * request's resolved provider matches one of these credentials, the gateway
 * attaches it so the upstream call bills the customer's own provider account.
 * Keys are sealed at rest; list responses carry only a masked fingerprint.
 */
export function RouteCredentialsPage(): React.ReactNode {
  const [credentials, setCredentials] = useState<RouteCredentialInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [formProvider, setFormProvider] = useState("");
  const [formKey, setFormKey] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCredentials(await listRouteCredentials());
    } catch (err) {
      setError(formatApiError(err, "Unable to load route credentials."));
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const showFlash = useCallback((message: string) => {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 3000);
  }, []);

  const handleAdd = useCallback(async () => {
    const provider = formProvider.trim();
    if (!provider) {
      setError("Provider id is required.");
      return;
    }
    if (!formKey.trim()) {
      setError("API key is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      setCredentials(
        await putRouteCredential({
          provider_id: provider,
          api_key: formKey,
          ...(formBaseUrl.trim() ? { base_url: formBaseUrl } : {}),
          ...(formLabel.trim() ? { label: formLabel } : {}),
        })
      );
      setShowAdd(false);
      setFormProvider("");
      setFormKey("");
      setFormBaseUrl("");
      setFormLabel("");
      showFlash(formBaseUrl.trim() ? "Credential validated and saved." : "Credential saved.");
    } catch (err) {
      setError(formatApiError(err, "Unable to save the credential."));
    } finally {
      setSaving(false);
    }
  }, [formProvider, formKey, formBaseUrl, formLabel, showFlash]);

  const handleDelete = useCallback(
    async (providerId: string) => {
      setBusyId(providerId);
      setError(null);
      try {
        await deleteRouteCredential(providerId);
        setCredentials((prev) => prev.filter((row) => row.provider_id !== providerId));
        setConfirmDeleteId(null);
        showFlash(`Credential for ${providerId} deleted.`);
      } catch (err) {
        setError(formatApiError(err, "Unable to delete the credential."));
      } finally {
        setBusyId(null);
      }
    },
    [showFlash]
  );

  return (
    <ListPage
      title="Route credentials"
      subtitle="Bring your own provider subscriptions. When a request resolves to one of these providers, the gateway bills your account instead of Allternit credits."
      primaryAction={
        showAdd
          ? undefined
          : { label: "Add credential", onClick: () => setShowAdd(true) }
      }
    >
      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-solid border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-3 py-2 text-[13px] text-[var(--status-error)]">
          <HugeiconsIcon icon={AlertCircleIcon} size={14} />
          {error}
        </p>
      )}
      {flash && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-solid border-[var(--status-success)]/30 bg-[var(--status-success)]/10 px-3 py-2 text-[13px] text-[var(--status-success)]">
          <HugeiconsIcon icon={CheckIcon} size={14} />
          {flash}
        </p>
      )}

      <p className="m-0 mb-4 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-[12px] text-[var(--text-tertiary)]">
        BYOK requests are metered for token usage but billed $0 — they spend your provider
        subscription, not Allternit credits. Keys are encrypted at rest and are never shown in
        full; only a masked fingerprint is displayed.
      </p>

      {showAdd && (
        <div className="mb-6 max-w-3xl rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
          <h2 className="m-0 mb-1 text-[15px] font-semibold text-[var(--text-primary)]">
            Add credential
          </h2>
          <p className="m-0 mb-3 text-[12px] text-[var(--text-tertiary)]">
            When a base URL is provided, the key is probed against the provider's /models
            endpoint and stored as validated. Without one it is stored unvalidated.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL_CLASS}>Provider id</span>
              <input
                value={formProvider}
                onChange={(event) => setFormProvider(event.target.value)}
                placeholder="anthropic"
                className={cn(INPUT_CLASS, "font-mono")}
              />
            </label>
            <label className="block">
              <span className={LABEL_CLASS}>API key</span>
              <input
                type="password"
                value={formKey}
                onChange={(event) => setFormKey(event.target.value)}
                placeholder="sk-…"
                autoComplete="off"
                className={cn(INPUT_CLASS, "font-mono")}
              />
            </label>
            <label className="block">
              <span className={LABEL_CLASS}>
                Base URL <span className="font-normal text-[var(--text-tertiary)]">(optional)</span>
              </span>
              <input
                value={formBaseUrl}
                onChange={(event) => setFormBaseUrl(event.target.value)}
                placeholder="https://api.anthropic.com"
                className={cn(INPUT_CLASS, "font-mono")}
              />
            </label>
            <label className="block">
              <span className={LABEL_CLASS}>
                Label <span className="font-normal text-[var(--text-tertiary)]">(optional)</span>
              </span>
              <input
                value={formLabel}
                onChange={(event) => setFormLabel(event.target.value)}
                placeholder="Production key"
                className={INPUT_CLASS}
              />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              className={QUIET_BUTTON_CLASS}
              disabled={saving}
              onClick={() => setShowAdd(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !formProvider.trim() || !formKey.trim()}
              onClick={() => void handleAdd()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-[13px] font-semibold text-[var(--ui-text-inverse)] transition-colors hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save credential"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonRow lines={4} />
      ) : credentials.length === 0 && !error ? (
        <EmptyState
          icon={<HugeiconsIcon icon={Key02Icon} size={32} />}
          title="No route credentials"
          caption="Add a provider API key to have matching requests billed to your own provider account instead of Allternit credits."
          ctaLabel="Add credential"
          onCtaClick={() => setShowAdd(true)}
        />
      ) : credentials.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className={TH_CLASS}>Provider</th>
                <th className={TH_CLASS}>Key</th>
                <th className={TH_CLASS}>Status</th>
                <th className={TH_CLASS}>Label</th>
                <th className={TH_CLASS}>Base URL</th>
                <th className={TH_CLASS}>Last validated</th>
                <th className={TH_CLASS} />
              </tr>
            </thead>
            <tbody>
              {credentials.map((credential) => (
                <tr
                  key={credential.provider_id}
                  className="border-b border-[var(--border-subtle)] last:border-b-0"
                >
                  <td className={TD_CLASS}>
                    <MonoChip>{credential.provider_id}</MonoChip>
                  </td>
                  <td className={cn(TD_CLASS, "font-mono text-[12px] text-[var(--text-secondary)]")}>
                    {credential.masked}
                  </td>
                  <td className={TD_CLASS}>
                    <Badge className={STATUS_TONE[credential.status]}>
                      {credential.status}
                    </Badge>
                  </td>
                  <td className={cn(TD_CLASS, "text-[var(--text-secondary)]")}>
                    {credential.label ?? "—"}
                  </td>
                  <td className={cn(TD_CLASS, "font-mono text-[12px] text-[var(--text-secondary)]")}>
                    {credential.base_url ?? "—"}
                  </td>
                  <td className={cn(TD_CLASS, "text-[var(--text-secondary)]")}>
                    {formatDateTime(credential.last_validated_at)}
                  </td>
                  <td className={cn(TD_CLASS, "text-right")}>
                    {confirmDeleteId === credential.provider_id ? (
                      <span className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          className={DESTRUCTIVE_BUTTON_CLASS}
                          disabled={busyId !== null}
                          onClick={() => void handleDelete(credential.provider_id)}
                        >
                          {busyId === credential.provider_id ? "Deleting…" : "Confirm delete"}
                        </button>
                        <button
                          type="button"
                          className={QUIET_BUTTON_CLASS}
                          disabled={busyId !== null}
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={DESTRUCTIVE_BUTTON_CLASS}
                        onClick={() => setConfirmDeleteId(credential.provider_id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </ListPage>
  );
}

export default RouteCredentialsPage;
