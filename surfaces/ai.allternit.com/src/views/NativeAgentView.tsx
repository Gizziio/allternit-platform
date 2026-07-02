// @ts-nocheck
"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsClient } from '@/lib/hooks/use-is-client';

// Store
import {
  useChatSessionStore,
  type ChatSession as NativeSession,
} from "@/views/chat/ChatSessionStore";

// Utils & Types
import { 
  type ViewMode, 
  type Canvas, 
  formatSessionTimestamp 
} from "./native-agent/main/NativeAgentView.utils";
import { useWorkspace } from "@/agent-workspace/useWorkspace";
import { MilestoneProgress } from "@/components/AllternitNative/MilestoneProgress";
import { ToolCallVisualization } from "@/components/agents";
import { UnifiedMessageRenderer } from "@/components/ai-elements/UnifiedMessageRenderer";
import { parseStructuredContent } from "@/lib/ai/rust-stream-adapter-extended";

// UI Components
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ProgramErrorBoundary } from "@/allternit-os/components/ProgramErrorBoundary";

// Modularized Components
import { SessionSelector } from "./native-agent/main/SessionSelector";
import { SessionComposerRegion } from "@/components/session-composer";

// Icons
import {
  Plus,
  Trash,
  Sidebar,
  SidebarSimple,
  Layout,
  Terminal,
  Lightning,
  X,
} from '@phosphor-icons/react';
import { cn } from "@/lib/utils";

interface NativeAgentViewProps {
  initialSessionId?: string;
  defaultLayout?: number[];
  bootstrapStrategy?: "auto" | "manual";
  onOpenRuntimeOps?: () => void;
}

