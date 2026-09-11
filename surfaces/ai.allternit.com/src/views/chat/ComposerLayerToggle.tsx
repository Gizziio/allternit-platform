"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  getComposerLayer,
  setComposerLayer,
  type ComposerLayer,
} from "@/lib/composer-layer";

const LAYERS: { id: ComposerLayer; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "agent", label: "Agent" },
  { id: "bot", label: "Bot" },
];

export function ComposerLayerToggle({
  onChange,
}: {
  onChange?: (layer: ComposerLayer) => void;
}) {
  const [layer, setLayer] = useState<ComposerLayer>("chat");

  useEffect(() => {
    setLayer(getComposerLayer());
  }, []);

  const pick = (next: ComposerLayer) => {
    setComposerLayer(next);
    setLayer(next);
    onChange?.(next);
  };

  return (
    <div
      className="inline-flex rounded-lg border border-[var(--border-subtle)] p-0.5 text-[11px] font-medium"
      role="tablist"
      aria-label="Composer mode"
    >
      {LAYERS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={layer === item.id}
          className={cn(
            "px-2.5 py-1 rounded-md transition-colors",
            layer === item.id
              ? "bg-[var(--accent-primary)] text-white"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
          )}
          onClick={() => pick(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
