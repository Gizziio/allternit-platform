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
    <div className="flex flex-col h-full w-full bg-[var(--shell-view-bg)] overflow-hidden">
      {/* Header */}
      <header className="px-6 py-5 shrink-0 border-b border-solid border-[var(--border-subtle)] flex items-center justify-between bg-gradient-to-r from-[var(--accent-primary)]/5 via-transparent to-transparent">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center border border-solid border-[var(--accent-primary)]/20 shadow-[0_4px_20px_var(--accent-primary)/10]">
            <Plugs size={22} weight="duotone" className="text-[var(--accent-primary)]" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold m-0 tracking-tight text-[var(--text-primary)]">
              Site APIs
            </h1>
            <p className="text-[13px] text-[var(--text-secondary)] m-0">
              HAR-derived API contracts, replay playground, and agent client generation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
            <ArrowsClockwise size={16} className={isLoadingSessions || isLoadingContracts ? "animate-spin" : ""} />
            Refresh
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
              "p-4 rounded-xl border border-dashed text-center cursor-pointer transition-colors",
              uploadDragging
                ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5"
                : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)]"
            )}
          >
            <div className="size-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center mx-auto mb-2">
              <FileJson size={20} className="text-[var(--accent-primary)]" />
            </div>
            <p className="text-[13px] font-semibold text-[var(--text-primary)] m-0">
              Drop a HAR file here
            </p>
            <p className="text-[11px] text-[var(--text-tertiary)] m-0 mt-1">
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
              <p className="text-[13px] text-[var(--text-secondary)] py-1">
                No active capture sessions. Upload a HAR or start capture from ACI.
              </p>
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
              <p className="text-[13px] text-[var(--text-secondary)] py-1">
                No derived contracts yet. Upload a HAR to extract one.
              </p>
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
              <Plugs size={48} weight="thin" className="mb-3 opacity-50" />
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
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Globe size={14} className="text-[var(--text-tertiary)]" />
            <h2 className="text-[18px] font-bold text-[var(--text-primary)] m-0">{contract.domain}</h2>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] m-0">
            {contract.endpoints.length} endpoint{contract.endpoints.length === 1 ? "" : "s"} derived{" "}
            {new Date(contract.derived_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="rounded-xl border border-solid border-[var(--border-subtle)] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[var(--bg-secondary)] text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            <tr>
              <th className="p-3 border-b border-solid border-[var(--border-subtle)]">Method</th>
              <th className="p-3 border-b border-solid border-[var(--border-subtle)]">Path</th>
              <th className="p-3 border-b border-solid border-[var(--border-subtle)]">Query</th>
              <th className="p-3 border-b border-solid border-[var(--border-subtle)]">Headers</th>
              <th className="p-3 border-b border-solid border-[var(--border-subtle)]">Hits</th>
              <th className="p-3 border-b border-solid border-[var(--border-subtle)]"></th>
            </tr>
          </thead>
          <tbody className="text-[13px]">
            {contract.endpoints.map((endpoint) => (
              <tr
                key={endpoint.id}
                className={`border-b border-solid border-[var(--border-subtle)] last:border-b-0 ${
                  selectedEndpoint?.id === endpoint.id ? "bg-[var(--accent-primary)]/5" : ""
                }`}
              >
                <td className="p-3">
                  <Badge variant="outline" className="font-semibold text-[var(--accent-primary)] border-[var(--accent-primary)]/30">
                    {endpoint.method}
                  </Badge>
                </td>
                <td className="p-3 font-mono text-[var(--text-primary)] truncate max-w-[240px]" title={endpoint.path_template}>
                  {endpoint.path_template || endpoint.path}
                </td>
                <td className="p-3 text-[var(--text-secondary)]">
                  {endpoint.query_params.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {endpoint.query_params.slice(0, 3).map((p) => (
                        <ParamChip key={p.name} param={p} />
                      ))}
                      {endpoint.query_params.length > 3 && (
                        <span className="text-[11px] text-[var(--text-tertiary)]">+{endpoint.query_params.length - 3}</span>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3 text-[var(--text-secondary)]">
                  {endpoint.headers.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {endpoint.headers.slice(0, 3).map((p) => (
                        <ParamChip key={p.name} param={p} />
                      ))}
                      {endpoint.headers.length > 3 && (
                        <span className="text-[11px] text-[var(--text-tertiary)]">+{endpoint.headers.length - 3}</span>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3 text-[var(--text-secondary)]">{endpoint.hit_count}</td>
                <td className="p-3">
                  <Button
                    size="sm"
                    variant={selectedEndpoint?.id === endpoint.id ? "default" : "outline"}
                    onClick={() => onSelectEndpoint(selectedEndpoint?.id === endpoint.id ? null : endpoint.id)}
                  >
                    {selectedEndpoint?.id === endpoint.id ? "Close" : "Replay"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    <div className="rounded-xl border border-solid border-[var(--border-subtle)] p-5 bg-[var(--bg-secondary)]">
      <h3 className="text-[14px] font-bold text-[var(--text-primary)] m-0 mb-4 flex items-center gap-2">
        <Play size={16} weight="fill" className="text-[var(--accent-primary)]" />
        Replay {endpoint.method} {endpoint.path_template || endpoint.path}
      </h3>

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

        <div>
          <div className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">Query Parameters</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {Object.entries(queryParams).map(([k, v]) => (
              <span
                key={k}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[12px]"
              >
                {k}={v}
                <button
                  type="button"
                  onClick={() => setQueryParams((prev) => {
                    const next = { ...prev };
                    delete next[k];
                    return next;
                  })}
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
              className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            >
              Add
            </button>
          </div>
        </div>

        <div>
          <div className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">Headers</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {headers.map((h, idx) => (
              <span
                key={`${h.name}-${idx}`}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[12px]"
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
              className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
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

export default ApiCaptureView;
