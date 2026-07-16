import React, { useEffect, useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import {
  CaretDown,
  Check,
  MagnifyingGlass,
  Gear,
  Brain,
  CloudArrowDown,
  ArrowSquareOut,
  Warning,
  Lock,
  LockOpen,
  Plus,
  Cpu,
  Cloud,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { OpenAIIcon, AnthropicIcon } from "@/components/icons/ModelIcons";
import { useChatStore } from "@/views/chat/ChatStore";
import { useLocalBrainStatus } from "@/hooks/useLocalBrainStatus";

export type ModelOption = {
  id: string;
  name: string;
  provider?: string;
  providerId?: string;
  providerName?: string;
  description?: string;
  [key: string]: unknown;
};

interface PromptModelSelectorProps {
  models?: ModelOption[];
  selectedModel?: string | null;
  onSelect?: (model: ModelOption) => void;
  onClose?: () => void;
  onBrowseAllModels?: () => void;
  onOpenProviderConnect?: () => void;
  isTerminalModels?: boolean;
  /** The parent already renders the model pill; mount only the anchored menu. */
  triggerless?: boolean;
  className?: string;
}

const LOCAL_BRAIN_ID = "local-brain";

function getProviderId(model: ModelOption): string {
  return model.providerId || model.provider || (model.id.includes("/") ? model.id.split("/")[0] : "allternit");
}

function getProviderName(model: ModelOption): string {
  return model.providerName || getProviderId(model);
}

function ProviderIcon({ providerId }: { providerId: string }) {
  const normalized = providerId.toLowerCase();
  if (normalized === "openai" || normalized === "codex") return <OpenAIIcon className="size-4" />;
  if (normalized === "anthropic" || normalized === "claude") return <AnthropicIcon className="size-4" />;
  if (normalized === "local" || normalized === "ollama") return <Brain className="size-4" weight="fill" />;
  if (normalized === "allternit" || normalized === "gizzi") return <Cpu className="size-4" weight="fill" />;
  return <Cloud className="size-4" weight="fill" />;
}

export function PromptModelSelector({
  models = [],
  selectedModel,
  onSelect,
  onClose,
  onBrowseAllModels,
  onOpenProviderConnect,
  isTerminalModels,
  triggerless = false,
  className,
}: PromptModelSelectorProps): React.ReactNode {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { ollamaRunning, modelReady } = useLocalBrainStatus({ pollOnFocus: false });
  const sandboxMode = useChatStore((state) => state.sandboxMode);
  const setSandboxMode = useChatStore((state) => state.setSandboxMode);

  useEffect(() => {
    if (triggerless) setOpen(true);
  }, [triggerless]);

  const enrichedModels = useMemo<ModelOption[]>(() => {
    const list = models.map((m) => ({
      ...m,
      providerId: getProviderId(m),
      providerName: getProviderName(m),
    }));
    // Keep Local Brain as a first-class option if it is not already in the registry list.
    const hasLocalBrain = list.some((m) => m.id === LOCAL_BRAIN_ID);
    if (!hasLocalBrain) {
      list.unshift({
        id: LOCAL_BRAIN_ID,
        name: "Local Brain",
        providerId: "local",
        providerName: "Local",
        description: "Offline · private",
      });
    }
    return list;
  }, [models]);

  const filteredModels = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enrichedModels;
    return enrichedModels.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.providerName?.toLowerCase().includes(q) ||
        m.providerId?.toLowerCase().includes(q)
    );
  }, [enrichedModels, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, ModelOption[]>();
    filteredModels.forEach((model) => {
      const key = model.providerName || "Models";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(model);
    });
    return Array.from(map.entries());
  }, [filteredModels]);

  const selected = useMemo(
    () => enrichedModels.find((m) => m.id === selectedModel) || enrichedModels[0],
    [enrichedModels, selectedModel]
  );

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) onClose?.();
  };

  const handleSelect = (model: ModelOption) => {
    onSelect?.(model);
    setOpen(false);
    onClose?.();
  };

  const handleLocalBrainClick = () => {
    if (modelReady) {
      handleSelect({ id: LOCAL_BRAIN_ID, name: "Local Brain", providerId: "local", providerName: "Local" });
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      {triggerless ? (
        <Popover.Anchor asChild>
          <span aria-hidden className="absolute right-0 bottom-full size-px" />
        </Popover.Anchor>
      ) : (
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 py-1 px-2 rounded-full text-sm font-medium transition-all",
              className
            )}
          >
            <span className="text-composer-muted">
              <ProviderIcon providerId={getProviderId(selected)} />
            </span>
            <span className="text-secondary">{selected?.name || "Select model"}</span>
            <CaretDown size={12} className={cn("text-composer-muted transition-transform", open && "rotate-180")} />
          </button>
        </Popover.Trigger>
      )}

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          avoidCollisions
          collisionPadding={16}
          className="w-[min(92vw,280px)] max-h-[min(420px,70vh)] rounded-xl bg-menu-bg backdrop-blur-[20px] border border-menu-border shadow-xl p-0 z-[200] flex flex-col overflow-hidden"
        >
          {/* Search */}
          <div className="flex-none p-2 border-b border-input-border flex items-center gap-2">
            <MagnifyingGlass size={14} className="text-muted" />
            <input
              aria-label="Search models"
              autoFocus
              placeholder="Search models…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-sm text-primary placeholder:text-muted"
            />
          </div>

          {/* Model list */}
          <ScrollArea.Root className="flex-1 overflow-hidden">
            <ScrollArea.Viewport className="w-full h-full p-1.5">
              {grouped.length === 0 ? (
                <div className="p-4 text-center text-muted text-sm">
                  <Warning size={18} className="mx-auto mb-2 opacity-60" />
                  <p>No models match your search.</p>
                </div>
              ) : (
                grouped.map(([providerName, providerModels]) => (
                  <div key={providerName} className="mb-1">
                    <div className="px-2 py-1 text-[11px] font-bold text-muted uppercase tracking-wider opacity-70">
                      {providerName}
                    </div>
                    {providerModels.map((model) => {
                      const isSelected = selectedModel === model.id;
                      const isLocalBrain = model.id === LOCAL_BRAIN_ID;
                      const lbReady = isLocalBrain && modelReady;
                      const lbNoOllama = isLocalBrain && !ollamaRunning;

                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => (isLocalBrain ? handleLocalBrainClick() : handleSelect(model))}
                          disabled={lbNoOllama}
                          className={cn(
                            "flex w-full items-center gap-3 px-2 py-1.5 rounded-lg text-sm text-left transition-colors",
                            lbNoOllama
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-hover",
                            isSelected && "bg-composer-soft"
                          )}
                        >
                          <div
                            className={cn(
                              "flex items-center justify-center size-7 rounded-md bg-composer-soft text-muted",
                              isSelected && "text-accent",
                              lbReady && "text-status-success"
                            )}
                          >
                            <ProviderIcon providerId={getProviderId(model)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={cn("font-medium truncate", lbReady && "text-status-success")}>
                                {model.name}
                              </span>
                              {isLocalBrain && (
                                <span
                                  className={cn(
                                    "text-[10px] font-bold px-1 py-0.5 rounded",
                                    lbReady
                                      ? "bg-status-success/10 text-status-success"
                                      : lbNoOllama
                                      ? "bg-status-warning/10 text-status-warning"
                                      : "bg-accent/10 text-accent"
                                  )}
                                >
                                  {lbReady ? "Ready" : lbNoOllama ? "Install Ollama" : "~2 GB"}
                                </span>
                              )}
                            </div>
                            {model.description ? (
                              <p className="text-xs text-muted truncate">{model.description}</p>
                            ) : null}
                          </div>
                          {isSelected && !isLocalBrain && <Check size={14} weight="bold" className="text-accent" />}
                          {isLocalBrain && lbReady && <Check size={14} weight="bold" className="text-status-success" />}
                          {isLocalBrain && !lbReady && !lbNoOllama && (
                            <CloudArrowDown size={14} className="text-accent" />
                          )}
                          {isLocalBrain && lbNoOllama && (
                            <a
                              href="https://ollama.com/download"
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-accent hover:underline"
                              title="Download Ollama"
                            >
                              <ArrowSquareOut size={12} />
                            </a>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}

              {!isTerminalModels && models.length === 0 && !search && (
                <div className="p-4 text-center text-muted text-sm">
                  <Cloud size={18} className="mx-auto mb-2 opacity-60" />
                  <p>No providers discovered yet.</p>
                  <p className="text-xs mt-1">Connect a provider to see available models.</p>
                </div>
              )}
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar
              className="flex select-none touch-none p-0.5 bg-transparent w-1.5"
              orientation="vertical"
            >
              <ScrollArea.Thumb className="flex-1 bg-border-strong rounded-full opacity-30" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>

          {/* Governance footer */}
          <div className="flex-none p-2 bg-composer-soft/50 border-t border-input-border flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-muted uppercase">Governance</span>
              <span
                className={cn(
                  "text-xs font-bold tracking-tight",
                  sandboxMode === "full" ? "text-status-error animate-pulse" : "text-status-success"
                )}
              >
                {sandboxMode === "full" ? "FULL WRITE ACCESS" : "READ ONLY (PROTECTED)"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSandboxMode(sandboxMode === "full" ? "read-only" : "full")}
              className={cn(
                "px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all text-xs font-bold border",
                sandboxMode === "full"
                  ? "bg-status-error/10 text-status-error border-status-error/20 hover:bg-status-error/20"
                  : "bg-status-success/10 text-status-success border-status-success/20 hover:bg-status-success/20"
              )}
            >
              {sandboxMode === "full" ? <LockOpen size={12} weight="bold" /> : <Lock size={12} weight="bold" />}
              TOGGLE
            </button>
          </div>

          {/* Actions footer */}
          <div className="flex-none p-1.5 bg-composer-soft/80 border-t border-input-border grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                onBrowseAllModels?.();
                setOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-md hover:bg-hover text-xs font-bold text-muted hover:text-primary transition-colors"
            >
              <Gear size={12} weight="fill" />
              Manage
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenProviderConnect?.();
                setOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-md hover:bg-hover text-xs font-bold text-accent transition-colors"
            >
              <Plus size={12} weight="bold" />
              Connect
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
