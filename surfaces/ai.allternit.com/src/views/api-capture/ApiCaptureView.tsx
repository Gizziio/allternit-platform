"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Spinner,
  Warning,
  X,
  UploadSimple,
  Trash,
  Globe,
  Record,
  Square,
} from "@phosphor-icons/react";
import { useApiCaptureStore } from "@/lib/api-capture/store";
import type { ApiSkill, Endpoint, SiteApiContract } from "@/lib/api-capture/api";
import { getCaptureAdapter } from "@/lib/api-capture/adapter";
import { useBrowserAgentStore } from "@/capsules/browser/browserAgent.store";
import { cn } from "@/lib/utils";

type TeachPhase = "idle" | "recording" | "saving";

function methodTone(method: string): string {
  const m = method.toUpperCase();
  if (m === "GET") return "text-[var(--status-info)]";
  if (m === "POST") return "text-[var(--accent-primary)]";
  if (m === "PUT" || m === "PATCH") return "text-[var(--status-warning)]";
  if (m === "DELETE") return "text-[var(--status-error)]";
  return "text-[var(--text-tertiary)]";
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function skillForContract(skills: ApiSkill[], contractId: string | null): ApiSkill | null {
  if (!contractId) return null;
  return skills.find((skill) => skill.contractId === contractId) ?? null;
}

export function ApiCaptureView() {
  Robot,
  ArrowSquareOut,
  Record,
  CaretDown,
  CaretRight,
} from "@phosphor-icons/react";
import { useApiCaptureStore } from "@/lib/api-capture/store";
import { armBrowserCapture } from "@/lib/api-capture/arm";
import type { Endpoint, Param, ReplayInput, ReplayResult, SiteApiContract } from "@/lib/api-capture/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CLIENT_LANGUAGES = [
  { value: "python", label: "Python" },
  { value: "typescript", label: "TypeScript" },
  { value: "curl", label: "cURL" },
] as const;

interface ApiCaptureViewProps {
  /** Render in a narrow sidepanel-friendly layout. */
  compact?: boolean;
}

