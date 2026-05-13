/**
 * AndroidFrame — Android device shell (Pixel 8 reference, 412×892)
 * Ported from alchaincyf/huashu-design android_frame.jsx
 */

import React from "react";

const styles = {
  wrapper: {
    display: "inline-block",
    padding: 10,
    background: "#1a1a1a",
    borderRadius: 44,
    boxShadow: "0 0 0 2px #2a2a2a, 0 20px 60px rgba(0,0,0,0.3)",
    position: "relative" as const,
  },
  screen: {
    position: "relative" as const,
    borderRadius: 36,
    overflow: "hidden" as const,
    background: "#fff",
  },
  statusBar: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    height: 32,
    display: "flex",
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: "0 24px",
    fontSize: 14,
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    zIndex: 20,
    pointerEvents: "none" as const,
  },
  punchHole: {
    position: "absolute" as const,
    top: 10,
    left: "50%",
    transform: "translateX(-50%)",
    width: 14,
    height: 14,
    background: "#000",
    borderRadius: "50%",
    zIndex: 30,
  },
  statusIcons: {
    display: "flex",
    alignItems: "center" as const,
    gap: 6,
  },
  content: {
    position: "absolute" as const,
    top: 32,
    left: 0,
    right: 0,
    bottom: 24,
    overflow: "auto" as const,
  },
  navBar: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    display: "flex",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 60,
    zIndex: 10,
  },
};

interface AndroidFrameProps {
  children?: React.ReactNode;
  width?: number;
  height?: number;
  time?: string;
  battery?: number;
  darkMode?: boolean;
  navStyle?: "gesture" | "buttons";
}

export function AndroidFrame({
  children,
  width = 412,
  height = 892,
  time = "9:41",
  battery = 100,
  darkMode = false,
  navStyle = "gesture",
}: AndroidFrameProps) {
  const textColor = darkMode ? "#fff" : "#1a1a1a";

  return (
    <div style={styles.wrapper}>
      <div style={{
        ...styles.screen,
        width,
        height,
        background: darkMode ? "#000" : "#fff",
      }}>
        <div style={{ ...styles.statusBar, color: textColor }}>
          <span>{time}</span>
          <div style={styles.statusIcons}>
            <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
              <rect x="0" y="6" width="2" height="4" rx="0.5" />
              <rect x="4" y="4" width="2" height="6" rx="0.5" />
              <rect x="8" y="2" width="2" height="8" rx="0.5" />
              <rect x="12" y="0" width="2" height="10" rx="0.5" />
            </svg>
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <path d="M7 9a1 1 0 100-2 1 1 0 000 2z" fill="currentColor" />
              <path d="M3 6a5 5 0 018 0" stroke="currentColor" strokeWidth="1.2" />
              <path d="M0.5 3.5a11 11 0 0113 0" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
            </svg>
            <div style={{ width: 22, height: 10, border: "1.5px solid currentColor", borderRadius: 2, padding: 1, position: "relative" as const }}>
              <div style={{ width: `${battery}%`, height: "100%", background: "currentColor", borderRadius: 1 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 2 }}>{battery}%</span>
          </div>
        </div>

        <div style={styles.punchHole} />

        <div style={styles.content}>{children}</div>

        {navStyle === "gesture" && (
          <div style={styles.navBar}>
            <div style={{
              width: 100,
              height: 4,
              background: darkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)",
              borderRadius: 999,
            }} />
          </div>
        )}

        {navStyle === "buttons" && (
          <div style={styles.navBar}>
            <span style={{ color: textColor, fontSize: 20 }}>◁</span>
            <span style={{ color: textColor, fontSize: 16 }}>○</span>
            <span style={{ color: textColor, fontSize: 16 }}>□</span>
          </div>
        )}
      </div>
    </div>
  );
}
