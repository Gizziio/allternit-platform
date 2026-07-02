import React, { useState, useEffect } from "react";
import {
  Wrench,
  Check,
  Prohibit,
  MagnifyingGlass,
  CaretDown,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  type Tool,
  useToolRegistryStore,
  type ToolRegistryEntry,
} from "@/lib/agents";
import type { SurfacePalette } from "./context-strip.types";

interface ToolsDrawerProps {
  tools: Tool[];
  isLoading: boolean;
  toolsEnabled: boolean;
  palette: SurfacePalette;
  sessionId?: string;
}

export function ToolsDrawer({ tools, isLoading, toolsEnabled, palette, sessionId }: ToolsDrawerProps) {
  const [showRegistry, setShowRegistry] = useState(false);
  
  if (showRegistry) {
    return (
      <ToolRegistryPanel
        palette={palette}
        sessionId={sessionId}
        onBack={() => setShowRegistry(false)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="p-5 text-center text-[#a8998c]">
        <div className="text-[13px]">Loading tools...</div>
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div className="rounded-[14px] border border-solid border-[var(--palette-border)] bg-[rgba(16,12,10,0.24)] p-4"
        style={{ '--palette-border': palette.border } as React.CSSProperties}
      >
        <div
          className="flex items-center gap-2 text-[var(--palette-accent)] text-[12px] font-extrabold uppercase tracking-[0.08em] mb-2"
          style={{ '--palette-accent': palette.accent } as React.CSSProperties}
        >
          <Wrench size={12} weight="bold" />
          No Tools Available
        </div>
        <div className="text-[12px] text-[#b3a395] leading-relaxed mb-3">
          {toolsEnabled
            ? "Tool access is enabled but no tools are registered. Tools will appear here when the runtime makes them available."
            : "Tool access is not configured for this session. Enable tools to see available capabilities."}
        </div>
        <button type="button"
          onClick={() => setShowRegistry(true)}
          className="px-3 py-1.5 rounded-lg border border-solid border-[var(--palette-border)] bg-[var(--palette-soft)] text-[var(--palette-accent)] text-[12px] font-semibold cursor-pointer transition-colors hover:opacity-90"
          style={{
            '--palette-border': palette.border,
            '--palette-soft': palette.soft,
            '--palette-accent': palette.accent,
          } as React.CSSProperties}
        >
          Open Tool Registry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <div
          className="text-[12px] font-extrabold text-[var(--palette-accent)] uppercase tracking-[0.08em]"
          style={{ '--palette-accent': palette.accent } as React.CSSProperties}
        >
          <Wrench size={12} weight="bold" className="mr-1.5 inline-block align-middle" />
          Available Tools ({tools.length})
        </div>
        <div className="flex gap-2">
          <button type="button"
            onClick={() => setShowRegistry(true)}
            className="px-2.5 py-1 rounded-md border border-solid border-[var(--palette-border)] bg-transparent text-[var(--palette-accent)] text-[12px] font-semibold cursor-pointer transition-colors hover:bg-[var(--surface-hover)]"
            style={{
              '--palette-border': palette.border,
              '--palette-accent': palette.accent,
            } as React.CSSProperties}
          >
            Manage
          </button>
          <div
            className={cn(
              "text-[12px] flex items-center gap-1",
              toolsEnabled ? "text-[#79C47C]" : "text-[#a8998c]"
            )}
          >
            {toolsEnabled ? (
              <>
                <Check size={10} weight="bold" />
                Enabled
              </>
            ) : (
              <>
                <Prohibit size={10} weight="bold" />
                Disabled
              </>
            )}
          </div>
        </div>
      </div>

      {tools.slice(0, 5).map((tool) => (
        <ToolItem key={tool.id} tool={tool} palette={palette} />
      ))}

      {tools.length > 5 && (
        <button type="button"
          onClick={() => setShowRegistry(true)}
          className="p-2 rounded-lg border border-dashed border-[var(--palette-border)] bg-transparent text-[#7a6b5d] text-[12px] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
          style={{ '--palette-border': palette.border } as React.CSSProperties}
        >
          + {tools.length - 5} more tools
        </button>
      )}

      <div
        className="mt-2 p-2.5 rounded-[10px] bg-[var(--surface-hover)] border border-solid border-[var(--palette-border)] text-[12px] text-[#a8998c] leading-relaxed"
        style={{ '--palette-border': palette.border } as React.CSSProperties}
      >
        Tools are executed in the native agent runtime. Click "Manage" to enable/disable tools or configure confirmation requirements.
      </div>
    </div>
  );
}

function ToolRegistryPanel({
  palette,
  sessionId,
  onBack,
}: {
  palette: SurfacePalette;
  sessionId?: string;
  onBack: () => void;
}) {
  const tools = useToolRegistryStore((state) => Object.values(state.tools));
  const isLoading = useToolRegistryStore((state) => state.isLoading);
  const fetchKernelTools = useToolRegistryStore((state) => state.fetchKernelTools);
  const toggleTool = useToolRegistryStore((state) => state.toggleTool);
  const toggleToolForSession = useToolRegistryStore((state) => state.toggleToolForSession);
  const setToolRequiresConfirmation = useToolRegistryStore((state) => state.setToolRequiresConfirmation);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (tools.length === 0 && !isLoading) {
      void fetchKernelTools();
    }
  }, [tools.length, isLoading, fetchKernelTools]);

  const categories = [...new Set(tools.map((t) => t.category))];

  const filteredTools = tools.filter((tool) => {
    if (selectedCategory && tool.category !== selectedCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-1">
        <button type="button"
          onClick={onBack}
          className="px-2 py-1 rounded-md border border-solid border-[var(--ui-border-default)] bg-transparent text-[#a8998c] text-[12px] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
        >
          Back
        </button>
        <div className="text-[12px] font-bold text-[#f6eee7]">
          Tool Registry ({tools.length})
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7a6b5d]" />
          <input aria-label="Search tools..." type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] rounded-lg py-1.5 pl-8 pr-3 text-[12px] text-[#f6eee7] outline-none focus:border-[var(--palette-accent)]"
            style={{ '--palette-accent': palette.accent } as React.CSSProperties}
          />
        </div>
        
        <div className="flex flex-wrap gap-1.5">
          <button type="button"
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "px-2 py-0.5 rounded-full border border-solid text-[10px] font-bold uppercase transition-colors cursor-pointer",
              selectedCategory === null ? "bg-[var(--palette-accent)] border-[var(--palette-accent)] text-[#1a1714]" : "bg-transparent border-[var(--ui-border-muted)] text-[#7a6b5d]"
            )}
            style={{ '--palette-accent': palette.accent } as React.CSSProperties}
          >
            All
          </button>
          {categories.map((cat) => (
            <button type="button"
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-2 py-0.5 rounded-full border border-solid text-[10px] font-bold uppercase transition-colors cursor-pointer",
                selectedCategory === cat ? "bg-[var(--palette-accent)] border-[var(--palette-accent)] text-[#1a1714]" : "bg-transparent border-[var(--ui-border-muted)] text-[#7a6b5d]"
              )}
              style={{ '--palette-accent': palette.accent } as React.CSSProperties}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tools List */}
      <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
        {filteredTools.map((tool) => (
          <RegistryToolItem
            key={tool.id}
            tool={tool}
            palette={palette}
            onToggle={(enabled) => {
              if (sessionId) {
                toggleToolForSession(tool.id, sessionId, enabled);
              } else {
                toggleTool(tool.id, enabled);
              }
            }}
            onToggleConfirmation={() => setToolRequiresConfirmation(tool.id, !tool.requiresConfirmation)}
          />
        ))}
      </div>
    </div>
  );
}

