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
  Lightning,
  BracketsCurly,
  ArrowRight,
  ArrowSquareOut,
  Faders,
  PaperPlaneRight,
} from "@phosphor-icons/react";
import { useApiCaptureStore } from "@/lib/api-capture/store";
import type { Endpoint, Param, ReplayInput, ReplayResult, SiteApiContract } from "@/lib/api-capture/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CLIENT_LANGUAGES = [
  { value: "python", label: "Python" },
  { value: "typescript", label: "TypeScript" },
  { value: "curl", label: "cURL" },
] as const;

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-[var(--accent-primary)]/10 mb-3">
        <Icon size={20} className="text-[var(--accent-primary)]" />
      </div>
      <p className="text-[13px] font-semibold text-[var(--text-primary)] m-0">{title}</p>
      <p className="text-[12px] text-[var(--text-secondary)] m-0 mt-1 max-w-[260px] leading-relaxed">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

function WorkflowStep({
  icon: Icon,
  label,
  description,
  accent,
  step,
  isLast,
}: {
  icon: React.ComponentType<any>;
  label: string;
  description: string;
  accent: string;
  step: number;
  isLast?: boolean;
}) {
  return (
    <div className="relative flex h-full items-center gap-3">
      <div className="flex flex-1 h-full items-center gap-3 rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 transition-colors hover:border-[var(--border-hover)]">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 16%, transparent), color-mix(in srgb, ${accent} 6%, transparent))`,
          }}
        >
          <Icon size={20} color={accent} weight="duotone" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="flex h-4 min-w-[16px] items-center justify-center rounded-full text-[9px] font-bold"
              style={{ background: accent, color: "var(--ui-text-inverse)" }}
            >
              {step}
            </span>
            <div className="text-[12px] font-semibold text-[var(--text-primary)]">{label}</div>
          </div>
          <div className="text-[11px] text-[var(--text-tertiary)] truncate">{description}</div>
        </div>
      </div>
      {!isLast && (
        <div className="hidden md:flex shrink-0 text-[var(--border-hover)]">
          <ArrowRight size={16} />
        </div>
      )}
    </div>
  );
}

export function ApiCaptureView() {
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

  const openBrowserView = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("allternit:open-view", { detail: { viewType: "browser" } })
    );
  }, []);

  useEffect(() => {
    void fetchSessions();
    void fetchContracts();
  }, [fetchSessions, fetchContracts]);

  const selectedContract = useMemo(
    () => contracts.find((c) => c.id === selectedContractId) || null,
    [contracts, selectedContractId]
  );

  const selectedEndpoint = useMemo(
    () => selectedContract?.endpoints.find((e) => e.id === selectedEndpointId) || null,
    [selectedContract, selectedEndpointId]
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
    [ingestHarFile]
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setUploadDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile]
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
    <div className="flex flex-col h-full w-full bg-[var(--shell-view-bg)] overflow-hidden">
      {/* Header */}
      <header className="px-6 py-5 shrink-0 border-b border-solid border-[var(--border-subtle)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-primary)]/5 flex items-center justify-center border border-solid border-[var(--accent-primary)]/20">
            <Plugs size={22} weight="duotone" className="text-[var(--accent-primary)]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold m-0 tracking-tight text-[var(--text-primary)]">
              Site APIs
            </h1>
            <p className="text-[13px] text-[var(--text-secondary)] m-0 truncate">
              HAR-derived API contracts, replay playground, and agent client generation
            </p>
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
            size="sm"
            onClick={openBrowserView}
            className="gap-2"
          >
            <ArrowSquareOut size={16} />
            Open browser to capture
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <UploadSimple size={16} />
            Upload HAR
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
            <ArrowsClockwise
              size={16}
              className={isLoadingSessions || isLoadingContracts ? "animate-spin" : ""}
            />
            Refresh
          </Button>
        </div>
      </header>

      {/* Workflow strip */}
      <div className="shrink-0 px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <WorkflowStep
            step={1}
            icon={UploadSimple}
            label="Upload HAR"
            description="Drop a browser DevTools export"
            accent="var(--accent-primary)"
          />
          <WorkflowStep
            step={2}
            icon={Plugs}
            label="Extract contract"
            description="Turn traffic into typed endpoints"
            accent="var(--accent-secondary)"
          />
          <WorkflowStep
            step={3}
            icon={Play}
            label="Replay"
            description="Test endpoints live with params"
            accent="var(--status-success)"
          />
          <WorkflowStep
            step={4}
            icon={Code}
            label="Generate client"
            description="Python / TypeScript / cURL"
            accent="var(--accent-code)"
            isLast
          />
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="shrink-0 mx-6 mt-2 p-3 px-4 rounded-lg bg-[var(--status-error-bg)] border border-solid border-[var(--status-error)]/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] text-[var(--status-error)]">
            <Warning size={16} weight="bold" />
            {error}
          </div>
          <button
            type="button"
            onClick={clearError}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex min-h-0">
        {/* Left sidebar */}
        <div className="w-[340px] shrink-0 border-r border-solid border-[var(--border-subtle)] overflow-y-auto p-4 space-y-6">
          {/* Upload dropzone */}
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "p-5 rounded-xl border border-dashed text-center cursor-pointer transition-colors",
              uploadDragging
                ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5"
                : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)]"
            )}
          >
            <div className="size-12 rounded-xl bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-primary)]/5 flex items-center justify-center mx-auto mb-3 border border-solid border-[var(--accent-primary)]/10">
              <FileJson size={24} className="text-[var(--accent-primary)]" />
            </div>
            <p className="text-[14px] font-semibold text-[var(--text-primary)] m-0">
              Drop a HAR file here
            </p>
            <p className="text-[12px] text-[var(--text-tertiary)] m-0 mt-1">
              or click to browse — JSON exported from browser DevTools
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
              <EmptyState
                icon={Lightning}
                title="No active capture sessions"
                description="Upload a HAR file or start a live capture from ACI to see sessions here."
              />
            ) : (
              <div className="flex flex-col gap-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="px-3 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-solid border-[var(--border-subtle)] text-[13px]"
                  >
                    <div className="font-semibold text-[var(--text-primary)] truncate">{session.domain}</div>
                    <div className="text-[11px] text-[var(--text-tertiary)] mt-1 flex items-center gap-2">
                      <span className="capitalize">{session.source}</span>
                      <StatusBadge status={session.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[var(--text-tertiary)] m-0">
                Contracts by Domain
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={openBrowserView}
                className="h-7 gap-1.5 px-2 text-[12px]"
              >
                <ArrowSquareOut size={14} />
                New capture
              </Button>
            </div>
            {isLoadingContracts && contracts.length === 0 ? (
              <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] py-2">
                <Spinner size={16} className="animate-spin" />
                Loading contracts…
              </div>
            ) : contracts.length === 0 ? (
              <EmptyState
                icon={BracketsCurly}
                title="No derived contracts yet"
                description="Contracts are created by uploading a HAR file or capturing traffic from the browser. Once created, select a domain to view its endpoints."
                action={
                  <div className="flex flex-col items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                      <UploadSimple size={14} />
                      Upload HAR
                    </Button>
                    <Button variant="ghost" size="sm" onClick={openBrowserView} className="gap-2">
                      <ArrowSquareOut size={14} />
                      Capture from browser
                    </Button>
                  </div>
                }
              />
            ) : (
              <>
                <p className="text-[12px] text-[var(--text-tertiary)] mb-3">
                  Select a domain to view its endpoints and replay requests.
                </p>
                <div className="flex flex-col gap-4">
                  {Array.from(contractsByDomain.entries()).map(([domain, domainContracts]) => (
                  <div
                    key={domain}
                    className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3"
                  >
                    <div className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2 truncate flex items-center gap-1.5">
                      <Globe size={12} />
                      {domain}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {domainContracts.map((contract) => (
                        <button
                          key={contract.id}
                          type="button"
                          onClick={() => selectContract(contract.id)}
                          className={cn(
                            "text-left px-3 py-2.5 rounded-lg border text-[12px] transition-colors",
                            selectedContractId === contract.id
                              ? "bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30 text-[var(--accent-primary)] font-semibold"
                              : "bg-transparent border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                          )}
                        >
                          <span className="flex items-center justify-between">
                            {contract.endpoints.length} endpoint{contract.endpoints.length === 1 ? "" : "s"}
                            {selectedContractId === contract.id && (
                              <CheckCircle size={12} weight="bold" />
                            )}
                          </span>
                          <span className="block text-[11px] text-[var(--text-tertiary)] mt-0.5 font-normal">
                            {new Date(contract.derived_at).toLocaleString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                </div>
              </>
            )}
          </section>
        </div>

        {/* Center/right: contract detail + replay */}
        <div className="flex-1 overflow-y-auto p-6 min-w-0 bg-[var(--bg-secondary)]">
          {!selectedContract ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)]">
              <div className="size-16 rounded-2xl bg-[var(--bg-elevated)] border border-solid border-[var(--border-subtle)] flex items-center justify-center mb-4">
                <Plugs size={32} weight="duotone" className="text-[var(--text-tertiary)]" />
              </div>
              <p className="text-[15px] font-semibold text-[var(--text-primary)] m-0">
                Select a contract to inspect
              </p>
              <p className="text-[13px] text-[var(--text-secondary)] m-0 mt-1 max-w-[360px] text-center">
                Choose a domain contract from the sidebar to view endpoints, replay requests, and generate clients.
              </p>
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
              onPublishAsSkill={(name, description) =>
                publishAsSkill(selectedContract.id, name, description).then(() => undefined)
              }
              onDelete={() => deleteContract(selectedContract.id)}
              onClearGeneratedClient={clearGeneratedClient}
              onClearPublishSkillSuccess={clearPublishSkillSuccess}
            />
          )}
        </div>
      </div>
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
}: ContractDetailProps) {
  const [clientLanguage, setClientLanguage] = useState<"python" | "typescript" | "curl">("python");
  const [copied, setCopied] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [skillDescription, setSkillDescription] = useState("");
  const [showSkillForm, setShowSkillForm] = useState(false);

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Globe size={14} className="text-[var(--accent-primary)]" />
            <h2 className="text-[18px] font-bold text-[var(--text-primary)] m-0 truncate">{contract.domain}</h2>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] m-0">
            {contract.endpoints.length} endpoint{contract.endpoints.length === 1 ? "" : "s"} derived{" "}
            {new Date(contract.derived_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <select
            value={clientLanguage}
            onChange={(e) => setClientLanguage(e.target.value as typeof clientLanguage)}
            className="h-8 px-2 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none"
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
        <div className="rounded-xl border border-solid border-[var(--border-subtle)] p-4 bg-[var(--bg-elevated)]">
          <div className="flex items-center gap-2 mb-3 text-[13px] font-semibold text-[var(--text-primary)]">
            <div className="size-7 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
              <Robot size={16} className="text-[var(--accent-primary)]" />
            </div>
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
        <div className="rounded-xl border border-solid border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-elevated)]">
          <div className="px-4 py-3 border-b border-solid border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-elevated)]">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
              <div className="size-7 rounded-lg bg-[var(--accent-code)]/10 flex items-center justify-center">
                <Code size={16} className="text-[var(--accent-code)]" />
              </div>
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

      <div className="rounded-xl border border-solid border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-elevated)]">
        <div className="px-4 py-3 border-b border-solid border-[var(--border-subtle)] flex items-center justify-between">
          <div className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            Endpoints
          </div>
          <div className="text-[11px] text-[var(--text-tertiary)]">
            {contract.endpoints.length} total
          </div>
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {contract.endpoints.map((endpoint) => (
            <EndpointCard
              key={endpoint.id}
              endpoint={endpoint}
              isSelected={selectedEndpoint?.id === endpoint.id}
              onToggle={() => onSelectEndpoint(selectedEndpoint?.id === endpoint.id ? null : endpoint.id)}
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
        />
      )}
    </div>
  );
}

function EndpointCard({
  endpoint,
  isSelected,
  onToggle,
}: {
  endpoint: Endpoint;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "p-4 transition-colors",
        isSelected ? "bg-[var(--accent-primary)]/5" : "hover:bg-[var(--surface-hover)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Badge variant="outline" className="font-semibold text-[var(--accent-primary)] border-[var(--accent-primary)]/30 shrink-0 mt-0.5">
            {endpoint.method}
          </Badge>
          <div className="min-w-0">
            <div className="text-[13px] font-mono text-[var(--text-primary)] truncate" title={endpoint.path_template || endpoint.path}>
              {endpoint.path_template || endpoint.path}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {endpoint.query_params.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Query</span>
                  {endpoint.query_params.slice(0, 3).map((p) => (
                    <ParamChip key={p.name} param={p} />
                  ))}
                  {endpoint.query_params.length > 3 && (
                    <span className="text-[11px] text-[var(--text-tertiary)]">+{endpoint.query_params.length - 3}</span>
                  )}
                </div>
              )}
              {endpoint.headers.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Headers</span>
                  {endpoint.headers.slice(0, 3).map((p) => (
                    <ParamChip key={p.name} param={p} />
                  ))}
                  {endpoint.headers.length > 3 && (
                    <span className="text-[11px] text-[var(--text-tertiary)]">+{endpoint.headers.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-[var(--text-tertiary)]">{endpoint.hit_count} hit{endpoint.hit_count === 1 ? "" : "s"}</span>
          <Button size="sm" variant={isSelected ? "default" : "outline"} onClick={onToggle}>
            {isSelected ? "Close" : "Replay"}
          </Button>
        </div>
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
}

function ReplayForm({ endpoint, isReplaying, replayResult, onReplay }: ReplayFormProps) {
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
    <div className="rounded-xl border border-solid border-[var(--border-subtle)] p-5 bg-[var(--bg-elevated)]">
      <div className="flex items-center gap-2 mb-5">
        <div className="size-8 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
          <Faders size={16} weight="fill" className="text-[var(--accent-primary)]" />
        </div>
        <h3 className="text-[14px] font-bold text-[var(--text-primary)] m-0">
          Replay {endpoint.method} {endpoint.path_template || endpoint.path}
        </h3>
      </div>

      <div className="flex flex-col gap-5">
        {pathParamKeys.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
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

        <div className="rounded-lg border border-solid border-[var(--border-subtle)] p-3 bg-[var(--bg-primary)]">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text-secondary)] mb-2">
            <BracketsCurly size={14} />
            Query Parameters
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {Object.entries(queryParams).map(([k, v]) => (
              <span
                key={k}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-elevated)] border border-solid border-[var(--border-subtle)] text-[12px]"
              >
                {k}={v}
                <button
                  type="button"
                  onClick={() =>
                    setQueryParams((prev) => {
                      const next = { ...prev };
                      delete next[k];
                      return next;
                    })
                  }
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
              placeholder="key"
              value={queryKey}
              onChange={(e) => setQueryKey(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />
            <input
              type="text"
              placeholder="value"
              value={queryValue}
              onChange={(e) => setQueryValue(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />
            <button
              type="button"
              onClick={() => {
                if (!queryKey) return;
                setQueryParams((prev) => ({ ...prev, [queryKey]: queryValue }));
                setQueryKey("");
                setQueryValue("");
              }}
              className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-solid border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            >
              Add
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-solid border-[var(--border-subtle)] p-3 bg-[var(--bg-primary)]">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text-secondary)] mb-2">
            <Code size={14} />
            Headers
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {headers.map((h, idx) => (
              <span
                key={`${h.name}-${idx}`}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-elevated)] border border-solid border-[var(--border-subtle)] text-[12px]"
              >
                {h.name}: {h.value}
                <button
                  type="button"
                  onClick={() => setHeaders((prev) => prev.filter((_, i) => i !== idx))}
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
              placeholder="name"
              value={headerName}
              onChange={(e) => setHeaderName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />
            <input
              type="text"
              placeholder="value"
              value={headerValue}
              onChange={(e) => setHeaderValue(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />
            <button
              type="button"
              onClick={() => {
                if (!headerName) return;
                setHeaders((prev) => [...prev, { name: headerName, value: headerValue }]);
                setHeaderName("");
                setHeaderValue("");
              }}
              className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-solid border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            >
              Add
            </button>
          </div>
        </div>

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
          {isReplaying ? <Spinner size={16} className="animate-spin" /> : <PaperPlaneRight size={16} weight="fill" />}
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

export default ApiCaptureView;
