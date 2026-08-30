import React, { useEffect, useMemo, useState } from "react";

import * as Popover from "@radix-ui/react-popover";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import {
  CaretDown,
  Check,
  MagnifyingGlass,
  Gear,
  Plus,
  Warning,
  Cloud,
  Terminal,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { getProviderMeta } from "@/lib/providers/provider-registry";

export type ModelOption = {
  id: string;
  name: string;
  provider?: string;
  providerId?: string;
  providerName?: string;
  description?: string;
  capabilities?: string[];
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

function getProviderId(model: ModelOption): string {
  return (
    model.providerId ||
    model.provider ||
    (model.id.includes("/") ? model.id.split("/")[0] : "allternit")
  );
}

function getProviderName(model: ModelOption): string {
  return model.providerName || getProviderMeta(getProviderId(model)).name;
}

function ProviderIcon({ providerId }: { providerId: string }) {
  const meta = getProviderMeta(providerId);
  const [error, setError] = useState(false);
  const src = meta.icon ? `/assets/runtime-logos/${meta.icon}` : "";

  if (!src || error) {
    return (
      <Terminal
        size={18}
        className="text-[var(--ui-text-muted)]"
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="size-5 object-contain"
      onError={() => setError(true)}
    />
  );
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

  useEffect(() => {
    if (triggerless) setOpen(true);
  }, [triggerless]);

  const enrichedModels = useMemo<ModelOption[]>(() => {
    return models.map((m) => ({
      ...m,
      providerId: getProviderId(m),
      providerName: getProviderName(m),
    }));
  }, [models]);

  const filteredModels = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enrichedModels;
    return enrichedModels.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.providerName?.toLowerCase().includes(q) ||
        m.providerId?.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q)
    );
  }, [enrichedModels, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, ModelOption[]>();
    filteredModels.forEach((model) => {
      const key = model.providerName || "Models";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(model);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredModels]);

  const selected = useMemo(
    () => enrichedModels.find((m) => m.id === selectedModel),
    [enrichedModels, selectedModel]
  );

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch("");
      onClose?.();
    }
  };

  const handleSelect = (model: ModelOption) => {
    onSelect?.(model);
    setOpen(false);
    onClose?.();
  };

  const selectedProviderMeta = selected
    ? getProviderMeta(getProviderId(selected))
    : getProviderMeta("allternit");

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
              "flex items-center gap-2 py-1 px-2 rounded-full text-[var(--text-sm)] font-medium transition-all",
              className
            )}
          >
            <ProviderIcon providerId={getProviderId(selected || enrichedModels[0])} />
            <span className="text-secondary">
              {selected?.name || enrichedModels[0]?.name || "Select model"}
            </span>
            <CaretDown
              size={12}
              className={cn(
                "text-composer-muted transition-transform",
                open && "rotate-180"
              )}
            />
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
          className="w-[min(92vw,300px)] max-h-[min(460px,70vh)] rounded-xl bg-[var(--shell-view-bg)] border border-[var(--ui-border-default)] shadow-xl p-0 z-[200] flex flex-col overflow-hidden"
        >
          {/* Search */}
          <div className="flex-none p-2 border-b border-[var(--ui-border-default)] flex items-center gap-2">
            <MagnifyingGlass
              size={14}
              className="text-[var(--ui-text-muted)]"
            />
            <input
              aria-label="Search models"
              autoFocus
              placeholder="Search models…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--ui-text-primary)] placeholder:text-[var(--ui-text-muted)]"
            />
          </div>

          {/* Model list */}
          <ScrollArea.Root className="flex-1 overflow-hidden">
            <ScrollArea.Viewport className="w-full h-full p-1.5">
              {grouped.length === 0 ? (
                <div className="p-4 text-center text-[var(--ui-text-muted)] text-[var(--text-sm)]">
                  <Warning
                    size={18}
                    className="mx-auto mb-2 opacity-60"
                  />
                  <p>No models match your search.</p>
                </div>
              ) : (
                grouped.map(([providerName, providerModels]) => {
                  const meta = getProviderMeta(
                    providerModels[0]?.providerId ||
                      providerModels[0]?.provider ||
                      providerName
                  );
                  return (
                    <div key={providerName} className="mb-1">
                      <div className="px-2 py-1 flex items-center gap-2">
                        <ProviderIcon providerId={getProviderId(providerModels[0])} />
                        <span className="text-[var(--text-xs)] font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
                          {providerName}
                        </span>
                      </div>
                      {providerModels.map((model) => {
                        const isSelected = selectedModel === model.id;
                        return (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => handleSelect(model)}
                            className={cn(
                              "flex w-full items-center gap-3 px-2 py-1.5 rounded-lg text-sm text-left transition-colors",
                              isSelected
                                ? "bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)]"
                                : "hover:bg-[var(--surface-hover)] text-[var(--ui-text-primary)]"
                            )}
                          >
                            <ProviderIcon providerId={getProviderId(model)} />
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-[var(--text-sm)] truncate">
                                {model.name}
                              </span>
                              {model.description ? (
                                <p className="text-[var(--text-xs)] text-[var(--ui-text-muted)] truncate">
                                  {model.description}
                                </p>
                              ) : null}
                            </div>
                            {isSelected && (
                              <Check
                                size={14}
                                weight="bold"
                                className="text-[var(--accent-chat)]"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}

              {!isTerminalModels && models.length === 0 && !search && (
                <div className="p-4 text-center text-[var(--ui-text-muted)] text-[var(--text-sm)]">
                  <Cloud size={18} className="mx-auto mb-2 opacity-60" />
                  <p>No providers discovered yet.</p>
                  <p className="text-[var(--text-xs)] mt-1">
                    Connect a provider to see available models.
                  </p>
                </div>
              )}
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar
              className="flex select-none touch-none p-0.5 bg-transparent w-1.5"
              orientation="vertical"
            >
              <ScrollArea.Thumb className="flex-1 bg-[var(--ui-border-strong)] rounded-full opacity-30" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>

          {/* Actions footer */}
          <div className="flex-none p-1.5 bg-[var(--chat-composer-soft)]/50 border-t border-[var(--ui-border-default)] grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                onBrowseAllModels?.();
                setOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-md hover:bg-[var(--surface-hover)] text-xs font-bold text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] transition-colors"
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
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-md hover:bg-[var(--surface-hover)] text-xs font-bold text-[var(--accent-chat)] transition-colors"
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
