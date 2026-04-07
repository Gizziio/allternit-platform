"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  X, 
  GearSix, 
  Trash, 
  Sparkle, 
  Pulse as Activity, 
  CaretRight, 
  SpeakerHigh,
  CircleNotch,
  CheckCircle,
  Warning,
  Square,
  FloppyDisk,
  GitCommit
} from "@phosphor-icons/react";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { 
  Agent, 
  AgentRun, 
  AgentTask, 
  Checkpoint as AgentCheckpoint, 
  Commit as AgentCommit,
  TaskStatus
} from "@/lib/agents/agent.types";
import { parseCharacterBlueprint } from "@/lib/agents";
import type { AvatarConfig } from "@/lib/agents/character.types";
import { createDefaultAvatarConfig } from "@/lib/agents/character.types";
import { AgentAvatar } from "@/components/Avatar";
import { AgentDashboard } from "@/components/AgentDashboard";
import { formatRelativeTime } from "@/lib/time";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Task } from "@/components/ai-elements/task";
import { Checkpoint } from "@/components/ai-elements/checkpoint";
import { Commit } from "@/components/ai-elements/commit";

// Assuming STUDIO_THEME is shared
const STUDIO_THEME = {
  accent: "#D4956A",
  bgCard: "rgba(26, 22, 18, 0.95)",
  borderSubtle: "rgba(212, 176, 140, 0.1)",
  textPrimary: "#E7E5E4",
  textSecondary: "#A8A29E",
  textMuted: "#78716C"
};

