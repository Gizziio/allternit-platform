"use client";

import React from "react";
import { X } from "@phosphor-icons/react";
import { pluginCategoryIcon, type PluginMentionTarget } from "@/lib/mentions/use-mention-targets";

interface PluginMentionChipProps {
  target: PluginMentionTarget;
  /** Omit for a read-only chip (e.g. transcript rendering). */
  onRemove?: () => void;
}

const THEME = {
  textPrimary: "var(--ui-text-primary, #ECECEC)",
  textSecondary: "var(--ui-text-secondary, #9B9B9B)",
  accent: "var(--accent-chat, #D4B08C)",
};

/**
 * Codex-style inline mention chip: sits inside the composer text field area —
 * just a small rounded icon + the plugin/connector name, no pill box.
 */
export function PluginMentionChip({ target, onRemove }: PluginMentionChipProps) {
  const CategoryIcon = pluginCategoryIcon(target);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "1px 2px",
        borderRadius: 6,
        fontSize: 14,
        fontWeight: 500,
        color: THEME.textPrimary,
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {target.iconUrl ? (
          <img
            src={target.iconUrl}
            alt=""
            width={20}
            height={20}
            style={{ borderRadius: 5, objectFit: "cover" }}
            onError={(e) => {
              // Fall back to the category icon tile if the favicon fails
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling?.removeAttribute("style");
            }}
          />
        ) : null}
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            background: THEME.accent,
            display: target.iconUrl ? "none" : "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <CategoryIcon size={12} weight="bold" />
        </div>
      </div>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 200,
        }}
      >
        {target.name}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${target.name}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 16,
            height: 16,
            borderRadius: 4,
            border: "none",
            background: "transparent",
            color: THEME.textSecondary,
            cursor: "pointer",
            padding: 0,
            marginLeft: 1,
            opacity: 0.6,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.color = THEME.textPrimary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.6";
            e.currentTarget.style.color = THEME.textSecondary;
          }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
