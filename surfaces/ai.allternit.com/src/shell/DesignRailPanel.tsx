"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MagicWand,
  Paperclip,
  Palette,
  FileText,
  Image,
  FigmaLogo,
  ChatTeardropText,
  Layout,
  PaintBucket,
  SidebarSimple,
} from "@phosphor-icons/react";
import { useDesignSessionStore, useDesignSessionActions } from "../views/design/DesignSessionStore";
import { useDesignTabStore } from "../stores/design-tab.store";
import { StudioMessageRenderer } from "../components/design/StudioMessageRenderer";

const SPECIALIST_LABELS: Record<string, string> = {
  architect: "Systems Architect",
  growth:    "Growth Hacker",
  purist:    "UI Purist",
  creative:  "Creative Director",
};

type HubTab = 'prototype' | 'slides' | 'template' | 'other';

interface DesignRailPanelProps {
  onNewDesign?: () => void;
  onCollapse?: () => void;
  onSetupDesignSystem?: () => void;
}

export function DesignRailPanel({ onNewDesign, onCollapse, onSetupDesignSystem }: DesignRailPanelProps) {
  const [input, setInput] = useState("");
  const [activeLeftTab, setActiveLeftTab] = useState<'chat' | 'comments'>('chat');
  const [importUrl, setImportUrl] = useState("");
  const [showImportBar, setShowImportBar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── session state ────────────────────────────────────────────────────────
  const activeSessionId = useDesignSessionStore(s => s.activeSessionId);
  const sessions       = useDesignSessionStore(s => s.sessions);
  const activeSession  = sessions.find(s => s.id === activeSessionId);
  const messages       = activeSession?.messages ?? [];
  const isStreaming    = useDesignSessionStore(
    s => s.streamingBySession?.[activeSessionId ?? ""]?.isStreaming ?? false
  );
  const { sendMessageStream, createSession } = useDesignSessionActions();

  // ── tab / project state ──────────────────────────────────────────────────
  const hasProject  = useDesignTabStore(s => s.hasProject);
  const specialist  = useDesignTabStore(s => s.specialist);
  const projectName = useDesignTabStore(s => s.projectName);

  // ── project creation form state ─────────────────────────────────────────
  const [hubTab, setHubTab]       = useState<HubTab>('prototype');
  const [projName, setProjName]   = useState("");
  const [fidelity, setFidelity]   = useState<'wireframe' | 'high'>('high');
  const [speakerNotes, setSpeakerNotes] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const text = `[Screenshot attached: "${file.name}"] Use the design patterns visible in this image as reference for the current project.`;
    setInput(prev => prev ? `${prev}\n${text}` : text);
  }

  function handleImportUrl() {
    const url = importUrl.trim();
    if (!url) return;
    setImportUrl("");
    setShowImportBar(false);
    const text = `[Import reference: ${url}] Use the design patterns from this URL as inspiration for the project.`;
    setInput(prev => prev ? `${prev}\n${text}` : text);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = await createSession({ name: projectName || "Design Session", sessionMode: "agent" });
    }
    if (sessionId) sendMessageStream(sessionId, { text });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function resumeSession(session: { id: string; name: string }) {
    (useDesignSessionStore.getState() as any).setActiveSessionId?.(session.id);
    useDesignTabStore.getState().setStoredProject({
      id: session.id, name: session.name, type: 'prototype',
      specialist: 'architect', fidelity: 'high', activeTabId: 'questions',
      tabs: [{ id: 'questions', label: 'Discovery', type: 'questions' }],
    });
    useDesignTabStore.getState().setHasProject(true);
    useDesignTabStore.getState().setProjectName(session.name);
    useDesignTabStore.getState().setSpecialist('architect');
  }

  function handleCreate() {
    if (!projName.trim()) return;
    const typeMap: Record<HubTab, string> = {
      prototype: 'prototype', slides: 'slides', template: 'template', other: 'other',
    };
    const specialistMap: Record<HubTab, string> = {
      prototype: 'architect', slides: 'creative', template: 'purist', other: 'architect',
    };
    useDesignTabStore.getState().setPendingProject({
      name:       projName.trim(),
      type:       typeMap[hubTab],
      specialist: specialistMap[hubTab],
      fidelity,
    });
    setProjName("");
  }

  const hubTabs: { id: HubTab; label: string }[] = [
    { id: 'prototype', label: 'Prototype' },
    { id: 'slides',    label: 'Slide deck' },
    { id: 'template',  label: 'Template' },
    { id: 'other',     label: 'Other' },
  ];

  // ── shared window chrome ─────────────────────────────────────────────────
  const panelChrome = (
    <div style={{
      height: 42, flexShrink: 0,
      display: "flex", alignItems: "center", padding: "0 10px", gap: 8,
      background: "var(--shell-floating-bg)",
      borderBottom: "1px solid var(--shell-floating-border)",
    }}>
      {/* Grip / drag affordance */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 3, padding: "4px 2px",
        cursor: "ew-resize", flexShrink: 0, opacity: 0.4,
      }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 14, height: 2, borderRadius: 1, background: "var(--shell-item-muted)" }} />
        ))}
      </div>
      <span style={{
        flex: 1, fontSize: 11, fontWeight: 700,
        color: "var(--shell-item-muted)", letterSpacing: "0.06em", textTransform: "uppercase",
      }}>
        Studio
      </span>
      {onCollapse && (
        <button
          onClick={onCollapse}
          title="Collapse panel"
          style={{
            width: 26, height: 26, borderRadius: 7, border: "1px solid var(--shell-floating-border)",
            background: "transparent", color: "var(--shell-item-muted)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--shell-item-hover)"; e.currentTarget.style.color = "var(--shell-item-fg)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--shell-item-muted)"; }}
        >
          <SidebarSimple size={13} weight="bold" />
        </button>
      )}
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────
  // NO PROJECT — show project creation form
  // ────────────────────────────────────────────────────────────────────────
  if (!hasProject) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {panelChrome}

        {/* Project type tabs */}
        <div style={{ padding: "10px 10px 8px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2, padding: 3, background: "var(--shell-floating-bg)", border: "1px solid var(--shell-floating-border)", borderRadius: 10, boxShadow: "var(--shadow-sm)" }}>
            {([
              { id: 'prototype' as const, label: 'Prototype', icon: <Layout size={13} weight="bold" /> },
              { id: 'slides'    as const, label: 'Slides',    icon: <FileText size={13} weight="bold" /> },
              { id: 'template'  as const, label: 'Template',  icon: <Palette size={13} weight="bold" /> },
              { id: 'other'     as const, label: 'Other',     icon: <MagicWand size={13} weight="bold" /> },
            ]).map(t => {
              const active = hubTab === t.id;
              return (
                <button key={t.id} onClick={() => setHubTab(t.id)} style={{
                  width: active ? "auto" : 26, height: 26, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  padding: active ? "0 9px" : "0",
                  border: "none", borderRadius: 7,
                  background: active ? "color-mix(in srgb, var(--accent-primary) 15%, var(--shell-panel-bg))" : "transparent",
                  color: active ? "var(--accent-primary)" : "var(--shell-item-muted)",
                  cursor: "pointer", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
                  opacity: active ? 1 : 0.55,
                  transition: "all 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
                }}>
                  {t.icon}
                  {active && <span>{t.label}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 14px", display: "flex", flexDirection: "column", gap: 16 }}>

          {hubTab === 'prototype' && (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--shell-item-fg)" }}>New prototype</div>
              <input
                value={projName} onChange={e => setProjName(e.target.value)}
                placeholder="Project name"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--shell-floating-border)", fontSize: 12, outline: "none", background: "var(--shell-panel-bg)", color: "var(--shell-item-fg)", boxSizing: "border-box" }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {([['wireframe', 'Wireframe'], ['high', 'High fidelity']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setFidelity(val)} style={{
                    padding: "8px 6px 10px", borderRadius: 10, textAlign: "center",
                    border: fidelity === val ? "2px solid var(--accent-primary)" : "1px solid var(--shell-floating-border)",
                    background: "var(--shell-panel-bg)", cursor: "pointer",
                  }}>
                    <div style={{ height: 48, marginBottom: 6, borderRadius: 5, background: val === 'wireframe' ? "rgba(0,0,0,0.04)" : "rgba(var(--accent-primary-rgb,226,100,41),0.08)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: "0 6px" }}>
                      <div style={{ width: "100%", height: 4, borderRadius: 2, background: val === 'wireframe' ? "rgba(0,0,0,0.15)" : "var(--accent-primary)" }} />
                      <div style={{ width: "70%", height: 4, borderRadius: 2, background: val === 'wireframe' ? "rgba(0,0,0,0.1)" : "rgba(99,102,241,0.6)" }} />
                      <div style={{ width: "85%", height: 4, borderRadius: 2, background: val === 'wireframe' ? "rgba(0,0,0,0.07)" : "rgba(99,102,241,0.35)" }} />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--shell-item-fg)" }}>{label}</div>
                    <div style={{ fontSize: 9, color: "var(--shell-item-muted)", marginTop: 2, lineHeight: 1.3 }}>
                      {val === 'wireframe' ? 'Layout & structure only' : 'Full colors & components'}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {hubTab === 'slides' && (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--shell-item-fg)" }}>New slide deck</div>
              <input
                value={projName} onChange={e => setProjName(e.target.value)}
                placeholder="Project name"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--shell-floating-border)", fontSize: 12, outline: "none", background: "var(--shell-panel-bg)", color: "var(--shell-item-fg)", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--shell-panel-bg)", borderRadius: 10, border: "1px solid var(--shell-floating-border)" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--shell-item-fg)" }}>Speaker notes</div>
                  <div style={{ fontSize: 10, color: "var(--shell-item-muted)", marginTop: 1 }}>Less text on slides</div>
                </div>
                <button onClick={() => setSpeakerNotes(v => !v)} style={{ width: 36, height: 20, borderRadius: 10, background: speakerNotes ? "var(--accent-primary)" : "rgba(0,0,0,0.2)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: speakerNotes ? 19 : 3, transition: "left 0.2s" }} />
                </button>
              </div>
            </>
          )}

          {(hubTab === 'template' || hubTab === 'other') && (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--shell-item-fg)" }}>
                New {hubTab === 'template' ? 'from template' : 'project'}
              </div>
              <input
                value={projName} onChange={e => setProjName(e.target.value)}
                placeholder="Project name"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--shell-floating-border)", fontSize: 12, outline: "none", background: "var(--shell-panel-bg)", color: "var(--shell-item-fg)", boxSizing: "border-box" }}
              />
            </>
          )}

          {/* Create button */}
          <button onClick={handleCreate} disabled={!projName.trim()} style={{
            width: "100%", padding: "10px", borderRadius: 10,
            background: projName.trim() ? "var(--accent-primary)" : "rgba(226,100,41,0.3)",
            color: "#fff", border: "none", fontSize: 12, fontWeight: 700,
            cursor: projName.trim() ? "pointer" : "default",
          }}>
            + Create
          </button>
          <div style={{ fontSize: 10, color: "var(--shell-item-muted)", textAlign: "center", marginTop: -8 }}>
            Only you can see your project by default.
          </div>

          {/* Design system promo */}
          <div style={{ padding: "14px 12px", borderRadius: 12, border: "1px solid var(--shell-floating-border)", background: "var(--shell-panel-bg)" }}>
            <div style={{ fontSize: 11, color: "var(--shell-item-fg)", lineHeight: 1.55, marginBottom: 12, opacity: 0.72 }}>
              Create a design system so anyone can create good-looking designs and assets.
            </div>
            <button
              onClick={onSetupDesignSystem}
              disabled={!onSetupDesignSystem}
              style={{ width: "100%", padding: "9px", borderRadius: 8, background: "var(--accent-primary)", color: "#fff", border: "none", fontSize: 11, fontWeight: 700, cursor: onSetupDesignSystem ? "pointer" : "default", opacity: onSetupDesignSystem ? 1 : 0.7 }}
            >
              Set up design system
            </button>
          </div>
        </div>

        {/* Recent sessions list */}
        {sessions.length > 0 && (
          <div style={{ padding: "0 14px 8px" }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--shell-item-muted)", marginBottom: 8 }}>Recent</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {sessions.slice(0, 6).map(session => (
                <button
                  key={session.id}
                  onClick={() => resumeSession(session)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 10, border: "1px solid transparent", background: "transparent", color: "var(--shell-item-fg)", cursor: "pointer", textAlign: "left", width: "100%" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--shell-item-hover)"; e.currentTarget.style.borderColor = "var(--shell-floating-border)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
                >
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: "color-mix(in srgb, var(--accent-primary) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-primary) 18%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <MagicWand size={12} weight="fill" color="var(--accent-primary)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--shell-item-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>{session.name}</div>
                    <div style={{ fontSize: 10, color: "var(--shell-item-muted)", marginTop: 1 }}>{(session as any).messages?.length ?? 0} messages</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // PROJECT ACTIVE — chat interface
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {panelChrome}

      {/* Project header */}
      <div style={{ padding: "10px 10px 0", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
          background: "var(--shell-floating-bg)", border: "1px solid var(--shell-floating-border)",
          borderRadius: 10, marginBottom: 8,
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "color-mix(in srgb, var(--accent-primary) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <MagicWand size={13} weight="fill" color="var(--accent-primary)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--shell-item-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>
              {activeSession?.name ?? projectName ?? "Untitled"}
            </div>
            {specialist && (
              <div style={{ fontSize: 9, color: "var(--accent-primary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 2 }}>
                {SPECIALIST_LABELS[specialist] ?? specialist}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: isStreaming ? "var(--accent-primary)" : "#22c55e" }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: isStreaming ? "var(--accent-primary)" : "#22c55e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {isStreaming ? "Working" : "Ready"}
            </span>
          </div>
        </div>

        {/* Chat / Comments tab strip */}
        <div style={{ paddingBottom: 10 }}>
          <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--shell-floating-bg)", border: "1px solid var(--shell-floating-border)", borderRadius: 10 }}>
            {(['chat', 'comments'] as const).map(t => (
              <button key={t} onClick={() => setActiveLeftTab(t)} style={{
                flex: 1, padding: "5px 0", fontSize: 11, fontWeight: 600,
                background: activeLeftTab === t ? "var(--shell-panel-bg)" : "transparent",
                border: activeLeftTab === t ? "1px solid var(--shell-floating-border)" : "1px solid transparent",
                borderRadius: 8, boxShadow: activeLeftTab === t ? "0 1px 3px rgba(0,0,0,0.07)" : "none",
                color: activeLeftTab === t ? "var(--shell-item-fg)" : "var(--shell-item-muted)",
                cursor: "pointer", textTransform: "capitalize", transition: "all 0.15s",
              }}>{t === 'chat' ? 'Chat' : 'Comments'}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && activeLeftTab === 'chat' && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 8px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--shell-item-fg)", letterSpacing: "-0.01em", marginBottom: 5 }}>
              Start with context
            </div>
            <div style={{ fontSize: 11, color: "var(--shell-item-muted)", lineHeight: 1.55, marginBottom: 18, maxWidth: 200 }}>
              Designs grounded in real context turn out better.
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,.fig" style={{ display: "none" }} onChange={handleFileAttach} />
            <div style={{ display: "flex", flexDirection: "column", gap: 7, width: "100%" }}>
              {([
                { label: "Design System",     icon: <PaintBucket size={13} weight="fill" />, iconBg: "rgba(226,100,41,0.15)", iconColor: "#E26429", onClick: () => onSetupDesignSystem?.() },
                { label: "Add screenshot",    icon: <Image size={13} weight="fill" />,       iconBg: "rgba(34,197,94,0.15)",  iconColor: "#22c55e", onClick: () => fileInputRef.current?.click() },
                { label: "Import Figma file", icon: <FigmaLogo size={13} weight="fill" />,   iconBg: "rgba(99,102,241,0.15)", iconColor: "#6366f1", onClick: () => setShowImportBar(v => !v) },
              ] as const).map(item => (
                <button key={item.label} onClick={item.onClick} style={{
                  display: "flex", alignItems: "center", gap: 9, padding: "8px 10px",
                  borderRadius: 10, border: "1px solid var(--shell-floating-border)",
                  background: "var(--shell-panel-bg)", color: "var(--shell-item-fg)",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left",
                }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: item.iconBg, color: item.iconColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  {item.label}
                </button>
              ))}
              {showImportBar && (
                <div style={{ display: "flex", gap: 6, padding: "8px 10px", borderRadius: 10, border: "1px solid var(--shell-floating-border)", background: "var(--shell-panel-bg)" }}>
                  <input
                    autoFocus
                    value={importUrl}
                    onChange={e => setImportUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleImportUrl(); if (e.key === "Escape") setShowImportBar(false); }}
                    placeholder="Paste Figma / URL…"
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 11, color: "var(--shell-item-fg)", minWidth: 0 }}
                  />
                  <button onClick={handleImportUrl} disabled={!importUrl.trim()} style={{ padding: "3px 9px", borderRadius: 6, background: importUrl.trim() ? "var(--accent-primary)" : "var(--shell-item-hover)", color: importUrl.trim() ? "#fff" : "var(--shell-item-muted)", border: "none", fontSize: 10, fontWeight: 700, cursor: importUrl.trim() ? "pointer" : "default" }}>
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeLeftTab === 'comments' && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 8px", gap: 8, color: "var(--shell-item-muted)", fontSize: 11 }}>
            <ChatTeardropText size={24} weight="duotone" />
            <span>No comments yet</span>
          </div>
        )}

        {activeLeftTab === 'chat' && messages.map((m, idx) => (
          <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: m.role === "user" ? "var(--accent-primary)" : "var(--shell-item-muted)" }}>
              {m.role === "user" ? "You" : "Studio Agent"}
            </div>
            <StudioMessageRenderer
              message={m}
              isLast={idx === messages.length - 1}
              onSubmitForm={(text) => activeSessionId && sendMessageStream(activeSessionId, { text })}
            />
          </div>
        ))}

        {isStreaming && (
          <div style={{ display: "flex", gap: 4, padding: "4px 0", alignItems: "center" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent-primary)", animation: `pulse 1.2s ${i * 0.2}s infinite`, opacity: 0.7 }} />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat input */}
      <div style={{ padding: "10px", borderTop: "1px solid var(--shell-divider)", flexShrink: 0 }}>
        <div style={{ background: "var(--shell-panel-bg)", border: "1px solid var(--shell-floating-border)", borderRadius: 14, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={messages.length === 0 ? "Describe what you want to create..." : "Message studio agent..."}
            rows={2}
            style={{ width: "100%", background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 12, fontFamily: "inherit", color: "var(--shell-item-fg)", lineHeight: 1.5 }}
          />
          {showImportBar && (
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input
                autoFocus
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleImportUrl(); if (e.key === "Escape") setShowImportBar(false); }}
                placeholder="Paste Figma / URL…"
                style={{ flex: 1, background: "var(--shell-panel-bg)", border: "1px solid var(--shell-floating-border)", borderRadius: 7, padding: "4px 8px", outline: "none", fontSize: 11, color: "var(--shell-item-fg)" }}
              />
              <button onClick={handleImportUrl} disabled={!importUrl.trim()} style={{ padding: "4px 9px", borderRadius: 6, background: importUrl.trim() ? "var(--accent-primary)" : "var(--shell-item-hover)", color: importUrl.trim() ? "#fff" : "var(--shell-item-muted)", border: "none", fontSize: 10, fontWeight: 700, cursor: importUrl.trim() ? "pointer" : "default" }}>
                Add
              </button>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4 }}>
              <button style={{ background: "none", border: "none", color: "var(--shell-item-muted)", cursor: "pointer", padding: 4 }}><Palette size={13} /></button>
              <button onClick={() => fileInputRef.current?.click()} style={{ background: "none", border: "none", color: "var(--shell-item-muted)", cursor: "pointer", padding: 4 }}><Paperclip size={13} /></button>
              <input ref={fileInputRef} type="file" accept="image/*,.fig" style={{ display: "none" }} onChange={handleFileAttach} />
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={() => setShowImportBar(v => !v)} style={{ padding: "4px 10px", borderRadius: 7, background: showImportBar ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)" : "var(--shell-item-hover)", color: showImportBar ? "var(--accent-primary)" : "var(--shell-item-muted)", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Import
              </button>
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                style={{
                  padding: "4px 12px", borderRadius: 7,
                  background: input.trim() ? "var(--accent-primary)" : "var(--shell-item-hover)",
                  color: input.trim() ? "#fff" : "var(--shell-item-muted)",
                  border: "none", fontSize: 11, fontWeight: 700,
                  cursor: input.trim() ? "pointer" : "default",
                  transition: "all 0.15s",
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