export function AgentDetailView({ agentId }: { agentId: string }) {
  console.log('[AgentDetailView] Rendering for agentId:', agentId);
  
  const {
    agents,
    characterStats,
    selectAgent,
    setIsEditing,
    deleteAgent,
    eventStreamConnected,
  } = useAgentStore();

  const agent = agents.find(a => a.id === agentId);
  console.log('[AgentDetailView] Found agent:', agent?.name);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  
  if (!agent) {
    console.log('[AgentDetailView] No agent found, returning null');
    return null;
  }

  // Show full Agent Dashboard
  if (showDashboard) {
    console.log('[AgentDetailView] Rendering dashboard for agent:', agentId);
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          justifyContent: 'center',
          padding: '24px',
        }}
        onClick={() => setShowDashboard(false)}
      >
        <AgentDashboard 
          agentId={agentId} 
          onClose={() => setShowDashboard(false)} 
        />
      </motion.div>
    );
  }

  const blueprint = parseCharacterBlueprint(agent?.config);
  const setupId = blueprint?.setup || "generalist";
  const avatarConfig = (agent?.config?.avatar as AvatarConfig) || createDefaultAvatarConfig(setupId);
  const agentCharacterStats = characterStats[agentId];

  const statusColors: Record<string, string> = {
    'online': '#22c55e',
    'offline': '#6b7280',
    'busy': '#f59e0b',
    'error': '#ef4444',
    'running': '#f59e0b',
    'completed': '#22c55e',
    'failed': '#ef4444',
    'idle': '#9B9B9B',
    'pending': '#9B9B9B',
  };

  const handleDelete = async () => {
    try {
      await deleteAgent(agentId);
      setShowDeleteConfirm(false);
      selectAgent(null);
    } catch {
      // Error handled by store
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={() => selectAgent(null)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        style={{
          display: 'flex',
          gap: '16px',
          maxWidth: '720px',
          width: '100%',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Agent Info Card */}
        <div style={{
          flex: 1,
          borderRadius: '16px',
          border: `1px solid ${STUDIO_THEME.borderSubtle}`,
          background: STUDIO_THEME.bgCard,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Header with Close */}
          <div style={{
            padding: '16px',
            borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: STUDIO_THEME.textMuted,
            }}>
              Agent Profile
            </span>
            <button
              onClick={() => selectAgent(null)}
              style={{
                padding: '6px',
                borderRadius: '6px',
                background: 'transparent',
                border: 'none',
                color: STUDIO_THEME.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>

          <div style={{ padding: '20px', flex: 1 }}>
            {/* Avatar & Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                <AgentAvatar 
                  config={avatarConfig}
                  size={64}
                  emotion={agent.status === 'running' ? 'focused' : agent.status === 'error' ? 'skeptical' : 'steady'}
                  isAnimating={true}
                />
                <div style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: statusColors[agent.status] || '#6b7280',
                  border: `3px solid ${STUDIO_THEME.bgCard}`,
                }} />
              </div>
              <div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: STUDIO_THEME.textPrimary,
                  margin: '0 0 6px 0',
                  fontFamily: 'Georgia, serif',
                }}>
                  {agent.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '999px',
                    background: `${STUDIO_THEME.accent}15`,
                    color: STUDIO_THEME.accent,
                    fontSize: '11px',
                    fontWeight: 500,
                    textTransform: 'capitalize',
                  }}>
                    {agent.type || 'worker'}
                  </span>
                  {eventStreamConnected && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      border: `1px solid ${STUDIO_THEME.accent}40`,
                      color: STUDIO_THEME.accent,
                      fontSize: '10px',
                      fontWeight: 500,
                    }}>
                      ● Live
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <p style={{
              fontSize: '14px',
              color: STUDIO_THEME.textSecondary,
              lineHeight: 1.6,
              marginBottom: '20px',
            }}>
              {agent.description}
            </p>

            {/* Key Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>Model</span>
                <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary }}>{agent.model}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>Provider</span>
                <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary }}>{agent.provider}</span>
              </div>
              {agent.voice?.enabled && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <SpeakerHigh style={{ width: 12, height: 12 }} />
                    Voice
                  </span>
                  <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary }}>{agent.voice.voiceLabel || agent.voice.voiceId}</span>
                </div>
              )}
            </div>

            {/* Capabilities */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                fontSize: '11px',
                color: STUDIO_THEME.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'block',
                marginBottom: '8px',
              }}>
                Capabilities
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {agent.capabilities.map(cap => (
                  <span key={cap} style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: `${STUDIO_THEME.accent}15`,
                    color: STUDIO_THEME.accent,
                    fontSize: '11px',
                    fontWeight: 500,
                  }}>
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
              <button
                onClick={() => setIsEditing(agentId)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  color: STUDIO_THEME.textPrimary,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <GearSix style={{ width: 16, height: 16 }} />
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: '#dc2626',
                  border: 'none',
                  color: 'white',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trash style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Card */}
        <div style={{
          flex: 1,
          borderRadius: '16px',
          border: `1px solid ${STUDIO_THEME.borderSubtle}`,
          background: STUDIO_THEME.bgCard,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '16px',
            borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}`,
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: STUDIO_THEME.textMuted,
            }}>
              Character Stats
            </span>
          </div>

          <div style={{ padding: '20px', flex: 1 }}>
            {agentCharacterStats ? (
              <>
                {/* Level & Class */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: '20px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: `${STUDIO_THEME.accent}10`,
                  border: `1px solid ${STUDIO_THEME.accent}30`,
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, marginBottom: '2px' }}>Class</div>
                    <div style={{ fontSize: '14px', color: STUDIO_THEME.textPrimary, fontWeight: 600 }}>{agentCharacterStats.class}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, marginBottom: '2px' }}>Level</div>
                    <div style={{ fontSize: '24px', color: STUDIO_THEME.accent, fontWeight: 700 }}>{agentCharacterStats.level}</div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {agentCharacterStats.relevantStats.slice(0, 4).map((statKey) => {
                    const definition = agentCharacterStats.statDefinitions.find((item) => item.key === statKey);
                    return (
                      <div key={statKey} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}>
                        <span style={{
                          fontSize: '12px',
                          color: STUDIO_THEME.textSecondary,
                          width: '80px',
                        }}>
                          {definition?.label || statKey}
                        </span>
                        <div style={{
                          flex: 1,
                          height: '6px',
                          background: 'rgba(255,255,255,0.1)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${agentCharacterStats.stats[statKey]}%`,
                            height: '100%',
                            background: `linear-gradient(90deg, ${STUDIO_THEME.accent}, #B08D6E)`,
                            borderRadius: '3px',
                          }} />
                        </div>
                        <span style={{
                          fontSize: '12px',
                          color: STUDIO_THEME.textPrimary,
                          fontWeight: 600,
                          width: '32px',
                          textAlign: 'right',
                        }}>
                          {agentCharacterStats.stats[statKey]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Sparkle style={{ width: 32, height: 32, color: STUDIO_THEME.textMuted, margin: '0 auto 12px' }} />
                <p style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>
                  No character stats available
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Launch Agent Dashboard Button */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[AgentDetailView] Launch Dashboard clicked');
          setShowDashboard(true);
        }}
        style={{
          position: 'absolute',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 24px',
          borderRadius: '999px',
          background: `linear-gradient(to right, ${STUDIO_THEME.accent}, #B08D6E)`,
          border: 'none',
          color: '#1A1612',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}
      >
        <Activity style={{ width: 18, height: 18 }} />
        Launch Agent Dashboard
        <CaretRight style={{ width: 16, height: 16 }} />
      </motion.button>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 101,
        }}
        onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            width: '100%',
            maxWidth: '400px',
            padding: '24px',
            borderRadius: '16px',
            background: STUDIO_THEME.bgCard,
            border: `1px solid ${STUDIO_THEME.borderSubtle}`,
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: STUDIO_THEME.textPrimary,
              margin: '0 0 8px 0',
              fontFamily: 'Georgia, serif',
            }}>
              Delete Agent
            </h3>
            <p style={{
              fontSize: '14px',
              color: STUDIO_THEME.textSecondary,
              margin: '0 0 24px 0',
            }}>
              Are you sure you want to delete &quot;{agent.name}&quot;? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  color: STUDIO_THEME.textPrimary,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: '#dc2626',
                  border: 'none',
                  color: 'white',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// Sub-components for AgentDetailView

export function RunCard({ run, isActive, onClick }: { 
  run: AgentRun;
  isActive: boolean;
  onClick: () => void;
}) {
  const statusIcon = {
    running: <CircleNotch className="w-4 h-4 animate-spin text-yellow-500" />,
    completed: <CheckCircle className="w-4 h-4 text-green-500" />,
    failed: <Warning className="w-4 h-4 text-red-500" />,
    cancelled: <Square className="w-4 h-4 text-[var(--text-tertiary)]" />,
  }[run.status];

  return (
    <Card 
      className={`cursor-pointer transition-colors ${isActive ? 'border-primary' : 'hover:border-primary/50'}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {statusIcon}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{run.input.slice(0, 50)}...</span>
              <Badge variant="outline" className="text-xs capitalize">
                {run.status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatRelativeTime(run.startedAt)} • {run.checkpointCount} checkpoints
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TaskCard({ task }: { task: AgentTask }) {
  const statusColors: Record<TaskStatus, string> = {
    pending: 'bg-white/30',
    'in-progress': 'bg-yellow-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    cancelled: 'bg-white/25',
  };

  return (
    <Task>
      <Card className="border-0 shadow-none">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className={`w-2 h-2 rounded-full mt-2 ${statusColors[task.status]}`} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{task.title}</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {task.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {task.description}
              </p>
              {task.result && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  {task.result}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Task>
  );
}

export function CheckpointCard({ checkpoint }: { checkpoint: AgentCheckpoint }) {
  return (
    <Checkpoint>
      <Card className="border-0 shadow-none">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <FloppyDisk className="w-4 h-4 text-green-500" />
            <div className="flex-1">
              <div className="font-medium">{checkpoint.label}</div>
              {checkpoint.description && (
                <p className="text-sm text-muted-foreground">
                  {checkpoint.description}
                </p>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                {formatRelativeTime(checkpoint.timestamp)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Checkpoint>
  );
}

export function CommitCard({ commit }: { commit: AgentCommit }) {
  return (
    <Commit>
      <Card className="border-0 shadow-none">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <GitCommit className="w-4 h-4 text-blue-500" />
            <div className="flex-1">
              <div className="font-medium">{commit.message}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {commit.author} • {formatRelativeTime(commit.timestamp)}
              </div>
              {commit.changes.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {commit.changes.length} changes
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Commit>
  );
}
