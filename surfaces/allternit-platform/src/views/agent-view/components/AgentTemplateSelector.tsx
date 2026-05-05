"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Robot, MagnifyingGlass, Code, PenNib, Bug, ShieldCheck, ChartLineUp, FileText, Globe, Wrench } from "@phosphor-icons/react";
import { SPECIALIST_TEMPLATES } from "@/lib/agents/agent-templates.specialist";
import type { SpecialistTemplate } from "@/lib/agents/agent-templates.specialist";
import { STUDIO_THEME } from "../AgentView.constants";

interface AgentTemplateSelectorProps {
  selectedTemplateId: string | null;
  onSelect: (template: SpecialistTemplate | null) => void;
}

const CATEGORY_ORDER = [
  "engineering",
  "design",
  "product",
  "testing",
  "business",
  "support",
  "specialized",
];

const CATEGORY_LABELS: Record<string, string> = {
  engineering: "Engineering",
  design: "Design",
  product: "Product",
  testing: "Testing",
  business: "Business",
  support: "Support",
  specialized: "Specialized",
  "agent-types": "Agent Types",
  "communication-styles": "Communication",
  "task-types": "Task Types",
  "general-assistant": "General",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  engineering: <Code size={14} />,
  design: <PenNib size={14} />,
  product: <ChartLineUp size={14} />,
  testing: <Bug size={14} />,
  business: <ChartLineUp size={14} />,
  support: <Wrench size={14} />,
  specialized: <ShieldCheck size={14} />,
  "agent-types": <Robot size={14} />,
  "communication-styles": <FileText size={14} />,
  "task-types": <Globe size={14} />,
  "general-assistant": <Robot size={14} />,
};

const AVATAR_COLORS = [
  { bg: "#4f46e5", text: "#fff" },
  { bg: "#0ea5e9", text: "#fff" },
  { bg: "#10b981", text: "#fff" },
  { bg: "#f59e0b", text: "#fff" },
  { bg: "#ec4899", text: "#fff" },
  { bg: "#8b5cf6", text: "#fff" },
  { bg: "#ef4444", text: "#fff" },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function AgentTemplateSelector({
  selectedTemplateId,
  onSelect,
}: AgentTemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = SPECIALIST_TEMPLATES.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  // Group by category
  const byCategory: Record<string, SpecialistTemplate[]> = {};
  for (const t of filtered) {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t);
  }

  // Sort categories
  const sortedCategories = Object.keys(byCategory).sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <MagnifyingGlass size={16} style={{ color: STUDIO_THEME.textMuted }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search templates..."
          style={{
            flex: 1,
            background: `${STUDIO_THEME.textPrimary}05`,
            border: `1px solid ${STUDIO_THEME.textPrimary}10`,
            borderRadius: "8px",
            padding: "8px 12px",
            color: STUDIO_THEME.textPrimary,
            fontSize: "14px",
            outline: "none",
            fontFamily: 'var(--font-sans)',
          }}
        />
      </div>

      {/* Start from scratch card */}
      <button
        onClick={() => onSelect(null)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "14px 16px",
          borderRadius: "10px",
          border: `1px solid ${
            selectedTemplateId === null
              ? `${STUDIO_THEME.accent}4D`
              : `${STUDIO_THEME.textPrimary}10`
          }`,
          background:
            selectedTemplateId === null
              ? `${STUDIO_THEME.accent}14`
              : `${STUDIO_THEME.textPrimary}05`,
          cursor: "pointer",
          transition: "all 0.15s ease",
          textAlign: "left",
          width: "100%",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: `${STUDIO_THEME.textPrimary}10`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: STUDIO_THEME.textSecondary,
            flexShrink: 0,
          }}
        >
          <Robot size={18} />
        </div>
        <div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: STUDIO_THEME.textPrimary,
            }}
          >
            Start from scratch
          </div>
          <div style={{ fontSize: "12px", color: STUDIO_THEME.textMuted }}>
            Build a custom agent with your own configuration
          </div>
        </div>
        {selectedTemplateId === null && (
          <div
            style={{
              marginLeft: "auto",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: STUDIO_THEME.accent,
            }}
          />
        )}
      </button>

      {/* Templates by category */}
      {sortedCategories.map((category) => (
        <div key={category}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "10px",
            }}
          >
            <span style={{ color: STUDIO_THEME.accent }}>
              {CATEGORY_ICONS[category] || <Robot size={14} />}
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
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "10px",
            }}
          >
            {byCategory[category].map((template, i) => {
              const isSelected = selectedTemplateId === template.id;
              const avatar = getAvatarColor(template.name);
              return (
                <motion.button
                  key={template.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => onSelect(template)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "12px",
                    borderRadius: "10px",
                    border: `1px solid ${
                      isSelected
                        ? `${STUDIO_THEME.accent}4D`
                        : `${STUDIO_THEME.textPrimary}10`
                    }`,
                    background: isSelected
                      ? `${STUDIO_THEME.accent}14`
                      : `${STUDIO_THEME.textPrimary}05`,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: avatar.bg,
                        color: avatar.text,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "13px",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {template.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: STUDIO_THEME.textPrimary,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {template.name}
                      </div>
                    </div>
                    {isSelected && (
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: STUDIO_THEME.accent,
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: STUDIO_THEME.textMuted,
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {template.description}
                  </div>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "auto" }}>
                    {template.agentConfig.capabilities?.slice(0, 3).map((cap) => (
                      <span
                        key={cap}
                        style={{
                          fontSize: "9px",
                          padding: "1px 5px",
                          borderRadius: "4px",
                          background: `${STUDIO_THEME.textPrimary}08`,
                          color: STUDIO_THEME.textMuted,
                        }}
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
