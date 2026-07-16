"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  CheckCircle,
  CircleNotch,
  Clock,
  Download,
  FileArrowDown,
  GitDiff,
  Info,
  Key,
  ListChecks,
  NotePencil,
  Package,
  Power,
  Prohibit,
  SealCheck,
  ShieldCheck,
  ShieldWarning,
  SignOut,
  Star,
  Warning,
  WarningOctagon,
  XCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { MiniAppManifest } from "./mini-app.types";
import { diffManifestsForReview } from "./mini-app-review-diff";
import {
  clearReviewToken,
  fetchKillSwitches,
  fetchReviewDetail,
  fetchReviewQueue,
  loadReviewActor,
  loadReviewToken,
  postKillSwitch,
  postReview,
  RegistryApiError,
  resolveRegistryBase,
  saveReviewActor,
  saveReviewToken,
} from "./use-mini-app-review";
import type {
  KillSwitchState,
  ReviewAction,
  ReviewDetail,
  ReviewQueueItem,
} from "./use-mini-app-review";

// ─── Formatting helpers ─────────────────────────────────────────────────────

function toMillis(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatAge(value: string | number | null | undefined): string {
  const millis = toMillis(value);
  if (millis === null) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - millis) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(millis).toLocaleDateString();
}

function formatDateTime(value: string | number | null | undefined): string {
  const millis = toMillis(value);
  return millis === null ? "—" : new Date(millis).toLocaleString();
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return "—";
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
}

function compactJson(value: unknown): string {
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? "—";
  } catch {
    return String(value);
  }
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

// ─── Small primitives ───────────────────────────────────────────────────────

type PillTone = "green" | "amber" | "red" | "blue" | "neutral";

const PILL_TONE_CLASS: Record<PillTone, string> = {
  green: "bg-green-500/10 text-green-500",
  amber: "bg-amber-500/10 text-amber-500",
  red: "bg-red-500/10 text-red-500",
  blue: "bg-blue-500/10 text-blue-400",
  neutral: "bg-[var(--surface-hover)] text-[var(--text-tertiary)]",
};

function Pill({
  tone = "neutral",
  children,
  title,
}: {
  tone?: PillTone;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        PILL_TONE_CLASS[tone],
      )}
    >
      {children}
    </span>
  );
}

function SectionCard({
  icon,
  title,
  count,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
      <header className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
        {icon}
        {title}
        {typeof count === "number" && (
          <span className="text-xs font-normal text-[var(--text-tertiary)]">
            ({count})
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-[var(--text-tertiary)]">{children}</p>;
}

// ─── Token gate ─────────────────────────────────────────────────────────────

function TokenGate({
  initialActor,
  onSubmit,
}: {
  initialActor: string;
  onSubmit: (token: string, actor: string) => void;
}) {
  const [token, setToken] = useState("");
  const [actor, setActor] = useState(initialActor);
  const canSubmit = token.trim().length > 0 && actor.trim().length > 0;

  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      <form
        className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSubmit(token.trim(), actor.trim());
        }}
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-base font-semibold">Miniapp review console</h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              Internal tool — admin token required
            </p>
          </div>
        </div>
        <label className="mb-3 block text-xs text-[var(--text-tertiary)]">
          Reviewer name
          <input
            value={actor}
            onChange={(event) => setActor(event.target.value)}
            placeholder="e.g. eoj"
            autoComplete="off"
            className="mt-1 h-10 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)]"
          />
        </label>
        <label className="mb-5 block text-xs text-[var(--text-tertiary)]">
          Admin token
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Registry admin token"
            autoComplete="off"
            className="mt-1 h-10 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)]"
          />
        </label>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--text-primary)] text-sm font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Key size={14} />
          Enter console
        </button>
      </form>
    </div>
  );
}

// ─── Review action bar ──────────────────────────────────────────────────────

const DESTRUCTIVE_ACTIONS: ReadonlyArray<ReviewAction> = [
  "reject",
  "revoke",
  "quarantine",
];

const ACTION_LABEL: Record<ReviewAction, string> = {
  approve: "Approve",
  reject: "Reject",
  request_changes: "Request changes",
  revoke: "Revoke",
  quarantine: "Quarantine",
};

const ACTION_ICON: Record<ReviewAction, React.ReactNode> = {
  approve: <CheckCircle size={13} />,
  reject: <XCircle size={13} />,
  request_changes: <NotePencil size={13} />,
  revoke: <Prohibit size={13} />,
  quarantine: <ShieldWarning size={13} />,
};

