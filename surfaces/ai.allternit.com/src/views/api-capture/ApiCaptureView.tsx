"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plugs,
  Play,
  Spinner,
  ArrowsClockwise,
  CheckCircle,
  Warning,
  X,
  UploadSimple,
  FileText as FileJson,
  Code,
  Copy,
  Trash,
  Globe,
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
    sessions,
    contracts,
    selectedContractId,
    selectedEndpointId,
    isLoadingSessions,
    isLoadingContracts,
    isReplaying,
    replayResult,
    isGenerating,
    generatedClient,
    isPublishingSkill,
    publishSkillSuccess,
    error,
    fetchSessions,
    fetchContracts,
    ingestHarFile,
    selectContract,
    selectEndpoint,
    replaySelectedEndpoint,
    generateClientForSelected,
    publishAsSkill,
    deleteContract,
    clearError,
    clearGeneratedClient,
    clearPublishSkillSuccess,
  } = useApiCaptureStore();

  const [uploadDragging, setUploadDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchSessions();
    void fetchContracts();
  }, [fetchSessions, fetchContracts]);

  const selectedContract = useMemo(
    () => contracts.find((c) => c.id === selectedContractId) || null,
    [contracts, selectedContractId],
  );

  const selectedEndpoint = useMemo(
    () => selectedContract?.endpoints.find((e) => e.id === selectedEndpointId) || null,
    [selectedContract, selectedEndpointId],
  );

  const contractsByDomain = useMemo(() => {
    const map = new Map<string, SiteApiContract[]>();
    for (const contract of contracts) {
      const list = map.get(contract.domain) || [];
      list.push(contract);
      map.set(contract.domain, list);
    }
    return map;
  }, [contracts]);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/json" && !file.name.endsWith(".har")) {
        // eslint-disable-next-line no-console
        console.warn("Expected HAR JSON file");
        return;
      }
      const text = await file.text();
      await ingestHarFile(text, "upload");
    },
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

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setUploadDragging(true);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setUploadDragging(false);
  }, []);

  return (
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
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".har,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.currentTarget.value = "";
            }}
          />
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
    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${color}`}>
      {status}
    </span>
  );
}

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
  selectedEndpoint,
  onSelectEndpoint,
  isReplaying,
  replayResult,
  isGenerating,
  generatedClient,
  isPublishingSkill,
  publishSkillSuccess,
  onReplay,
  onGenerateClient,
  onPublishAsSkill,
  onDelete,
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
          <p className="text-[13px] text-[var(--text-secondary)] m-0">
            {contract.endpoints.length} endpoint{contract.endpoints.length === 1 ? "" : "s"} derived{" "}
            {new Date(contract.derived_at).toLocaleString()}
          </p>
        </div>
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
            {isGenerating ? <Spinner size={14} className="animate-spin" /> : <Code size={14} />}
            Generate client
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPublishingSkill}
            onClick={() => setShowSkillForm((v) => !v)}
            className="gap-1.5"
          >
            {isPublishingSkill ? <Spinner size={14} className="animate-spin" /> : <Robot size={14} />}
            Publish as skill
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="text-[var(--status-error)] hover:text-[var(--status-error)] hover:bg-[var(--status-error)]/10"
          >
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
            onClick={onClearPublishSkillSuccess}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-none bg-transparent"
          >
            <X size={16} />
          </button>
        </div>
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
        </div>
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
    </div>
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
