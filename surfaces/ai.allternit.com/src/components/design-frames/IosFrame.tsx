/**
 * IosFrame — iPhone device shell (iPhone 15 Pro reference, 393×852 logical px)
 * Ported from alchaincyf/huashu-design ios_frame.jsx
 *
 * Usage:
 *   <IosFrame time="9:41" battery={85}>
 *     <YourAppContent />
 *   </IosFrame>
 */

import React from "react";

const styles = {
  wrapper: {
    display: "inline-block",
    padding: 12,
    background: "#000",
    borderRadius: 60,
    boxShadow: "0 0 0 2px #1f2937, 0 20px 60px rgba(0,0,0,0.3)",
    position: "relative" as const,
  },
  screen: {
    position: "relative" as const,
    borderRadius: 48,
    overflow: "hidden" as const,
    background: "#fff",
  },
  statusBar: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    height: 54,
    display: "flex",
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: "0 32px",
    fontSize: 16,
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    zIndex: 20,
    pointerEvents: "none" as const,
  },
  dynamicIsland: {
    position: "absolute" as const,
    top: 12,
    left: "50%",
    transform: "translateX(-50%)",
    width: 124,
    height: 36,
    background: "#000",
    borderRadius: 999,
    zIndex: 30,
  },
  statusIcons: {
    display: "flex",
    alignItems: "center" as const,
    gap: 6,
  },
  signalIcon: {
    display: "flex",
    alignItems: "flex-end" as const,
    gap: 2,
    height: 12,
  },
  signalBar: {
    width: 3,
    background: "currentColor",
    borderRadius: 1,
  },
  batteryIcon: {
    width: 26,
    height: 12,
    border: "1.5px solid currentColor",
    borderRadius: 3,
    padding: 1,
    position: "relative" as const,
    opacity: 0.8,
  },
  batteryCap: {
    position: "absolute" as const,
    top: 3,
    right: -3,
    width: 2,
    height: 6,
    background: "currentColor",
    borderRadius: "0 1px 1px 0",
  },
  content: {
    position: "absolute" as const,
    top: 54,
    left: 0,
    right: 0,
    bottom: 34,
    overflow: "auto" as const,
  },
  homeIndicator: {
    position: "absolute" as const,
    bottom: 10,
    left: "50%",
    transform: "translateX(-50%)",
    width: 140,
    height: 5,
    background: "rgba(0,0,0,0.3)",
    borderRadius: 999,
    zIndex: 10,
  },
};

interface IosFrameProps {
  children?: React.ReactNode;
  width?: number;
  height?: number;
  time?: string;
  battery?: number;
  darkMode?: boolean;
  showStatusBar?: boolean;
  showDynamicIsland?: boolean;
  showHomeIndicator?: boolean;
}

export function IosFrame({
  children,
  width = 393,
  height = 852,
  time = "9:41",
  battery = 100,
  darkMode = false,
  showStatusBar = true,
  showDynamicIsland = true,
  showHomeIndicator = true,
}: IosFrameProps) {
  const textColor = darkMode ? "#fff" : "#000";

  return (
    <div style={styles.wrapper}>
      <div style={{
        ...styles.screen,
        width,
        height,
        background: darkMode ? "#000" : "#fff",
      }}>
        {showStatusBar && (
          <div style={{ ...styles.statusBar, color: textColor }}>
            <span>{time}</span>
            <div style={styles.statusIcons}>
              <div style={styles.signalIcon}>
                <div style={{ ...styles.signalBar, height: 4 }} />
                <div style={{ ...styles.signalBar, height: 6 }} />
                <div style={{ ...styles.signalBar, height: 9 }} />
                <div style={{ ...styles.signalBar, height: 11 }} />
              </div>
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none" style={{ color: textColor }}>
                <path d="M8 11.5a1 1 0 100-2 1 1 0 000 2z" fill="currentColor" />
                <path d="M3 7.5a7 7 0 0110 0" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                <path d="M1 4.5a11 11 0 0114 0" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.7" />
              </svg>
              <div style={styles.batteryIcon}>
                <div style={{
                  width: `${battery}%`,
                  height: "100%",
                  background: "currentColor",
                  borderRadius: 1,
                  opacity: 0.9,
                }} />
                <div style={styles.batteryCap} />
              </div>
            </div>
          </div>
        )}

        {showDynamicIsland && <div style={styles.dynamicIsland} />}

        <div style={styles.content}>{children}</div>

        {showHomeIndicator && (
          <div style={{
            ...styles.homeIndicator,
            background: darkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.3)",
          }} />
        )}
      </div>
    </div>
  );
}
