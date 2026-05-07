"use client";

import React, { useState, useMemo } from "react";
import { Search, Download, Star, Shield, Wrench, Check, ExternalLink } from "lucide-react";
import { useToolRegistryStore } from "@/lib/agents/tool-registry.store";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ToolRegistryEntry } from "@/lib/agents/tool-registry.store";

interface McpServerCardProps {
  tool: ToolRegistryEntry;
  installed?: boolean;
  onInstall?: () => void;
}

function McpServerCard({ tool, installed, onInstall }: McpServerCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 14,
        borderRadius: 12,
        background: "var(--surface-floating)",
        border: "1px solid var(--ui-border-muted)",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent-chat)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--ui-border-muted)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: tool.source === "mcp" ? "#10b98120" : "var(--chat-composer-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: tool.source === "mcp" ? "#10b981" : "var(--ui-text-secondary)",
            }}
          >
            <Wrench size={18} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ui-text-primary)" }}>{tool.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <Badge variant="outline" className="text-[10px] py-0 h-4">
                {tool.source}
              </Badge>
              {tool.category && (
                <span style={{ fontSize: 11, color: "var(--ui-text-muted)" }}>{tool.category}</span>
              )}
              {tool.requiresConfirmation && (
                <Shield size={10} color="#f59e0b" />
              )}
            </div>
          </div>
        </div>
        {installed ? (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#10b981", fontWeight: 600 }}>
            <Check size={14} />
            Installed
          </span>
        ) : (
          <button
            onClick={onInstall}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 12px",
              borderRadius: 6,
              background: "var(--accent-chat)",
              color: "#000",
              border: "none",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Download size={14} />
            Install
          </button>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 13, color: "var(--ui-text-secondary)", lineHeight: 1.4 }}>
        {tool.description}
      </p>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8, borderTop: "1px solid var(--ui-border-muted)" }}>
          {tool.tags && tool.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {tool.tags.map((tag) => (
                <span key={tag} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--chat-composer-soft)", color: "var(--ui-text-secondary)" }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div style={{ fontSize: 12, color: "var(--ui-text-muted)" }}>
            Version: {tool.version || "unknown"}
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          alignSelf: "flex-start",
          background: "transparent",
          border: "none",
          color: "var(--ui-text-muted)",
          fontSize: 12,
          cursor: "pointer",
          padding: 0,
        }}
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}

interface McpMarketplaceProps {
  onInstall?: (tool: ToolRegistryEntry) => void;
}

export function McpMarketplace({ onInstall }: McpMarketplaceProps) {
  const { tools, isLoading, fetchKernelTools } = useToolRegistryStore();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  React.useEffect(() => {
    fetchKernelTools().catch(() => {});
  }, [fetchKernelTools]);

  const allTools = useMemo(() => Object.values(tools), [tools]);

  const filtered = useMemo(() => {
    return allTools.filter((tool) => {
      const matchesSearch =
        !search ||
        tool.name.toLowerCase().includes(search.toLowerCase()) ||
        tool.description.toLowerCase().includes(search.toLowerCase());
      const matchesSource = !sourceFilter || tool.source === sourceFilter;
      return matchesSearch && matchesSource;
    });
  }, [allTools, search, sourceFilter]);

  const mcpTools = filtered.filter((t) => t.source === "mcp");
  const nativeTools = filtered.filter((t) => t.source === "native");
  const customTools = filtered.filter((t) => t.source === "custom");

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "var(--ui-text-primary)" }}>Tool Marketplace</h1>
          <p style={{ margin: "6px 0 0 0", color: "var(--ui-text-muted)", fontSize: 14 }}>
            Browse and install MCP servers, native tools, and custom connectors.
          </p>
        </div>
      </div>

      {/* Search + filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ui-text-muted)" }} />
          <Input
            placeholder="Search tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
        {["mcp", "native", "custom"].map((source) => (
          <button
            key={source}
            onClick={() => setSourceFilter(sourceFilter === source ? null : source)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid",
              borderColor: sourceFilter === source ? "var(--accent-chat)" : "var(--ui-border-muted)",
              background: sourceFilter === source ? "var(--chat-composer-soft)" : "transparent",
              color: sourceFilter === source ? "var(--accent-chat)" : "var(--ui-text-secondary)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            {source}
          </button>
        ))}
      </div>

      {isLoading && <p style={{ color: "var(--ui-text-muted)" }}>Loading tools...</p>}

      {/* MCP Servers */}
      {mcpTools.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ui-text-primary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
            MCP Servers
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {mcpTools.map((tool) => (
              <McpServerCard key={tool.id} tool={tool} installed={tool.isRegistered} onInstall={() => onInstall?.(tool)} />
            ))}
          </div>
        </div>
      )}

      {/* Native Tools */}
      {nativeTools.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ui-text-primary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
            Native Tools
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {nativeTools.map((tool) => (
              <McpServerCard key={tool.id} tool={tool} installed={true} />
            ))}
          </div>
        </div>
      )}

      {/* Custom Tools */}
      {customTools.length > 0 && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ui-text-primary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
            Custom Tools
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {customTools.map((tool) => (
              <McpServerCard key={tool.id} tool={tool} installed={tool.isRegistered} onInstall={() => onInstall?.(tool)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
