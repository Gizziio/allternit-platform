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
    [contracts, selectedContractId],
  );
  const selectedSkill = skillForContract(apiSkills, selectedContractId);

  const openBrowserForTeach = useCallback(() => {
    window.dispatchEvent(new CustomEvent("allternit:open-view", { detail: { viewType: "browser" } }));
    window.dispatchEvent(new CustomEvent("allternit:agent-pane-tab", { detail: { tab: "site-apis" } }));
  }, []);

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
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onReplay}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border-none cursor-pointer bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-[12px] font-semibold"
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
          ))}
        </ol>
        {contract.endpoints.length === 0 && (
          <p className="text-[13px] text-[var(--text-tertiary)]">No steps in this recording.</p>
        )}
      </div>
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
        )}
      </div>
    </li>
  );
}

export default ApiCaptureView;
