/**
 * BrowserWindow — Chrome-style browser window shell with tab + URL bar
 * Ported from alchaincyf/huashu-design browser_window.jsx
 */

import React from "react";

interface BrowserWindowProps {
  children?: React.ReactNode;
  title?: string;
  url?: string;
  width?: number;
  height?: number;
  showTrafficLights?: boolean;
}

export function BrowserWindow({
  title = "New Tab",
  url = "https://example.com",
  width = 1200,
  height = 800,
  showTrafficLights = true,
  children,
}: BrowserWindowProps) {
  return (
    <div style={{
      display: "inline-block",
      background: "#fff",
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: "0 30px 80px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.15)",
    }}>
      {/* Chrome bar */}
      <div style={{ background: "#dee1e6", paddingTop: 10, paddingLeft: 10, paddingRight: 10, userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, position: "relative" }}>
          {showTrafficLights && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 10, marginRight: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57", border: "0.5px solid rgba(0,0,0,0.15)" }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#febc2e", border: "0.5px solid rgba(0,0,0,0.15)" }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840", border: "0.5px solid rgba(0,0,0,0.15)" }} />
            </div>
          )}
          <div style={{
            background: "#fff",
            padding: "8px 30px 8px 14px",
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            fontSize: 12,
            color: "#222",
            fontFamily: 'var(--font-sans)',
            maxWidth: 220,
            display: "flex",
            alignItems: "center",
            gap: 8,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            <div style={{ width: 14, height: 14, borderRadius: 2, background: "#999", flexShrink: 0 }} />
            <span>{title}</span>
          </div>
        </div>
      </div>

      {/* Nav bar */}
      <div style={{
        background: "#fff",
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderBottom: "1px solid #e5e7eb",
      }}>
        <div style={{ display: "flex", gap: 4, color: "#5f6368", fontSize: 16 }}>
          {["←", "→", "↻"].map((ch) => (
            <div key={ch} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}>
              {ch}
            </div>
          ))}
        </div>
        <div style={{
          flex: 1,
          background: "#f1f3f4",
          borderRadius: 999,
          padding: "7px 14px",
          fontSize: 13,
          color: "#333",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: 'var(--font-sans)',
        }}>
          <span style={{ color: "#5f6368", fontSize: 12 }}>🔒</span>
          <span>{url}</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ position: "relative", overflow: "auto", background: "#fff", width, height }}>
        {children}
      </div>
    </div>
  );
}
