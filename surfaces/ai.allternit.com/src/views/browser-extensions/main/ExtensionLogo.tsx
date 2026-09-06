"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { MatrixLogo } from "@/components/ai-elements/MatrixLogo";
import { OfficeAppLogo } from "@/views/office/OfficeAppLogo";
import type { Extension } from "./BrowserExtensions.types";

/** Curated gradient pairs for generic extension monogram tiles, chosen by a stable hash. */
const TILE_GRADIENTS: [string, string][] = [
  ["#7C6CF0", "#5244C8"],
  ["#3EA6E0", "#1D6FB8"],
  ["#3DBE8B", "#15805A"],
  ["#E0A33E", "#B8741D"],
  ["#E06C8A", "#B83A5E"],
  ["#8A94E0", "#5A64B8"],
  ["#3EC8C8", "#1D8A8A"],
  ["#B08AE0", "#7C4DB8"],
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Generic extension tile: gradient monogram + Allternit sparkle, same family as the office suite logos. */
function MonogramTile({ extension, dimension, glyph }: { extension: Extension; dimension: number; glyph?: string }) {
  const [from, to] = TILE_GRADIENTS[hashString(extension.id || extension.name) % TILE_GRADIENTS.length]!;
  const letter = glyph ?? (extension.name.trim()[0] ?? "?").toUpperCase();
  const gid = `ext-${hashString(extension.id || extension.name) % 1000}`;
  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 48 48"
      role="img"
      aria-label={`${extension.name} logo`}
      className="shrink-0"
      style={{ display: "block", filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.18))" }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="11" fill={`url(#${gid})`} />
      <rect width="48" height="24" rx="11" fill="#ffffff" opacity="0.08" />
      <text x="24" y="30.5" textAnchor="middle" fontSize="19" fontWeight="800" fill="#ffffff" fontFamily="inherit">
        {letter}
      </text>
      <path
        d="M41 5.1 Q41.6 8 44.4 8.6 Q41.6 9.2 41 12.1 Q40.4 9.2 37.6 8.6 Q40.4 8 41 5.1 Z"
        fill="#ffffff"
        opacity="0.85"
      />
    </svg>
  );
}

export function ExtensionLogo({ extension, size = "card" }: { extension: Extension; size?: "card" | "detail" }) {
  const dimension = size === "detail" ? 40 : 28;

  if (extension.officeHost) {
    return (
      <OfficeAppLogo
        product={extension.officeHost}
        size={dimension}
        className="shrink-0"
      />
    );
  }

  if (extension.id === "allternit-agent") {
    const displaySize = size === "detail" ? 32 : 22;
    return (
      <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-hover)]", size === "detail" ? "size-10 rounded-xl" : "size-7")}>
        <ScaledMatrixLogo state={extension.isEnabled ? "listening" : "idle"} displaySize={displaySize} />
      </div>
    );
  }

  if (extension.icon && /^(https?:|data:|\/)/.test(extension.icon)) {
    return (
      <img
        src={extension.icon}
        alt=""
        className={cn("shrink-0 rounded-lg object-contain", size === "detail" ? "size-10 rounded-xl" : "size-7")}
      />
    );
  }

  return <MonogramTile extension={extension} dimension={dimension} glyph={extension.icon || undefined} />;
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
