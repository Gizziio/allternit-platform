"use client";

import { useState, useEffect, useMemo } from "react";
import { MagnifyingGlass, ArrowRight } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import {
  BACKGROUND,
  TEXT,
  BORDER,
  RADIUS,
  TYPOGRAPHY,
} from "@/design/allternit.tokens";
import { MODE_COLORS } from "@/design/allternit.tokens";
import { useBrowserStore } from "./browser.store";
import { useBrowserShortcutsStore, getFaviconUrl } from "./browserShortcuts.store";

const browserTokens = MODE_COLORS.browser;

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function BrowserNewTabPage({ onNavigate }: { onNavigate: (url: string) => void }) {
  const [time, setTime] = useState(new Date());
  const [query, setQuery] = useState("");
  const recentVisits = useBrowserStore((s) => s.recentVisits);
  const shortcuts = useBrowserShortcutsStore((s) => s.shortcuts);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const filteredVisits = useMemo(() => {
    if (!query.trim()) return recentVisits.slice(0, 8);
    const q = query.toLowerCase();
    return recentVisits
      .filter((v) => v.url.toLowerCase().includes(q) || v.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, recentVisits]);

  const suggested = useMemo(() => {
    return [
      { label: "Google", url: "https://www.google.com", icon: "🔍" },
      { label: "GitHub", url: "https://github.com", icon: "🐙" },
      { label: "YouTube", url: "https://www.youtube.com", icon: "▶️" },
      { label: "ChatGPT", url: "https://chat.openai.com", icon: "💬" },
      { label: "Vercel", url: "https://vercel.com", icon: "▲" },
      { label: "Figma", url: "https://www.figma.com", icon: "🎨" },
    ];
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const url = query.includes(".") && !query.includes(" ")
      ? `https://${query.replace(/^https?:\/\//, "")}`
      : `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    onNavigate(url);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        background: BACKGROUND.primary,
        padding: "48px 32px",
        overflow: "auto",
      }}
    >
      {/* Clock */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: "center", marginBottom: 8 }}
      >
        <div style={{ fontSize: 56, fontWeight: 200, color: TEXT.primary, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          {formatTime(time)}
        </div>
        <div style={{ fontSize: TYPOGRAPHY.size.sm, color: TEXT.tertiary, marginTop: 4 }}>
          {formatDate(time)}
        </div>
      </motion.div>

      {/* Search bar */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        onSubmit={handleSearch}
        style={{
          width: "100%",
          maxWidth: 560,
          marginBottom: 40,
          marginTop: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 44,
            background: BACKGROUND.secondary,
            borderRadius: RADIUS.lg,
            border: `1px solid ${BORDER.subtle}`,
            paddingLeft: 16,
            paddingRight: 16,
            gap: 10,
            transition: "box-shadow 0.2s",
          }}
        >
          <MagnifyingGlass style={{ width: 18, height: 18, color: TEXT.tertiary, flexShrink: 0 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or type a URL"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: TYPOGRAPHY.size.base,
              color: TEXT.primary,
              fontFamily: "inherit",
            }}
          />
          {query && (
            <motion.button
              type="submit"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                padding: "4px 10px",
                borderRadius: RADIUS.md,
                border: "none",
                background: browserTokens.accent,
                color: BACKGROUND.primary,
                fontSize: TYPOGRAPHY.size.xs,
                fontWeight: TYPOGRAPHY.weight.semibold,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <ArrowRight style={{ width: 12, height: 12 }} />
            </motion.button>
          )}
        </div>
      </motion.form>

      {/* Suggested / Shortcuts row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        style={{ width: "100%", maxWidth: 640, marginBottom: 32 }}
      >
        <div style={{ fontSize: TYPOGRAPHY.size.xs, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: TYPOGRAPHY.weight.semibold }}>
          Suggestions
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {suggested.map((item) => (
            <motion.button
              key={item.url}
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate(item.url)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: RADIUS.md,
                border: `1px solid ${BORDER.subtle}`,
                background: BACKGROUND.secondary,
                color: TEXT.secondary,
                fontSize: TYPOGRAPHY.size.sm,
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span>{item.label}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Recent visits */}
      {filteredVisits.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          style={{ width: "100%", maxWidth: 640 }}
        >
          <div style={{ fontSize: TYPOGRAPHY.size.xs, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: TYPOGRAPHY.weight.semibold }}>
            Recent
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {filteredVisits.map((visit, i) => (
              <motion.button
                key={`${visit.url}-${i}`}
                whileHover={{ y: -1, background: browserTokens.panelTint }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate(visit.url)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: RADIUS.md,
                  border: `1px solid ${BORDER.subtle}`,
                  background: BACKGROUND.secondary,
                  color: TEXT.secondary,
                  fontSize: TYPOGRAPHY.size.sm,
                  cursor: "pointer",
                  textAlign: "left",
                  overflow: "hidden",
                }}
              >
                <img
                  src={getFaviconUrl(visit.url, 32)}
                  alt=""
                  style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: TEXT.primary, fontSize: TYPOGRAPHY.size.sm }}>
                    {visit.title}
                  </div>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: TEXT.tertiary, fontSize: TYPOGRAPHY.size.xs, marginTop: 1 }}>
                    {new URL(visit.url).hostname.replace('www.', '')}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Shortcuts */}
      {shortcuts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          style={{ width: "100%", maxWidth: 640, marginTop: 32 }}
        >
          <div style={{ fontSize: TYPOGRAPHY.size.xs, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: TYPOGRAPHY.weight.semibold }}>
            Bookmarks
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {shortcuts.slice(0, 8).map((shortcut) => (
              <motion.button
                key={shortcut.url}
                whileHover={{ y: -1, background: browserTokens.panelTint }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate(shortcut.url)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: RADIUS.md,
                  border: `1px solid ${BORDER.subtle}`,
                  background: BACKGROUND.secondary,
                  color: TEXT.secondary,
                  fontSize: TYPOGRAPHY.size.sm,
                  cursor: "pointer",
                }}
              >
                <img
                  src={getFaviconUrl(shortcut.url, 32)}
                  alt=""
                  style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
                  {shortcut.label}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
