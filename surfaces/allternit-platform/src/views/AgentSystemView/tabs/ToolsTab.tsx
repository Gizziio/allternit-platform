/**
 * ToolsTab - Templates, Snapshots, and Settings
 * 
 * Features:
 * - Template editor/viewer
 * - Snapshot manager
 * - Receipt query interface
 * - Settings panel
 */

import React, { useState, useEffect } from "react";
import {
  FileText,
  Trash,
  MagnifyingGlass,
  GearSix,
  Database,
  ArrowsClockwise,
  HardDrive,
  X,
} from '@phosphor-icons/react';
import { useUnifiedStore } from "@/lib/agents/unified.store";
import type { PromptTemplate, ToolSnapshot } from "@/lib/agents/unified.store";
import type { Receipt } from "@/lib/agents";

export function ToolsTab() {
  const {
    templates,
    snapshots,
    snapshotStats,
    receipts,
    fetchTemplates,
    fetchSnapshots,
    fetchReceipts,
    clearSnapshot,
    clearAllSnapshots,
    executeTemplate,
  } = useUnifiedStore();

  const [activeSection, setActiveSection] = useState<"templates" | "snapshots" | "receipts" | "settings">("templates");
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
  const [receiptFilter, setReceiptFilter] = useState("");
  const [receiptKindFilter, setReceiptKindFilter] = useState<string>("all");

  // Fetch data on mount
  useEffect(() => {
    fetchTemplates();
    fetchSnapshots();
    fetchReceipts();
  }, [fetchTemplates, fetchSnapshots, fetchReceipts]);

  const handleTemplateSelect = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    const vars: Record<string, string> = {};
    template.variables.forEach((v) => {
      vars[v.name] = v.defaultValue?.toString() || "";
    });
    setTemplateVars(vars);
  };

  const handleExecuteTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      await executeTemplate(selectedTemplate.id, templateVars);
      setSelectedTemplate(null);
      setTemplateVars({});
    } catch (err) {
      // Error handled by store
    }
  };

  const filteredReceipts = receipts.filter((r) => {
    const matchesSearch = receiptFilter === "" || 
      r.receipt_id.toLowerCase().includes(receiptFilter.toLowerCase()) ||
      JSON.stringify(r.payload).toLowerCase().includes(receiptFilter.toLowerCase());
    const matchesKind = receiptKindFilter === "all" || r.kind === receiptKindFilter;
    return matchesSearch && matchesKind;
  });

  const receiptKinds = [...new Set(receipts.map((r) => r.kind))];

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Left Sidebar */}
      <div
        style={{
          width: 200,
          background: "var(--bg-secondary, #141414)",
          borderRight: "1px solid var(--border-subtle, #333)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <SidebarItem
          icon={FileText}
          label="Templates"
          isActive={activeSection === "templates"}
          onClick={() => setActiveSection("templates")}
        />
        <SidebarItem
          icon={Database}
          label="Snapshots"
          isActive={activeSection === "snapshots"}
          onClick={() => setActiveSection("snapshots")}
        />
        <SidebarItem
          icon={HardDrive}
          label="Receipts"
          isActive={activeSection === "receipts"}
          onClick={() => setActiveSection("receipts")}
        />
        <SidebarItem
          icon={GearSix}
          label="Settings"
          isActive={activeSection === "settings"}
          onClick={() => setActiveSection("settings")}
        />
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: 24,
        }}
      >
        {activeSection === "templates" && (
          <TemplatesSection
            templates={templates}
            selectedTemplate={selectedTemplate}
            templateVars={templateVars}
            onSelect={handleTemplateSelect}
            onVarChange={(name, value) => setTemplateVars((prev) => ({ ...prev, [name]: value }))}
            onExecute={handleExecuteTemplate}
            onClose={() => setSelectedTemplate(null)}
          />
        )}

        {activeSection === "snapshots" && (
          <SnapshotsSection
            snapshots={snapshots}
            stats={snapshotStats}
            onClear={(id) => clearSnapshot(id)}
            onClearAll={() => clearAllSnapshots()}
          />
        )}

        {activeSection === "receipts" && (
          <ReceiptsSection
            receipts={filteredReceipts}
            kinds={receiptKinds}
            filter={receiptFilter}
            kindFilter={receiptKindFilter}
            onFilterChange={setReceiptFilter}
            onKindFilterChange={setReceiptKindFilter}
            onRefresh={() => fetchReceipts()}
          />
        )}

        {activeSection === "settings" && <SettingsSection />}
      </div>
    </div>
  );
}

