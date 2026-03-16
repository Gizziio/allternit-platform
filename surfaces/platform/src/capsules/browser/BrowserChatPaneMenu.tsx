/**
 * BrowserChatPaneMenu — Three-dot dropdown menu for browser chat pane header.
 *
 * Items: Convert to task, Settings, Language (submenu).
 */

"use client";

import React, { useEffect, useRef, useState } from "react";
import { CalendarClock, ChevronRight, Globe, Settings } from "lucide-react";

import { useBrowserChatPaneStore } from "./browserChatPane.store";

const MENU_BG = "#1e2024";
const MENU_BORDER = "rgba(255,255,255,0.1)";
const MENU_HOVER = "rgba(255,255,255,0.06)";
const TEXT_PRIMARY = "#e8edf0";
const TEXT_SECONDARY = "#96a7b1";

const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "es", label: "Spanish" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "pt", label: "Portuguese" },
  { id: "zh", label: "Chinese" },
  { id: "ja", label: "Japanese" },
  { id: "ko", label: "Korean" },
] as const;

interface BrowserChatPaneMenuProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export function BrowserChatPaneMenu({
  open,
  onClose,
  onOpenSettings,
}: BrowserChatPaneMenuProps) {
  const [showLangSubmenu, setShowLangSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const language = useBrowserChatPaneStore((s) => s.language);
  const setLanguage = useBrowserChatPaneStore((s) => s.setLanguage);
  const setScheduledTaskBanner = useBrowserChatPaneStore(
    (s) => s.setScheduledTaskBanner,
  );

  useEffect(() => {
    if (!open) {
      setShowLangSubmenu(false);
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, open]);

  if (!open) return null;

  const handleConvertToTask = () => {
    setScheduledTaskBanner({
      title: "Create Scheduled Task",
      description:
        "Start a conversation first to create a scheduled task from it. The scheduled task feature converts your chat history into an automated task that can run on a schedule.",
    });
    onClose();
  };

  const handleSettings = () => {
    onOpenSettings?.();
    onClose();
  };

  const handleSelectLanguage = (langId: string) => {
    setLanguage(langId);
    setShowLangSubmenu(false);
    onClose();
  };

  const menuItemStyle: React.CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderRadius: 8,
    background: "transparent",
    border: "none",
    color: TEXT_PRIMARY,
    fontSize: 13,
    cursor: "pointer",
    textAlign: "left",
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        right: 0,
        width: 220,
        background: MENU_BG,
        borderRadius: 12,
        border: `1px solid ${MENU_BORDER}`,
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        padding: 6,
        zIndex: 300,
      }}
    >
      {/* Convert to task */}
      <button
        type="button"
        style={menuItemStyle}
        onClick={handleConvertToTask}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = MENU_HOVER;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <CalendarClock size={15} style={{ color: TEXT_SECONDARY }} />
        <span>Convert to task</span>
      </button>

      {/* Settings */}
      <button
        type="button"
        style={menuItemStyle}
        onClick={handleSettings}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = MENU_HOVER;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <Settings size={15} style={{ color: TEXT_SECONDARY }} />
        <span>Settings</span>
      </button>

      {/* Language (with submenu) */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          style={{
            ...menuItemStyle,
            background: showLangSubmenu ? MENU_HOVER : "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = MENU_HOVER;
            setShowLangSubmenu(true);
          }}
          onMouseLeave={(e) => {
            if (!showLangSubmenu) {
              e.currentTarget.style.background = "transparent";
            }
          }}
        >
          <Globe size={15} style={{ color: TEXT_SECONDARY }} />
          <span style={{ flex: 1 }}>Language</span>
          <span style={{ fontSize: 11, color: TEXT_SECONDARY, marginRight: 4 }}>
            {LANGUAGES.find((l) => l.id === language)?.label ?? language}
          </span>
          <ChevronRight size={13} style={{ opacity: 0.5 }} />
        </button>

        {showLangSubmenu && (
          <div
            style={{
              position: "absolute",
              left: "calc(100% + 6px)",
              top: 0,
              width: 160,
              background: MENU_BG,
              borderRadius: 12,
              border: `1px solid ${MENU_BORDER}`,
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              padding: 6,
              zIndex: 310,
            }}
            onMouseLeave={() => setShowLangSubmenu(false)}
          >
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                type="button"
                style={{
                  ...menuItemStyle,
                  fontWeight: lang.id === language ? 700 : 400,
                  color: lang.id === language ? "#8fc7df" : TEXT_PRIMARY,
                }}
                onClick={() => handleSelectLanguage(lang.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = MENU_HOVER;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {lang.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
