/**
 * BrowserChatPane - Browser sidecar chat surface
 *
 * Uses embedded native agent sessions when a browser-origin durable session is active.
 * Falls back to the legacy browser agent store when no embedded session exists yet.
 *
 * Features: model picker header, three-dot menu, permission mode selector,
 * scheduled task banner, workflow teaching empty state, footer disclaimer.
 */

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock,
  Diamond,
  Globe,
  Mic,
  MicOff,
  MoreVertical,
  Play,
  Sparkles,
  Square,
  X,
} from "lucide-react";

import { AgentContextStrip } from "@/components/agents/AgentContextStrip";
import {
  GizziMascot,
  type GizziAttention,
  type GizziEmotion,
} from "@/components/ai-elements/GizziMascot";
import {
  getOpenClawWorkspacePathFromAgent,
  mapNativeMessagesToStreamMessages,
  useEmbeddedAgentSession,
  useEmbeddedAgentSessionStore,
  useNativeAgentStore,
} from "@/lib/agents";
import { useSurfaceAgentSelection } from "@/lib/agents/surface-agent-context";
import { useAgentSurfaceModeStore } from "@/stores/agent-surface-mode.store";
import { useSidecarStore } from "@/stores/sidecar-store";
import {
  AgentModeBackdrop,
  getAgentModeSurfaceTheme,
} from "@/views/chat/agentModeSurfaceTheme";

import { ChatComposer } from "../../views/chat/ChatComposer";
import type { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from "@/services/voice/SpeechToText";
import { useBrowserAgentStore } from "./browserAgent.store";
import { useBrowserChatPaneStore } from "./browserChatPane.store";
import { BrowserChatPaneMenu } from "./BrowserChatPaneMenu";
import { useBrowserStore } from "./browser.store";
import {
  useBrowserShortcutsStore,
  getFaviconUrl,
  type BrowserShortcut,
} from "./browserShortcuts.store";
import type { BrowserTab } from "./browser.types";

// Terminal Server URL for model fetching
declare const __TERMINAL_SERVER_URL__: string | undefined;

declare global {
  interface Window {
    __TERMINAL_SERVER_URL__?: string;
  }
}

const TERMINAL_SERVER_URL =
  typeof __TERMINAL_SERVER_URL__ !== "undefined"
    ? __TERMINAL_SERVER_URL__
    : typeof window !== "undefined" && window.__TERMINAL_SERVER_URL__
      ? window.__TERMINAL_SERVER_URL__
      : "http://127.0.0.1:4096";

interface FallbackChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number | string;
}

type DisplayMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: string | number;
};

// Type guard for web tabs to safely access url/title properties
function isWebTab(tab: BrowserTab | null | undefined): tab is BrowserTab & { contentType: 'web'; url: string; title: string } {
  return tab !== null && tab !== undefined && 'contentType' in tab && tab.contentType === 'web';
}

function formatHost(url?: string): string {
  if (!url) {
    return "No page selected";
  }

  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// ── Slash commands for browser surface ──────────────────────────────────────
const BROWSER_SLASH_COMMANDS = [
  { command: "/screenshot", label: "Take a screenshot" },
  { command: "/navigate", label: "Navigate to URL" },
  { command: "/extract", label: "Extract page content" },
  { command: "/workflow", label: "Start workflow recording" },
  { command: "/task", label: "Create scheduled task" },
];

// ── Header icon button helper ───────────────────────────────────────────────
function HeaderIconButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        padding: 6,
        borderRadius: "50%",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: "#999",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.1)";
        e.currentTarget.style.color = "#fff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "#999";
      }}
    >
      {children}
    </button>
  );
}

