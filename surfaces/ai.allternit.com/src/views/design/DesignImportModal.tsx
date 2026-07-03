// @ts-nocheck
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link, ArrowRight, CheckCircle, WarningCircle, Spinner, Palette, Tag, Code, BracketsCurly, FileCss, FolderOpen, FileText, FileZip } from "@phosphor-icons/react";
import type { DesignSystem } from "../../lib/design/design-registry";
import { extractCssVars, extractTailwindTokens, extractDtcgTokens, type ExtractedToken } from "../../lib/design/token-extractor";
import { resolveDesignSystemFromFile, resolveDesignSystemFromDirectory, resolvedDesignToDesignSystem } from "../../lib/design/design-system-resolver";
import { importClaudeDesignZip } from "../../lib/design/claude-design-import";
import { cn } from "../../lib/utils";

interface Props {
  onClose: () => void;
  onImport: (design: DesignSystem) => void;
}

type Phase = "input" | "loading" | "preview" | "error";
type Tab = "url" | "tokens" | "local" | "claude-zip";
type SourceType = "css" | "tailwind" | "dtcg";

export function DesignImportModal({ onClose, onImport }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("url");

  // URL tab state
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState<Omit<DesignSystem, "id"> | null>(null);
  const [customName, setCustomName] = useState("");

  // Tokens tab state
  const [sourceType, setSourceType] = useState<SourceType>("css");
  const [pasteInput, setPasteInput] = useState("");
  const [extractedTokens, setExtractedTokens] = useState<ExtractedToken[]>([]);

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

  function handleExtractTokens() {
    const input = pasteInput.trim();
    if (!input) return;
    let tokens: ExtractedToken[] = [];
    if (sourceType === "css") tokens = extractCssVars(input);
    else if (sourceType === "tailwind") tokens = extractTailwindTokens(input);
    else if (sourceType === "dtcg") tokens = extractDtcgTokens(input);
    setExtractedTokens(tokens);
  }

  function handleApplyTokens() {
    if (extractedTokens.length === 0) return;
    const id = `imported-tokens-${Date.now()}`;
    const colors = extractedTokens
      .filter(t => t.type === 'color')
      .map(t => t.value)
      .slice(0, 4);
    onImport({
      id,
      name: `Token Import (${extractedTokens.length} tokens)`,
      description: `Extracted ${extractedTokens.length} tokens from ${sourceType} input`,
      tags: ['imported', sourceType],
      previewColors: colors.length >= 2 ? colors : ['#111', '#333', '#666', '#999'],
      designMd: `# Imported Tokens\n\nSource: ${sourceType}\n\n` + extractedTokens.map(t => `- \`${t.id}\`: ${t.value}`).join('\n'),
      installs: 0,
      likes: 0,
      views: 0,
      forks: 0,
    });
    onClose();
  }

  async function handleResolveFromFile() {
    try {
      const resolved = await resolveDesignSystemFromFile();
      if (resolved) onImport(resolvedDesignToDesignSystem(resolved));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  async function handleResolveFromDirectory() {
    try {
      const resolved = await resolveDesignSystemFromDirectory();
      if (resolved) onImport(resolvedDesignToDesignSystem(resolved));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  async function handleClaudeDesignZip(file: File) {
    try {
      const result = await importClaudeDesignZip(file);
      if (result.designSystem) {
        onImport(result.designSystem);
      } else if (result.html) {
        const title = result.title || 'Claude Design Import';
        onImport({
          id: `claude-design-${Date.now()}`,
          name: title,
          description: 'Imported from Claude Design ZIP',
          vibe: 'Imported',
          author: 'claude-design',
          installs: 0,
          likes: 0,
          views: 0,
          forks: 0,
          tags: ['claude-design', 'import'],
          designMd: `# ${title}\n\nImported from Claude Design ZIP.`,
          previewColors: ['#111111', '#ffffff', '#888888'],
        });
      } else {
        setErrorMsg('No DESIGN.md or HTML artifact found in the ZIP.');
        setPhase('error');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
        onClick={e => e.stopPropagation()}
        className="bg-[var(--bg-primary,#fff)] border border-solid border-[var(--border-subtle,rgba(0,0,0,0.08))] rounded-3xl w-full max-w-[520px] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.2)]"
      >
        {/* Header */}
        <div className="p-[20px_24px] border-b border-solid border-[var(--border-subtle,rgba(0,0,0,0.08))] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-[var(--accent-primary,#e27c59)] flex items-center justify-center">
              <Link size={16} color="#fff" weight="bold" />
            </div>
            <div>
              <div className="text-[14px] font-bold text-[var(--text-primary,#111)]">Import Design System</div>
              <div className="text-[11px] text-[var(--text-secondary,#666)] mt-px">Extract design tokens from a URL or paste code</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg bg-black/5 border-none flex items-center justify-center cursor-pointer hover:bg-black/10 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-solid border-[var(--border-subtle,rgba(0,0,0,0.08))]">
          <button type="button"
            onClick={() => setActiveTab("url")}
            className={cn("flex-1 p-3 border-none text-[12px] font-bold cursor-pointer border-b-2 border-solid transition-colors duration-200", activeTab === "url" ? "bg-[var(--bg-secondary,#f9f9f9)] text-[var(--text-primary,#111)] border-[var(--accent-primary,#e27c59)]" : "bg-transparent text-[var(--text-secondary,#666)] border-transparent")}
          >
            From URL
          </button>
          <button type="button"
            onClick={() => setActiveTab("tokens")}
            className={cn("flex-1 p-3 border-none text-[12px] font-bold cursor-pointer border-b-2 border-solid transition-colors duration-200", activeTab === "tokens" ? "bg-[var(--bg-secondary,#f9f9f9)] text-[var(--text-primary,#111)] border-[var(--accent-primary,#e27c59)]" : "bg-transparent text-[var(--text-secondary,#666)] border-transparent")}
          >
            Extract Tokens
          </button>
          <button type="button"
            onClick={() => setActiveTab("local")}
            className={cn("flex-1 p-3 border-none text-[12px] font-bold cursor-pointer border-b-2 border-solid transition-colors duration-200", activeTab === "local" ? "bg-[var(--bg-secondary,#f9f9f9)] text-[var(--text-primary,#111)] border-[var(--accent-primary,#e27c59)]" : "bg-transparent text-[var(--text-secondary,#666)] border-transparent")}
          >
            Local DESIGN.md
          </button>
          <button type="button"
            onClick={() => setActiveTab("claude-zip")}
            className={cn("flex-1 p-3 border-none text-[12px] font-bold cursor-pointer border-b-2 border-solid transition-colors duration-200", activeTab === "claude-zip" ? "bg-[var(--bg-secondary,#f9f9f9)] text-[var(--text-primary,#111)] border-[var(--accent-primary,#e27c59)]" : "bg-transparent text-[var(--text-secondary,#666)] border-transparent")}
          >
            Claude ZIP
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <AnimatePresence mode="wait">

            {/* ─── URL Tab ───────────────────────────────────────── */}
            {activeTab === "url" && (
              <motion.div key="url" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Input phase */}
                {phase === "input" && (
                  <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="text-[13px] text-[var(--text-secondary,#666)] mb-4 leading-relaxed">
                      Paste any public website URL. Allternit will fetch it server-side, extract CSS custom properties, fonts, and color palette, and build a design system entry you can review before saving.
                    </div>
                    <div className="flex gap-2">
                      <input aria-label="Input" autoFocus
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleFetch()}
                        placeholder="https://linear.app"
                        className="flex-1 p-[10px_14px] rounded-[10px] border border-solid border-[var(--border-default,rgba(0,0,0,0.12))] text-[13px] outline-none font-inherit bg-[var(--bg-secondary,#f9f9f9)] focus:border-[var(--accent-primary,#e27c59)] transition-colors"
                      />
                      <button type="button"
                        onClick={handleFetch}
                        disabled={!url.trim()}
                        className={cn("p-[10px_18px] rounded-[10px] bg-[var(--text-primary,#111)] text-white border-none font-bold text-[13px] flex items-center gap-1.5 transition-opacity", !url.trim() ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:opacity-90")}
                      >
                        Extract <ArrowRight size={14} weight="bold" />
                      </button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {["linear.app", "vercel.com", "stripe.com", "resend.com", "supabase.com"].map(example => (
                        <button type="button"
                          key={example}
                          onClick={() => setUrl(`https://${example}`)}
                          className="px-2.5 py-1 rounded-lg border border-solid border-[var(--border-subtle,rgba(0,0,0,0.08))] bg-transparent text-[11px] font-semibold text-[var(--text-secondary,#666)] cursor-pointer hover:bg-black/5 transition-colors"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Loading phase */}
                {phase === "loading" && (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 py-8">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <Spinner size={32} className="text-[var(--accent-primary,#e27c59)]" />
                    </motion.div>
                    <div className="text-[13px] text-[var(--text-secondary,#666)] text-center">
                      Fetching {url}<br />
                      <span className="opacity-60">Extracting CSS tokens…</span>
                    </div>
                  </motion.div>
                )}

                {/* Preview phase */}
                {phase === "preview" && preview && (
                  <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <div className="flex items-center gap-2 mb-5 text-[#16a34a]">
                      <CheckCircle size={16} weight="fill" />
                      <span className="text-[12px] font-bold">Tokens extracted successfully</span>
                    </div>

                    <div className="flex gap-2 mb-5">
                      {preview.previewColors.map((c, i) => (
                        <div key={`designimportmodal-${i}`} title={c} className="w-10 h-10 rounded-[10px] border border-solid border-black/10 shrink-0" style={{ background: c }} />
                      ))}
                      <div className="flex-1 flex flex-col justify-center gap-1 ml-2">
                        <div className="text-[11px] font-bold text-[var(--text-secondary,#666)] uppercase tracking-wider">Detected Palette</div>
                        <div className="text-[11px] text-[var(--text-secondary,#666)]">{preview.previewColors.join("  ")}</div>
                      </div>
                    </div>

                    <div className="flex gap-1.5 flex-wrap mb-5">
                      {preview.tags.map(t => (
                        <span key={t} className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/5 text-[11px] font-semibold">
                          <Tag size={10} /> {t}
                        </span>
                      ))}
                    </div>

                    <div className="mb-2">
                      <div className="text-[11px] font-bold text-[var(--text-secondary,#666)] uppercase tracking-wider flex items-center mb-1.5">
                        <Palette size={11} className="mr-1" />
                        Design system name
                      </div>
                      <input aria-label="Input" value={customName}
                        onChange={e => setCustomName(e.target.value)}
                        className="w-full p-[10px_14px] rounded-[10px] border border-solid border-[var(--border-default,rgba(0,0,0,0.12))] text-[13px] font-semibold outline-none font-inherit box-border focus:border-[var(--accent-primary,#e27c59)] transition-colors"
                      />
                    </div>

                    <details className="mb-5 group">
                      <summary className="text-[11px] font-bold text-[var(--text-secondary,#666)] cursor-pointer select-none outline-none">View extracted Design.md</summary>
                      <pre className="mt-2 p-3 rounded-lg bg-black/5 text-[10px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-words max-h-40 overflow-y-auto font-mono">
                        {preview.designMd}
                      </pre>
                    </details>

                    <div className="flex gap-2 mt-4">
                      <button type="button" onClick={() => setPhase("input")} className="flex-1 p-2.5 rounded-[10px] border border-solid border-[var(--border-default,rgba(0,0,0,0.12))] bg-transparent text-[13px] font-semibold cursor-pointer hover:bg-black/5 transition-colors">
                        Try another
                      </button>
                      <button type="button" onClick={handleConfirm} className="flex-[2] p-2.5 rounded-[10px] bg-[var(--text-primary,#111)] text-white border-none text-[13px] font-bold cursor-pointer hover:opacity-90 transition-opacity">
                        Save to my registry
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Error phase */}
                {phase === "error" && (
                  <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="flex items-start gap-2.5 p-4 rounded-xl bg-[#fef2f2] border border-solid border-[#fecaca] mb-5">
                      <WarningCircle size={18} className="text-[#dc2626] shrink-0 mt-px" weight="fill" />
                      <div>
                        <div className="text-[13px] font-bold text-[#dc2626] mb-1">Could not extract tokens</div>
                        <div className="text-[12px] text-[#b91c1c]">{errorMsg}</div>
                      </div>
                    </div>
                    <div className="text-[12px] text-[var(--text-secondary,#666)] mb-4 leading-relaxed">
                      This happens with JS-only rendered sites. Try a URL that serves real CSS in its initial HTML (most marketing pages, docs sites, and landing pages work well).
                    </div>
                    <button type="button" onClick={() => setPhase("input")} className="w-full p-2.5 rounded-[10px] border border-solid border-[var(--border-default,rgba(0,0,0,0.12))] bg-transparent text-[13px] font-semibold cursor-pointer hover:bg-black/5 transition-colors">
                      Try a different URL
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ─── Extract Tokens Tab ────────────────────────────── */}
            {activeTab === "tokens" && (
              <motion.div key="tokens" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex gap-1.5 mb-4">
                  {([
                    { id: "css" as SourceType, label: "CSS vars", icon: <FileCss size={14} /> },
                    { id: "tailwind" as SourceType, label: "Tailwind", icon: <Code size={14} /> },
                    { id: "dtcg" as SourceType, label: "DTCG JSON", icon: <BracketsCurly size={14} /> },
                  ]).map(opt => (
                    <button type="button"
                      key={opt.id}
                      onClick={() => { setSourceType(opt.id); setExtractedTokens([]); }}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-solid text-[11px] font-bold cursor-pointer transition-colors duration-200",
                        sourceType === opt.id ? "border-[var(--accent-primary,#e27c59)] bg-[#e27c5914] text-[var(--accent-primary,#e27c59)]" : "border-[var(--border-subtle,rgba(0,0,0,0.08))] bg-transparent text-[var(--text-secondary,#666)] hover:bg-black/5"
                      )}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>

                <textarea aria-label="Text Area" value={pasteInput}
                  onChange={e => setPasteInput(e.target.value)}
                  placeholder={sourceType === "css" ? ":root { --color-primary: #3b82f6; --radius-base: 12px; }" : sourceType === "tailwind" ? '{ "colors": { "primary": "#3b82f6", "secondary": "#64748b" } }' : '{ "token-name": { "$value": "#3b82f6", "$type": "color" } }'}
                  className="w-full h-[140px] p-[10px_14px] rounded-[10px] border border-solid border-[var(--border-default,rgba(0,0,0,0.12))] text-[12px] outline-none font-mono bg-[var(--bg-secondary,#f9f9f9)] resize-y box-border focus:border-[var(--accent-primary,#e27c59)] transition-colors"
                />

                <div className="flex gap-2 mt-3">
                  <button type="button"
                    onClick={handleExtractTokens}
                    disabled={!pasteInput.trim()}
                    className={cn(
                      "flex-1 p-2.5 rounded-[10px] bg-[var(--text-primary,#111)] text-white border-none text-[13px] font-bold transition-opacity",
                      !pasteInput.trim() ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:opacity-90"
                    )}
                  >
                    Extract
                  </button>
                </div>

                {extractedTokens.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                    <div className="text-[11px] font-bold text-[var(--text-secondary,#666)] uppercase tracking-wider mb-2">
                      {extractedTokens.length} token{extractedTokens.length !== 1 ? 's' : ''} found
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3 max-h-48 overflow-y-auto p-1">
                      {extractedTokens.map(t => (
                        <span key={t.id} 
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-solid border-[var(--border-subtle,rgba(0,0,0,0.08))]"
                          style={{
                            background: t.type === 'color' ? t.value : "rgba(0,0,0,0.04)",
                            color: t.type === 'color' ? (isLightColor(t.value) ? '#111' : '#fff') : "var(--text-secondary, #666)",
                          }}
                        >
                          {t.id}: {t.value}
                        </span>
                      ))}
                    </div>
                    <button type="button"
                      onClick={handleApplyTokens}
                      className="w-full p-2.5 rounded-[10px] bg-[var(--accent-primary,#e27c59)] text-white border-none text-[13px] font-bold cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      Apply to project
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ─── Local DESIGN.md Tab ───────────────────────────── */}
            {activeTab === "local" && (
              <motion.div key="local" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-[13px] text-[var(--text-secondary,#666)] mb-4 leading-relaxed">
                  Load a DESIGN.md directly from your computer. The resolver looks for <code className="text-[11px] font-mono bg-black/5 px-1 rounded">DESIGN.md</code> in the selected directory, or in <code className="text-[11px] font-mono bg-black/5 px-1 rounded">design-system/DESIGN.md</code>.
                </div>
                <div className="flex flex-col gap-2">
                  <button type="button"
                    onClick={handleResolveFromFile}
                    className="w-full p-3 rounded-[10px] border border-solid border-[var(--border-default,rgba(0,0,0,0.12))] bg-[var(--bg-secondary,#f9f9f9)] text-[var(--text-primary,#111)] text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-black/5 transition-colors"
                  >
                    <FileText size={16} /> Select DESIGN.md file
                  </button>
                  <button type="button"
                    onClick={handleResolveFromDirectory}
                    className="w-full p-3 rounded-[10px] border border-solid border-[var(--border-default,rgba(0,0,0,0.12))] bg-[var(--bg-secondary,#f9f9f9)] text-[var(--text-primary,#111)] text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-black/5 transition-colors"
                  >
                    <FolderOpen size={16} /> Select project directory
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── Claude Design ZIP Tab ─────────────────────────── */}
            {activeTab === "claude-zip" && (
              <motion.div key="claude-zip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-[13px] text-[var(--text-secondary,#666)] mb-4 leading-relaxed">
                  Import a ZIP exported from Claude Design. The importer extracts DESIGN.md, the artifact HTML, and conversation metadata.
                </div>
                <label className="w-full p-3 rounded-[10px] border border-solid border-[var(--border-default,rgba(0,0,0,0.12))] bg-[var(--bg-secondary,#f9f9f9)] text-[var(--text-primary,#111)] text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-black/5 transition-colors">
                  <FileZip size={16} /> Select Claude Design ZIP
                  <input
                    type="file"
                    accept=".zip,application/zip,application/x-zip-compressed"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleClaudeDesignZip(file);
                    }}
                  />
                </label>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

function isLightColor(color: string): boolean {
  let r = 128, g = 128, b = 128;

  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    r = parseInt(hex.slice(0, 2), 16) || 0;
    g = parseInt(hex.slice(2, 4), 16) || 0;
    b = parseInt(hex.slice(4, 6), 16) || 0;
  } else if (color.startsWith('rgb')) {
    const m = color.match(/(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)/);
    if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
  } else if (color.startsWith('hsl')) {
    const m = color.match(/(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)%[,\s]+(\d+(?:\.\d+)?)%/);
    if (m) {
      const h = +m[1], s = +m[2] / 100, l = +m[3] / 100;
      const a = s * Math.min(l, 1 - l);
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      };
      r = Math.round(f(0) * 255);
      g = Math.round(f(8) * 255);
      b = Math.round(f(4) * 255);
    }
  } else if (color.startsWith('oklch')) {
    // Approximation: oklch lightness > 0.7 is light
    const m = color.match(/oklch\(\s*(\d+(?:\.\d+)?)%?/);
    if (m) return parseFloat(m[1]) > 0.7;
  }

  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 180;
}
