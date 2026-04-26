"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  CaretDown as ChevronDown,
  ShieldCheck,
  Heart,
  BookOpen,
  Wrench,
  Clock,
  CheckCircle,
} from "@phosphor-icons/react";
import { STUDIO_THEME } from "../AgentView.constants";

export interface WorkspaceDocument {
  path: string;
  content: string;
  required: boolean;
}

interface AgentWorkspacePreviewProps {
  agentName: string;
  description: string;
  tools: string[];
  documents: WorkspaceDocument[];
  selectedPaths: string[];
  onTogglePath: (path: string) => void;
}

const DOC_ICONS: Record<string, React.ReactNode> = {
  "README.md": <BookOpen size={14} />,
  "SOUL.md": <Heart size={14} />,
  "TOOLS.md": <Wrench size={14} />,
  "HEARTBEAT.md": <Clock size={14} />,
  "PLAYBOOK.md": <ShieldCheck size={14} />,
  "IDENTITY.md": <FileText size={14} />,
};

const DOC_DESCRIPTIONS: Record<string, string> = {
  "README.md": "Agent overview and documentation",
  "SOUL.md": "Trust tiers, core values, self-awareness",
  "TOOLS.md": "Tool inventory and usage guidelines",
  "HEARTBEAT.md": "Scheduled periodic tasks",
  "PLAYBOOK.md": "Execution rules and error handling",
  "IDENTITY.md": "Identity card and purpose statement",
  "memory/active-tasks.md": "Active task tracking",
};

export function AgentWorkspacePreview({
  agentName,
  description,
  tools,
  documents,
  selectedPaths,
  onTogglePath,
}: AgentWorkspacePreviewProps) {
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header info */}
      <div
        style={{
          padding: "12px 16px",
          borderRadius: "10px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: STUDIO_THEME.textPrimary,
          }}
        >
          {agentName} Workspace
        </div>
        <div style={{ fontSize: "11px", color: STUDIO_THEME.textMuted, marginTop: "2px" }}>
          {documents.length} document{documents.length !== 1 ? "s" : ""} ·{" "}
          {selectedPaths.length} selected · {tools.length} tool{tools.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Document list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {documents.map((doc) => {
          const isSelected = selectedPaths.includes(doc.path);
          const isExpanded = expandedDoc === doc.path;
          const filename = doc.path.split("/").pop() || doc.path;
          const icon = DOC_ICONS[filename] || <FileText size={14} />;
          const desc = DOC_DESCRIPTIONS[filename] || "Workspace document";

          return (
            <div
              key={doc.path}
              style={{
                borderRadius: "10px",
                border: `1px solid ${
                  isSelected
                    ? "rgba(212,149,106,0.2)"
                    : "rgba(255,255,255,0.06)"
                }`,
                background: isSelected
                  ? "rgba(212,149,106,0.04)"
                  : "rgba(255,255,255,0.01)",
                overflow: "hidden",
              }}
            >
              {/* Row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (!doc.required) onTogglePath(doc.path);
                }}
              >
                {/* Checkbox */}
                <div
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "5px",
                    border: `1px solid ${
                      isSelected
                        ? STUDIO_THEME.accent
                        : "rgba(255,255,255,0.15)"
                    }`,
                    background: isSelected ? STUDIO_THEME.accent : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.15s",
                  }}
                >
                  {isSelected && <CheckCircle size={12} color="#1A1612" />}
                </div>

                {/* Icon */}
                <span style={{ color: STUDIO_THEME.accent, flexShrink: 0 }}>
                  {icon}
                </span>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: isSelected
                        ? STUDIO_THEME.textPrimary
                        : STUDIO_THEME.textSecondary,
                    }}
                  >
                    {filename}
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: STUDIO_THEME.textMuted,
                    }}
                  >
                    {desc}
                    {doc.required && (
                      <span
                        style={{
                          marginLeft: "6px",
                          color: STUDIO_THEME.accent,
                          fontWeight: 600,
                        }}
                      >
                        required
                      </span>
                    )}
                  </div>
                </div>

                {/* Expand */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedDoc(isExpanded ? null : doc.path);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: STUDIO_THEME.textMuted,
                    cursor: "pointer",
                    padding: "4px",
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              {/* Expanded preview */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div
                      style={{
                        padding: "0 12px 12px 44px",
                      }}
                    >
                      <pre
                        style={{
                          margin: 0,
                          padding: "10px",
                          borderRadius: "8px",
                          background: "rgba(0,0,0,0.25)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          color: STUDIO_THEME.textSecondary,
                          fontSize: "11px",
                          lineHeight: 1.5,
                          maxHeight: "200px",
                          overflow: "auto",
                          fontFamily: "ui-monospace, monospace",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {doc.content}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function generateWorkspaceDocs(
  name: string,
  agentDescription: string,
  tools: string[]
): WorkspaceDocument[] {
  const now = new Date().toISOString().split("T")[0];
  return [
    {
      path: "README.md",
      required: true,
      content: `# ${name}

${agentDescription || "Agent workspace documentation."}

## Created
${now}

## Status
Active`,
    },
    {
      path: "identity/IDENTITY.md",
      required: true,
      content: `# IDENTITY.md — ${name}

| Field | Value |
|-------|-------|
| **Name** | ${name} |
| **Version** | 1.0.0 |

## Purpose
${agentDescription || "To assist the user effectively."}

## Core Values
- Helpfulness
- Accuracy
- Efficiency`,
    },
    {
      path: "identity/SOUL.md",
      required: true,
      content: `# SOUL.md — ${name}'s Soul Configuration

## Trust Tiers

### Tier 1 — Foundation
- Respect user preferences
- Maintain transparency
- Admit limitations honestly

### Tier 2 — Boundaries
- Only use granted tools
- Confirm destructive actions
- Protect sensitive data`,
    },
    {
      path: "governance/PLAYBOOK.md",
      required: false,
      content: `# PLAYBOOK.md — ${name}'s Execution Rules

## Standard Operating Procedures

### Communication
- Be clear and direct
- Adapt tone to context

### Error Handling
- Acknowledge limitations honestly
- Offer alternatives when stuck

### Tool Usage
- Only use tools the user has granted access to
- Confirm before destructive operations`,
    },
    {
      path: "governance/TOOLS.md",
      required: false,
      content: `# TOOLS.md — ${name}'s Tool Inventory

## Available Tools
${tools.length > 0 ? tools.map((t) => `- ${t}`).join("\n") : "*No tools configured*"}

## Tool Usage Guidelines
- Verify permissions before use
- Explain what tools will do
- Report results clearly`,
    },
    {
      path: "governance/HEARTBEAT.md",
      required: false,
      content: `# HEARTBEAT.md — ${name}'s Periodic Tasks

## Scheduled Tasks
*Configure in CronJob wizard*

### Daily
- [ ] Self-check
- [ ] Memory review

### Weekly
- [ ] Performance review
- [ ] Archive old data`,
    },
    {
      path: "memory/active-tasks.md",
      required: false,
      content: `# Active Tasks

*No active tasks*

> Tasks will be automatically added when ${name} receives work.`,
    },
  ];
}