function ActionBar({
  miniappId,
  notes,
  onNotesChange,
  busy,
  error,
  notice,
  confirmAction,
  confirmText,
  onConfirmTextChange,
  onRequest,
  onCancelConfirm,
}: {
  miniappId: string;
  notes: string;
  onNotesChange: (value: string) => void;
  busy: ReviewAction | null;
  error: string | null;
  notice: string | null;
  confirmAction: ReviewAction | null;
  confirmText: string;
  onConfirmTextChange: (value: string) => void;
  onRequest: (action: ReviewAction) => void;
  onCancelConfirm: () => void;
}) {
  const actions: ReadonlyArray<ReviewAction> = [
    "approve",
    "request_changes",
    "reject",
    "revoke",
    "quarantine",
  ];
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
      <label className="mb-1 block text-xs font-medium text-[var(--text-tertiary)]">
        Review notes (stored in the audit trail)
      </label>
      <textarea
        value={notes}
        onChange={(event) => onNotesChange(event.target.value)}
        rows={3}
        placeholder="What did you check? Why this verdict?"
        className="mb-3 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)]"
      />
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => {
          const destructive = DESTRUCTIVE_ACTIONS.includes(action);
          return (
            <button
              key={action}
              type="button"
              disabled={busy !== null}
              onClick={() => onRequest(action)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors disabled:opacity-50",
                action === "approve" &&
                  "border-green-500/30 bg-green-500/10 text-green-500 hover:bg-green-500/20",
                action === "request_changes" &&
                  "border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20",
                destructive &&
                  "border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20",
              )}
            >
              {busy === action ? (
                <CircleNotch size={13} className="animate-spin" />
              ) : (
                ACTION_ICON[action]
              )}
              {ACTION_LABEL[action]}
            </button>
          );
        })}
      </div>
      {confirmAction && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs text-red-500">
            <WarningOctagon size={13} />
            {ACTION_LABEL[confirmAction]} is destructive. Type{" "}
            <span className="font-mono font-semibold">{miniappId}</span> to
            confirm.
          </p>
          <div className="flex items-center gap-2">
            <input
              value={confirmText}
              onChange={(event) => onConfirmTextChange(event.target.value)}
              placeholder={miniappId}
              autoComplete="off"
              className="h-8 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 font-mono text-xs text-[var(--text-primary)] outline-none focus:border-red-500/50"
            />
            <button
              type="button"
              disabled={confirmText !== miniappId || busy !== null}
              onClick={() => onRequest(confirmAction)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-500 px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy === confirmAction ? (
                <CircleNotch size={13} className="animate-spin" />
              ) : (
                ACTION_ICON[confirmAction]
              )}
              Confirm {ACTION_LABEL[confirmAction].toLowerCase()}
            </button>
            <button
              type="button"
              onClick={onCancelConfirm}
              className="h-8 rounded-lg border border-[var(--border-default)] px-3 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-red-500">
          <Warning size={13} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {notice && !error && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-green-500">
          <CheckCircle size={13} />
          {notice}
        </p>
      )}
    </div>
  );
}

// ─── Detail sections ────────────────────────────────────────────────────────

const RISK_FLAG_TONE: Record<string, PillTone> = {
  "network-expanded": "red",
  "filesystem-expanded": "red",
  "secrets-added": "red",
  "processes-enabled": "red",
  "commands-changed": "amber",
  "presentation-changed": "amber",
  "platforms-expanded": "amber",
  "network-reduced": "green",
  "filesystem-reduced": "green",
  "secrets-reduced": "green",
  "first-submission": "blue",
  "metadata-only": "blue",
};

const CHANGE_KIND_TONE: Record<string, PillTone> = {
  added: "green",
  removed: "red",
  changed: "amber",
};

const SCAN_STATUS_TONE: Record<string, PillTone> = {
  pass: "green",
  warn: "amber",
  fail: "red",
};

