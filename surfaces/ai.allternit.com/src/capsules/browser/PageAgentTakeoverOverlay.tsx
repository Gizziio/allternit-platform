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
      className="absolute inset-0 z-[16] pointer-events-none overflow-hidden"
    >
      <style>{PAGE_AGENT_TAKEOVER_ANIMATIONS}</style>
      <div
        className="absolute -inset-[10px] rounded-[24px] bg-[conic-gradient(from_180deg,rgba(92,136,255,0.28),rgba(83,196,255,0.08),rgba(179,96,255,0.2),rgba(92,136,255,0.28))] blur-[10px] opacity-60 animate-[allternit-page-agent-takeover-glow-a_5s_ease-in-out_infinite]"
      />
      <div
        className="absolute inset-0 shadow-[inset_0_0_0_1px_rgba(91,153,255,0.32)] animate-[allternit-page-agent-takeover-border_2.4s_ease-in-out_infinite]"
      />
    </div>
  );
}

export default PageAgentTakeoverOverlay;
