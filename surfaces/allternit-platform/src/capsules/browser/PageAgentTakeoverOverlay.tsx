"use client";

import React from "react";

const PAGE_AGENT_TAKEOVER_ANIMATIONS = `
@keyframes allternit-page-agent-takeover-glow-a {
  0%, 100% {
    opacity: 0.52;
    transform: scale(1);
  }
  50% {
    opacity: 0.24;
    transform: scale(1.035);
  }
}

@keyframes allternit-page-agent-takeover-glow-b {
  0%, 100% {
    opacity: 0.18;
    transform: scale(1.02);
  }
  50% {
    opacity: 0.42;
    transform: scale(1);
  }
}

@keyframes allternit-page-agent-takeover-border {
  0% {
    opacity: 0.55;
    box-shadow: inset 0 0 0 1px rgba(91, 153, 255, 0.32), 0 0 36px rgba(91, 153, 255, 0.12);
  }
  50% {
    opacity: 0.92;
    box-shadow: inset 0 0 0 1px rgba(189, 104, 255, 0.36), 0 0 48px rgba(72, 195, 255, 0.18);
  }
  100% {
    opacity: 0.55;
    box-shadow: inset 0 0 0 1px rgba(91, 153, 255, 0.32), 0 0 36px rgba(91, 153, 255, 0.12);
  }
}

@keyframes allternit-page-agent-takeover-badge {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}
`;

export function PageAgentTakeoverOverlay({
  active,
  task: _task,
}: {
  active: boolean;
  task?: string;
}) {
  if (!active) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      data-testid="page-agent-takeover-overlay"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 16,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <style>{PAGE_AGENT_TAKEOVER_ANIMATIONS}</style>
      <div
        style={{
          position: "absolute",
          inset: 0,
          inset: -10,
          borderRadius: 24,
          background:
            "conic-gradient(from 180deg, rgba(92, 136, 255, 0.28), rgba(83, 196, 255, 0.08), rgba(179, 96, 255, 0.2), rgba(92, 136, 255, 0.28))",
          filter: "blur(18px)",
          opacity: 0.6,
          animation: "allternit-page-agent-takeover-glow-a 5s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 0 1px rgba(91, 153, 255, 0.32)",
          animation: "allternit-page-agent-takeover-border 2.4s ease-in-out infinite",
        }}
      />
    </div>
  );
}

export default PageAgentTakeoverOverlay;
