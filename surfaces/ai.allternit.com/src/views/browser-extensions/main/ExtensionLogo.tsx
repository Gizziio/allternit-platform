"use client";

import React from "react";
import { PuzzlePiece } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { MatrixLogo } from "@/components/ai-elements/MatrixLogo";
import type { Extension } from "./BrowserExtensions.types";

const OFFICE_COLORS = {
  word: { background: "#185ABD", panel: "#2B7CD3", letter: "W" },
  excel: { background: "#107C41", panel: "#21A366", letter: "X" },
  powerpoint: { background: "#C43E1C", panel: "#D35230", letter: "P" },
} as const;

export function ExtensionLogo({ extension, size = "card" }: { extension: Extension; size?: "card" | "detail" }) {
  const dimension = size === "detail" ? "size-20 rounded-2xl" : "size-12 rounded-xl";
  const office = extension.officeHost ? OFFICE_COLORS[extension.officeHost] : null;

  if (office) {
    return (
      <div
        className={cn("relative shrink-0 overflow-hidden shadow-sm", dimension)}
        style={{ background: office.background }}
        aria-label={`Microsoft ${extension.officeHost} logo`}
      >
        <div className="absolute bottom-[14%] right-[10%] top-[14%] w-[55%] rounded-sm" style={{ background: office.panel }} />
        <div className={cn("absolute bottom-[9%] left-[10%] top-[9%] flex w-[48%] items-center justify-center rounded-sm bg-white/95 font-bold", size === "detail" ? "text-3xl" : "text-lg")} style={{ color: office.background }}>
          {office.letter}
        </div>
      </div>
    );
  }

  if (extension.id === "allternit-agent") {
    const displaySize = size === "detail" ? 64 : 36;
    return (
      <div className={cn("flex shrink-0 items-center justify-center overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-hover)] shadow-sm", dimension)}>
        <ScaledMatrixLogo state={extension.isEnabled ? "listening" : "idle"} displaySize={displaySize} />
      </div>
    );
  }

  if (extension.icon && /^(https?:|data:|\/)/.test(extension.icon)) {
    return <img src={extension.icon} alt="" className={cn("shrink-0 object-cover shadow-sm", dimension)} />;
  }

  return (
    <div className={cn("flex shrink-0 items-center justify-center border border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-primary)] shadow-sm", dimension)}>
      {extension.icon ? <span className={size === "detail" ? "text-3xl font-semibold" : "text-lg font-semibold"}>{extension.icon}</span> : <PuzzlePiece size={size === "detail" ? 36 : 22} weight="duotone" />}
    </div>
  );
}

function ScaledMatrixLogo({ state, displaySize }: { state: "idle" | "listening"; displaySize: number }) {
  const baseSize = 48;
  const scale = displaySize / baseSize;
  return (
    <div className="flex shrink-0 items-center justify-center overflow-hidden" style={{ width: displaySize, height: displaySize }}>
      <div className="shrink-0" style={{ width: baseSize, height: baseSize, transform: `scale(${scale})`, transformOrigin: "center center" }}>
        <MatrixLogo state={state} size={baseSize} />
      </div>
    </div>
  );
}
