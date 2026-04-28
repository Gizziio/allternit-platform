"use client";

import { X, DownloadSimple, CheckCircle, Warning, ArrowDown } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BACKGROUND,
  TEXT,
  BORDER,
  RADIUS,
  SHADOW,
  TYPOGRAPHY,
  STATUS,
} from "@/design/allternit.tokens";
import { useBrowserDownloadStore } from "./browserDownload.store";

export function BrowserDownloadBar() {
  const { downloads, removeDownload, clearCompleted } = useBrowserDownloadStore();
  const active = downloads.filter((d) => d.status === "downloading" || d.status === "pending");
  const visible = downloads.slice(0, 5);

  if (visible.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        right: 12,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <AnimatePresence>
        {visible.map((dl) => (
          <motion.div
            key={dl.id}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderRadius: RADIUS.md,
              background: BACKGROUND.secondary,
              border: `1px solid ${BORDER.subtle}`,
              boxShadow: SHADOW.md,
              backdropFilter: "blur(12px)",
            }}
          >
            {dl.status === "completed" ? (
              <CheckCircle style={{ width: 16, height: 16, color: STATUS.success, flexShrink: 0 }} />
            ) : dl.status === "error" ? (
              <Warning style={{ width: 16, height: 16, color: STATUS.error, flexShrink: 0 }} />
            ) : (
              <ArrowDown style={{ width: 16, height: 16, color: TEXT.secondary, flexShrink: 0, animation: "spin 1s linear infinite" }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: TYPOGRAPHY.size.sm, color: TEXT.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {dl.filename}
              </div>
              <div style={{ fontSize: TYPOGRAPHY.size.xs, color: TEXT.tertiary, marginTop: 1 }}>
                {dl.status === "downloading" ? `${dl.progress}% · ${dl.size || ""}` : dl.status === "completed" ? "Done" : dl.status === "error" ? "Failed" : "Waiting..."}
              </div>
              {dl.status === "downloading" && (
                <div style={{ width: "100%", height: 2, background: BORDER.subtle, borderRadius: 1, marginTop: 4, overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${dl.progress}%` }}
                    style={{ height: "100%", background: STATUS.info }}
                  />
                </div>
              )}
            </div>
            <button
              onClick={() => removeDownload(dl.id)}
              style={{
                padding: 4,
                borderRadius: RADIUS.sm,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: TEXT.tertiary,
                display: "flex",
                flexShrink: 0,
              }}
            >
              <X style={{ width: 12, height: 12 }} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
      {downloads.length > visible.length && (
        <div style={{ fontSize: TYPOGRAPHY.size.xs, color: TEXT.tertiary, paddingLeft: 4 }}>
          +{downloads.length - visible.length} more
        </div>
      )}
      {active.length === 0 && downloads.length > 0 && (
        <button
          onClick={clearCompleted}
          style={{
            alignSelf: "flex-start",
            padding: "4px 10px",
            borderRadius: RADIUS.md,
            border: "none",
            background: "transparent",
            color: TEXT.tertiary,
            fontSize: TYPOGRAPHY.size.xs,
            cursor: "pointer",
          }}
        >
          Clear all
        </button>
      )}
    </motion.div>
  );
}
