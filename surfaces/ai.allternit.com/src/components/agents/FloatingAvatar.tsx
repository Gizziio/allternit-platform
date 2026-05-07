"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAgentStore } from "@/lib/agents/agent.store";
import { useAgentInboxStore } from "@/lib/agents/agent-inbox.store";
import { cn } from "@/lib/utils";
import { X, Zap, Sparkles } from "lucide-react";
import { AgentAvatar } from "@/components/Avatar";
import { useStudioTheme } from "@/views/agent-view/useStudioTheme";

interface FloatingAvatarProps {
  className?: string;
}

const STORAGE_KEY = "allternit-floating-avatar-position";
const AVATAR_SIZE = 48;

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function readPosition(): { x: number; y: number } {
  const fallback = { x: 0, y: 0 };
  if (typeof window === "undefined") return fallback;
  const w = window.innerWidth;
  const h = window.innerHeight;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        x: clamp(parsed.x ?? w - 96, 0, w - 64),
        y: clamp(parsed.y ?? h - 96, 0, h - 64),
      };
    }
  } catch {
    // ignore
  }
  return { x: w - 96, y: h - 96 };
}

function savePosition(pos: { x: number; y: number }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
}

export function FloatingAvatar({ className }: FloatingAvatarProps) {
  const { agents, activeAgentId, updateAgent } = useAgentStore();
  const { unreadCount, fetchInbox } = useAgentInboxStore();
  const STUDIO_THEME = useStudioTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "thinking" | "active">("idle");
  const [pulse, setPulse] = useState(false);

  // Draggable position state
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; origX: number; origY: number }>({
    dragging: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const activeAgent = agents.find((a) => a.id === activeAgentId) || agents[0];

  // Load position on mount — prefer agent config, fall back to localStorage
  useEffect(() => {
    const agentPos = (activeAgent as any)?.avatar?.position || (activeAgent?.config as any)?.avatar?.position;
    if (agentPos && typeof agentPos.x === "number" && typeof agentPos.y === "number") {
      setPosition({
        x: clamp(agentPos.x, 0, window.innerWidth - 64),
        y: clamp(agentPos.y, 0, window.innerHeight - 64),
      });
    } else {
      setPosition(readPosition());
    }
  }, [activeAgent?.id]);

  // Keyboard arrow-key movement (accessibility)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const step = 10;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      if (e.key === "ArrowRight") dx = step;
      if (e.key === "ArrowUp") dy = -step;
      if (e.key === "ArrowDown") dy = step;
      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        setPosition((prev) => {
          const next = {
            x: clamp(prev.x + dx, 0, window.innerWidth - 64),
            y: clamp(prev.y + dy, 0, window.innerHeight - 64),
          };
          savePosition(next);
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Clamp on resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => ({
        x: clamp(prev.x, 0, window.innerWidth - 64),
        y: clamp(prev.y, 0, window.innerHeight - 64),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    fetchInbox();
    const interval = setInterval(fetchInbox, 30000);
    return () => clearInterval(interval);
  }, []);

  // Derive status from actual agent state instead of random simulation
  useEffect(() => {
    if (!activeAgent) return;
    const agentStatus = activeAgent.status;
    if (agentStatus === "running") {
      setStatus("active");
      setPulse(true);
      setTimeout(() => setPulse(false), 2000);
    } else if (agentStatus === "paused") {
      setStatus("thinking");
    } else {
      setStatus("idle");
    }
  }, [activeAgent?.status]);

  // Feature 3: Pulse when this agent is @mentioned in chat
  useEffect(() => {
    const handler = (e: Event) => {
      const { agentId } = (e as CustomEvent).detail;
      if (agentId && activeAgent?.id === agentId) {
        setPulse(true);
        setStatus('active');
        setTimeout(() => {
          setPulse(false);
          setStatus('idle');
        }, 2000);
      }
    };
    window.addEventListener('allternit:agent-pulse' as any, handler);
    return () => window.removeEventListener('allternit:agent-pulse' as any, handler);
  }, [activeAgent?.id]);

  // Pointer event handlers for drag
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    dragRef.current = {
      dragging: false,
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
    };
  }, [position.x, position.y]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    // Start dragging only after moving a few pixels
    if (!drag.dragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      drag.dragging = true;
    }

    if (drag.dragging) {
      setPosition({
        x: clamp(drag.origX + dx, 0, window.innerWidth - 64),
        y: clamp(drag.origY + dy, 0, window.innerHeight - 64),
      });
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.dragging) {
      // Drag ended — save position
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const finalPos = {
        x: clamp(drag.origX + dx, 0, window.innerWidth - 64),
        y: clamp(drag.origY + dy, 0, window.innerHeight - 64),
      };
      savePosition(finalPos);

      // Also persist to agent config for cross-device sync
      if (activeAgent?.id) {
        const avatarConfig = (activeAgent as any).avatar || activeAgent.config?.avatar;
        if (avatarConfig) {
          updateAgent(activeAgent.id, {
            config: {
              ...activeAgent.config,
              avatar: {
                ...avatarConfig,
                position: finalPos,
              },
            },
          }).catch(() => {
            // Silent fail — localStorage is the primary persistence
          });
        }
      }
    } else {
      // It was a click — toggle open
      setIsOpen((prev) => !prev);
    }

    dragRef.current.dragging = false;
  }, [activeAgent, updateAgent]);

  // Allternit brand-aligned status colors (not Tailwind defaults)
  const statusColors = {
    idle: { bg: "#4ade80", shadow: "rgba(74, 222, 128, 0.4)" },
    thinking: { bg: "#fbbf24", shadow: "rgba(251, 191, 36, 0.4)" },
    active: { bg: "#60a5fa", shadow: "rgba(96, 165, 250, 0.4)" },
  };

  const avatarConfig = (activeAgent as any)?.avatar || activeAgent?.config?.avatar;

  return (
    <div
      className={cn("fixed z-50 flex flex-col items-end gap-3", className)}
      style={{
        left: position.x,
        top: position.y,
        touchAction: "none",
        userSelect: "none",
      }}
    >
      {/* Speech bubble */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="rounded-2xl p-4 w-72 shadow-2xl"
            style={{
              background: STUDIO_THEME.bgCard,
              border: `1px solid ${STUDIO_THEME.borderSubtle}`,
              color: STUDIO_THEME.textPrimary,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4" style={{ color: STUDIO_THEME.accent }} />
              <span className="text-sm font-semibold" style={{ color: STUDIO_THEME.textPrimary }}>
                {activeAgent?.name || "Agent Companion"}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="ml-auto transition-colors"
                style={{ color: STUDIO_THEME.textMuted }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = STUDIO_THEME.textPrimary)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = STUDIO_THEME.textMuted)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              <div className="text-xs leading-relaxed" style={{ color: STUDIO_THEME.textSecondary }}>
                I&apos;m here to help! I can assist with research, code generation, data analysis, and
                more. What would you like to work on?
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    background: `${STUDIO_THEME.accent}20`,
                    color: STUDIO_THEME.accent,
                  }}
                >
                  Quick Task
                </button>
                <button
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    background: STUDIO_THEME.bg,
                    color: STUDIO_THEME.textSecondary,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  }}
                >
                  Open Hub
                </button>
              </div>
              {unreadCount > 0 && (
                <div className="flex items-center gap-2 text-xs mt-2" style={{ color: "#fbbf24" }}>
                  <Zap className="h-3 w-3" />
                  {unreadCount} new notification{unreadCount > 1 ? "s" : ""}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar Button — Draggable */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Drag to move • Alt + Arrow keys"
        aria-label={`${activeAgent?.name || 'Agent'} companion. Drag to move or use Alt + Arrow keys.`}
        className={cn(
          "relative w-14 h-14 rounded-full flex items-center justify-center shadow-xl"
        )}
        style={{
          background: STUDIO_THEME.bgCard,
          border: `2px solid ${STUDIO_THEME.borderSubtle}`,
          touchAction: "none",
          cursor: "grab",
        }}
        onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.cursor = "grabbing"; }}
        onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.cursor = "grab"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.cursor = "grab"; }}
      >
        {/* Drag handle indicator */}
        <div
          className="absolute top-1 left-1/2 -translate-x-1/2 flex gap-0.5 opacity-40"
          style={{ pointerEvents: "none" }}
        >
          <div className="w-1 h-1 rounded-full" style={{ background: STUDIO_THEME.textMuted }} />
          <div className="w-1 h-1 rounded-full" style={{ background: STUDIO_THEME.textMuted }} />
          <div className="w-1 h-1 rounded-full" style={{ background: STUDIO_THEME.textMuted }} />
        </div>
        {/* Glow effect */}
        {pulse && (
          <motion.div
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0 rounded-full"
            style={{ background: statusColors[status].bg }}
          />
        )}

        {/* Avatar content — real designed avatar */}
        <div className="relative z-10 pointer-events-none">
          {avatarConfig ? (
            <AgentAvatar
              config={avatarConfig as any}
              size={AVATAR_SIZE}
              emotion="steady"
              isAnimating
              showGlow={false}
            />
          ) : activeAgent?.teammateProfile?.avatar ? (
            <img
              src={activeAgent.teammateProfile.avatar}
              alt={activeAgent.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
              style={{
                background: STUDIO_THEME.accent,
                color: "#fff",
              }}
            >
              {(activeAgent?.name || "A").charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Status dot */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 animate-pulse"
          style={{
            borderColor: STUDIO_THEME.bg,
            background: statusColors[status].bg,
            boxShadow: `0 0 6px ${statusColors[status].shadow}`,
          }}
        />

        {/* Unread badge */}
        {unreadCount > 0 && !isOpen && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </div>
        )}
      </motion.button>
    </div>
  );
}
