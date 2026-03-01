"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRunnerStore } from "./runner.store";
import { Send, Sparkles, Command, Square, Plus, Folder, Bot, Puzzle, Globe, Plug, ChevronRight, X, Minimize2, GripHorizontal } from "lucide-react";
import { GlassSurface } from "@/design/GlassSurface";

// Import ChatView input components
import { NewChatInput } from "@/views/ChatView";

export function AgentInvokeBar({
  onExpand,
}: {
  onExpand: () => void;
}) {
  const { draft, setDraft, submit, activeRun } = useRunnerStore();
  const [input, setInput] = useState(draft);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [activeSubOverlay, setActiveSubOverlay] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  // Sync with store
  useEffect(() => {
    setInput(draft);
  }, [draft]);

  // Auto-show trace if there is an active run
  useEffect(() => {
    if (activeRun) {
      setShowTrace(true);
      setIsLoading(activeRun.state === "thinking" || activeRun.state === "tooling" || activeRun.state === "writing");
    }
  }, [activeRun]);

  // Click outside to close overlay
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        setShowOverlay(false);
        setActiveSubOverlay(null);
      }
    };
    if (showOverlay) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOverlay]);

  const handleSubmit = (text: string) => {
    if (!text.trim()) return;
    setDraft(text);
    submit();
    setShowTrace(true);
    onExpand();
  };

  return (
    <div className="w-full space-y-4">
      {/* Main Input Bar with Shimmer Border - Using ChatView Input */}
      <div className="relative rounded-[28px] p-[1.5px]">
        {/* Shimmer glow effect */}
        <div
          className="absolute -inset-[1px] opacity-50 rounded-[29px] pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, var(--sand-300) 0%, var(--sand-500) 50%, var(--sand-300) 100%)',
            filter: 'blur(2px)',
          }}
        />
        <GlassSurface
          intensity="thick"
          className="relative rounded-[26.5px] bg-[var(--glass-bg-thick)] shadow-[0_8px_32px_rgba(0,0,0,0.08)] flex flex-col transition-all duration-200"
        >
          {/* Top section with badge */}
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium"
              style={{
                background: 'var(--sand-200)',
                color: 'var(--sand-800)'
              }}
            >
              <Sparkles className="w-3 h-3" />
              A2R
            </div>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Vision Operator</span>
          </div>

          {/* ChatView Input Component */}
          <NewChatInput
            onSend={handleSubmit}
            isLoading={isLoading}
            onStop={() => {}}
            selectedModel="gpt-4o"
            onOpenModelPicker={() => {}}
            conversationMode="llm"
            onConversationModeChange={() => {}}
            availableAgents={[]}
            selectedAgentId={null}
            onSelectAgent={() => {}}
            showAgentControlPanel={false}
            onToggleAgentControlPanel={() => {}}
            useWebSearch={false}
            onToggleWebSearch={() => {}}
            models={[
              { id: "gpt-4o", name: "GPT-4o" },
              { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
              { id: "gemini-1-5-pro", name: "Gemini 1.5 Pro" },
            ]}
            transcript={null}
            interimTranscript={null}
            clearTranscript={() => {}}
            hoveredTemplate={null}
            selectedTemplate={null}
            onTemplateSent={() => {}}
          />
        </GlassSurface>
      </div>

      {/* Thought Trace Panel */}
      {showTrace && activeRun && (
        <div
          className="rounded-xl border overflow-hidden animate-in slide-in-from-top-2"
          style={{
            animationDuration: '200ms',
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-subtle)'
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-2 border-b"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: 'var(--accent-chat)' }}
              />
              <span
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Thought Trace
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onExpand}
                className="px-2 py-1 text-xs rounded-md transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Expand
              </button>
              <button
                onClick={() => setShowTrace(false)}
                className="px-2 py-1 text-xs rounded-md transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Hide
              </button>
            </div>
          </div>
          <div className="p-4">
            <div
              className="text-sm leading-relaxed font-mono"
              style={{ color: 'var(--text-primary)' }}
            >
              {activeRun.output || "Initializing A2R Vision operator..."}
            </div>
            {activeRun.state === "thinking" && (
              <div className="flex items-center gap-1.5 mt-3">
                <div
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms', background: 'var(--accent-chat)' }}
                />
                <div
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms', background: 'var(--accent-chat)' }}
                />
                <div
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms', background: 'var(--accent-chat)' }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}