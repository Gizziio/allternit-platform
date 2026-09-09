"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise,
  CaretRight,
  Check,
  FlowArrow,
  Play,
  Playlist,
  Record,
  Warning,
  X,
} from "@phosphor-icons/react";
import { useToast } from "@/hooks/use-toast";
import {
  RecordingDetailUnavailableError,
  WorkflowNotCompiledError,
  getRecordingDetail,
  listRecordings,
  pollRunUntilTerminal,
  replayRecording,
  resolveRunApproval,
  runCompiledWorkflow,
  type RecordingDetail,
  type RecordingListItem,
  type RunStatusView,
} from "../api/recordings";

/** Matches the compiler's stableId("skill", trajectoryId) convention. */
function defaultSkillId(recordingId: string): string {
  return `skill_${recordingId.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase()}`;
}

function formatStartedAt(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function statusColor(status: string): string {
  switch (status) {
    case "completed":
      return "var(--status-success)";
    case "failed":
    case "error":
      return "var(--status-error, var(--status-danger, #ef4444))";
    case "awaiting_approval":
      return "var(--accent-primary)";
    case "running":
      return "var(--status-warning)";
    default:
      return "var(--ui-text-muted)";
  }
}

interface ActiveRun {
  runId: string;
  kind: "replay" | "workflow";
  status: string;
  summary?: string;
  done: boolean;
}

interface RecordingsPanelProps {
  /** Called when the panel needs vertical room for the step viewer. */
  compact?: boolean;
}

export function RecordingsPanel(_props: RecordingsPanelProps): React.ReactNode {
  const { addToast } = useToast();

  const [recordings, setRecordings] = useState<RecordingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecordingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailErrorKind, setDetailErrorKind] = useState<"unavailable" | "other" | null>(null);

  const [deviation, setDeviation] = useState("0.05");
  const [skillId, setSkillId] = useState("");
  const [starting, setStarting] = useState<"replay" | "workflow" | null>(null);

  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);

  const loadRecordings = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      setRecordings(await listRecordings());
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Could not load recordings.");
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecordings();
  }, [loadRecordings]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      setDetailErrorKind(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setDetailErrorKind(null);
    setSkillId(defaultSkillId(selectedId));
    getRecordingDetail(selectedId)
      .then((result) => {
        if (cancelled) {
          if (result.gifUrl?.startsWith("blob:")) URL.revokeObjectURL(result.gifUrl);
          return;
        }
        setDetail(result);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setDetail(null);
        if (error instanceof RecordingDetailUnavailableError) {
          setDetailError(error.message);
          setDetailErrorKind("unavailable");
        } else {
          setDetailError(error instanceof Error ? error.message : "Could not load this recording.");
          setDetailErrorKind("other");
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Revoke blob GIF URLs when the detail changes or the panel unmounts.
  useEffect(() => {
    const gifUrl = detail?.gifUrl;
    if (!gifUrl?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(gifUrl);
  }, [detail]);

  const selectedRecording = useMemo(
    () => recordings.find((r) => r.recording_id === selectedId) ?? null,
    [recordings, selectedId],
  );

  // Poll the active run to completion; surface the approval gate as a banner.
  const activeRunId = activeRun?.runId ?? null;
  useEffect(() => {
    if (!activeRunId) return;
    const controller = new AbortController();
    let cancelled = false;

    pollRunUntilTerminal(activeRunId, {
      signal: controller.signal,
      onUpdate: (status: RunStatusView) => {
        if (cancelled) return;
        setActiveRun((prev) =>
          prev && prev.runId === status.run_id
            ? { ...prev, status: status.status, summary: status.summary }
            : prev,
        );
      },
    })
      .then((final) => {
        if (cancelled) return;
        setActiveRun((prev) =>
          prev && prev.runId === final.run_id
            ? { ...prev, status: final.status, summary: final.summary, done: true }
            : prev,
        );
        addToast({
          title: final.status === "completed" ? "Run completed" : `Run ${final.status}`,
          description: final.summary,
          type: final.status === "completed" ? "success" : "error",
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setActiveRun((prev) => (prev ? { ...prev, done: true } : prev));
        addToast({
          title: "Run status unavailable",
          description: error instanceof Error ? error.message : "Polling the run failed.",
          type: "error",
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // Only re-arm the poller when the run id changes; status updates flow
    // through onUpdate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId]);

  const handleReplay = async () => {
    if (!selectedId || activeRun) return;
    const threshold = Number(deviation);
    if (!Number.isFinite(threshold) || threshold < 0) {
      addToast({
        title: "Invalid deviation threshold",
        description: "Enter a non-negative number (default 0.05).",
        type: "error",
      });
      return;
    }
    setStarting("replay");
    try {
      const ref = await replayRecording(selectedId, threshold);
      setActiveRun({ runId: ref.run_id, kind: "replay", status: ref.status ?? "running", done: false });
      addToast({ title: "Replay started", description: `Run ${ref.run_id}`, type: "info" });
    } catch (error) {
      addToast({
        title: "Replay failed to start",
        description: error instanceof Error ? error.message : "Unknown error.",
        type: "error",
      });
    } finally {
      setStarting(null);
    }
  };

  const handleRunWorkflow = async () => {
    if (!selectedId || !skillId.trim() || activeRun) return;
    setStarting("workflow");
    try {
      const ref = await runCompiledWorkflow(skillId.trim());
      setActiveRun({ runId: ref.run_id, kind: "workflow", status: ref.status ?? "running", done: false });
      addToast({ title: "Workflow started", description: `Run ${ref.run_id}`, type: "info" });
    } catch (error) {
      if (error instanceof WorkflowNotCompiledError) {
        addToast({ title: "Compile this recording first", description: error.message, type: "warning" });
      } else {
        addToast({
          title: "Workflow failed to start",
          description: error instanceof Error ? error.message : "Unknown error.",
          type: "error",
        });
      }
    } finally {
      setStarting(null);
    }
  };

  const handleApproval = async (decision: "approve" | "deny") => {
    if (!activeRun) return;
    try {
      await resolveRunApproval(activeRun.runId, decision);
      setActiveRun((prev) => (prev ? { ...prev, status: decision === "approve" ? "running" : "cancelled" } : prev));
      addToast({
        title: decision === "approve" ? "Run approved" : "Run denied",
        description: `Run ${activeRun.runId}`,
        type: decision === "approve" ? "success" : "info",
      });
    } catch (error) {
      addToast({
        title: "Approval failed",
        description: error instanceof Error ? error.message : "Unknown error.",
        type: "error",
      });
    }
  };

  return (
    <div>
      {/* Run monitor */}
      {activeRun && (
        <div
          className="rounded-2xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 mb-4"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <CaretRight size={16} weight="bold" color={statusColor(activeRun.status)} />
              <span className="text-[13px] font-semibold capitalize">
                {activeRun.kind === "replay" ? "Replay" : "Workflow"} run
              </span>
              <code className="text-[12px] text-[var(--text-tertiary)] truncate">{activeRun.runId}</code>
              <span
                className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ color: statusColor(activeRun.status), background: "var(--surface-hover)" }}
              >
                {activeRun.status.replace(/_/g, " ")}
              </span>
            </div>
            {activeRun.done && (
              <button
                type="button"
                onClick={() => setActiveRun(null)}
                className="p-1.5 rounded-lg border-none bg-transparent cursor-pointer transition-colors"
                style={{ color: "var(--ui-text-muted)" }}
                title="Dismiss"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {activeRun.summary && (
            <p className="text-[12px] text-[var(--text-secondary)] m-0 mt-2">{activeRun.summary}</p>
          )}
          {activeRun.status === "awaiting_approval" && (
            <div
              className="mt-3 rounded-xl border border-solid p-3 flex items-center justify-between gap-3 flex-wrap"
              style={{ borderColor: "var(--accent-primary)", background: "var(--surface-hover)" }}
            >
              <div className="flex items-center gap-2 min-w-0 text-[13px]">
                <Warning size={16} weight="bold" color="var(--accent-primary)" />
                <span>This run is waiting for your approval (deviation or safety pause).</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleApproval("approve")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-none text-[12px] font-semibold cursor-pointer transition-colors"
                  style={{ background: "var(--status-success)", color: "var(--bg-elevated)" }}
                >
                  <Check size={14} weight="bold" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void handleApproval("deny")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-none text-[12px] font-semibold cursor-pointer transition-colors"
                  style={{ background: "var(--surface-hover)", color: "var(--text-primary)" }}
                >
                  <X size={14} weight="bold" />
                  Deny
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recordings list */}
      {loading ? (
        <div className="text-[14px] text-[var(--text-secondary)] py-12 text-center">
          Loading recordings…
        </div>
      ) : listError ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] p-8 text-center">
          <Playlist size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-[14px] font-medium text-[var(--text-primary)] m-0 mb-1">
            Recordings unavailable
          </p>
          <p className="text-[12px] text-[var(--text-tertiary)] m-0 mb-4">{listError}</p>
          <button
            type="button"
            onClick={() => void loadRecordings()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--text-primary)] text-[var(--bg-elevated)] border-none cursor-pointer hover:opacity-90 transition-opacity"
          >
            <ArrowClockwise size={14} weight="bold" />
            Retry
          </button>
        </div>
      ) : recordings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] p-8 text-center">
          <Record size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-[14px] font-medium text-[var(--text-primary)] m-0 mb-1">No recordings yet</p>
          <p className="text-[12px] text-[var(--text-tertiary)] m-0">
            Recordings appear here after a computer-use run records its actions on this machine.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recordings.map((recording) => {
            const selected = recording.recording_id === selectedId;
            return (
              <button
                key={recording.recording_id}
                type="button"
                onClick={() => setSelectedId(selected ? null : recording.recording_id)}
                className="text-left rounded-2xl border border-solid border-[var(--border-default)] p-4 cursor-pointer transition-colors"
                style={{
                  background: "var(--bg-elevated)",
                  borderColor: selected ? "var(--accent-primary)" : "var(--border-default)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold m-0 truncate">
                      {recording.task || recording.recording_id}
                    </p>
                    <p className="text-[12px] text-[var(--text-tertiary)] m-0 mt-0.5 truncate">
                      {formatStartedAt(recording.started_at)} · {recording.total_steps} steps
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ color: statusColor(recording.status), background: "var(--surface-hover)" }}
                  >
                    {recording.status}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected recording detail */}
      {selectedRecording && (
        <div
          className="mt-4 rounded-2xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] p-4"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold m-0 truncate">
                {selectedRecording.task || selectedRecording.recording_id}
              </p>
              <p className="text-[12px] text-[var(--text-tertiary)] m-0 mt-0.5">
                {selectedRecording.recording_id} · {selectedRecording.total_steps} steps ·{" "}
                {formatStartedAt(selectedRecording.started_at)}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                Deviation
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={deviation}
                  onChange={(e) => setDeviation(e.target.value)}
                  className="w-20 px-2 py-1.5 rounded-lg border border-solid border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-[12px]"
                  title="Deviation threshold — replay pauses when the live screen diverges from the recording by more than this score"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleReplay()}
                disabled={Boolean(activeRun) || starting !== null}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-none text-[12px] font-semibold cursor-pointer transition-colors disabled:opacity-50"
                style={{ background: "var(--accent-primary)", color: "var(--accent-on-primary)" }}
              >
                <Play size={14} weight="bold" />
                {starting === "replay" ? "Starting…" : "Replay"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-3">
            <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)] min-w-0 flex-1">
              <FlowArrow size={14} />
              <input
                type="text"
                value={skillId}
                onChange={(e) => setSkillId(e.target.value)}
                placeholder="skill id (compile first)"
                className="flex-1 min-w-[180px] px-2 py-1.5 rounded-lg border border-solid border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-[12px]"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleRunWorkflow()}
              disabled={Boolean(activeRun) || starting !== null || !skillId.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-none text-[12px] font-semibold cursor-pointer transition-colors disabled:opacity-50"
              style={{ background: "var(--surface-hover)", color: "var(--text-primary)" }}
              title="Run a compiled browser workflow from this recording (POST /v1/browser-skills/run)"
            >
              <CaretRight size={14} weight="bold" />
              {starting === "workflow" ? "Starting…" : "Run as workflow"}
            </button>
          </div>

          {detailLoading ? (
            <div className="text-[13px] text-[var(--text-secondary)] py-6 text-center">
              Loading steps…
            </div>
          ) : detailError ? (
            <div
              className="rounded-xl border border-dashed border-[var(--border-default)] p-4 text-[12px] text-[var(--text-secondary)]"
            >
              {detailErrorKind === "unavailable"
                ? "Steps are not available yet — this gateway does not expose a recordings detail or file route. Replay and workflow actions still work."
                : detailError}
            </div>
          ) : detail ? (
            <div>
              {detail.gifUrl ? (
                <div className="mb-3 rounded-xl overflow-hidden border border-solid border-[var(--border-default)]">
                  <img
                    src={detail.gifUrl}
                    alt={`Recording playback for ${detail.manifest.recording_id}`}
                    className="w-full max-h-[320px] object-contain bg-black"
                  />
                </div>
              ) : null}
              {detail.steps.length > 0 ? (
                <ol className="m-0 p-0 list-none max-h-[320px] overflow-y-auto flex flex-col gap-1">
                  {detail.steps.map((step) => (
                    <li
                      key={step.step}
                      title={step.reasoning || undefined}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px]"
                      style={{ background: "var(--surface-hover)" }}
                    >
                      <span className="shrink-0 w-6 text-right text-[var(--text-tertiary)] font-mono">
                        {step.step}
                      </span>
                      {step.action_succeeded ? (
                        <Check size={14} weight="bold" color="var(--status-success)" className="shrink-0" />
                      ) : (
                        <X size={14} weight="bold" color="var(--status-error, #ef4444)" className="shrink-0" />
                      )}
                      <span className="shrink-0 font-semibold">{step.action_type || "action"}</span>
                      <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">
                        {step.action_target || JSON.stringify(step.action_params)}
                      </span>
                      {step.risk_level && step.risk_level !== "low" ? (
                        <span
                          className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                          style={{ color: "var(--status-warning)", background: "var(--bg-primary)" }}
                        >
                          {step.risk_level}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[12px] text-[var(--text-tertiary)] m-0">No steps recorded.</p>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