// Sidebar Item Component
function SidebarItem({
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 20px",
        background: isActive ? "#0a84ff20" : "transparent",
        border: "none",
        borderLeft: `3px solid ${isActive ? "#0a84ff" : "transparent"}`,
        color: isActive ? "#0a84ff" : "var(--text-primary, #f0f0f0)",
        fontSize: 14,
        fontWeight: isActive ? 600 : 500,
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.2s",
      }}
    >
      <Icon size={18} />
      {label}
    </button>
  );
}

// Templates Section
function TemplatesSection({
  templates,
  selectedTemplate,
  templateVars,
  onSelect,
  onVarChange,
  onExecute,
  onClose,
}: {
  templates: PromptTemplate[];
  selectedTemplate: PromptTemplate | null;
  templateVars: Record<string, string>;
  onSelect: (t: PromptTemplate) => void;
  onVarChange: (name: string, value: string) => void;
  onExecute: () => void;
  onClose: () => void;
}) {
  return (
    <div>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          margin: "0 0 24px 0",
        }}
      >
        Templates
      </h2>

      {selectedTemplate ? (
        <div
          style={{
            background: "var(--bg-secondary, #141414)",
            border: "1px solid var(--border-subtle, #333)",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  margin: "0 0 4px 0",
                }}
              >
                {selectedTemplate.name}
              </h3>
              <span
                style={{
                  fontSize: 12,
                  color: "#888",
                }}
              >
                {selectedTemplate.category} • v{selectedTemplate.version}
              </span>
            </div>
            <button
              onClick={onClose}
              style={{
                padding: 8,
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <X size={20} color="#888" />
            </button>
          </div>

          <p
            style={{
              fontSize: 14,
              color: "#888",
              marginBottom: 24,
            }}
          >
            {selectedTemplate.description}
          </p>

          <div
            style={{
              background: "var(--bg-primary, #0a0a0a)",
              padding: 16,
              borderRadius: 8,
              marginBottom: 24,
              fontFamily: "monospace",
              fontSize: 13,
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
            }}
          >
            {selectedTemplate.template}
          </div>

          <h4
            style={{
              fontSize: 14,
              fontWeight: 600,
              margin: "0 0 16px 0",
            }}
          >
            Variables
          </h4>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginBottom: 24,
            }}
          >
            {selectedTemplate.variables.map((variable) => (
              <div key={variable.name}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "#888",
                    marginBottom: 4,
                  }}
                >
                  {variable.name}
                  {variable.required && <span style={{ color: "#ff3b30" }}> *</span>}
                </label>
                <input
                  type="text"
                  value={templateVars[variable.name] || ""}
                  onChange={(e) => onVarChange(variable.name, e.target.value)}
                  placeholder={variable.description}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--bg-primary, #0a0a0a)",
                    border: "1px solid var(--border-subtle, #333)",
                    borderRadius: 6,
                    color: "var(--text-primary, #f0f0f0)",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ))}
          </div>

          <button
            onClick={onExecute}
            style={{
              width: "100%",
              padding: "12px",
              background: "#0a84ff",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Execute Template
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {templates.map((template) => (
            <div
              key={template.id}
              onClick={() => onSelect(template)}
              style={{
                background: "var(--bg-secondary, #141414)",
                border: "1px solid var(--border-subtle, #333)",
                borderRadius: 12,
                padding: 20,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#0a84ff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-subtle, #333)";
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: "#0a84ff20",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FileText size={20} color="#0a84ff" />
                </div>
                <div>
                  <h4
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      margin: 0,
                    }}
                  >
                    {template.name}
                  </h4>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#888",
                      textTransform: "uppercase",
                    }}
                  >
                    {template.category}
                  </span>
                </div>
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: "#888",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {template.description}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 12,
                  flexWrap: "wrap",
                }}
              >
                {template.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      padding: "4px 8px",
                      background: "var(--bg-primary, #0a0a0a)",
                      borderRadius: 4,
                      fontSize: 10,
                      color: "#888",
                      textTransform: "uppercase",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Snapshots Section
function SnapshotsSection({
  snapshots,
  stats,
  onClear,
  onClearAll,
}: {
  snapshots: ToolSnapshot[];
  stats?: { total: number; totalSize: number };
  onClear: (id: string) => void;
  onClearAll: () => void;
}) {
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            margin: 0,
          }}
        >
          Snapshots
        </h2>
        {snapshots.length > 0 && (
          <button
            onClick={onClearAll}
            style={{
              padding: "8px 16px",
              background: "#ff3b30",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Trash size={14} />
            Clear All
          </button>
        )}
      </div>

      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <StatBox label="Total Snapshots" value={stats.total} />
          <StatBox label="Total Size" value={formatSize(stats.totalSize)} />
          <StatBox label="Tools" value={[...new Set(snapshots.map((s) => s.toolName))].length} />
        </div>
      )}

      {snapshots.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "#666",
          }}
        >
          <Database size={64} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p>No snapshots stored</p>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.snapshotId}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 16,
                background: "var(--bg-secondary, #141414)",
                border: "1px solid var(--border-subtle, #333)",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Database size={20} color="#0a84ff" />
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {snapshot.toolName}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#888",
                    }}
                  >
                    {formatSize(snapshot.size)} • {new Date(snapshot.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <button
                onClick={() => onClear(snapshot.snapshotId)}
                style={{
                  padding: 8,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Trash size={16} color="#ff3b30" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Receipts Section
function ReceiptsSection({
  receipts,
  kinds,
  filter,
  kindFilter,
  onFilterChange,
  onKindFilterChange,
  onRefresh,
}: {
  receipts: Receipt[];
  kinds: string[];
  filter: string;
  kindFilter: string;
  onFilterChange: (value: string) => void;
  onKindFilterChange: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            margin: 0,
          }}
        >
          Receipts
        </h2>
        <button
          onClick={onRefresh}
          style={{
            padding: 8,
            background: "transparent",
            border: "1px solid var(--border-subtle, #333)",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          <ArrowsClockwise size={16} color="#888" />
        </button>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: "var(--bg-secondary, #141414)",
            border: "1px solid var(--border-subtle, #333)",
            borderRadius: 8,
          }}
        >
          <MagnifyingGlass size={16} color="#888" />
          <input
            type="text"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Search receipts..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "var(--text-primary, #f0f0f0)",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>
        <select
          value={kindFilter}
          onChange={(e) => onKindFilterChange(e.target.value)}
          style={{
            padding: "10px 14px",
            background: "var(--bg-secondary, #141414)",
            border: "1px solid var(--border-subtle, #333)",
            borderRadius: 8,
            color: "var(--text-primary, #f0f0f0)",
            fontSize: 14,
          }}
        >
          <option value="all">All Kinds</option>
          {kinds.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </div>

      {/* Receipts List */}
      {receipts.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "#666",
          }}
        >
          <HardDrive size={64} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p>No receipts found</p>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {receipts.map((receipt) => (
            <div
              key={receipt.receipt_id}
              style={{
                padding: 16,
                background: "var(--bg-secondary, #141414)",
                border: "1px solid var(--border-subtle, #333)",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "monospace",
                  }}
                >
                  {receipt.receipt_id}
                </span>
                <span
                  style={{
                    padding: "4px 8px",
                    background: "#0a84ff20",
                    borderRadius: 4,
                    fontSize: 11,
                    color: "#0a84ff",
                    textTransform: "uppercase",
                  }}
                >
                  {receipt.kind}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#888",
                  marginBottom: 8,
                }}
              >
                DAG: {receipt.dag_id} • Node: {receipt.node_id} • WIH: {receipt.wih_id}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#666",
                }}
              >
                {new Date(receipt.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Settings Section
function SettingsSection() {
  return (
    <div>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          margin: "0 0 24px 0",
        }}
      >
        Settings
      </h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <SettingItem
          title="Auto-refresh Interval"
          description="How often to sync with Rails backend"
          value="30 seconds"
        />
        <SettingItem
          title="Log Level"
          description="Minimum log level to display"
          value="Info"
        />
        <SettingItem
          title="Theme"
          description="UI color theme"
          value="Dark"
        />
        <SettingItem
          title="Notifications"
          description="Enable desktop notifications"
          value="Enabled"
        />
      </div>
    </div>
  );
}

// Setting Item Component
function SettingItem({
  title,
  description,
  value,
}: {
  title: string;
  description: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        background: "var(--bg-secondary, #141414)",
        border: "1px solid var(--border-subtle, #333)",
        borderRadius: 8,
      }}
    >
      <div>
        <h4
          style={{
            fontSize: 14,
            fontWeight: 600,
            margin: "0 0 4px 0",
          }}
        >
          {title}
        </h4>
        <p
          style={{
            fontSize: 12,
            color: "#888",
            margin: 0,
          }}
        >
          {description}
        </p>
      </div>
      <span
        style={{
          fontSize: 13,
          color: "#0a84ff",
          fontWeight: 600,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// Stat Box Component
function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        padding: 16,
        background: "var(--bg-secondary, #141414)",
        border: "1px solid var(--border-subtle, #333)",
        borderRadius: 8,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#0a84ff",
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#888",
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default ToolsTab;