function RegistryToolItem({
  tool,
  palette,
  onToggle,
  onToggleConfirmation,
}: {
  tool: ToolRegistryEntry;
  palette: SurfacePalette;
  onToggle: (enabled: boolean) => void;
  onToggleConfirmation: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-[10px] border border-solid overflow-hidden transition-opacity duration-200",
        tool.isEnabled ? "bg-[rgba(16,12,10,0.24)] border-[var(--palette-border)]" : "bg-black/10 border-[var(--surface-hover)] opacity-70"
      )}
      style={{ '--palette-border': palette.border } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 p-2 px-2.5">
        {/* Toggle Switch */}
        <button type="button"
          onClick={() => onToggle(!tool.isEnabled)}
          className={cn(
            "w-9 h-5 rounded-[10px] border-none relative cursor-pointer transition-colors duration-200",
            tool.isEnabled ? "bg-[#79C47C]" : "bg-[#444]"
          )}
        >
          <div
            className={cn(
              "size-4 rounded-full bg-white absolute top-0.5 transition-all duration-200",
              tool.isEnabled ? "left-[18px]" : "left-0.5"
            )}
          />
        </button>

        {/* Tool Info */}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "text-[12px] font-semibold truncate",
              tool.isEnabled ? "text-[#f6eee7]" : "text-[#888]"
            )}
          >
            {tool.name}
          </div>
          <div className="text-[12px] text-[#7a6b5d]">{tool.category}</div>
        </div>

        {/* Confirmation Toggle */}
        {tool.isEnabled && (
          <button type="button"
            onClick={onToggleConfirmation}
            title={tool.requiresConfirmation ? "Requires confirmation" : "No confirmation needed"}
            className={cn(
              "px-2 py-0.5 rounded-md border border-solid text-[12px] cursor-pointer transition-colors",
              tool.requiresConfirmation ? "border-[#fbbf24] bg-[var(--status-warning-bg)] text-[#fbbf24]" : "border-[var(--ui-border-default)] bg-transparent text-[#7a6b5d]"
            )}
          >
            {tool.requiresConfirmation ? "⚠️ Confirm" : "Auto"}
          </button>
        )}

        {/* Expand */}
        <button type="button"
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "p-1 rounded-md border-none bg-transparent text-[#7a6b5d] cursor-pointer transition-transform duration-200",
            expanded ? "rotate-180" : "rotate-0"
          )}
        >
          <CaretDown size={14} />
        </button>
      </div>

      {expanded && (
        <div className="px-2.5 pb-2.5 border-t border-solid border-[var(--surface-hover)]">
          <div className="pt-2 text-[12px] text-[#a8998c] leading-relaxed">
            {tool.description}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolItem({ tool, palette }: { tool: Tool; palette: SurfacePalette }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-2">
      <button type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-2 px-3 rounded-lg border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-hover)] flex items-center justify-between cursor-pointer transition-colors hover:bg-[var(--surface-active)]"
      >
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[var(--palette-accent)]"
            style={{ '--palette-accent': palette.accent } as React.CSSProperties}
          >
            {tool.name}
          </span>
        </div>
        <div
          className={cn(
            "text-[12px] text-[var(--palette-accent)] transition-transform duration-200",
            expanded ? "rotate-180" : "rotate-0"
          )}
          style={{ '--palette-accent': palette.accent } as React.CSSProperties}
        >
          <CaretDown size={14} />
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-solid border-[var(--surface-hover)]">
          <div className="pt-2.5">
            <div className="text-[12px] text-[#b3a395] leading-relaxed mb-2">
              {tool.description || "No description available."}
            </div>
            {tool.parameters && Object.keys(tool.parameters).length > 0 && (
              <div>
                <div className="text-[12px] font-extrabold text-[#9f8a78] uppercase tracking-[0.08em] mb-1.5">
                  Parameters
                </div>
                <div className="flex flex-col gap-1">
                  {Object.entries(tool.parameters).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-baseline gap-2 text-[12px]"
                    >
                      <span className="text-[var(--palette-accent)] font-mono"
                        style={{ '--palette-accent': palette.accent } as React.CSSProperties}
                      >
                        {key}
                      </span>
                      <span className="text-[#7a6b5d]">
                        {(value as any)?.type || "unknown"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