function ManifestDiffSection({ detail }: { detail: ReviewDetail }) {
  const diff = useMemo(
    () =>
      diffManifestsForReview(
        (detail.previousVerified?.manifest as MiniAppManifest | undefined) ??
          null,
        detail.candidate.manifest as MiniAppManifest,
      ),
    [detail],
  );
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof diff.changes>();
    for (const change of diff.changes) {
      const root = change.section.split(".")[0];
      const list = groups.get(root) ?? [];
      list.push(change);
      groups.set(root, list);
    }
    return [...groups.entries()];
  }, [diff.changes]);

  return (
    <SectionCard
      icon={<GitDiff size={15} />}
      title={
        diff.fromVersion
          ? `Manifest diff v${diff.fromVersion} → v${diff.toVersion || "?"}`
          : `Manifest diff — first submission (v${diff.toVersion || "?"})`
      }
      count={diff.changes.length}
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {diff.riskFlags.length === 0 && <Pill tone="green">no risk flags</Pill>}
        {diff.riskFlags.map((flag) => (
          <Pill key={flag} tone={RISK_FLAG_TONE[flag] ?? "amber"}>
            {flag}
          </Pill>
        ))}
        {diff.hasSecurityRelevantChanges && (
          <Pill
            tone="red"
            title="Permissions, harness, lifecycle, presentation or compatibility changed"
          >
            security-relevant
          </Pill>
        )}
      </div>
      {grouped.length === 0 ? (
        <EmptyNote>No manifest changes against the verified version.</EmptyNote>
      ) : (
        <div className="space-y-3">
          {grouped.map(([section, changes]) => (
            <div key={section}>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                {section}
              </div>
              <ul className="space-y-1">
                {changes.map((change, index) => (
                  <li
                    key={`${change.section}-${index}`}
                    className="flex flex-wrap items-baseline gap-2 rounded-lg bg-[var(--bg-primary)] px-2.5 py-1.5 text-xs"
                  >
                    <Pill tone={CHANGE_KIND_TONE[change.kind] ?? "neutral"}>
                      {change.kind}
                    </Pill>
                    <span className="font-mono text-[var(--text-secondary)]">
                      {change.section}
                    </span>
                    <span className="min-w-0 break-all font-mono text-[var(--text-tertiary)]">
                      {change.kind !== "added" && (
                        <span className="text-red-400/80 line-through">
                          {compactJson(change.oldValue)}
                        </span>
                      )}
                      {change.kind === "changed" && " → "}
                      {change.kind !== "removed" && (
                        <span className="text-green-500/90">
                          {compactJson(change.newValue)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function SignatureSection({ detail }: { detail: ReviewDetail }) {
  const candidate = detail.candidate;
  const signed = Boolean(candidate.signature);
  return (
    <SectionCard icon={<SealCheck size={15} />} title="Signature">
      <div className="flex flex-wrap items-center gap-2">
        {signed ? (
          <Pill tone="green">
            <SealCheck size={11} /> signed
          </Pill>
        ) : (
          <Pill tone="amber">
            <ShieldWarning size={11} /> unsigned
          </Pill>
        )}
        {candidate.publisherKeyFingerprint && (
          <Pill tone="neutral" title="Publisher key fingerprint">
            <Key size={11} />
            {candidate.publisherKeyFingerprint}
          </Pill>
        )}
      </div>
      <dl className="mt-3 space-y-1.5 text-xs text-[var(--text-secondary)]">
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-tertiary)]">Candidate status</dt>
          <dd className="font-mono">{candidate.status}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-tertiary)]">Submitted</dt>
          <dd>{formatDateTime(candidate.submittedAt)}</dd>
        </div>
        {candidate.signature && (
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--text-tertiary)]">Signature</dt>
            <dd className="truncate font-mono" title={candidate.signature}>
              {shortHash(candidate.signature)}
            </dd>
          </div>
        )}
      </dl>
      {candidate.changelog && (
        <p className="mt-3 rounded-lg bg-[var(--bg-primary)] px-3 py-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          {candidate.changelog}
        </p>
      )}
    </SectionCard>
  );
}

function PipelineSection({ detail }: { detail: ReviewDetail }) {
  const job = detail.intakeJob;
  return (
    <SectionCard
      icon={<ListChecks size={15} />}
      title="Intake pipeline"
      count={detail.scanReports.length}
    >
      {job ? (
        <div className="mb-3 rounded-lg bg-[var(--bg-primary)] px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Pill
              tone={
                job.status === "awaiting_review"
                  ? "blue"
                  : job.status === "failed"
                    ? "red"
                    : "neutral"
              }
            >
              {job.status}
            </Pill>
            <span className="text-[var(--text-tertiary)]">
              attempts: {job.attempts}
            </span>
            {job.claimedBy && (
              <span className="text-[var(--text-tertiary)]">
                claimed by {job.claimedBy}
              </span>
            )}
          </div>
          {job.lastError && (
            <p className="mt-1.5 break-all font-mono text-[11px] text-red-400">
              {job.lastError}
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-[var(--text-tertiary)]">
            updated {formatAge(job.updatedAt)} · created{" "}
            {formatDateTime(job.createdAt)}
          </p>
        </div>
      ) : (
        <EmptyNote>No intake job recorded for this version.</EmptyNote>
      )}
      {detail.scanReports.length === 0 ? (
        <EmptyNote>No scan reports yet.</EmptyNote>
      ) : (
        <ul className="space-y-1.5">
          {detail.scanReports.map((report) => (
            <li
              key={report.id}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--bg-primary)] px-2.5 py-1.5 text-xs"
            >
              <Pill tone={SCAN_STATUS_TONE[report.status] ?? "neutral"}>
                {report.status}
              </Pill>
              <span className="font-medium text-[var(--text-primary)]">
                {report.scanner}
              </span>
              {report.stage && (
                <span className="text-[var(--text-tertiary)]">
                  stage: {report.stage}
                </span>
              )}
              <span className="text-[var(--text-tertiary)]">
                {formatAge(report.createdAt)}
              </span>
              {report.downloadUrl && (
                <a
                  href={report.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-[var(--accent-primary)] hover:underline"
                >
                  <FileArrowDown size={12} />
                  Full report
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function AssetsSection({ detail }: { detail: ReviewDetail }) {
  return (
    <SectionCard
      icon={<Package size={15} />}
      title="Assets"
      count={detail.assets.length}
    >
      {detail.assets.length === 0 ? (
        <EmptyNote>No assets stored for this version.</EmptyNote>
      ) : (
        <ul className="space-y-1.5">
          {detail.assets.map((asset) => (
            <li
              key={asset.id}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--bg-primary)] px-2.5 py-1.5 text-xs"
            >
              <Pill tone="neutral">{asset.kind}</Pill>
              <span
                className="font-mono text-[var(--text-secondary)]"
                title={asset.sha256}
              >
                {shortHash(asset.sha256)}
              </span>
              <span className="text-[var(--text-tertiary)]">
                {formatBytes(asset.sizeBytes)}
              </span>
              <span className="text-[var(--text-tertiary)]">{asset.mime}</span>
              {asset.quarantined && (
                <Pill tone="red">
                  <ShieldWarning size={11} /> quarantined
                </Pill>
              )}
              {asset.downloadUrl && (
                <a
                  href={asset.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-[var(--accent-primary)] hover:underline"
                >
                  <Download size={12} />
                  Download
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function AuditSection({ detail }: { detail: ReviewDetail }) {
  return (
    <SectionCard
      icon={<Clock size={15} />}
      title="Review history"
      count={detail.reviews.length}
    >
      {detail.reviews.length === 0 ? (
        <EmptyNote>No review actions recorded yet.</EmptyNote>
      ) : (
        <ul className="space-y-1.5">
          {detail.reviews.map((review) => (
            <li
              key={review.id}
              className="rounded-lg bg-[var(--bg-primary)] px-2.5 py-1.5 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Pill
                  tone={
                    review.action === "approve"
                      ? "green"
                      : review.action === "request_changes"
                        ? "amber"
                        : "red"
                  }
                >
                  {review.action}
                </Pill>
                <span className="font-medium text-[var(--text-primary)]">
                  {review.actor}
                </span>
                <span className="text-[var(--text-tertiary)]">
                  {formatDateTime(review.createdAt)}
                </span>
              </div>
              {review.notes && (
                <p className="mt-1 whitespace-pre-wrap text-[var(--text-secondary)]">
                  {review.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function InstallEventsSection({ detail }: { detail: ReviewDetail }) {
  return (
    <SectionCard
      icon={<Download size={15} />}
      title="Recent install events"
      count={detail.installEvents.length}
    >
      {detail.installEvents.length === 0 ? (
        <EmptyNote>No install events recorded.</EmptyNote>
      ) : (
        <ul className="space-y-1">
          {detail.installEvents.slice(0, 20).map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]"
            >
              <Pill tone="neutral">{event.event}</Pill>
              <span className="font-mono">v{event.version}</span>
              {event.platform && (
                <span className="text-[var(--text-tertiary)]">
                  {event.platform}
                </span>
              )}
              {event.clientVersion && (
                <span className="text-[var(--text-tertiary)]">
                  client {event.clientVersion}
                </span>
              )}
              <span className="ml-auto text-[var(--text-tertiary)]">
                {formatAge(event.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ─── Kill-switch panel ──────────────────────────────────────────────────────

function KillSwitchPanel({
  base,
  token,
  actor,
  onChanged,
}: {
  base: string;
  token: string;
  actor: string;
  onChanged: () => void;
}) {
  const [state, setState] = useState<KillSwitchState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState("");
  const [reason, setReason] = useState("");
  const [confirmScope, setConfirmScope] = useState("");
  const [busy, setBusy] = useState<"enable" | "disable" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setState(await fetchKillSwitches(base, token));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [base, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const normalizedScope = scope.trim();
  const isMarketplace = normalizedScope === "marketplace";
  const scopeConfirmed = confirmScope.trim() === normalizedScope;

  const submit = async (enabled: boolean) => {
    setFormError(null);
    setNotice(null);
    if (!normalizedScope) {
      setFormError("Enter a scope: marketplace or a miniapp id.");
      return;
    }
    if (enabled && !reason.trim()) {
      setFormError("A reason is mandatory when enabling a kill switch.");
      return;
    }
    if (!scopeConfirmed) {
      setFormError(`Type the scope (${normalizedScope}) to confirm.`);
      return;
    }
    setBusy(enabled ? "enable" : "disable");
    try {
      await postKillSwitch(base, token, {
        scope: normalizedScope,
        enabled,
        reason: reason.trim() || undefined,
        actor: actor || undefined,
      });
      setNotice(
        `Kill switch for ${normalizedScope} ${enabled ? "enabled" : "disabled"}.`,
      );
      setConfirmScope("");
      await load();
      onChanged();
    } catch (reason) {
      setFormError(errorMessage(reason));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard icon={<Power size={15} />} title="Set kill switch">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-[var(--text-tertiary)]">
            Scope (marketplace or miniapp id)
            <input
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              placeholder="marketplace"
              autoComplete="off"
              className="mt-1 h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 font-mono text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />
          </label>
          <label className="block text-xs text-[var(--text-tertiary)]">
            Reason (mandatory when enabling)
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is this switch changing?"
              autoComplete="off"
              className="mt-1 h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />
          </label>
        </div>
        <label className="mt-3 block text-xs text-[var(--text-tertiary)]">
          Type the scope to confirm
          <input
            value={confirmScope}
            onChange={(event) => setConfirmScope(event.target.value)}
            placeholder={normalizedScope || "scope"}
            autoComplete="off"
            className="mt-1 h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 font-mono text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
          />
        </label>
        {isMarketplace && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-500">
            <WarningOctagon size={14} className="mt-0.5 shrink-0" />
            <span>
              Enabling the <span className="font-semibold">marketplace</span>{" "}
              kill switch empties the public marketplace and halts all installs
              and updates for every user until it is disabled again.
            </span>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void submit(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            {busy === "enable" ? (
              <CircleNotch size={13} className="animate-spin" />
            ) : (
              <Power size={13} />
            )}
            Enable switch
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void submit(false)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 text-xs font-medium text-green-500 transition-colors hover:bg-green-500/20 disabled:opacity-50"
          >
            {busy === "disable" ? (
              <CircleNotch size={13} className="animate-spin" />
            ) : (
              <CheckCircle size={13} />
            )}
            Disable switch
          </button>
        </div>
        {formError && (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-red-500">
            <Warning size={13} className="mt-0.5 shrink-0" />
            <span>{formError}</span>
          </p>
        )}
        {notice && !formError && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-green-500">
            <CheckCircle size={13} />
            {notice}
          </p>
        )}
      </SectionCard>

      <SectionCard
        icon={<ShieldWarning size={15} />}
        title="Current switches"
        count={state?.switches.length}
      >
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-2.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-hover)] disabled:opacity-50"
          >
            {loading ? (
              <CircleNotch size={12} className="animate-spin" />
            ) : (
              <ArrowsClockwise size={12} />
            )}
            Refresh
          </button>
        </div>
        {error && (
          <p className="mb-3 flex items-start gap-1.5 text-xs text-red-500">
            <Warning size={13} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
        {!state || state.switches.length === 0 ? (
          <EmptyNote>No kill switches configured.</EmptyNote>
        ) : (
          <ul className="space-y-1.5">
            {state.switches.map((row) => (
              <li
                key={row.scope}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--bg-primary)] px-2.5 py-1.5 text-xs"
              >
                <Pill tone={row.enabled ? "red" : "green"}>
                  {row.enabled ? "enabled" : "disabled"}
                </Pill>
                <span className="font-mono font-medium text-[var(--text-primary)]">
                  {row.scope}
                </span>
                {row.reason && (
                  <span className="text-[var(--text-secondary)]">
                    {row.reason}
                  </span>
                )}
                <span className="ml-auto text-[var(--text-tertiary)]">
                  by {row.actor} · {formatAge(row.updatedAt)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setScope(row.scope);
                    setConfirmScope("");
                  }}
                  className="text-[var(--accent-primary)] hover:underline"
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        icon={<Clock size={15} />}
        title="Recent kill-switch events"
        count={state?.events.length}
      >
        {!state || state.events.length === 0 ? (
          <EmptyNote>No kill-switch events recorded.</EmptyNote>
        ) : (
          <ul className="space-y-1">
            {state.events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]"
              >
                <Pill tone={event.enabled ? "red" : "green"}>
                  {event.enabled ? "enabled" : "disabled"}
                </Pill>
                <span className="font-mono">{event.scope}</span>
                {event.reason && (
                  <span className="text-[var(--text-tertiary)]">
                    {event.reason}
                  </span>
                )}
                <span className="ml-auto text-[var(--text-tertiary)]">
                  {event.actor} · {formatAge(event.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Queue row ──────────────────────────────────────────────────────────────

function QueueRow({
  item,
  selected,
  killSwitched,
  onSelect,
}: {
  item: ReviewQueueItem;
  selected: boolean;
  killSwitched: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-[var(--accent-primary)] bg-[var(--surface-hover)]"
          : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-hover)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-[var(--text-primary)]">
          {item.name}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-[var(--text-tertiary)]">
          v{item.version}
        </span>
      </div>
      <div className="mt-0.5 truncate text-[11px] text-[var(--text-tertiary)]">
        {item.publisherId} · {formatAge(item.submittedAt)}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {item.signed ? (
          <Pill tone="green">
            <SealCheck size={10} /> signed
          </Pill>
        ) : (
          <Pill tone="amber">
            <ShieldWarning size={10} /> unsigned
          </Pill>
        )}
        {item.intakeStatus && <Pill tone="blue">{item.intakeStatus}</Pill>}
        {item.scanFailures > 0 && (
          <Pill tone="red">{item.scanFailures} scan fail</Pill>
        )}
        {item.scanWarnings > 0 && (
          <Pill tone="amber">{item.scanWarnings} scan warn</Pill>
        )}
        {killSwitched && (
          <Pill tone="red">
            <Prohibit size={10} /> kill-switched
          </Pill>
        )}
      </div>
    </button>
  );
}

// ─── Main view ──────────────────────────────────────────────────────────────

export function MiniAppReviewConsoleView() {
  const base = useMemo(() => resolveRegistryBase(), []);
  const [token, setToken] = useState<string | null>(() => loadReviewToken());
  const [actor, setActor] = useState(() => loadReviewActor() ?? "");
  const [tab, setTab] = useState<"queue" | "kill-switches">("queue");

  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [queueLoading, setQueueLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [killScopes, setKillScopes] = useState<Set<string>>(new Set());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [notes, setNotes] = useState("");
  const [actionBusy, setActionBusy] = useState<ReviewAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ReviewAction | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const loadDetail = useCallback(
    async (id: string, version?: string) => {
      if (!base || !token) return;
      setDetailLoading(true);
      setDetailError(null);
      try {
        setDetail(await fetchReviewDetail(base, token, id, version));
      } catch (reason) {
        setDetail(null);
        setDetailError(errorMessage(reason));
      } finally {
        setDetailLoading(false);
      }
    },
    [base, token],
  );

  const loadQueue = useCallback(
    async (selectFirst: boolean) => {
      if (!base || !token) return;
      setQueueLoading(true);
      setQueueError(null);
      try {
        const [page, switches] = await Promise.all([
          fetchReviewQueue(base, token),
          fetchKillSwitches(base, token).catch(() => null),
        ]);
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setKillScopes(
          new Set(
            (switches?.switches ?? [])
              .filter((row) => row.enabled)
              .map((row) => row.scope),
          ),
        );
        if (selectFirst && page.items.length > 0) {
          const first = page.items[0];
          setSelectedId(first.miniappId);
          void loadDetail(first.miniappId, first.version);
        }
      } catch (reason) {
        setQueueError(errorMessage(reason));
      } finally {
        setQueueLoading(false);
      }
    },
    [base, token, loadDetail],
  );

  useEffect(() => {
    if (token) void loadQueue(true);
  }, [token, loadQueue]);

  const loadMore = async () => {
    if (!base || !token || !nextCursor) return;
    setLoadingMore(true);
    setQueueError(null);
    try {
      const page = await fetchReviewQueue(base, token, nextCursor);
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (reason) {
      setQueueError(errorMessage(reason));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSelect = (item: ReviewQueueItem) => {
    setSelectedId(item.miniappId);
    setConfirmAction(null);
    setConfirmText("");
    setActionError(null);
    setActionNotice(null);
    setNotes("");
    void loadDetail(item.miniappId, item.version);
  };

  const handleAction = async (action: ReviewAction) => {
    if (!base || !token || !detail) return;
    if (DESTRUCTIVE_ACTIONS.includes(action) && confirmAction !== action) {
      setConfirmAction(action);
      setConfirmText("");
      return;
    }
    if (
      DESTRUCTIVE_ACTIONS.includes(action) &&
      confirmText !== detail.miniappId
    )
      return;
    setActionBusy(action);
    setActionError(null);
    setActionNotice(null);
    try {
      await postReview(base, token, detail.miniappId, {
        status: action,
        notes: notes.trim() || undefined,
        version: detail.candidate.version,
        actor: actor || undefined,
      });
      setActionNotice(`${ACTION_LABEL[action]} recorded.`);
      setNotes("");
      setConfirmAction(null);
      setConfirmText("");
      await loadQueue(false);
      await loadDetail(detail.miniappId, detail.candidate.version);
    } catch (reason) {
      if (
        reason instanceof RegistryApiError &&
        reason.status === 422 &&
        action === "approve"
      ) {
        setActionError(
          `Pipeline evidence incomplete — the registry refused approval (422). The intake pipeline must reach awaiting_review first. ${reason.message}`,
        );
      } else {
        setActionError(errorMessage(reason));
      }
    } finally {
      setActionBusy(null);
    }
  };

  if (!token) {
    return (
      <TokenGate
        initialActor={actor}
        onSubmit={(nextToken, nextActor) => {
          saveReviewToken(nextToken);
          saveReviewActor(nextActor);
          setActor(nextActor);
          setToken(nextToken);
        }}
      />
    );
  }

  if (!base) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--bg-elevated)] text-[var(--text-primary)]">
        <div className="max-w-md rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-sm text-[var(--text-secondary)]">
          <p className="mb-2 flex items-center gap-2 font-semibold text-[var(--text-primary)]">
            <Warning size={16} className="text-amber-500" />
            Registry URL not configured
          </p>
          Set{" "}
          <code className="font-mono text-xs">
            window.__ALLTERNIT_MINIAPP_REGISTRY_URL__
          </code>{" "}
          before loading the shell to point the console at a registry.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] px-6 py-4">
        <div className="flex size-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)]">
          <ShieldCheck size={18} />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-semibold">Miniapp review console</h1>
          <p className="truncate text-[11px] text-[var(--text-tertiary)]">
            {base} · reviewer: {actor || "unknown"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg border border-[var(--border-default)] p-0.5">
            <button
              type="button"
              onClick={() => setTab("queue")}
              className={cn(
                "h-7 rounded-md px-3 text-xs font-medium transition-colors",
                tab === "queue"
                  ? "bg-[var(--text-primary)] text-[var(--bg-elevated)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
            >
              Review queue
            </button>
            <button
              type="button"
              onClick={() => setTab("kill-switches")}
              className={cn(
                "h-7 rounded-md px-3 text-xs font-medium transition-colors",
                tab === "kill-switches"
                  ? "bg-[var(--text-primary)] text-[var(--bg-elevated)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
            >
              Kill switches
            </button>
          </div>
          {tab === "queue" && (
            <button
              type="button"
              onClick={() => void loadQueue(false)}
              disabled={queueLoading}
              title="Refresh queue"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] disabled:opacity-50"
            >
              {queueLoading ? (
                <CircleNotch size={14} className="animate-spin" />
              ) : (
                <ArrowsClockwise size={14} />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              clearReviewToken();
              setToken(null);
            }}
            title="Sign out and forget the admin token"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-tertiary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-secondary)]"
          >
            <SignOut size={14} />
          </button>
        </div>
      </header>

      {tab === "kill-switches" ? (
        <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
          <div className="mx-auto max-w-3xl">
            <KillSwitchPanel
              base={base}
              token={token}
              actor={actor}
              onChanged={() => void loadQueue(false)}
            />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-80 shrink-0 flex-col border-r border-[var(--border-subtle)]">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                Queue ({items.length})
              </span>
              {queueLoading && (
                <CircleNotch
                  size={12}
                  className="animate-spin text-[var(--text-tertiary)]"
                />
              )}
            </div>
            {queueError && (
              <div className="mx-4 mb-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-500">
                {queueError}
                {queueError.includes("401") && (
                  <button
                    type="button"
                    onClick={() => {
                      clearReviewToken();
                      setToken(null);
                    }}
                    className="ml-2 underline"
                  >
                    Re-enter token
                  </button>
                )}
              </div>
            )}
            <div className="min-h-0 flex-1 space-y-2 overflow-auto px-4 pb-4">
              {items.map((item) => (
                <QueueRow
                  key={`${item.miniappId}@${item.version}`}
                  item={item}
                  selected={item.miniappId === selectedId}
                  killSwitched={killScopes.has(item.miniappId)}
                  onSelect={() => handleSelect(item)}
                />
              ))}
              {!queueLoading && items.length === 0 && !queueError && (
                <div className="flex flex-col items-center gap-2 py-16 text-center">
                  <ListChecks
                    size={28}
                    className="text-[var(--text-tertiary)] opacity-50"
                  />
                  <p className="text-xs text-[var(--text-tertiary)]">
                    The review queue is empty.
                  </p>
                </div>
              )}
              {nextCursor && (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border-default)] text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] disabled:opacity-50"
                >
                  {loadingMore ? (
                    <CircleNotch size={12} className="animate-spin" />
                  ) : (
                    <CaretDown size={12} />
                  )}
                  Load more
                </button>
              )}
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-auto px-6 py-5">
            {detailLoading && (
              <div className="flex items-center gap-2 py-16 text-xs text-[var(--text-tertiary)]">
                <CircleNotch size={14} className="animate-spin" />
                Loading review detail…
              </div>
            )}
            {!detailLoading && detailError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">
                {detailError}
              </div>
            )}
            {!detailLoading && !detailError && !detail && (
              <div className="flex flex-col items-center gap-2 py-24 text-center">
                <CaretRight
                  size={28}
                  className="text-[var(--text-tertiary)] opacity-50"
                />
                <p className="text-xs text-[var(--text-tertiary)]">
                  Select a submission from the queue.
                </p>
              </div>
            )}
            {!detailLoading && detail && (
              <div className="mx-auto max-w-3xl space-y-4">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{detail.name}</h2>
                    <span className="font-mono text-xs text-[var(--text-tertiary)]">
                      v{detail.candidate.version}
                    </span>
                    <Pill tone="blue">{detail.status}</Pill>
                    {detail.killSwitched && (
                      <Pill tone="red">
                        <Prohibit size={11} /> kill-switched
                      </Pill>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                      <Star size={12} />
                      {detail.rating.count > 0
                        ? `${detail.rating.average.toFixed(1)} (${detail.rating.count} ratings)`
                        : "no ratings"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    <span className="font-mono">{detail.miniappId}</span> ·
                    publisher {detail.publisher}
                    {detail.reviewedBy &&
                      ` · last reviewed by ${detail.reviewedBy} ${formatAge(detail.reviewedAt)}`}
                  </p>
                  {detail.reviewNotes && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                      <Info size={13} className="mt-0.5 shrink-0" />
                      {detail.reviewNotes}
                    </p>
                  )}
                </div>

                <ActionBar
                  miniappId={detail.miniappId}
                  notes={notes}
                  onNotesChange={setNotes}
                  busy={actionBusy}
                  error={actionError}
                  notice={actionNotice}
                  confirmAction={confirmAction}
                  confirmText={confirmText}
                  onConfirmTextChange={setConfirmText}
                  onRequest={(action) => void handleAction(action)}
                  onCancelConfirm={() => {
                    setConfirmAction(null);
                    setConfirmText("");
                  }}
                />

                <ManifestDiffSection detail={detail} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <SignatureSection detail={detail} />
                  <AuditSection detail={detail} />
                </div>
                <PipelineSection detail={detail} />
                <AssetsSection detail={detail} />
                <InstallEventsSection detail={detail} />
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
