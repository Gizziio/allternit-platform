/**
 * MacosWindow — macOS app window shell with traffic lights
 * Ported from alchaincyf/huashu-design macos_window.jsx
 */

import React from "react";

interface MacosWindowProps {
  children?: React.ReactNode;
  title?: string;
  width?: number;
  height?: number;
  darkMode?: boolean;
}

export function MacosWindow({
  title = "",
  width = 900,
  height = 600,
  darkMode = false,
  children,
}: MacosWindowProps) {
  return (
    <div style={{
      display: "inline-block",
      background: darkMode ? "#1e1e1e" : "#fff",
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: "0 30px 80px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.15)",
    }}>
      <div style={{
        height: 38,
        background: darkMode
          ? "linear-gradient(to bottom, #3c3c3c, #2c2c2c)"
          : "linear-gradient(to bottom, #e8e8e8, #d8d8d8)",
        display: "flex",
        alignItems: "center",
        padding: "0 14px",
        borderBottom: darkMode ? "0.5px solid rgba(255,255,255,0.1)" : "0.5px solid rgba(0,0,0,0.1)",
        position: "relative",
        userSelect: "none",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57", border: "0.5px solid rgba(0,0,0,0.15)" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#febc2e", border: "0.5px solid rgba(0,0,0,0.15)" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840", border: "0.5px solid rgba(0,0,0,0.15)" }} />
        </div>
        {title && (
          <div style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 13,
            color: darkMode ? "#ddd" : "#333",
            fontWeight: 500,
            fontFamily: 'var(--font-sans)',
            pointerEvents: "none",
          }}>
            {title}
          </div>
        )}
      </div>
      <div style={{ position: "relative", overflow: "auto", width, height }}>
        {children}
      </div>
    </div>
  );
}
