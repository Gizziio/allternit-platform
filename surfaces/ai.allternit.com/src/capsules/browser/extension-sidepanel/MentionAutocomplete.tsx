"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  BACKGROUND,
  TEXT,
  RADIUS,
  MODE_COLORS,
  TYPOGRAPHY,
  ANIMATION,
} from "@/design/allternit.tokens";
import { cn } from "@/lib/utils";

const browser = MODE_COLORS.browser;

export interface MentionOption {
  name: string;
  description: string;
  icon: string;
  color: string;
}

export const MENTION_OPTIONS: MentionOption[] = [
  {
    name: "capture",
    description: "Capture current page to Figma",
    icon: "📸",
    color: browser.accent,
  },
  {
    name: "quick",
    description: "Quick capture (screenshot only)",
    icon: "⚡",
    color: "#4ade80",
  },
  {
    name: "deep",
    description: "Deep capture (full DOM + assets)",
    icon: "🔍",
    color: "#A78BFA",
  },
];

export function getMention(text: string, cursorPosition: number) {
  const beforeCursor = text.slice(0, cursorPosition);
  const lastAtIndex = beforeCursor.lastIndexOf("@");

  if (lastAtIndex === -1) {
    return { isActive: false, query: "", startIndex: 0 };
  }

  const afterAt = beforeCursor.slice(lastAtIndex + 1);
  const hasSpaceAfterAt = afterAt.includes(" ");

  if (hasSpaceAfterAt) {
    return { isActive: false, query: "", startIndex: 0 };
  }

  return {
    isActive: true,
    query: afterAt.toLowerCase(),
    startIndex: lastAtIndex,
  };
}

export const useMention = getMention;

interface MentionAutocompleteProps {
  text: string;
  cursorPosition: number;
  onSelect: (option: MentionOption) => void;
  onClose: () => void;
}

export function MentionAutocomplete({
  text,
  cursorPosition,
  onSelect,
  onClose,
}: MentionAutocompleteProps) {
  const mention = getMention(text, cursorPosition);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = MENTION_OPTIONS.filter(
    (opt) =>
      opt.name.toLowerCase().includes(mention.query) ||
      opt.description.toLowerCase().includes(mention.query)
  );

  const [prevQuery, setPrevQuery] = useState(mention.query);
  
  if (mention.query !== prevQuery) {
    setPrevQuery(mention.query);
    setSelectedIndex(0);
  }

  useEffect(() => {
    if (!mention.isActive) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const option = filtered[selectedIndex];
        if (option) onSelect(option);
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mention.isActive, filtered, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    if (!mention.isActive) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mention.isActive, onClose]);

  if (!mention.isActive || filtered.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-[var(--bg-secondary)] backdrop-blur-xl border border-solid border-[var(--accent-browser-border)] rounded-md shadow-[0_8px_32px_var(--surface-panel),0_0_0_1px_var(--accent-browser-panel-tint)] py-1 overflow-hidden"
      style={{
        ['--accent-browser-border' as string]: browser.border,
        ['--accent-browser-panel-tint' as string]: browser.panelTint,
      }}
    >
      {filtered.map((option, i) => (
        <button type="button"
          key={option.name}
          onClick={() => onSelect(option)}
          className={cn(
            "flex items-center gap-2.5 w-full p-[8px_12px] border-none cursor-pointer text-left transition-all duration-150",
            i === selectedIndex ? "bg-[var(--accent-browser-panel-tint)]" : "bg-transparent"
          )}
          style={{
            ['--accent-browser-panel-tint' as string]: browser.panelTint,
          }}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <span
            className="size-7 rounded-md flex items-center justify-center text-[14px] shrink-0"
            style={{
              background: `${option.color}20`,
            }}
          >
            {option.icon}
          </span>
          <div>
            <div className="text-[14px] font-medium text-[var(--text-primary)]">
              @{option.name}
            </div>
            <div className="text-[12px] text-[var(--text-tertiary)] mt-px">
              {option.description}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