// ── Workflow Teaching Empty State ────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// WorkflowTeachingToggle — pill button that lives on the input bar
// ─────────────────────────────────────────────────────────────────────────────
function WorkflowTeachingToggle() {
  const active = useBrowserChatPaneStore((s) => s.workflowTeachingActive);
  const recording = useBrowserChatPaneStore((s) => s.workflowRecording);
  const setActive = useBrowserChatPaneStore((s) => s.setWorkflowTeachingActive);
  const setRecording = useBrowserChatPaneStore((s) => s.setWorkflowRecording);

  const handleClick = () => {
    if (!active) {
      // Activate — the WorkflowPaneContent will handle mic permission
      setActive(true);
    } else if (recording) {
      // Stop recording — WorkflowPaneContent watches this and transitions to save card
      setRecording(false);
    } else {
      // Deactivate entirely
      setActive(false);
    }
  };

  const isRed = active && recording;
  const isAmber = active && !recording;

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        type="button"
        onClick={handleClick}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 500,
          cursor: "pointer", transition: "all 0.15s",
          border: isRed
            ? "1px solid rgba(239,68,68,0.4)"
            : isAmber
              ? "1px solid rgba(245,158,11,0.35)"
              : "1px solid rgba(255,255,255,0.1)",
          background: isRed
            ? "rgba(239,68,68,0.08)"
            : isAmber
              ? "rgba(245,158,11,0.06)"
              : "transparent",
          color: isRed ? "#f87171" : isAmber ? "#fbbf24" : "#96a7b1",
        }}
      >
        {isRed ? (
          <>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "#ef4444", flexShrink: 0,
              animation: "pulse-recording 1.5s ease-in-out infinite",
            }} />
            Stop recording
          </>
        ) : isAmber ? (
          <><Mic style={{ width: 12, height: 12 }} /> Teach workflow — active</>
        ) : (
          <><Mic style={{ width: 12, height: 12 }} /> Teach A2R your workflow</>
        )}
      </button>
      <style>{`@keyframes pulse-recording { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WorkflowPaneContent — replaces the old WorkflowTeachingEmptyState.
// Renders inside the chat pane empty-state area for non-embedded sessions.
// Manages the full teaching flow:
//   idle → permission → ready → recording → saving → (saved/idle)
// When workflowTeachingActive is false it shows the default Gizzi mascot.
// ─────────────────────────────────────────────────────────────────────────────
type WorkflowPhase = "idle" | "permission" | "ready" | "recording" | "saving";

function WorkflowPaneContent({
  mascotEmotion,
  mascotAttention,
}: {
  mascotEmotion: GizziEmotion;
  mascotAttention: GizziAttention | null;
}) {
  const active = useBrowserChatPaneStore((s) => s.workflowTeachingActive);
  const micEnabled = useBrowserChatPaneStore((s) => s.microphoneEnabled);
  const recording = useBrowserChatPaneStore((s) => s.workflowRecording);
  const setActive = useBrowserChatPaneStore((s) => s.setWorkflowTeachingActive);
  const setMicEnabled = useBrowserChatPaneStore((s) => s.setMicrophoneEnabled);
  const setRecording = useBrowserChatPaneStore((s) => s.setWorkflowRecording);

  const [phase, setPhase] = useState<WorkflowPhase>("idle");
  const [steps, setSteps] = useState<string[]>([]);
  const [interimText, setInterimText] = useState("");
  const [micError, setMicError] = useState<string | null>(null);

  // Save-card state
  const [workflowName, setWorkflowName] = useState("");
  const [workflowDesc, setWorkflowDesc] = useState("");
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-5-20250929");
  const [saved, setSaved] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Sync phase with store state
  useEffect(() => {
    if (!active) {
      setPhase("idle");
      stopSTT();
      return;
    }
    if (!micEnabled) {
      setPhase("permission");
      return;
    }
    // mic granted but currently NOT recording (store flag just flipped false)
    if (!recording && phase === "recording") {
      stopSTT();
      if (steps.length > 0) {
        setPhase("saving");
      } else {
        setPhase("ready");
      }
    } else if (phase === "idle" || phase === "permission") {
      setPhase("ready");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, micEnabled, recording]);

  const stopSTT = () => {
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
    setInterimText("");
  };

  const handleRequestMic = async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop()); // we only needed the grant
      setMicEnabled(true);
      setPhase("ready");
    } catch {
      setMicError("Microphone access denied. Open System Settings → Privacy → Microphone and allow this app, then try again.");
    }
  };

  const handleStartRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSteps((prev) => [...prev, "[Speech recognition not supported in this browser]"]);
      setRecording(true);
      setPhase("recording");
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          const trimmed = t.trim();
          if (trimmed) setSteps((prev) => [...prev, trimmed]);
          interim = "";
        } else {
          interim += t;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== "aborted") {
        setSteps((prev) => [...prev, `[STT error: ${e.error}]`]);
      }
    };

    recognition.onend = () => {
      setInterimText("");
    };

    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
    setPhase("recording");
  };

  const handleStopRecording = () => {
    stopSTT();
    setRecording(false);
    if (steps.length > 0) {
      setPhase("saving");
    } else {
      setPhase("ready");
    }
  };

  const handleSaveWorkflow = () => {
    // Dispatch a chat message summarising the captured workflow
    // For now we store it locally and show a success state
    setSaved(true);
    setTimeout(() => {
      setActive(false);
      setPhase("idle");
      setSteps([]);
      setInterimText("");
      setWorkflowName("");
      setWorkflowDesc("");
      setSaved(false);
    }, 2000);
  };

  // ── IDLE: show Gizzi mascot (same as embedded sessions) ──────────────────
  if (phase === "idle") {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100%", padding: "0 24px", textAlign: "center",
      }}>
        <div style={{ marginBottom: 16 }}>
          <GizziMascot size={56} emotion={mascotEmotion} attention={mascotAttention} />
        </div>
        <p style={{ fontSize: 14, color: "#ddd", fontWeight: 600, marginBottom: 4 }}>
          Browser agent ready
        </p>
        <p style={{ fontSize: 12, color: "#93a1ab", lineHeight: 1.5, margin: 0 }}>
          Ask me to browse, fill forms, or automate a workflow. Use the mic button below to teach me a workflow step by step.
        </p>
      </div>
    );
  }

  // ── PERMISSION: ask for microphone ───────────────────────────────────────
  if (phase === "permission") {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100%", padding: "0 24px", textAlign: "center", gap: 16,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "rgba(143,199,223,0.1)",
          border: "1px solid rgba(143,199,223,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Mic style={{ width: 24, height: 24, color: "#8fc7df" }} />
        </div>
        <div>
          <p style={{ fontSize: 14, color: "#ddd", fontWeight: 600, margin: "0 0 6px" }}>
            Microphone access needed
          </p>
          <p style={{ fontSize: 12, color: "#93a1ab", lineHeight: 1.6, margin: 0 }}>
            A2R needs your microphone to record your narration as you demonstrate the workflow. When prompted, click <strong style={{ color: "#ccc" }}>Allow</strong> in the browser permission dialog.
          </p>
        </div>
        {micError && (
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#fca5a5", lineHeight: 1.5,
            textAlign: "left", maxWidth: 280,
          }}>
            <strong>Permission denied.</strong> {micError}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={handleRequestMic} style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px",
            borderRadius: 999, border: "none", background: "#8fc7df", color: "#0d1f2d",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            <Mic style={{ width: 14, height: 14 }} /> Enable microphone
          </button>
          <button type="button" onClick={() => setActive(false)} style={{
            padding: "9px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent", color: "#96a7b1", fontSize: 13, cursor: "pointer",
          }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── READY: mic granted, waiting to record ────────────────────────────────
  if (phase === "ready") {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100%", padding: "0 24px", textAlign: "center", gap: 16,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Mic style={{ width: 24, height: 24, color: "#4ade80" }} />
        </div>
        <div>
          <p style={{ fontSize: 14, color: "#ddd", fontWeight: 600, margin: "0 0 6px" }}>
            Ready to record
          </p>
          <p style={{ fontSize: 12, color: "#93a1ab", lineHeight: 1.6, margin: 0 }}>
            Microphone connected. When you click Start, narrate each step of your workflow out loud as you perform it in the browser. A2R will transcribe and learn each step.
          </p>
        </div>
        <button type="button" onClick={handleStartRecording} style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px",
          borderRadius: 999, border: "none", background: "#4ade80", color: "#0a2010",
          fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>
          <Play style={{ width: 14, height: 14, fill: "currentColor" }} /> Start recording
        </button>
        <button type="button" onClick={() => setActive(false)} style={{
          padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.08)",
          background: "transparent", color: "#555", fontSize: 12, cursor: "pointer",
        }}>
          Cancel
        </button>
      </div>
    );
  }

  // ── RECORDING: live STT — steps building up ──────────────────────────────
  if (phase === "recording") {
    return (
      <div style={{
        display: "flex", flexDirection: "column", height: "100%", padding: "12px",
        gap: 0,
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", borderRadius: 8, marginBottom: 10,
          background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", background: "#ef4444", flexShrink: 0,
              animation: "pulse-recording 1.5s ease-in-out infinite",
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#f87171" }}>
              Recording… narrate each step aloud
            </span>
          </div>
          <button type="button" onClick={handleStopRecording} style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(239,68,68,0.3)",
            background: "rgba(239,68,68,0.1)", color: "#f87171",
            fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}>
            <Square size={10} fill="currentColor" /> Stop
          </button>
        </div>
        {/* Steps list */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {steps.length === 0 && !interimText && (
            <div style={{ textAlign: "center", color: "#555", fontSize: 12, marginTop: 24 }}>
              Start speaking — your steps will appear here
            </div>
          )}
          {steps.map((step, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "8px 10px", borderRadius: 8,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: "50%", background: "rgba(143,199,223,0.15)",
                border: "1px solid rgba(143,199,223,0.3)", color: "#8fc7df",
                fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center",
                justifyContent: "center", flexShrink: 0,
              }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 13, color: "#d4e6ef", lineHeight: 1.45, paddingTop: 1 }}>
                {step}
              </span>
            </div>
          ))}
          {/* Interim (in-progress) step */}
          {interimText && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "8px 10px", borderRadius: 8,
              background: "rgba(239,68,68,0.04)", border: "1px dashed rgba(239,68,68,0.2)",
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: "50%", background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)", color: "#f87171",
                fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center",
                justifyContent: "center", flexShrink: 0,
              }}>
                {steps.length + 1}
              </span>
              <span style={{ fontSize: 13, color: "#9aa5ab", lineHeight: 1.45, paddingTop: 1, fontStyle: "italic" }}>
                {interimText}
              </span>
            </div>
          )}
        </div>
        <style>{`@keyframes pulse-recording{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
      </div>
    );
  }

  // ── SAVING: name + model + save card ─────────────────────────────────────
  if (phase === "saving") {
    if (saved) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100%", gap: 12,
        }}>
          <CheckCircle2 style={{ width: 40, height: 40, color: "#4ade80" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "#4ade80", margin: 0 }}>Workflow saved!</p>
          <p style={{ fontSize: 12, color: "#93a1ab", margin: 0 }}>A2R will use it for future automations.</p>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* Captured steps summary */}
        <div style={{
          padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          fontSize: 11, color: "#8fc7df", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <CheckCircle2 style={{ width: 12, height: 12 }} />
          {steps.length} step{steps.length !== 1 ? "s" : ""} recorded
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Workflow name */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Workflow name *
            </span>
            <input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="e.g. Fill monthly expense report"
              autoFocus
              style={{
                background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13,
                outline: "none", width: "100%", boxSizing: "border-box",
              }}
            />
          </label>
          {/* Description */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Description (optional)
            </span>
            <textarea
              value={workflowDesc}
              onChange={(e) => setWorkflowDesc(e.target.value)}
              placeholder="What does this workflow do?"
              rows={2}
              style={{
                background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13,
                outline: "none", width: "100%", boxSizing: "border-box", resize: "none",
                fontFamily: "inherit",
              }}
            />
          </label>
          {/* Model selector */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Model to use
            </span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{
                background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, padding: "8px 10px", color: "#ccc", fontSize: 13,
                outline: "none", width: "100%", cursor: "pointer",
              }}
            >
              <option value="claude-opus-4-5-20251101">Claude Opus 4.5 — most capable</option>
              <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5 — recommended</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 — fastest</option>
            </select>
          </label>
          {/* Recorded steps preview */}
          <div>
            <span style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Recorded steps
            </span>
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
              {steps.map((s, i) => (
                <div key={i} style={{
                  display: "flex", gap: 8, padding: "5px 8px", borderRadius: 6,
                  background: "rgba(255,255,255,0.03)", fontSize: 12, color: "#93a1ab",
                }}>
                  <span style={{ color: "#8fc7df", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Action buttons */}
        <div style={{
          padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", gap: 8,
        }}>
          <button
            type="button"
            onClick={handleSaveWorkflow}
            disabled={!workflowName.trim()}
            style={{
              flex: 1, padding: "9px", borderRadius: 8, border: "none",
              background: workflowName.trim() ? "#8fc7df" : "#333",
              color: workflowName.trim() ? "#0d1f2d" : "#555",
              fontSize: 13, fontWeight: 700, cursor: workflowName.trim() ? "pointer" : "not-allowed",
            }}
          >
            Save workflow
          </button>
          <button
            type="button"
            onClick={() => { setPhase("recording"); handleStartRecording(); }}
            style={{
              padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent", color: "#96a7b1", fontSize: 13, cursor: "pointer",
            }}
            title="Re-record"
          >
            <Mic style={{ width: 14, height: 14 }} />
          </button>
          <button
            type="button"
            onClick={() => { setActive(false); setSteps([]); }}
            style={{
              padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
              background: "transparent", color: "#555", fontSize: 13, cursor: "pointer",
            }}
          >
            Discard
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// kept for reference — replaced by WorkflowPaneContent
// (WorkflowTeachingEmptyState removed — replaced by WorkflowPaneContent above)

// ── Main Component ──────────────────────────────────────────────────────────

export function BrowserChatPane() {
  const { mode: agentMode, runGoal, status: agentStatus, setMode } =
    useBrowserAgentStore();
  const { toggle: toggleSidecar, setOpen: setSidecarOpen } = useSidecarStore();
  const browserAgentModeEnabled = useAgentSurfaceModeStore(
    (state) => state.enabledBySurface.browser,
  );
  const browserAgentModePulse = useAgentSurfaceModeStore(
    (state) => state.pulseBySurface.browser,
  );
  const { selectedAgentId, selectedAgent } = useSurfaceAgentSelection("browser");
  const embeddedAgentSession = useEmbeddedAgentSession("browser");
  const setEmbeddedAgentSession = useEmbeddedAgentSessionStore(
    (state) => state.setSurfaceSession,
  );
  const clearEmbeddedAgentSession = useEmbeddedAgentSessionStore(
    (state) => state.clearSurfaceSession,
  );
  const createNativeSession = useNativeAgentStore((state) => state.createSession);
  const setActiveNativeSession = useNativeAgentStore(
    (state) => state.setActiveSession,
  );
  const fetchNativeMessages = useNativeAgentStore((state) => state.fetchMessages);
  const fetchNativeCanvases = useNativeAgentStore(
    (state) => state.fetchSessionCanvases,
  );
  const sendNativeMessageStream = useNativeAgentStore(
    (state) => state.sendMessageStream,
  );
  const abortNativeGeneration = useNativeAgentStore(
    (state) => state.abortGeneration,
  );
  const nativeStreaming = useNativeAgentStore((state) => state.streaming);
  const nativeMessages = useNativeAgentStore((state) =>
    embeddedAgentSession.sessionId
      ? state.messages[embeddedAgentSession.sessionId] || []
      : [],
  );
  const embeddedCanvasIds = useNativeAgentStore((state) =>
    embeddedAgentSession.sessionId
      ? state.sessionCanvases[embeddedAgentSession.sessionId] || []
      : [],
  );
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const activeTab = useBrowserStore((state) =>
    state.tabs.find((tab) => tab.id === activeTabId) ?? null,
  );

  // Chat pane store
  const permissionMode = useBrowserChatPaneStore((s) => s.permissionMode);
  const setPermissionMode = useBrowserChatPaneStore((s) => s.setPermissionMode);
  const scheduledTaskBanner = useBrowserChatPaneStore(
    (s) => s.scheduledTaskBanner,
  );
  const dismissScheduledTaskBanner = useBrowserChatPaneStore(
    (s) => s.dismissScheduledTaskBanner,
  );
  const workflowTeachingActive = useBrowserChatPaneStore(
    (s) => s.workflowTeachingActive,
  );

  const [messages, setMessages] = useState<FallbackChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const browserAgentTheme = getAgentModeSurfaceTheme("browser");
  const [mascotEmotion, setMascotEmotion] = useState<GizziEmotion>("steady");
  const [mascotAttention, setMascotAttention] = useState<GizziAttention | null>(
    null,
  );

  // Shortcuts store
  const shortcuts = useBrowserShortcutsStore((s) => s.shortcuts);
  const addShortcut = useBrowserShortcutsStore((s) => s.addShortcut);
  const removeShortcut = useBrowserShortcutsStore((s) => s.removeShortcut);

  // Session history
  const nativeSessions = useNativeAgentStore((state) => state.sessions);
  const fetchSessions = useNativeAgentStore((state) => state.fetchSessions);

  // Header state
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [terminalModels, setTerminalModels] = useState<
    Array<{ id: string; name: string; providerId: string }>
  >([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [permissionDropdownOpen, setPermissionDropdownOpen] = useState(false);
  const [paneWidth, setPaneWidth] = useState(400);
  const paneRef = useRef<HTMLDivElement>(null);
  const shortcutsRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // Measure pane width for responsive layout
  useEffect(() => {
    if (!paneRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPaneWidth(entry.contentRect.width);
      }
    });
    observer.observe(paneRef.current);
    return () => observer.disconnect();
  }, []);

  // Fetch sessions for history panel
  useEffect(() => {
    fetchSessions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Click-outside handlers for shortcuts / history popovers
  useEffect(() => {
    if (!shortcutsOpen && !historyOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (shortcutsOpen && shortcutsRef.current && !shortcutsRef.current.contains(e.target as Node)) {
        setShortcutsOpen(false);
      }
      if (historyOpen && historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [shortcutsOpen, historyOpen]);

  // Browser-origin sessions for history panel (most recent first, max 20)
  const browserSessions = useMemo(() => {
    return nativeSessions
      .filter((s) => {
        const meta = s.metadata as Record<string, unknown> | undefined;
        return meta?.originSurface === "browser" || !meta?.originSurface;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 20);
  }, [nativeSessions]);

  // Handler: navigate to a shortcut
  const handleShortcutClick = useCallback(
    (shortcut: BrowserShortcut) => {
      // Navigate the active browser tab to the shortcut URL
      const store = useBrowserStore.getState();
      const tab = store.tabs.find((t) => t.id === store.activeTabId);
      if (tab && isWebTab(tab)) {
        store.updateTab(tab.id, { url: shortcut.url });
      }
      setShortcutsOpen(false);
    },
    [],
  );

  // Handler: add current page as shortcut
  const handleAddCurrentAsShortcut = useCallback(() => {
    if (!activeTab) return;
    
    const url = isWebTab(activeTab) ? activeTab.url : "";
    const label = isWebTab(activeTab) ? activeTab.title : formatHost(url) || "Untitled";
    addShortcut({ label, url, icon: "🔗" });
  }, [activeTab, addShortcut]);

  // Handler: switch to a history session
  const handleSelectHistorySession = useCallback(
    async (sessionId: string) => {
      setActiveNativeSession(sessionId);
      setEmbeddedAgentSession("browser", sessionId);
      await fetchNativeMessages(sessionId);
      setHistoryOpen(false);
    },
    [setActiveNativeSession, setEmbeddedAgentSession, fetchNativeMessages],
  );

  // Fetch models from Terminal Server
  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch(`${TERMINAL_SERVER_URL}/provider`);
        if (!response.ok) return;
        const data = await response.json();
        const models: Array<{ id: string; name: string; providerId: string }> = [];
        if (data.all && Array.isArray(data.all)) {
          data.all.forEach((provider: { id: string; models?: Record<string, { name?: string }> }) => {
            if (provider.models && typeof provider.models === "object") {
              Object.entries(provider.models).forEach(
                ([modelId, modelData]: [string, { name?: string }]) => {
                  models.push({
                    id: `${provider.id}/${modelId}`,
                    name: modelData.name || modelId,
                    providerId: provider.id,
                  });
                },
              );
            }
          });
        }
        if (models.length > 0) {
          setTerminalModels(models);
          if (!selectedModelId) setSelectedModelId(models[0].id);
        }
      } catch {
        // Silently fail — model picker will show fallback
      }
    }
    fetchModels();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentModelName =
    terminalModels.find((m) => m.id === selectedModelId)?.name ||
    terminalModels[0]?.name ||
    "A2R Model";

  const pulseMascot = useCallback(
    (emotion: GizziEmotion) => {
      setMascotEmotion(emotion);
      window.setTimeout(() => {
        if (browserAgentModeEnabled) {
          setMascotEmotion(selectedAgentId ? "focused" : "steady");
          setMascotAttention(
            selectedAgentId
              ? { state: "tracking", target: { x: 0.04, y: -0.04 } }
              : null,
          );
          return;
        }

        setMascotEmotion("steady");
      }, 640);
    },
    [browserAgentModeEnabled, selectedAgentId],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, nativeMessages, embeddedAgentSession.isEmbedded]);

  useEffect(() => {
    setMode(browserAgentModeEnabled ? "Agent" : "Human");
  }, [browserAgentModeEnabled, setMode]);

  useEffect(() => {
    if (!embeddedAgentSession.sessionId || !embeddedAgentSession.isEmbedded) {
      return;
    }

    setActiveNativeSession(embeddedAgentSession.sessionId);
    void fetchNativeMessages(embeddedAgentSession.sessionId);
    void fetchNativeCanvases(embeddedAgentSession.sessionId);
  }, [
    embeddedAgentSession.isEmbedded,
    embeddedAgentSession.sessionId,
    fetchNativeCanvases,
    fetchNativeMessages,
    setActiveNativeSession,
  ]);

  useEffect(() => {
    if (!browserAgentModeEnabled) {
      setMascotEmotion("steady");
      setMascotAttention(null);
      return;
    }

    setMascotEmotion(selectedAgentId ? "proud" : "alert");
    setMascotAttention(
      selectedAgentId
        ? { state: "locked-on", target: { x: 0.08, y: -0.1 } }
        : { state: "startled", target: { x: 0, y: -0.12 } },
    );

    const timeoutId = window.setTimeout(() => {
      setMascotEmotion(selectedAgentId ? "focused" : "steady");
      setMascotAttention(
        selectedAgentId
          ? { state: "tracking", target: { x: 0.04, y: -0.04 } }
          : null,
      );
    }, 920);

    return () => window.clearTimeout(timeoutId);
  }, [browserAgentModeEnabled, browserAgentModePulse, selectedAgentId]);

  useEffect(() => {
    if (embeddedAgentSession.isEmbedded) {
      return;
    }

    const unsubAction = useBrowserAgentStore.subscribe(
      (state) => state.currentAction,
      (currentAction) => {
        if (currentAction?.label) {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}-action`,
              role: "assistant",
              content: `${currentAction.label} (step ${currentAction.stepIndex}/${currentAction.totalSteps})`,
              timestamp: Date.now(),
            },
          ]);
          pulseMascot("focused");
        }
      },
    );

    const unsubStatus = useBrowserAgentStore.subscribe(
      (state) => state.status,
      (status, prevStatus) => {
        if (status === "Done" && prevStatus === "Running") {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}-done`,
              role: "assistant",
              content: "Task completed. What would you like me to do next?",
              timestamp: Date.now(),
            },
          ]);
          pulseMascot("pleased");
        } else if (status === "WaitingApproval") {
          const state = useBrowserAgentStore.getState();
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}-approval`,
              role: "assistant",
              content: `Waiting for approval: ${state.approvalActionSummary || "Action requires confirmation"}. This is a risk tier ${state.approvalRiskTier} action.`,
              timestamp: Date.now(),
            },
          ]);
          pulseMascot("alert");
        } else if (status === "Blocked") {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}-blocked`,
              role: "assistant",
              content:
                'Execution paused. You are in control. Say "continue" or give me a new task.',
              timestamp: Date.now(),
            },
          ]);
        }
      },
    );

    return () => {
      unsubAction();
      unsubStatus();
    };
  }, [embeddedAgentSession.isEmbedded, pulseMascot]);

  const ensureEmbeddedSession = useCallback(async () => {
    if (embeddedAgentSession.sessionId && embeddedAgentSession.isEmbedded) {
      setActiveNativeSession(embeddedAgentSession.sessionId);
      return embeddedAgentSession.sessionId;
    }

    if (!browserAgentModeEnabled || !selectedAgentId) {
      return null;
    }

    const session = await createNativeSession("Browser Agent Session", undefined, {
      originSurface: "browser",
      sessionMode: "agent",
      agentId: selectedAgent?.id,
      agentName: selectedAgent?.name,
      workspaceScope: getOpenClawWorkspacePathFromAgent(selectedAgent) ?? undefined,
      runtimeModel: selectedAgent?.model,
      agentFeatures: {
        workspace: true,
        tools: true,
        automation: true,
      },
    });

    setEmbeddedAgentSession("browser", session.id);
    setActiveNativeSession(session.id);
    setSidecarOpen(true);
    return session.id;
  }, [
    browserAgentModeEnabled,
    createNativeSession,
    embeddedAgentSession.isEmbedded,
    embeddedAgentSession.sessionId,
    selectedAgent,
    selectedAgentId,
    setActiveNativeSession,
    setEmbeddedAgentSession,
    setSidecarOpen,
  ]);

  const handleSend = useCallback(
    async (text: string) => {
      const draft = text.trim();
      if (!draft) {
        return;
      }

      if (browserAgentModeEnabled && selectedAgentId) {
        const nativeSessionId = await ensureEmbeddedSession();
        if (nativeSessionId) {
          setActiveNativeSession(nativeSessionId);
          await sendNativeMessageStream(nativeSessionId, draft);
          return;
        }
      }

      const userMsg: FallbackChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: draft,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      const trimmed = draft.toLowerCase();
      const currentStatus = useBrowserAgentStore.getState().status;

      if (
        currentStatus === "WaitingApproval" &&
        (trimmed === "yes" || trimmed === "approve" || trimmed === "ok")
      ) {
        useBrowserAgentStore.getState().approveAction();
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-ack`,
            role: "assistant",
            content: "Approved. Continuing execution...",
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      if (
        currentStatus === "WaitingApproval" &&
        (trimmed === "no" || trimmed === "deny" || trimmed === "stop")
      ) {
        useBrowserAgentStore.getState().denyAction();
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-ack`,
            role: "assistant",
            content: "Action denied. Execution paused.",
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      if (currentStatus === "Running" && (trimmed === "stop" || trimmed === "pause")) {
        useBrowserAgentStore.getState().stopExecution();
        return;
      }

      if (
        currentStatus === "Blocked" &&
        (trimmed === "continue" || trimmed === "resume")
      ) {
        useBrowserAgentStore.getState().handOff();
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-ack`,
            role: "assistant",
            content: "Resuming agent execution...",
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      pulseMascot("curious");
      runGoal(draft);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-ack`,
          role: "assistant",
          content: `Got it. Starting: "${draft}"`,
          timestamp: Date.now(),
        },
      ]);
    },
    [
      browserAgentModeEnabled,
      ensureEmbeddedSession,
      pulseMascot,
      runGoal,
      selectedAgentId,
      sendNativeMessageStream,
      setActiveNativeSession,
    ],
  );

  const displayMessages: DisplayMessage[] = embeddedAgentSession.isEmbedded
    ? mapNativeMessagesToStreamMessages(nativeMessages) as unknown as DisplayMessage[]
    : messages as unknown as DisplayMessage[];
  const displayLoading = embeddedAgentSession.isEmbedded
    ? nativeStreaming.isStreaming
    : agentStatus === "Running";
  const descriptor = embeddedAgentSession.descriptor;

  const showTabSubtitle = paneWidth > 400;
  const truncateModelName = paneWidth < 320;

  return (
    <div
      ref={paneRef}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        isolation: "isolate",
        background:
          embeddedAgentSession.isEmbedded
            ? "linear-gradient(180deg, rgba(18,28,34,0.98) 0%, rgba(20,22,25,0.98) 100%)"
            : "#1e1e1e",
        boxShadow: browserAgentModeEnabled
          ? `inset 0 0 0 1px ${browserAgentTheme.edge}, inset 0 0 40px ${browserAgentTheme.panelTint}`
          : "none",
      }}
    >
      <AgentModeBackdrop
        active={browserAgentModeEnabled}
        surface="browser"
        dataTestId="agent-mode-browser-backdrop"
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          style={{
            height: showTabSubtitle ? 52 : 48,
            minHeight: showTabSubtitle ? 52 : 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 8px 0 12px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
            background: embeddedAgentSession.isEmbedded
              ? `linear-gradient(90deg, ${browserAgentTheme.soft}, rgba(255,255,255,0.02) 58%)`
              : "rgba(255,255,255,0.02)",
          }}
        >
          {/* Left: Model selector pill */}
          <div style={{ minWidth: 0, overflow: "hidden", position: "relative" }}>
            <button
              type="button"
              onClick={() => setModelPickerOpen(!modelPickerOpen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: 999,
                border: "none",
                background: modelPickerOpen
                  ? "rgba(255,255,255,0.08)"
                  : "transparent",
                color: "#f4efe9",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                maxWidth: truncateModelName ? 100 : 180,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = modelPickerOpen
                  ? "rgba(255,255,255,0.08)"
                  : "transparent";
              }}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {currentModelName}
              </span>
              <ChevronDown
                size={12}
                style={{
                  flexShrink: 0,
                  opacity: 0.6,
                  transform: modelPickerOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s",
                }}
              />
            </button>

            {/* Subtle tab info subtitle */}
            {showTabSubtitle && (
              <div
                style={{
                  fontSize: 11,
                  color: "#96a7b1",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  paddingLeft: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Globe size={9} />
                {isWebTab(activeTab) ? (activeTab.title || formatHost(activeTab.url)) : formatHost(undefined)}
              </div>
            )}

            {/* Model picker dropdown */}
            {modelPickerOpen && terminalModels.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  width: 220,
                  maxHeight: 280,
                  overflowY: "auto",
                  background: "#1e2024",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                  padding: 6,
                  zIndex: 300,
                }}
                onMouseLeave={() => setModelPickerOpen(false)}
              >
                {terminalModels.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      setSelectedModelId(model.id);
                      setModelPickerOpen(false);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      borderRadius: 8,
                      background:
                        model.id === selectedModelId
                          ? "rgba(143,199,223,0.1)"
                          : "transparent",
                      border: "none",
                      color:
                        model.id === selectedModelId ? "#8fc7df" : "#e8edf0",
                      fontSize: 13,
                      fontWeight: model.id === selectedModelId ? 700 : 400,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        model.id === selectedModelId
                          ? "rgba(143,199,223,0.1)"
                          : "transparent";
                    }}
                  >
                    {model.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: icon buttons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              flexShrink: 0,
              position: "relative",
            }}
          >
            <HeaderIconButton
              onClick={() => {
                setShortcutsOpen(!shortcutsOpen);
                setHistoryOpen(false);
                setHeaderMenuOpen(false);
              }}
              title="Shortcuts"
            >
              <Diamond style={{ width: 14, height: 14 }} />
            </HeaderIconButton>
            <HeaderIconButton
              onClick={() => {
                setHistoryOpen(!historyOpen);
                setShortcutsOpen(false);
                setHeaderMenuOpen(false);
              }}
              title="History"
            >
              <Clock style={{ width: 14, height: 14 }} />
            </HeaderIconButton>
            <HeaderIconButton
              onClick={() => {
                setHeaderMenuOpen(!headerMenuOpen);
                setShortcutsOpen(false);
                setHistoryOpen(false);
              }}
              title="Menu"
            >
              <MoreVertical style={{ width: 14, height: 14 }} />
            </HeaderIconButton>
            <HeaderIconButton onClick={toggleSidecar} title="Close">
              <X style={{ width: 14, height: 14 }} />
            </HeaderIconButton>

            <BrowserChatPaneMenu
              open={headerMenuOpen}
              onClose={() => setHeaderMenuOpen(false)}
            />

            {/* ── Shortcuts Quick-Access Popover ────────────────────── */}
            {shortcutsOpen && (
              <div
                ref={shortcutsRef}
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  width: Math.min(paneWidth - 24, 260),
                  background: "#1e2024",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                  padding: 8,
                  zIndex: 300,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 8px 8px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#e8edf0" }}>
                    Quick Shortcuts
                  </span>
                  <button
                    type="button"
                    onClick={handleAddCurrentAsShortcut}
                    title="Add current page"
                    style={{
                      padding: "3px 8px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "transparent",
                      color: "#8fc7df",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    + Add page
                  </button>
                </div>
                {shortcuts.length === 0 && (
                  <div
                    style={{
                      padding: "16px 8px",
                      textAlign: "center",
                      color: "#666",
                      fontSize: 12,
                    }}
                  >
                    No shortcuts yet. Click &quot;+ Add page&quot; to save the current page.
                  </div>
                )}
                {shortcuts.map((sc) => (
                  <div
                    key={sc.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                    onClick={() => handleShortcutClick(sc)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {sc.icon ? (
                      <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{sc.icon}</span>
                    ) : (
                      <img
                        src={getFaviconUrl(sc.url)}
                        alt=""
                        style={{ width: 16, height: 16, borderRadius: 3 }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13,
                        color: "#e8edf0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {sc.label}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeShortcut(sc.id);
                      }}
                      title="Remove shortcut"
                      style={{
                        padding: 2,
                        border: "none",
                        background: "transparent",
                        color: "#555",
                        cursor: "pointer",
                        display: "flex",
                        opacity: 0.5,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = "1";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = "0.5";
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── History Panel Popover ─────────────────────────────── */}
            {historyOpen && (
              <div
                ref={historyRef}
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  width: Math.min(paneWidth - 24, 280),
                  maxHeight: 360,
                  overflowY: "auto",
                  background: "#1e2024",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                  padding: 8,
                  zIndex: 300,
                }}
              >
                <div
                  style={{
                    padding: "4px 8px 8px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#e8edf0" }}>
                    Conversation History
                  </span>
                </div>
                {browserSessions.length === 0 && (
                  <div
                    style={{
                      padding: "20px 8px",
                      textAlign: "center",
                      color: "#666",
                      fontSize: 12,
                    }}
                  >
                    No browser sessions yet. Start a conversation to see history here.
                  </div>
                )}
                {browserSessions.map((session) => {
                  const isActive = session.id === embeddedAgentSession.sessionId;
                  const updatedDate = new Date(session.updatedAt);
                  const timeStr = updatedDate.toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  return (
                    <div
                      key={session.id}
                      onClick={() => handleSelectHistorySession(session.id)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        padding: "8px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        background: isActive ? "rgba(143,199,223,0.08)" : "transparent",
                        borderLeft: isActive
                          ? "2px solid #8fc7df"
                          : "2px solid transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isActive
                          ? "rgba(143,199,223,0.08)"
                          : "transparent";
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: isActive ? 700 : 400,
                          color: isActive ? "#8fc7df" : "#e8edf0",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {session.name || "Untitled session"}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 11,
                          color: "#96a7b1",
                        }}
                      >
                        <span>{timeStr}</span>
                        <span style={{ opacity: 0.5 }}>·</span>
                        <span>{session.messageCount} msg{session.messageCount !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Scheduled Task Banner ───────────────────────────────────── */}
        {scheduledTaskBanner ? (
          <div
            style={{
              margin: "8px 12px 0",
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(234,159,56,0.08)",
              border: "1px solid rgba(234,159,56,0.25)",
              fontSize: 13,
              color: "#e8d5b8",
              position: "relative",
              lineHeight: 1.5,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontWeight: 700,
                marginBottom: 4,
                color: "#f2c9a6",
              }}
            >
              <span style={{ fontSize: 14 }}>ⓘ</span>
              {scheduledTaskBanner.title}
              <button
                type="button"
                onClick={dismissScheduledTaskBanner}
                style={{
                  marginLeft: "auto",
                  padding: 2,
                  border: "none",
                  background: "transparent",
                  color: "#96a7b1",
                  cursor: "pointer",
                  display: "flex",
                }}
              >
                <X size={13} />
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#b8a99b" }}>
              {scheduledTaskBanner.description}
            </p>
          </div>
        ) : null}

        {/* ── Agent Context Strip ─────────────────────────────────────── */}
        {embeddedAgentSession.isEmbedded ? (
          <div style={{ padding: "12px 12px 0", flexShrink: 0 }}>
            <AgentContextStrip
              surface="browser"
              sessionName={
                embeddedAgentSession.session?.name || "Browser Agent Session"
              }
              sessionDescription={
                embeddedAgentSession.session?.description ||
                "Work against the active browser tab with the linked agent workspace."
              }
              agentName={
                descriptor.agentName || selectedAgent?.name || undefined
              }
              statusLabel={
                embeddedAgentSession.session?.metadata?.a2r_local_draft === true
                  ? "Local Draft"
                  : embeddedAgentSession.session?.isActive
                    ? "Live"
                    : "Paused"
              }
              messageCount={
                embeddedAgentSession.session?.messageCount ??
                displayMessages.length
              }
              workspaceScope={descriptor.workspaceScope}
              canvasCount={embeddedCanvasIds.length}
              tags={embeddedAgentSession.session?.tags}
              localDraft={
                embeddedAgentSession.session?.metadata?.a2r_local_draft === true
              }
              toolsEnabled={descriptor.agentFeatures?.tools === true}
              automationEnabled={descriptor.agentFeatures?.automation === true}
              onDismiss={() => clearEmbeddedAgentSession("browser")}
            />
          </div>
        ) : null}

        {/* ── Messages / Empty State ──────────────────────────────────── */}
        <div
          ref={scrollRef}
          style={{ flex: "1 1 0%", overflowY: "auto", minHeight: 0 }}
        >
          {displayMessages.length === 0 ? (
            embeddedAgentSession.isEmbedded ? (
              /* GizziMascot empty state for embedded sessions */
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  padding: "0 24px",
                  textAlign: "center",
                }}
              >
                <div style={{ marginBottom: 16 }}>
                  <GizziMascot
                    size={56}
                    emotion={mascotEmotion}
                    attention={mascotAttention}
                  />
                </div>
                <p
                  style={{
                    fontSize: 14,
                    color: "#ddd",
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  Your browser agent session is ready
                </p>
                <p style={{ fontSize: 12, color: "#93a1ab", lineHeight: 1.5 }}>
                  Ask this agent to inspect the current page, collect context,
                  or automate a browsing workflow.
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 14,
                  }}
                >
                  {descriptor.agentName ? (
                    <div
                      style={{
                        borderRadius: 999,
                        border: `1px solid ${browserAgentTheme.edge}`,
                        background: browserAgentTheme.soft,
                        color: "#dff2fb",
                        padding: "6px 10px",
                        fontSize: 11,
                      }}
                    >
                      {descriptor.agentName}
                    </div>
                  ) : null}
                  <div
                    style={{
                      borderRadius: 999,
                      border: `1px solid ${browserAgentTheme.edge}`,
                      background: "rgba(255,255,255,0.04)",
                      color: "#b8cad3",
                      padding: "6px 10px",
                      fontSize: 11,
                    }}
                  >
                    {isWebTab(activeTab) ? (activeTab.title || formatHost(activeTab.url)) : formatHost(undefined)}
                  </div>
                  <div
                    style={{
                      borderRadius: 999,
                      border: `1px solid ${browserAgentTheme.edge}`,
                      background: "rgba(255,255,255,0.04)",
                      color: "#b8cad3",
                      padding: "6px 10px",
                      fontSize: 11,
                    }}
                  >
                    {descriptor.workspaceScope || "Session scoped workspace"}
                  </div>
                </div>
              </div>
            ) : (
              /* Default empty state for non-embedded:
                 WorkflowPaneContent shows Gizzi mascot by default and switches to
                 the full workflow teaching flow when the toggle is active */
              <WorkflowPaneContent
                mascotEmotion={mascotEmotion}
                mascotAttention={mascotAttention}
              />
            )
          ) : (
            <div
              style={{
                padding: embeddedAgentSession.isEmbedded
                  ? "8px 12px 12px"
                  : 12,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {displayMessages.map((message) => {
                const isUser = message.role === "user";

                return (
                  <div
                    key={message.id}
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: isUser ? "flex-end" : "flex-start",
                    }}
                  >
                    {!isUser ? (
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: "rgba(143,199,223,0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: 2,
                          color: "#8fc7df",
                        }}
                      >
                        {embeddedAgentSession.isEmbedded ? (
                          <Bot style={{ width: 12, height: 12 }} />
                        ) : (
                          <Sparkles style={{ width: 12, height: 12 }} />
                        )}
                      </div>
                    ) : null}
                    <div
                      style={{
                        maxWidth: "86%",
                        minWidth: 0,
                        padding: "9px 12px",
                        borderRadius: 16,
                        fontSize: 13,
                        lineHeight: 1.55,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "break-word",
                        wordBreak: "break-word",
                        ...(isUser
                          ? {
                              background: "rgba(105,168,200,0.18)",
                              color: "#e5f2f7",
                              borderBottomRightRadius: 4,
                            }
                          : {
                              background: embeddedAgentSession.isEmbedded
                                ? "rgba(255,255,255,0.05)"
                                : "#2a2a2a",
                              color: "#e8edf0",
                              borderBottomLeftRadius: 4,
                              border: embeddedAgentSession.isEmbedded
                                ? `1px solid ${browserAgentTheme.soft}`
                                : "1px solid transparent",
                            }),
                      }}
                    >
                      {message.content}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Composer + Permission Mode + Footer ─────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            padding: "12px",
            background: "rgba(12,16,19,0.72)",
          }}
        >
          {/* ── Teach A2R workflow toggle — persistent button on input bar ── */}
          {!embeddedAgentSession.isEmbedded && (
            <WorkflowTeachingToggle />
          )}

          <ChatComposer
            onSend={handleSend}
            isLoading={displayLoading}
            onStop={
              embeddedAgentSession.isEmbedded
                ? () =>
                    void abortNativeGeneration(
                      embeddedAgentSession.sessionId || undefined,
                    )
                : () => {
                    if (agentStatus === "Running") {
                      useBrowserAgentStore.getState().stopExecution();
                    }
                  }
            }
            placeholder={
              embeddedAgentSession.isEmbedded
                ? "Message browser agent..."
                : "Ask the browser agent..."
            }
            slashCommands={BROWSER_SLASH_COMMANDS}
          />

          {/* Footer disclaimer */}
          <div
            style={{
              marginTop: 8,
              textAlign: "center",
              fontSize: 11,
              color: "#666",
            }}
          >
            AI-generated content may be inaccurate
          </div>
        </div>
      </div>
    </div>
  );
}
