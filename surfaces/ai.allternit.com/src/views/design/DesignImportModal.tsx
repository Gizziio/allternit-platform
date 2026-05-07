"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link, ArrowRight, CheckCircle, WarningCircle, Spinner, Palette, Tag } from "@phosphor-icons/react";
import type { DesignSystem } from "../../lib/design/design-registry";

interface Props {
  onClose: () => void;
  onImport: (design: DesignSystem) => void;
}

type Phase = "input" | "loading" | "preview" | "error";

export function DesignImportModal({ onClose, onImport }: Props) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState<Omit<DesignSystem, "id"> | null>(null);
  const [customName, setCustomName] = useState("");

  async function handleFetch() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setPhase("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/design/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json() as { ok: boolean; design?: Omit<DesignSystem, "id">; error?: string };
      if (!data.ok || !data.design) {
        setErrorMsg(data.error ?? "Could not extract design tokens from that URL.");
        setPhase("error");
        return;
      }
      setPreview(data.design);
      setCustomName(data.design.name);
      setPhase("preview");
    } catch {
      setErrorMsg("Network error — check your connection.");
      setPhase("error");
    }
  }

  function handleConfirm() {
    if (!preview) return;
    const id = `imported-${Date.now()}`;
    onImport({
      ...preview,
      id,
      name: customName || preview.name,
      installs: 0,
      likes: 0,
      views: 0,
      forks: 0,
    });
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
        onClick={e => e.stopPropagation()}
        style={{ background: "var(--bg-primary, #fff)", border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))", borderRadius: "24px", width: "100%", maxWidth: "520px", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.2)" }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.08))", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "var(--accent-primary, #e27c59)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Link size={16} color="#fff" weight="bold" />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary, #111)" }}>Import from URL</div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary, #666)", marginTop: "1px" }}>Extract design tokens from any website</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: "28px", height: "28px", borderRadius: "8px", background: "rgba(0,0,0,0.05)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px" }}>
          <AnimatePresence mode="wait">

            {/* Input phase */}
            {phase === "input" && (
              <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ fontSize: "13px", color: "var(--text-secondary, #666)", marginBottom: "16px", lineHeight: 1.5 }}>
                  Paste any public website URL. Allternit will fetch it server-side, extract CSS custom properties, fonts, and color palette, and build a design system entry you can review before saving.
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    autoFocus
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleFetch()}
                    placeholder="https://linear.app"
                    style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--border-default, rgba(0,0,0,0.12))", fontSize: "13px", outline: "none", fontFamily: "inherit", background: "var(--bg-secondary, #f9f9f9)" }}
                  />
                  <button
                    onClick={handleFetch}
                    disabled={!url.trim()}
                    style={{ padding: "10px 18px", borderRadius: "10px", background: "var(--text-primary, #111)", color: "#fff", border: "none", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: !url.trim() ? 0.4 : 1 }}
                  >
                    Extract <ArrowRight size={14} weight="bold" />
                  </button>
                </div>
                <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {["linear.app", "vercel.com", "stripe.com", "resend.com", "supabase.com"].map(example => (
                    <button
                      key={example}
                      onClick={() => setUrl(`https://${example}`)}
                      style={{ padding: "4px 10px", borderRadius: "8px", border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))", background: "transparent", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary, #666)", cursor: "pointer" }}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Loading phase */}
            {phase === "loading" && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "32px 0" }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <Spinner size={32} color="var(--accent-primary, #e27c59)" />
                </motion.div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary, #666)", textAlign: "center" }}>
                  Fetching {url}<br />
                  <span style={{ opacity: 0.6 }}>Extracting CSS tokens…</span>
                </div>
              </motion.div>
            )}

            {/* Preview phase */}
            {phase === "preview" && preview && (
              <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px", color: "#16a34a" }}>
                  <CheckCircle size={16} weight="fill" />
                  <span style={{ fontSize: "12px", fontWeight: 700 }}>Tokens extracted successfully</span>
                </div>

                {/* Color swatches */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                  {preview.previewColors.map((c, i) => (
                    <div key={i} title={c} style={{ width: "40px", height: "40px", borderRadius: "10px", background: c, border: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }} />
                  ))}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "4px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary, #666)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Detected Palette</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary, #666)" }}>{preview.previewColors.join("  ")}</div>
                  </div>
                </div>

                {/* Tags */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "20px" }}>
                  {preview.tags.map(t => (
                    <span key={t} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "3px 8px", borderRadius: "6px", background: "rgba(0,0,0,0.04)", fontSize: "11px", fontWeight: 600 }}>
                      <Tag size={10} /> {t}
                    </span>
                  ))}
                </div>

                {/* Name edit */}
                <div style={{ marginBottom: "8px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary, #666)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
                    <Palette size={11} style={{ marginRight: "4px" }} />
                    Design system name
                  </label>
                  <input
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--border-default, rgba(0,0,0,0.12))", fontSize: "13px", fontWeight: 600, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                </div>

                {/* designMd preview */}
                <details style={{ marginBottom: "20px" }}>
                  <summary style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary, #666)", cursor: "pointer", userSelect: "none" }}>View extracted Design.md</summary>
                  <pre style={{ marginTop: "8px", padding: "12px", borderRadius: "8px", background: "rgba(0,0,0,0.03)", fontSize: "10px", lineHeight: 1.6, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "160px", overflowY: "auto" }}>
                    {preview.designMd}
                  </pre>
                </details>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => setPhase("input")} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid var(--border-default, rgba(0,0,0,0.12))", background: "transparent", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                    Try another
                  </button>
                  <button onClick={handleConfirm} style={{ flex: 2, padding: "10px", borderRadius: "10px", background: "var(--text-primary, #111)", color: "#fff", border: "none", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                    Save to my registry
                  </button>
                </div>
              </motion.div>
            )}

            {/* Error phase */}
            {phase === "error" && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "16px", borderRadius: "12px", background: "#fef2f2", border: "1px solid #fecaca", marginBottom: "20px" }}>
                  <WarningCircle size={18} color="#dc2626" weight="fill" style={{ flexShrink: 0, marginTop: "1px" }} />
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#dc2626", marginBottom: "4px" }}>Could not extract tokens</div>
                    <div style={{ fontSize: "12px", color: "#b91c1c" }}>{errorMsg}</div>
                  </div>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary, #666)", marginBottom: "16px" }}>
                  This happens with JS-only rendered sites. Try a URL that serves real CSS in its initial HTML (most marketing pages, docs sites, and landing pages work well).
                </div>
                <button onClick={() => setPhase("input")} style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid var(--border-default, rgba(0,0,0,0.12))", background: "transparent", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  Try a different URL
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
