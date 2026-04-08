/**
 * FileOutputCard — Rendered when a write/create/edit tool completes successfully.
 *
 * Shows a compact, clickable card with:
 *   • File type icon (by extension)
 *   • Filename (basename)
 *   • Dir path (dimmed)
 *   • Operation badge (Created / Edited / Deleted)
 *
 * Used in UnifiedMessageRenderer for write-class tool completions.
 */

"use client";

import React, { memo } from "react";
import {
  FileText,
  FileCode,
  File,
  CheckCircle,
  PencilSimple,
  PlusCircle,
  Trash,
} from '@phosphor-icons/react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns true if the tool is a file-write/create/edit/delete operation */
export function isFileWriteTool(toolName: string): boolean {
  const n = toolName.toLowerCase();
  return /write|edit|create|apply_?patch|applypatch|insert|delete|remove|mv|mkdir/.test(n);
}

/** Pick a file icon by extension */
function FileIcon({ filename, color }: { filename: string; color: string }) {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  const style = { width: 13, height: 13, color, flexShrink: 0 as const };

  if (/tsx?|jsx?/.test(ext))   return <FileCode style={style} />;
  if (/json|jsonl/.test(ext))  return <FileCode style={style} />;
  if (/md|mdx/.test(ext))      return <FileText style={style} />;
  if (/rs|go|py|rb|java|c|cpp|cs/.test(ext)) return <FileCode style={style} />;
  return <File style={style} />;
}

/** Map tool name → operation label */
function opLabel(toolName: string): { label: string; icon: React.ReactNode; color: string } {
  const n = toolName.toLowerCase();
  if (/write|create|mkdir/.test(n))            return { label: "Created", icon: <PlusCircle size={10} />, color: "rgba(74,222,128,0.7)" };
  if (/edit|patch|apply|insert|update/.test(n)) return { label: "Edited",   icon: <PencilSimple size={10} />,       color: "rgba(167,139,250,0.7)" };
  if (/delete|remove/.test(n))                  return { label: "Deleted",  icon: <Trash size={10} />,     color: "rgba(248,113,113,0.65)" };
  return { label: "Saved", icon: <CheckCircle size={10} />, color: "rgba(74,222,128,0.55)" };
}

/** Extract basename and dir from a path string */
function splitPath(path: string): { basename: string; dir: string } {
  const parts = path.replace(/\\/g, "/").split("/");
  const basename = parts.pop() ?? path;
  const dir = parts.length > 0 ? parts.join("/") : "";
  return { basename, dir };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface FileOutputCardProps {
  toolName: string;
  filePath: string;
  onClick?: () => void;
}

export const FileOutputCard = memo(function FileOutputCard({
  toolName,
  filePath,
  onClick,
}: FileOutputCardProps) {
  const { basename, dir } = splitPath(filePath);
  const { label, icon, color } = opLabel(toolName);

  return (
    <div
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "5px 10px 5px 9px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.03)",
        cursor: onClick ? "pointer" : "default",
        maxWidth: "100%",
        minWidth: 0,
        transition: "background 0.15s",
        userSelect: "none",
      }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.055)")}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)")}
    >
      {/* File icon */}
      <FileIcon filename={basename} color="rgba(255,255,255,0.35)" />

      {/* Name + dir */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: "12px",
          fontWeight: 500,
          color: "rgba(236,236,236,0.78)",
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {basename}
        </div>
        {dir && (
          <div style={{
            fontSize: "10px",
            color: "rgba(255,255,255,0.28)",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {dir}
          </div>
        )}
      </div>

      {/* Operation badge */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "3px",
        fontSize: "10px",
        fontWeight: 600,
        color,
        letterSpacing: "0.02em",
        flexShrink: 0,
      }}>
        {icon}
        {label}
      </div>
    </div>
  );
});

FileOutputCard.displayName = "FileOutputCard";
