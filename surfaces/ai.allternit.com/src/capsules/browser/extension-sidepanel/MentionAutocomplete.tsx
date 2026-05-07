"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  BACKGROUND,
  TEXT,
  BORDER,
  RADIUS,
  MODE_COLORS,
  TYPOGRAPHY,
  ANIMATION,
} from "@/design/allternit.tokens";

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

export function useMention(text: string, cursorPosition: number) {
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
  const mention = useMention(text, cursorPosition);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = MENTION_OPTIONS.filter(
    (opt) =>
      opt.name.toLowerCase().includes(mention.query) ||
      opt.description.toLowerCase().includes(mention.query)
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [mention.query]);

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
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        right: 0,
        marginBottom: 8,
        zIndex: 50,
        background: BACKGROUND.secondary,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${browser.border}`,
        borderRadius: RADIUS.md,
        boxShadow: `0 8px 32px var(--surface-panel), 0 0 0 1px ${browser.panelTint}`,
        padding: "4px 0",
        overflow: "hidden",
      }}
    >
      {filtered.map((option, i) => (
        <button
          key={option.name}
          onClick={() => onSelect(option)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: "8px 12px",
            border: "none",
            background: i === selectedIndex ? browser.panelTint : "transparent",
            cursor: "pointer",
            textAlign: "left",
            transition: ANIMATION.fast,
          }}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: RADIUS.sm,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              background: `${option.color}20`,
              flexShrink: 0,
            }}
          >
            {option.icon}
          </span>
          <div>
            <div
              style={{
                fontSize: TYPOGRAPHY.size.sm,
                fontWeight: TYPOGRAPHY.weight.medium,
                color: TEXT.primary,
              }}
            >
              @{option.name}
            </div>
            <div
              style={{
                fontSize: TYPOGRAPHY.size.xs,
                color: TEXT.tertiary,
                marginTop: 1,
              }}
            >
              {option.description}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
