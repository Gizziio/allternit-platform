"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

interface QuickActionOverlayProps {
  url: string;
  onQuick: () => void;
  onDeep: () => void;
  onChat: () => void;
  onClose: () => void;
}

export function QuickActionOverlay({
  url,
  onQuick,
  onDeep,
  onChat,
  onClose,
}: QuickActionOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const displayUrl = url.replace(/^https?:\/\//, "").slice(0, 40);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: "absolute",
        bottom: "100%",
        left: 12,
        right: 12,
        marginBottom: 10,
        zIndex: 50,
        background: `linear-gradient(135deg, ${browser.accent}18, ${browser.accent}08)`,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${browser.border}`,
        borderRadius: RADIUS.lg,
        boxShadow: `0 8px 32px rgba(0,0,0,0.25), 0 0 0 1px ${browser.panelTint}`,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: TEXT.tertiary,
            fontFamily: TYPOGRAPHY.fontFamily.mono,
          }}
        >
          {displayUrl}
        </span>
        <button
          onClick={onClose}
          style={{
            padding: 2,
            borderRadius: RADIUS.sm,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: TEXT.tertiary,
            fontSize: 12,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onQuick}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: RADIUS.md,
            border: `1px solid ${BORDER.subtle}`,
            background: BACKGROUND.secondary,
            color: TEXT.secondary,
            fontSize: TYPOGRAPHY.size.xs,
            fontWeight: TYPOGRAPHY.weight.medium,
            cursor: "pointer",
            transition: ANIMATION.fast,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = browser.panelTint;
            e.currentTarget.style.borderColor = browser.border;
            e.currentTarget.style.color = TEXT.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = BACKGROUND.secondary;
            e.currentTarget.style.borderColor = BORDER.subtle;
            e.currentTarget.style.color = TEXT.secondary;
          }}
        >
          <span style={{ marginRight: 4 }}>⚡</span> Quick
        </button>
        <button
          onClick={onDeep}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: RADIUS.md,
            border: `1px solid ${BORDER.subtle}`,
            background: BACKGROUND.secondary,
            color: TEXT.secondary,
            fontSize: TYPOGRAPHY.size.xs,
            fontWeight: TYPOGRAPHY.weight.medium,
            cursor: "pointer",
            transition: ANIMATION.fast,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = browser.panelTint;
            e.currentTarget.style.borderColor = browser.border;
            e.currentTarget.style.color = TEXT.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = BACKGROUND.secondary;
            e.currentTarget.style.borderColor = BORDER.subtle;
            e.currentTarget.style.color = TEXT.secondary;
          }}
        >
          <span style={{ marginRight: 4 }}>🔍</span> Deep
        </button>
        <button
          onClick={onChat}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: RADIUS.md,
            border: `1px solid ${BORDER.subtle}`,
            background: BACKGROUND.secondary,
            color: TEXT.secondary,
            fontSize: TYPOGRAPHY.size.xs,
            fontWeight: TYPOGRAPHY.weight.medium,
            cursor: "pointer",
            transition: ANIMATION.fast,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = browser.panelTint;
            e.currentTarget.style.borderColor = browser.border;
            e.currentTarget.style.color = TEXT.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = BACKGROUND.secondary;
            e.currentTarget.style.borderColor = BORDER.subtle;
            e.currentTarget.style.color = TEXT.secondary;
          }}
        >
          <span style={{ marginRight: 4 }}>💬</span> Chat
        </button>
      </div>
    </motion.div>
  );
}