export function NativeAgentView({
  initialSessionId,
  bootstrapStrategy = "auto",
  onOpenRuntimeOps,
}: NativeAgentViewProps) {
  const isClient = useIsClient();
  const {
    updateSession = async () => {},
    deleteSession,
    setActiveSession,
    loadSessions,
    sessions,
    activeSessionId,
    isLoading: isLoadingSessions,
  } = useChatSessionStore();
  
  const streamingState = useChatSessionStore((s) => activeSessionId ? s.streamingBySession[activeSessionId] : null);
  const isStreaming = streamingState?.isStreaming ?? false;

  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [hasFetchedSessions, setHasFetchedSessions] = useState(false);

  const [prevBootstrapOC, setPrevBootstrapOC] = useState(bootstrapStrategy);
  if (bootstrapStrategy !== prevBootstrapOC) {
    setPrevBootstrapOC(bootstrapStrategy);
    if (bootstrapStrategy === "manual") {
      setHasFetchedSessions(true);
    }
  }

  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const hasAutoCreatedWelcomeSession = useRef(false);
  
  const activeSession = useMemo(() => 
    sessions.find((session) => session.id === activeSessionId) || null
  , [sessions, activeSessionId]);

  const activeMessages = useMemo(() => activeSession?.messages ?? [], [activeSession]);

  // Initialization
  useEffect(() => {
    if (bootstrapStrategy === "manual") {
      setHasFetchedSessions(true);
      return;
    }

    let isMounted = true;
    void (async () => {
      try {
        await loadSessions();
      } finally {
        if (isMounted) setHasFetchedSessions(true);
      }
    })();

    return () => { isMounted = false; };
  }, [bootstrapStrategy, loadSessions]);

  // Auto-select session
  useEffect(() => {
    if (!hasFetchedSessions || isLoadingSessions || activeSessionId) return;

    if (initialSessionId && sessions.some(s => s.id === initialSessionId)) {
      setActiveSession(initialSessionId);
      return;
    }

    if (sessions.length > 0) {
      setActiveSession(sessions[0].id);
      return;
    }

    if (bootstrapStrategy === "manual") return;

    if (!hasAutoCreatedWelcomeSession.current) {
      hasAutoCreatedWelcomeSession.current = true;
      void useChatSessionStore.getState().createSession({ name: "Welcome Session" });
    }
  }, [hasFetchedSessions, isLoadingSessions, activeSessionId, initialSessionId, sessions, setActiveSession, bootstrapStrategy]);

  const handleDeleteSession = useCallback((id: string) => {
    const session = sessions.find(s => s.id === id);
    setConfirmDialog({
      message: `Are you sure you want to delete "${session?.name || 'this session'}"?`,
      onConfirm: async () => {
        await deleteSession(id);
        setConfirmDialog(null);
      }
    });
  }, [sessions, deleteSession]);

  const handleCreateSession = useCallback(async () => {
    const id = await useChatSessionStore.getState().createSession({ name: "New Agent Session" });
    setActiveSession(id);
  }, [setActiveSession]);

  if (!isClient) return null;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-[var(--surface-canvas)] overflow-hidden font-sans">
        {/* Header / Control Bar */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-solid border-[rgba(212,176,140,0.1)] bg-[rgba(15,12,10,0.4)] backdrop-blur-md z-20 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <SessionSelector
              sessions={sessions}
              activeSession={activeSession}
              onSelect={setActiveSession}
              onNew={handleCreateSession}
              onDelete={handleDeleteSession}
            />

            <div className="h-6 w-px bg-white/10" />

            <div className="flex items-center gap-1.5 p-1 bg-black/20 rounded-lg border border-solid border-white/5">
              <ViewModeButton active={viewMode === 'split'} onClick={() => setViewMode('split')} icon={Layout} label="Split" />
              <ViewModeButton active={viewMode === 'chat-only'} onClick={() => setViewMode('chat-only')} icon={Sidebar} label="Chat" />
              <ViewModeButton active={viewMode === 'canvas-only'} onClick={() => setViewMode('canvas-only')} icon={SidebarSimple} label="Canvas" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isStreaming && (
              <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30 text-blue-400 gap-1.5 px-2.5 py-1 animate-pulse">
                <Lightning size={12} weight="fill" />
                Agent Thinking
              </Badge>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenRuntimeOps}
              className="text-zinc-400 hover:text-white gap-2"
            >
              <Terminal size={16} />
              <span className="hidden sm:inline">Runtime Ops</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden relative">
          <ProgramErrorBoundary programName="Native Agent">
            <div className="flex-1 flex overflow-hidden">
              {/* Chat Column */}
              {(viewMode === 'split' || viewMode === 'chat-only') && (
                <div className={cn(
                  "flex flex-col border-r border-solid border-[rgba(212,176,140,0.1)] relative transition-all duration-300",
                  viewMode === 'split' ? "w-[40%] min-w-[360px]" : "w-full"
                )}>
                  <ScrollArea className="flex-1">
                    <div className="p-6 pb-32 space-y-8 max-w-3xl mx-auto">
                      {activeMessages.map((msg) => (
                        <UnifiedMessageRenderer 
                          key={msg.id} 
                          message={msg} 
                        />
                      ))}
                      {isStreaming && (
                        <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
                          <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 border border-solid border-blue-500/20">
                            <Lightning size={18} className="text-blue-500" weight="fill" />
                          </div>
                          <div className="flex-1 pt-1">
                            <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[var(--surface-canvas)] via-[var(--surface-canvas)] to-transparent pt-12">
                    <div className="max-w-2xl mx-auto">
                      <SessionComposerRegion 
                        sessionId={activeSessionId || ""}
                        isLoading={isStreaming}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Canvas Column */}
              {(viewMode === 'split' || viewMode === 'canvas-only') && (
                <div className="flex-1 flex flex-col bg-zinc-950/50">
                  <div className="flex-1 p-6 overflow-auto">
                    <div className="max-w-4xl mx-auto space-y-6">
                      <MilestoneProgress sessionId={activeSessionId || ""} />
                      <ToolCallVisualization sessionId={activeSessionId || ""} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ProgramErrorBoundary>
        </main>

        <ConfirmModal
          isOpen={confirmDialog !== null}
          title="Confirm Action"
          message={confirmDialog?.message || ""}
          onConfirm={() => confirmDialog?.onConfirm()}
          onCancel={() => setConfirmDialog(null)}
          destructive
        />
      </div>
    </TooltipProvider>
  );
}

function ViewModeButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center size-8 rounded-md border-none transition-all cursor-pointer",
        active ? "bg-white/10 text-white shadow-sm" : "bg-transparent text-zinc-500 hover:text-zinc-300"
      )}
      title={label}
    >
      <Icon size={18} weight={active ? "fill" : "regular"} />
    </button>
  );
}
