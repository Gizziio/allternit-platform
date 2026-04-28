"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Wrench,
  ShieldCheck,
  CircleNotch,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { useToolRegistryStore } from "@/lib/agents/tool-registry.store";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { STUDIO_THEME } from "../AgentView.constants";

interface AgentToolConfiguratorProps {
  enabledToolIds: string[];
  onChange: (toolIds: string[]) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "file-system": <Wrench size={14} />,
  web: <Wrench size={14} />,
  database: <Wrench size={14} />,
  api: <Wrench size={14} />,
  ai: <Wrench size={14} />,
  "retrieval-rag": <Wrench size={14} />,
  memory: <Wrench size={14} />,
  planning: <Wrench size={14} />,
  system: <Wrench size={14} />,
  cli: <Wrench size={14} />,
  container: <Wrench size={14} />,
  cloud: <Wrench size={14} />,
  security: <ShieldCheck size={14} />,
  secrets: <ShieldCheck size={14} />,
  observability: <Wrench size={14} />,
  logging: <Wrench size={14} />,
  monitoring: <Wrench size={14} />,
  custom: <Wrench size={14} />,
  user: <Wrench size={14} />,
};

const CATEGORY_LABELS: Record<string, string> = {
  "file-system": "File System",
  web: "Web",
  database: "Database",
  api: "API",
  ai: "AI & Agents",
  "retrieval-rag": "Retrieval & RAG",
  memory: "Memory",
  planning: "Planning",
  system: "System",
  cli: "CLI",
  container: "Container",
  cloud: "Cloud",
  security: "Security",
  secrets: "Secrets",
  observability: "Observability",
  logging: "Logging",
  monitoring: "Monitoring",
  custom: "Custom",
  user: "User",
};

export function AgentToolConfigurator({
  enabledToolIds,
  onChange,
}: AgentToolConfiguratorProps) {
  const { tools, isLoading, error, fetchKernelTools } = useToolRegistryStore();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchKernelTools().catch(() => {
      // Fallback: if API fails, we show empty state with helpful message
    });
  }, [fetchKernelTools]);

  const allTools = Object.values(tools);

  const filteredTools = allTools.filter((tool) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      tool.name.toLowerCase().includes(q) ||
      tool.description.toLowerCase().includes(q) ||
      tool.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  // Group by category
  const byCategory: Record<string, typeof allTools> = {};
  for (const tool of filteredTools) {
    const cat = tool.category || "custom";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(tool);
  }

  const toggleTool = (toolId: string) => {
    if (enabledToolIds.includes(toolId)) {
      onChange(enabledToolIds.filter((id) => id !== toolId));
    } else {
      onChange([...enabledToolIds, toolId]);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: "24px", textAlign: "center" }}>
        <CircleNotch size={24} className="animate-spin" style={{ color: STUDIO_THEME.accent }} />
        <p style={{ fontSize: "13px", color: STUDIO_THEME.textMuted, marginTop: "12px" }}>
          Loading available tools...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: "10px",
          background: "var(--status-error-bg)",
          border: "1px solid rgba(239,68,68,0.15)",
          color: "#f87171",
          fontSize: "13px",
        }}
      >
        Failed to load tools: {error}
      </div>
    );
  }

  if (allTools.length === 0) {
    return (
      <div
        style={{
          padding: "24px",
          borderRadius: "10px",
          background: "var(--surface-hover)",
          border: "1px solid var(--ui-border-muted)",
          textAlign: "center",
        }}
      >
        <Wrench size={24} style={{ color: STUDIO_THEME.textMuted, marginBottom: "8px" }} />
        <p style={{ fontSize: "13px", color: STUDIO_THEME.textMuted }}>
          No tools available from the registry.
        </p>
        <p style={{ fontSize: "11px", color: STUDIO_THEME.textMuted, marginTop: "4px" }}>
          Make sure the Gateway API is running to load tools.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <MagnifyingGlass size={16} style={{ color: STUDIO_THEME.textMuted, flexShrink: 0 }} />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tools..."
          className="bg-white/5 border-white/10 text-white text-sm"
        />
      </div>

      {/* Summary bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderRadius: "8px",
          background: "var(--surface-hover)",
          border: "1px solid var(--ui-border-muted)",
        }}
      >
        <span style={{ fontSize: "12px", color: STUDIO_THEME.textSecondary }}>
          {enabledToolIds.length} tool{enabledToolIds.length !== 1 ? "s" : ""} enabled
        </span>
        <button
          onClick={() => onChange([])}
          style={{
            fontSize: "11px",
            color: STUDIO_THEME.textMuted,
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          Clear all
        </button>
      </div>

      {/* Categories */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {Object.entries(byCategory).map(([category, catTools]) => (
          <div key={category}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "8px",
              }}
            >
              <span style={{ color: STUDIO_THEME.accent }}>
                {CATEGORY_ICONS[category] || <Wrench size={14} />}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: STUDIO_THEME.textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {CATEGORY_LABELS[category] || category}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  color: STUDIO_THEME.textMuted,
                  marginLeft: "4px",
                }}
              >
                ({catTools.length})
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "8px",
              }}
            >
              {catTools.map((tool) => {
                const isEnabled = enabledToolIds.includes(tool.id);
                return (
                  <motion.div
                    key={tool.id}
                    whileHover={{ y: -1 }}
                    onClick={() => toggleTool(tool.id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: `1px solid ${
                        isEnabled
                          ? "rgba(212,149,106,0.25)"
                          : "var(--ui-border-muted)"
                      }`,
                      background: isEnabled
                        ? "rgba(212,149,106,0.08)"
                        : "var(--surface-hover)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ paddingTop: "2px", flexShrink: 0 }}>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => toggleTool(tool.id)}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: isEnabled
                            ? STUDIO_THEME.textPrimary
                            : STUDIO_THEME.textSecondary,
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        {tool.name}
                        {tool.source === "mcp" && (
                          <span
                            style={{
                              fontSize: "9px",
                              padding: "1px 5px",
                              borderRadius: "999px",
                              background: "rgba(59,130,246,0.15)",
                              color: "#60a5fa",
                              fontWeight: 600,
                            }}
                          >
                            MCP
                          </span>
                        )}
                        {tool.requiresConfirmation && (
                          <span
                            style={{
                              fontSize: "9px",
                              padding: "1px 5px",
                              borderRadius: "999px",
                              background: "rgba(245,158,11,0.15)",
                              color: "#fbbf24",
                              fontWeight: 600,
                            }}
                          >
                            CONFIRM
                          </span>
                        )}
                      </div>
                      {tool.description && (
                        <div
                          style={{
                            fontSize: "11px",
                            color: STUDIO_THEME.textMuted,
                            marginTop: "2px",
                            lineHeight: 1.4,
                          }}
                        >
                          {tool.description}
                        </div>
                      )}
                      {tool.tags.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            gap: "4px",
                            marginTop: "4px",
                            flexWrap: "wrap",
                          }}
                        >
                          {tool.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              style={{
                                fontSize: "9px",
                                padding: "1px 5px",
                                borderRadius: "4px",
                                background: "var(--surface-hover)",
                                color: STUDIO_THEME.textMuted,
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
