"use client";

import React from "react";
import { motion } from "framer-motion";
import { STUDIO_THEME } from "../AgentView.constants";

export interface AvatarPickerConfig {
  initial: string;
  bgColor: string;
  textColor: string;
  shape: "square" | "rounded" | "circle";
}

const PALETTE = [
  { bg: "#4f46e5", text: "#fff", label: "Indigo" },
  { bg: "#0ea5e9", text: "#fff", label: "Sky" },
  { bg: "#10b981", text: "#fff", label: "Emerald" },
  { bg: "#f59e0b", text: "#fff", label: "Amber" },
  { bg: "#ec4899", text: "#fff", label: "Pink" },
  { bg: "#8b5cf6", text: "#fff", label: "Violet" },
  { bg: "#ef4444", text: "#fff", label: "Red" },
  { bg: "#14b8a6", text: "#fff", label: "Teal" },
  { bg: "#6366f1", text: "#fff", label: "Purple" },
  { bg: "#84cc16", text: "#fff", label: "Lime" },
  { bg: "#06b6d4", text: "#fff", label: "Cyan" },
  { bg: "#f97316", text: "#fff", label: "Orange" },
];

interface AgentAvatarPickerProps {
  name: string;
  config: AvatarPickerConfig;
  onChange: (config: AvatarPickerConfig) => void;
}

export function AgentAvatarPicker({ name, config, onChange }: AgentAvatarPickerProps) {
  const displayInitial = config.initial || name.charAt(0).toUpperCase() || "A";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Preview */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "24px",
          borderRadius: "12px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <motion.div
          key={config.bgColor + config.shape}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          style={{
            width: 80,
            height: 80,
            borderRadius:
              config.shape === "circle"
                ? "50%"
                : config.shape === "rounded"
                  ? "16px"
                  : "8px",
            background: config.bgColor,
            color: config.textColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "32px",
            fontWeight: 700,
            fontFamily: "system-ui, sans-serif",
            boxShadow: `0 4px 20px ${config.bgColor}40`,
          }}
        >
          {displayInitial}
        </motion.div>
      </div>

      {/* Color palette */}
      <div>
        <label
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: STUDIO_THEME.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "10px",
            display: "block",
          }}
        >
          Color
        </label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: "8px",
          }}
        >
          {PALETTE.map((color) => (
            <button
              key={color.bg}
              onClick={() =>
                onChange({ ...config, bgColor: color.bg, textColor: color.text })
              }
              style={{
                width: "100%",
                aspectRatio: "1",
                borderRadius: "8px",
                background: color.bg,
                border:
                  config.bgColor === color.bg
                    ? "2px solid rgba(255,255,255,0.6)"
                    : "2px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s ease",
                position: "relative",
              }}
              title={color.label}
            >
              {config.bgColor === color.bg && (
                <div
                  style={{
                    position: "absolute",
                    inset: "-4px",
                    borderRadius: "10px",
                    border: `2px solid ${color.bg}`,
                    opacity: 0.4,
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Shape */}
      <div>
        <label
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: STUDIO_THEME.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "10px",
            display: "block",
          }}
        >
          Shape
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          {(["square", "rounded", "circle"] as const).map((shape) => (
            <button
              key={shape}
              onClick={() => onChange({ ...config, shape })}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                border: `1px solid ${
                  config.shape === shape
                    ? "rgba(212,149,106,0.4)"
                    : "rgba(255,255,255,0.08)"
                }`,
                background:
                  config.shape === shape
                    ? "rgba(212,149,106,0.08)"
                    : "rgba(255,255,255,0.02)",
                color: STUDIO_THEME.textSecondary,
                fontSize: "12px",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {shape}
            </button>
          ))}
        </div>
      </div>

      {/* Initial override */}
      <div>
        <label
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: STUDIO_THEME.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "10px",
            display: "block",
          }}
        >
          Initial (auto from name)
        </label>
        <input
          type="text"
          maxLength={2}
          value={config.initial}
          onChange={(e) =>
            onChange({
              ...config,
              initial: e.target.value.toUpperCase().slice(0, 2),
            })
          }
          placeholder={name.charAt(0).toUpperCase()}
          style={{
            width: "60px",
            padding: "8px 12px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: STUDIO_THEME.textPrimary,
            fontSize: "16px",
            fontWeight: 700,
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}

export function createDefaultAvatarPickerConfig(name: string): AvatarPickerConfig {
  const colors = PALETTE[Math.abs(name.charCodeAt(0)) % PALETTE.length];
  return {
    initial: name.charAt(0).toUpperCase(),
    bgColor: colors.bg,
    textColor: colors.text,
    shape: "rounded",
  };
}