export function ApiCaptureView({ compact = false }: ApiCaptureViewProps) {
  const {
    contracts,
    selectedContractId,
    apiSkills,
    error,
    ingestHarFile,
    selectContract,
    publishAsSkill,
    deleteContract,
    clearError,
    fetchContracts,
  } = useApiCaptureStore();

  const [phase, setPhase] = useState<TeachPhase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [teachError, setTeachError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [draftName, setDraftName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchContracts();
  }, [fetchContracts]);

  useEffect(() => {
    if (phase !== "recording") return;
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.id === selectedContractId) || null,
    () => contracts.find((c) => c.id === selectedContractId) || null,
    [contracts, selectedContractId],
  );
  const selectedSkill = skillForContract(apiSkills, selectedContractId);

  const openBrowserForTeach = useCallback(() => {
    window.dispatchEvent(new CustomEvent("allternit:open-view", { detail: { viewType: "browser" } }));
    window.dispatchEvent(new CustomEvent("allternit:agent-pane-tab", { detail: { tab: "site-apis" } }));
  }, []);
  const selectedEndpoint = useMemo(
    () => selectedContract?.endpoints.find((e) => e.id === selectedEndpointId) || null,
    [selectedContract, selectedEndpointId],
  );

  const startTeach = useCallback(async () => {
    setTeachError(null);
    clearError();
    openBrowserForTeach();
    const adapter = getCaptureAdapter();
    if (adapter.name === "upload") {
      fileInputRef.current?.click();
      return;
    }
    try {
      setPhase("recording");
      const result = await adapter.start();
      setSessionId(result.sessionId);
    } catch (err) {
      setPhase("idle");
      setTeachError(err instanceof Error ? err.message : "Could not start recording");
    }
  }, [clearError, openBrowserForTeach]);

  const stopTeach = useCallback(async () => {
    if (!sessionId) {
      setPhase("idle");
      return;
    }
    setPhase("saving");
    try {
      const adapter = getCaptureAdapter();
      const result = await adapter.stop(sessionId);
      await ingestHarFile(result.har, adapter.name === "desktop" ? "aci" : "browser");
      const state = useApiCaptureStore.getState();
      if (state.error) throw new Error(state.error);
      const contract = state.contracts.find((item) => item.id === state.selectedContractId);
      if (contract) {
        const name = `${contract.domain} walkthrough`;
        await publishAsSkill(
          contract.id,
          name,
          `Taught path on ${contract.domain} · ${contract.endpoints.length} step${contract.endpoints.length === 1 ? "" : "s"}.`,
        );
        setDraftName(name);
      }
      setSessionId(null);
      setPhase("idle");
    } catch (err) {
      setPhase("recording");
      setTeachError(err instanceof Error ? err.message : "Could not save the recording");
    }
  }, [ingestHarFile, publishAsSkill, sessionId]);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/json" && !file.name.endsWith(".har")) return;
      const text = await file.text();
      await ingestHarFile(text, "upload");
      const state = useApiCaptureStore.getState();
      if (state.error) throw new Error(state.error);
      const contract = state.contracts.find((item) => item.id === state.selectedContractId);
      if (contract) {
        const name = `${contract.domain} walkthrough`;
        await publishAsSkill(
          contract.id,
          name,
          `Imported recording for ${contract.domain} · ${contract.endpoints.length} step${contract.endpoints.length === 1 ? "" : "s"}.`,
        );
        setDraftName(name);
      }
    },
    [ingestHarFile, publishAsSkill],
    [ingestHarFile],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setUploadDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const replayWithAgent = useCallback((contract: SiteApiContract, skill: ApiSkill | null) => {
    const steps = contract.endpoints
      .map((endpoint, index) => `${index + 1}. ${endpoint.method} ${endpoint.path_template || endpoint.path}`)
      .join("\n");
    const name = skill?.name || `${contract.domain} walkthrough`;
    useBrowserAgentStore.getState().startAciSession(
      `Replay the taught skill "${name}" on ${contract.domain}. Follow this path:\n${steps}`,
    );
  }, []);

  const saveName = useCallback(async () => {
    if (!selectedContract || !draftName.trim()) return;
    await publishAsSkill(
      selectedContract.id,
      draftName.trim(),
      selectedSkill?.description || `Taught path on ${selectedContract.domain}.`,
    );
  }, [draftName, publishAsSkill, selectedContract, selectedSkill]);

  const isEmpty = apiSkills.length === 0 && contracts.length === 0 && phase === "idle";

  return (
    <div className="flex h-full w-full min-h-0 overflow-hidden bg-[var(--shell-view-bg)]">
      <style>{`
        @keyframes teach-pulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--status-error) 45%, transparent); }
          50% { box-shadow: 0 0 0 10px transparent; }
        }
      `}</style>
      <input
        ref={fileInputRef}
        type="file"
        accept=".har,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.currentTarget.value = "";
        }}
      />

      {apiSkills.length > 0 || contracts.length > 0 ? (
        <aside className="w-[240px] shrink-0 border-r border-solid border-[var(--border-subtle)] flex flex-col min-h-0">
          <div className="px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Taught
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
            {apiSkills.map((skill) => (
              <button
                key={skill.id}
                type="button"
                onClick={() => selectContract(skill.contractId)}
                className={cn(
                  "w-full text-left rounded-lg px-2.5 py-2 border-none cursor-pointer",
                  selectedContractId === skill.contractId
                    ? "bg-[var(--accent-primary)]/12 text-[var(--text-primary)]"
                    : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
                )}
              >
                <div className="text-[13px] font-medium truncate">{skill.name}</div>
                <div className="text-[11px] text-[var(--text-tertiary)] truncate mt-0.5">
                  {skill.domain} · {skill.endpoints.length}
                </div>
              </button>
            ))}
            {contracts
              .filter((contract) => !apiSkills.some((skill) => skill.contractId === contract.id))
              .map((contract) => (
                <button
                  key={contract.id}
                  type="button"
                  onClick={() => selectContract(contract.id)}
                  className={cn(
                    "w-full text-left rounded-lg px-2.5 py-2 border-none cursor-pointer",
                    selectedContractId === contract.id
                      ? "bg-[var(--accent-primary)]/12 text-[var(--text-primary)]"
                      : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
                  )}
                >
                  <div className="text-[13px] font-medium truncate">{contract.domain}</div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">unsaved · {contract.endpoints.length}</div>
                </button>
              ))}
    <div className={cn("flex flex-col h-full w-full bg-[var(--shell-view-bg)] overflow-hidden", compact && "text-[13px]")}>
      {/* Header */}
      <header className={cn(
        "shrink-0 border-b border-solid border-[var(--border-subtle)] flex items-center justify-between bg-gradient-to-r from-[var(--accent-primary)]/5 via-transparent to-transparent",
        compact ? "px-4 py-3" : "px-6 py-5"
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center border border-solid border-[var(--accent-primary)]/20 shadow-[0_4px_20px_var(--accent-primary)/10] shrink-0",
            compact ? "size-9" : "size-11"
          )}>
            <Plugs size={compact ? 18 : 22} weight="duotone" className="text-[var(--accent-primary)]" />
          </div>
          <div className="min-w-0">
            <h1 className={cn("font-bold m-0 tracking-tight text-[var(--text-primary)] truncate", compact ? "text-[16px]" : "text-[22px]")}>
              Site APIs
            </h1>
            {!compact && (
              <p className="text-[13px] text-[var(--text-secondary)] m-0 truncate">
                HAR-derived API contracts, replay playground, and agent client generation
              </p>
            )}
          </div>
        </aside>
      ) : null}

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {phase === "recording" || phase === "saving" ? (
          <RecordingStage
            phase={phase}
            elapsed={elapsed}
            error={teachError}
            onStop={() => void stopTeach()}
          />
        ) : isEmpty ? (
          <EmptyTeach
            error={teachError || error}
            onTeach={() => void startTeach()}
            onImport={() => fileInputRef.current?.click()}
            onDismissError={() => {
              setTeachError(null);
              clearError();
            }}
          />
        ) : selectedContract ? (
          <Walkthrough
            contract={selectedContract}
            skill={selectedSkill}
            draftName={draftName || selectedSkill?.name || `${selectedContract.domain} walkthrough`}
            onDraftName={setDraftName}
            onSaveName={() => void saveName()}
            onReplay={() => replayWithAgent(selectedContract, selectedSkill)}
            onTeachAgain={() => void startTeach()}
            onDelete={() => {
              deleteContract(selectedContract.id);
            }}
            onImport={() => fileInputRef.current?.click()}
          />
        ) : (
          <EmptyTeach
            error={teachError || error}
            onTeach={() => void startTeach()}
            onImport={() => fileInputRef.current?.click()}
            onDismissError={() => {
              setTeachError(null);
              clearError();
            }}
          />
        )}
      </div>
    </div>
  );
}

