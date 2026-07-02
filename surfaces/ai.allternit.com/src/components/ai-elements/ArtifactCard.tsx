"use client";

import { useState } from "react";
import { useNav } from '@/nav/useNav';
import { KIND_META, type SelectedArtifact } from './artifact.types';

interface ArtifactCardProps {
  artifact: SelectedArtifact;
  isSelected?: boolean;
  onClick: () => void;
}

export function ArtifactCard({ artifact, isSelected, onClick }: ArtifactCardProps) {
  const [hovered, setHovered] = useState(false);
  const { dispatch } = useNav();
  const meta = KIND_META[artifact.kind] ?? KIND_META.document;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        group relative flex items-center gap-3 p-3 rounded-xl border border-solid transition-all duration-200 cursor-pointer
        ${isSelected 
          ? "bg-[rgba(212,176,140,0.12)] border-[rgba(212,176,140,0.4)] shadow-[0_4px_20px_rgba(0,0,0,0.2)]" 
          : "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]"}
      `}
    >
      {/* Icon */}
      <div
        className="size-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
        style={{ background: meta.accent.replace("0.7", "0.15"), color: meta.accent }}
      >
        {meta.icon}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-[rgba(236,236,236,0.92)] truncate">
          {artifact.title}
        </div>
        <div className="text-[12px] text-[rgba(236,236,236,0.38)] mt-[1px]">
          {meta.label}
        </div>
        {/* Content preview snippet — first line of document/code content */}
        {artifact.content && (artifact.kind === "document" || artifact.kind === "code") && (
          <div className={`text-[12px] text-[rgba(255,255,255,0.22)] mt-[3px] truncate ${artifact.kind === "code" ? "font-mono" : ""}`}>
            {artifact.content.split("\n")[0].trim().slice(0, 60)}
          </div>
        )}
      </div>

      {/* Hover visual cue */}
      <div
        className={`
          absolute right-3 opacity-0 transition-all duration-200 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0
          ${isSelected ? "text-[rgba(212,176,140,0.8)]" : "text-[rgba(255,255,255,0.25)]"}
        `}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
          View
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4.5 9L7.5 6L4.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