function EmptyTeach({
  error,
  onTeach,
  onImport,
  onDismissError,
}: {
  error: string | null;
  onTeach: () => void;
  onImport: () => void;
  onDismissError: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      {error && (
        <div className="mb-6 max-w-[420px] w-full rounded-lg border border-solid border-[var(--status-error)]/25 bg-[var(--status-error)]/8 px-3 py-2 text-[12px] text-[var(--status-error)] flex items-start gap-2 text-left">
          <Warning size={14} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={onDismissError} className="border-none bg-transparent p-0 cursor-pointer text-current">
            <X size={14} />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={onTeach}
        aria-label="Show the agent this site"
        className="size-[72px] rounded-full border-none cursor-pointer flex items-center justify-center bg-[var(--status-error)] text-white transition-transform hover:scale-[1.04]"
      >
        <Record size={28} weight="fill" />
      </button>
      <h1 className="mt-5 mb-1 text-[20px] font-semibold tracking-tight text-[var(--text-primary)]">
        Show the agent this site
      </h1>
      <p className="m-0 max-w-[340px] text-[13px] leading-relaxed text-[var(--text-secondary)]">
        Click through the flow once. We record the path and save it as a skill the agent can replay.
      </p>
      <button
        type="button"
        onClick={onImport}
        className="mt-5 border-none bg-transparent cursor-pointer text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
      >
        Import a recording
      </button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <UploadSimple size={16} />
            {!compact && "Upload HAR"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void fetchSessions();
              void fetchContracts();
            }}
            disabled={isLoadingSessions || isLoadingContracts}
            className="gap-2"
          >
            <ArrowsClockwise size={16} className={isLoadingSessions || isLoadingContracts ? "animate-spin" : ""} />
            {!compact && "Refresh"}
          </Button>
        </div>
      </header>

      {/* Error toast */}
      {error && (
        <div className="shrink-0 mx-6 mt-4 p-3 px-4 rounded-lg bg-[var(--status-error-bg)] border border-solid border-[var(--status-error)]/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] text-[var(--status-error)]">
            <Warning size={16} weight="bold" />
            {error}
          </div>
          <button type="button" onClick={clearError} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className={cn("flex-1 overflow-hidden flex min-h-0", compact && "flex-col")}>
        {/* Left sidebar */}
        <div className={cn(
          "shrink-0 border-r border-solid border-[var(--border-subtle)] overflow-y-auto p-4 space-y-5",
          compact ? "w-full border-r-0 border-b" : "w-[340px]"
        )}>
          {/* Capture launcher */}
          <CaptureLauncher compact={compact} />

          {/* Upload dropzone */}
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "rounded-xl border border-dashed text-center cursor-pointer transition-colors",
              compact ? "p-3" : "p-4",
              uploadDragging
                ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5"
                : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)]"
            )}
          >
            <div className={cn("rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center mx-auto mb-2", compact ? "size-8" : "size-10")}>
              <FileJson size={compact ? 16 : 20} className="text-[var(--accent-primary)]" />
            </div>
            <p className="text-[13px] font-semibold text-[var(--text-primary)] m-0">
              Drop a HAR file here
            </p>
            <p className="text-[11px] text-[var(--text-tertiary)] m-0 mt-1">
              or click to browse
            </p>
          </div>

          <section>
            <h2 className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[var(--text-tertiary)] mb-3">
              Capture Sessions
            </h2>
            {isLoadingSessions && sessions.length === 0 ? (
              <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] py-2">
                <Spinner size={16} className="animate-spin" />
                Loading sessions…
              </div>
            ) : sessions.length === 0 ? (
              <EmptyState compact={compact}>
                No active capture sessions. Upload a HAR or start capture from the ACI browser.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] text-[13px]"
                  >
                    <div className="font-semibold text-[var(--text-primary)] truncate">{session.domain}</div>
                    <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5 flex items-center gap-2">
                      <span className="capitalize">{session.source}</span>
                      <StatusBadge status={session.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[var(--text-tertiary)] mb-3">
              Contracts by Domain
            </h2>
            {isLoadingContracts && contracts.length === 0 ? (
              <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] py-2">
                <Spinner size={16} className="animate-spin" />
                Loading contracts…
              </div>
            ) : contracts.length === 0 ? (
              <EmptyState compact={compact}>
                No derived contracts yet. Upload a HAR to extract one.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-4">
                {Array.from(contractsByDomain.entries()).map(([domain, domainContracts]) => (
                  <div key={domain}>
                    <div className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 truncate flex items-center gap-1.5">
                      <Globe size={12} />
                      {domain}
                    </div>
                    <div className="flex flex-col gap-1">
                      {domainContracts.map((contract) => (
                        <button
                          key={contract.id}
                          type="button"
                          onClick={() => selectContract(contract.id)}
                          className={`text-left px-3 py-2 rounded-lg border text-[12px] transition-colors ${
                            selectedContractId === contract.id
                              ? "bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30 text-[var(--accent-primary)] font-semibold"
                              : "bg-transparent border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {contract.endpoints.length} endpoint{contract.endpoints.length === 1 ? "" : "s"}
                          <span className="block text-[11px] text-[var(--text-tertiary)] mt-0.5">
                            {new Date(contract.derived_at).toLocaleString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Center/right: contract detail + replay */}
        <div className="flex-1 overflow-y-auto p-6 min-w-0">
          {!selectedContract ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)]">
              <Plugs size={compact ? 32 : 48} weight="thin" className="mb-3 opacity-50" />
              <p className="text-[14px]">Select a contract to inspect endpoints, replay requests, and generate clients.</p>
            </div>
          ) : (
            <ContractDetail
              contract={selectedContract}
              selectedEndpoint={selectedEndpoint}
              onSelectEndpoint={selectEndpoint}
              isReplaying={isReplaying}
              replayResult={replayResult}
              isGenerating={isGenerating}
              generatedClient={generatedClient}
              isPublishingSkill={isPublishingSkill}
              publishSkillSuccess={publishSkillSuccess}
              onReplay={(input) => replaySelectedEndpoint(input)}
              onGenerateClient={(language) => generateClientForSelected(language)}
              onPublishAsSkill={(name, description) => publishAsSkill(selectedContract.id, name, description).then(() => undefined)}
              onDelete={() => deleteContract(selectedContract.id)}
              onClearGeneratedClient={clearGeneratedClient}
              onClearPublishSkillSuccess={clearPublishSkillSuccess}
              compact={compact}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function RecordingStage({
  phase,
  elapsed,
  error,
  onStop,
}: {
  phase: TeachPhase;
  elapsed: number;
  error: string | null;
  onStop: () => void;
}) {
  const saving = phase === "saving";
function EmptyState({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={cn("rounded-lg bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] text-[var(--text-secondary)]", compact ? "p-2.5 text-[12px]" : "p-3 text-[13px]")}>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "finished" || status === "completed"
      ? "text-[var(--status-success)] bg-[var(--status-success)]/10"
      : status === "failed"
      ? "text-[var(--status-error)] bg-[var(--status-error)]/10"
      : "text-[var(--status-warning)] bg-[var(--status-warning)]/10";

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div
        className="size-[72px] rounded-full flex items-center justify-center bg-[var(--status-error)] text-white"
        style={saving ? undefined : { animation: "teach-pulse 1.6s ease-out infinite" }}
      >
        {saving ? <Spinner size={28} className="animate-spin" /> : <Record size={28} weight="fill" />}
      </div>
      <p className="mt-5 mb-1 text-[20px] font-semibold text-[var(--text-primary)]">
        {saving ? "Saving the path…" : "Recording"}
      </p>
      <p className="m-0 font-mono text-[13px] text-[var(--text-tertiary)]">{formatElapsed(elapsed)}</p>
      <p className="mt-2 mb-0 max-w-[320px] text-[13px] leading-relaxed text-[var(--text-secondary)]">
        {saving
          ? "Distilling the walkthrough into a skill."
          : "Do the flow in the browser. Stop when the agent should know it."}
      </p>
      {error && <p className="mt-3 text-[12px] text-[var(--status-error)]">{error}</p>}
      {!saving && (
        <button
          type="button"
          onClick={onStop}
          className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 border-none cursor-pointer bg-[var(--text-primary)] text-[var(--bg-elevated)] text-[13px] font-semibold"
        >
          <Square size={12} weight="fill" />
          Stop
        </button>
      )}
    </div>
  );
}

function Walkthrough({
interface CaptureLauncherProps {
  compact?: boolean;
}

function CaptureLauncher({ compact }: CaptureLauncherProps) {
  const [url, setUrl] = useState("");

  const handleOpenAndCapture = () => {
    const trimmed = url.trim();
    let domain: string | undefined;
    if (trimmed) {
      try {
        domain = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`).hostname;
      } catch {
        domain = trimmed;
      }
    }
    armBrowserCapture({ domain, url: trimmed || undefined });
  };

  return (
    <div className={cn("rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden", compact ? "p-3" : "p-4")}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center shrink-0", compact ? "size-7" : "size-8")}>
          <Record size={compact ? 14 : 16} weight="fill" className="text-[var(--accent-primary)]" />
        </div>
        <div className="min-w-0">
          <div className={cn("font-semibold text-[var(--text-primary)]", compact ? "text-[13px]" : "text-[14px]")}>
            Record a workflow
          </div>
          <div className="text-[11px] text-[var(--text-tertiary)] truncate">
            Open the ACI browser and capture API calls
          </div>
        </div>
      </div>

      <div className={cn("flex gap-2", compact && "flex-col")}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleOpenAndCapture(); }}
          placeholder="https://example.com or domain"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
        />
        <Button
          size="sm"
          onClick={handleOpenAndCapture}
          className="gap-1.5 shrink-0"
        >
          <ArrowSquareOut size={14} />
          {compact ? "Capture" : "Open browser & capture"}
        </Button>
      </div>

      <p className="mt-2 text-[11px] text-[var(--text-tertiary)] leading-relaxed">
        Tip: live capture needs the Allternit Desktop shell. In a browser tab you can still upload a HAR file.
      </p>
    </div>
  );
}

interface ContractDetailProps {
  contract: SiteApiContract;
  selectedEndpoint: Endpoint | null;
  onSelectEndpoint: (id: string | null) => void;
  isReplaying: boolean;
  replayResult: ReplayResult | null;
  isGenerating: boolean;
  generatedClient: { language: string; code: string; notes: string[] } | null;
  isPublishingSkill: boolean;
  publishSkillSuccess: string | null;
  onReplay: (input: ReplayInput) => Promise<ReplayResult>;
  onGenerateClient: (language: "python" | "typescript" | "curl") => Promise<void>;
  onPublishAsSkill: (name: string, description: string) => Promise<void>;
  onDelete: () => void;
  onClearGeneratedClient: () => void;
  onClearPublishSkillSuccess: () => void;
  compact?: boolean;
}

function ContractDetail({
  contract,
  skill,
  draftName,
  onDraftName,
  onSaveName,
  onReplay,
  onTeachAgain,
  onDelete,
  onImport,
}: {
  contract: SiteApiContract;
  skill: ApiSkill | null;
  draftName: string;
  onDraftName: (value: string) => void;
  onSaveName: () => void;
  onReplay: () => void;
  onTeachAgain: () => void;
  onDelete: () => void;
  onImport: () => void;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="shrink-0 px-6 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <input
            value={draftName}
            onChange={(event) => onDraftName(event.target.value)}
            onBlur={onSaveName}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            className="w-full max-w-[420px] bg-transparent border-none outline-none text-[18px] font-semibold tracking-tight text-[var(--text-primary)] p-0"
          />
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)]">
            <Globe size={12} />
            <span className="truncate">{contract.domain}</span>
            <span>·</span>
            <span>
              {contract.endpoints.length} step{contract.endpoints.length === 1 ? "" : "s"}
            </span>
  onClearGeneratedClient,
  onClearPublishSkillSuccess,
  compact,
}: ContractDetailProps) {
  const [clientLanguage, setClientLanguage] = useState<"python" | "typescript" | "curl">("python");
  const [copied, setCopied] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [skillDescription, setSkillDescription] = useState("");
  const [showSkillForm, setShowSkillForm] = useState(false);

  return (
    <div className={cn("flex flex-col gap-6", compact ? "max-w-full" : "max-w-5xl")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Globe size={14} className="text-[var(--text-tertiary)] shrink-0" />
            <h2 className="text-[18px] font-bold text-[var(--text-primary)] m-0 truncate">{contract.domain}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onReplay}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border-none cursor-pointer bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-[12px] font-semibold"
        <div className={cn("flex items-center gap-2 shrink-0", compact && "flex-wrap justify-end")}>
          <select
            value={clientLanguage}
            onChange={(e) => setClientLanguage(e.target.value as typeof clientLanguage)}
            className="h-8 px-2 rounded-lg bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none"
          >
            {CLIENT_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={isGenerating}
            onClick={() => void onGenerateClient(clientLanguage)}
            className="gap-1.5"
          >
            <Play size={12} weight="fill" />
            Replay
          </button>
          <button
            type="button"
            onClick={onTeachAgain}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-solid border-[var(--border-default)] bg-transparent cursor-pointer text-[12px] text-[var(--text-secondary)]"
          >
            <Record size={12} weight="fill" />
            Teach again
          </button>
          <button
            type="button"
            onClick={onImport}
            className="size-8 rounded-lg border border-solid border-[var(--border-default)] bg-transparent cursor-pointer text-[var(--text-tertiary)] inline-flex items-center justify-center"
            title="Import a recording"
          >
            <UploadSimple size={14} />
          </button>
            <Trash size={16} />
          </Button>
        </div>
      </div>

      {showSkillForm && (
        <div className="rounded-xl border border-solid border-[var(--border-subtle)] p-4 bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-2 mb-3 text-[13px] font-semibold text-[var(--text-primary)]">
            <Robot size={16} className="text-[var(--accent-primary)]" />
            Publish captured workflow as agent skill
          </div>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-[12px] text-[var(--text-secondary)]">
              Skill name
              <input
                type="text"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder={`${contract.domain} API workflow`}
                className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-[var(--text-secondary)]">
              Description
              <textarea
                value={skillDescription}
                onChange={(e) => setSkillDescription(e.target.value)}
                placeholder="What this workflow does and when the agent should use it"
                rows={3}
                className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] resize-none"
              />
            </label>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={isPublishingSkill || !skillName.trim()}
                onClick={() => {
                  void onPublishAsSkill(skillName, skillDescription).then(() => {
                    setSkillName("");
                    setSkillDescription("");
                    setShowSkillForm(false);
                  });
                }}
              >
                {isPublishingSkill ? <Spinner size={14} className="animate-spin" /> : <Robot size={14} />}
                Publish skill
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowSkillForm(false);
                  setSkillName("");
                  setSkillDescription("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {publishSkillSuccess && (
        <div className="p-3 rounded-lg bg-[var(--status-success)]/10 border border-solid border-[var(--status-success)]/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] text-[var(--status-success)]">
            <CheckCircle size={16} weight="fill" />
            Published <strong>{publishSkillSuccess}</strong> to the Skills Registry.
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="size-8 rounded-lg border-none bg-transparent cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--status-error)] inline-flex items-center justify-center"
            title="Delete"
          >
            <Trash size={14} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <ol className="m-0 p-0 list-none max-w-[560px]">
          {contract.endpoints.map((endpoint, index) => (
            <StepRow key={endpoint.id} index={index} endpoint={endpoint} isLast={index === contract.endpoints.length - 1} />
      )}

      {generatedClient && (
        <div className="rounded-xl border border-solid border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-secondary)]">
          <div className="px-4 py-3 border-b border-solid border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-secondary)]">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
              <Code size={16} className="text-[var(--accent-primary)]" />
              Generated {generatedClient.language} client
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(generatedClient.code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="gap-1.5 h-7 text-[12px]"
              >
                {copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="ghost" onClick={onClearGeneratedClient} className="h-7 px-2">
                <X size={14} />
              </Button>
            </div>
          </div>
          <div className="p-0">
            <pre className="text-[12px] font-mono text-[var(--text-secondary)] overflow-auto max-h-[360px] m-0 p-4 bg-[var(--bg-primary)]">
              {generatedClient.code}
            </pre>
          </div>
          {generatedClient.notes.length > 0 && (
            <div className="px-4 py-3 border-t border-solid border-[var(--border-subtle)] space-y-1">
              {generatedClient.notes.map((note, i) => (
                <p key={i} className="text-[11px] text-[var(--text-tertiary)] m-0 flex items-start gap-2">
                  <Warning size={12} className="shrink-0 mt-0.5" />
                  {note}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          Endpoints
        </h3>
        <div className="flex flex-col gap-2">
          {contract.endpoints.map((endpoint) => (
            <EndpointCard
              key={endpoint.id}
              endpoint={endpoint}
              isSelected={selectedEndpoint?.id === endpoint.id}
              onToggle={() => onSelectEndpoint(selectedEndpoint?.id === endpoint.id ? null : endpoint.id)}
              compact={compact}
            />
          ))}
        </ol>
        {contract.endpoints.length === 0 && (
          <p className="text-[13px] text-[var(--text-tertiary)]">No steps in this recording.</p>
        )}
      </div>

      {selectedEndpoint && (
        <ReplayForm
          endpoint={selectedEndpoint}
          isReplaying={isReplaying}
          replayResult={replayResult}
          onReplay={(input) => onReplay(input)}
          compact={compact}
        />
      )}
    </div>
  );
}

function StepRow({ endpoint, index, isLast }: { endpoint: Endpoint; index: number; isLast: boolean }) {
  return (
    <li className="relative flex gap-3 pb-4">
      {!isLast && <span className="absolute left-[11px] top-6 bottom-0 w-px bg-[var(--border-subtle)]" />}
      <span className="relative z-[1] mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--bg-elevated)] border border-solid border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-tertiary)]">
        {index + 1}
      </span>
      <div className="min-w-0 pt-0.5">
        <div className="flex items-center gap-2">
          <span className={cn("text-[11px] font-bold tracking-wide", methodTone(endpoint.method))}>
            {endpoint.method}
          </span>
          <span className="text-[13px] font-mono text-[var(--text-primary)] truncate">
            {endpoint.path_template || endpoint.path}
          </span>
        </div>
        {endpoint.summary && (
          <div className="mt-0.5 text-[12px] text-[var(--text-tertiary)] truncate">{endpoint.summary}</div>
interface EndpointCardProps {
  endpoint: Endpoint;
  isSelected: boolean;
  onToggle: () => void;
  compact?: boolean;
}

function EndpointCard({ endpoint, isSelected, onToggle, compact }: EndpointCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-xl border border-solid transition-colors overflow-hidden",
        isSelected
          ? "border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5"
          : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)]"
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        <Badge variant="outline" className="font-semibold text-[var(--accent-primary)] border-[var(--accent-primary)]/30 shrink-0">
          {endpoint.method}
        </Badge>
        <code className="flex-1 min-w-0 text-[13px] font-mono text-[var(--text-primary)] truncate">
          {endpoint.path_template || endpoint.path}
        </code>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-[var(--text-tertiary)]">
            {endpoint.query_params.length + endpoint.path_params.length + endpoint.headers.length} params
          </span>
          {expanded ? <CaretDown size={14} className="text-[var(--text-tertiary)]" /> : <CaretRight size={14} className="text-[var(--text-tertiary)]" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-solid border-[var(--border-subtle)]">
          <div className={cn("grid gap-3 pt-3", compact ? "grid-cols-1" : "grid-cols-2")}>
            <ParamGroup title="Query" params={endpoint.query_params} />
            <ParamGroup title="Path" params={endpoint.path_params} />
            <ParamGroup title="Headers" params={endpoint.headers} />
            {endpoint.body_template && (
              <div className={cn("col-span-full", compact && "col-span-1")}>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-1.5">Body</div>
                <pre className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-primary)] p-2 rounded-lg overflow-auto max-h-[160px]">
                  {endpoint.body_template}
                </pre>
              </div>
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant={isSelected ? "default" : "outline"} onClick={onToggle}>
              {isSelected ? "Close replay" : "Replay"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ParamGroup({ title, params }: { title: string; params: Param[] }) {
  if (params.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-1.5">{title}</div>
      <div className="flex flex-wrap gap-1">
        {params.map((p) => (
          <ParamChip key={p.name} param={p} />
        ))}
      </div>
    </div>
  );
}

function ParamChip({ param }: { param: Param }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border",
        param.templated
          ? "bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/20 text-[var(--accent-primary)]"
          : "bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-secondary)]"
      )}
      title={`${param.name}=${param.value}${param.suggested_default ? ` (default: ${param.suggested_default})` : ""}`}
    >
      {param.name}
    </span>
  );
}

interface ReplayFormProps {
  endpoint: Endpoint;
  isReplaying: boolean;
  replayResult: ReplayResult | null;
  onReplay: (input: ReplayInput) => Promise<ReplayResult>;
  compact?: boolean;
}

function ReplayForm({ endpoint, isReplaying, replayResult, onReplay, compact }: ReplayFormProps) {
  const pathMatches = (endpoint.path_template || endpoint.path).match(/\{(\w+)\}/g) || [];
  const pathParamKeys = pathMatches.map((m) => m.slice(1, -1));

  const [pathParams, setPathParams] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      pathParamKeys.map((k) => {
        const param = endpoint.path_params.find((p) => p.name === k);
        return [k, param?.suggested_default || ""];
      })
    )
  );
  const [queryParams, setQueryParams] = useState<Record<string, string>>(() =>
    Object.fromEntries(endpoint.query_params.filter((p) => !p.templated).map((p) => [p.name, p.value]))
  );
  const [body, setBody] = useState<string>(() => {
    if (endpoint.body_template) {
      try {
        return JSON.stringify(JSON.parse(endpoint.body_template), null, 2);
      } catch {
        return endpoint.body_template;
      }
    }
    return "";
  });
  const [headers, setHeaders] = useState<Array<{ name: string; value: string }>>(() =>
    endpoint.headers.filter((h) => !h.templated).map((h) => ({ name: h.name, value: h.value }))
  );
  const [queryKey, setQueryKey] = useState("");
  const [queryValue, setQueryValue] = useState("");
  const [headerName, setHeaderName] = useState("");
  const [headerValue, setHeaderValue] = useState("");

  const handleReplay = () => {
    let parsedBody: unknown = null;
    if (body.trim()) {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        parsedBody = body;
      }
    }
    void onReplay({
      path_params: pathParams,
      query_params: queryParams,
      body: parsedBody,
      headers,
    });
  };

  return (
    <div className="rounded-xl border border-solid border-[var(--border-subtle)] p-5 bg-[var(--bg-secondary)]">
      <h3 className="text-[14px] font-bold text-[var(--text-primary)] m-0 mb-4 flex items-center gap-2">
        <Play size={16} weight="fill" className="text-[var(--accent-primary)]" />
        Replay {endpoint.method} {endpoint.path_template || endpoint.path}
      </h3>

      <div className="flex flex-col gap-5">
        {pathParamKeys.length > 0 && (
          <div className={cn("grid gap-3", compact ? "grid-cols-1" : "grid-cols-2")}>
            {pathParamKeys.map((key) => (
              <label key={key} className="flex flex-col gap-1 text-[12px] text-[var(--text-secondary)]">
                Path param: <code className="text-[var(--text-primary)]">{key}</code>
                <input
                  type="text"
                  value={pathParams[key] || ""}
                  onChange={(e) => setPathParams((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="mt-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                />
              </label>
            ))}
          </div>
        )}

        <KeyValueEditor
          title="Query Parameters"
          items={queryParams}
          onAdd={(k, v) => setQueryParams((prev) => ({ ...prev, [k]: v }))}
          onRemove={(k) => setQueryParams((prev) => {
            const next = { ...prev };
            delete next[k];
            return next;
          })}
          keyPlaceholder="key"
          valuePlaceholder="value"
        />

        <KeyValueEditor
          title="Headers"
          items={Object.fromEntries(headers.map((h) => [h.name, h.value]))}
          onAdd={(k, v) => setHeaders((prev) => [...prev, { name: k, value: v }])}
          onRemove={(k) => setHeaders((prev) => prev.filter((h) => h.name !== k))}
          keyPlaceholder="name"
          valuePlaceholder="value"
        />

        <label className="flex flex-col gap-1 text-[12px] text-[var(--text-secondary)]">
          Request Body
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] font-mono"
          />
        </label>

        <button
          type="button"
          onClick={handleReplay}
          disabled={isReplaying}
          className="self-start flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-[13px] font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isReplaying ? <Spinner size={16} className="animate-spin" /> : <Play size={16} weight="fill" />}
          {isReplaying ? "Replaying…" : "Send Replay"}
        </button>

        {replayResult && (
          <div className="mt-2 p-4 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 mb-2 text-[13px] font-semibold">
              {replayResult.status >= 200 && replayResult.status < 300 ? (
                <CheckCircle size={16} weight="fill" className="text-[var(--status-success)]" />
              ) : replayResult.status === 0 ? (
                <Warning size={16} weight="fill" className="text-[var(--status-error)]" />
              ) : (
                <Warning size={16} weight="fill" className="text-amber-500" />
              )}
              Status {replayResult.status}
              {replayResult.error && <span className="text-[var(--status-error)] font-normal">— {replayResult.error}</span>}
            </div>
            <pre className="text-[12px] font-mono text-[var(--text-secondary)] overflow-auto max-h-[240px] m-0">
              {JSON.stringify(replayResult.body, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </li>
  );
}

interface KeyValueEditorProps {
  title: string;
  items: Record<string, string>;
  onAdd: (key: string, value: string) => void;
  onRemove: (key: string) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
}

function KeyValueEditor({ title, items, onAdd, onRemove, keyPlaceholder, valuePlaceholder }: KeyValueEditorProps) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  return (
    <div>
      <div className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">{title}</div>
      <div className="flex flex-wrap gap-2 mb-2">
        {Object.entries(items).map(([k, v]) => (
          <span
            key={k}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[12px]"
          >
            {k}={v}
            <button
              type="button"
              onClick={() => onRemove(k)}
              className="text-[var(--text-tertiary)] hover:text-[var(--status-error)]"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={keyPlaceholder}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
        />
        <input
          type="text"
          placeholder={valuePlaceholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
        />
        <button
          type="button"
          onClick={() => {
            if (!key) return;
            onAdd(key, value);
            setKey("");
            setValue("");
          }}
          className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default ApiCaptureView;
