"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  X, 
  GearSix, 
  Trash, 
  Sparkle, 
  Pulse as Activity, 
  CaretRight, 
  SpeakerHigh,
  Star,
  Shield,
  ArrowsLeftRight
} from "@phosphor-icons/react";
import { useAgentStore } from "@/lib/agents/agent.store";


import { parseCharacterBlueprint } from "@/lib/agents";
import type { AvatarConfig } from "@/lib/agents/character.types";
import { createDefaultAvatarConfig } from "@/lib/agents/character.types";
import { AgentAvatar } from "@/components/Avatar";
import { AgentDashboard } from "@/components/AgentDashboard";

// Platform theme tokens
const STUDIO_THEME = {
  accent: "var(--accent-primary)",
  bgCard: "var(--surface-panel)",
  borderSubtle: "var(--border-subtle)",
  border: "var(--border-default)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-tertiary)",
};

export function AgentDetailView({ agentId }: { agentId: string }) {

  const {
    agents,
    runs,
    fetchRuns,
    selectAgent,
    setIsEditing,
    deleteAgent,
    eventStreamConnected,
  } = useAgentStore();

  const agent = agents.find(a => a.id === agentId);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    fetchRuns(agentId);
  }, [agentId, fetchRuns]);

  if (!agent) {
    return null;
  }

  // Show full Agent Dashboard
  if (showDashboard) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--shell-overlay-backdrop)',
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

  const agentRuns = runs[agentId] || [];
  const completedRuns = agentRuns.filter(r => r.status === 'completed');
  const failedRuns = agentRuns.filter(r => r.status === 'failed');
  const finishedRuns = completedRuns.length + failedRuns.length;
  const successRate = finishedRuns > 0 ? Math.round((completedRuns.length / finishedRuns) * 100) : null;
  const durations = completedRuns
    .filter(r => r.completedAt)
    .map(r => new Date(r.completedAt!).getTime() - new Date(r.startedAt).getTime())
    .filter(ms => ms > 0);
  const avgResponseSeconds = durations.length > 0
    ? Math.round((durations.reduce((sum, ms) => sum + ms, 0) / durations.length) / 1000)
    : null;
  const lastActive = agent.lastRunAt || agentRuns[0]?.startedAt;

  const statusColors: Record<string, string> = {
    'online': 'var(--status-success)',
    'offline': 'var(--ui-text-muted)',
    'busy': 'var(--status-warning)',
    'error': 'var(--status-error)',
    'running': 'var(--status-warning)',
    'completed': 'var(--status-success)',
    'failed': 'var(--status-error)',
    'idle': 'var(--ui-text-secondary)',
    'pending': 'var(--ui-text-secondary)',
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
        background: 'var(--shell-overlay-backdrop)',
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
            <button type="button"
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
                  background: statusColors[agent.status] || 'var(--ui-text-muted)',
                  border: `3px solid ${STUDIO_THEME.bgCard}`,
                }} />
              </div>
              <div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: STUDIO_THEME.textPrimary,
                  margin: '0 0 6px 0',
                  fontFamily: 'var(--font-research)',
                }}>
                  {agent.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '999px',
                    background: `color-mix(in srgb, var(--accent-primary) 15%, transparent)`,
                    color: STUDIO_THEME.accent,
                    fontSize: '12px',
                    fontWeight: 500,
                    textTransform: 'capitalize',
                  }}>
                    {agent.type || 'worker'}
                  </span>
                  {(agent.allowedSurfaces || []).map((surface) => (
                    <span key={surface} style={{
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background: 'var(--bg-primary)',
                      border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                      color: STUDIO_THEME.textSecondary,
                      fontSize: '12px',
                      fontWeight: 500,
                      textTransform: 'capitalize',
                    }}>
                      {surface}
                    </span>
                  ))}
                  {agent.trustTier && (
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background: 'var(--bg-primary)',
                      border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                      color: STUDIO_THEME.textSecondary,
                      fontSize: '12px',
                      fontWeight: 500,
                      textTransform: 'capitalize',
                    }}>
                      {agent.trustTier}
                    </span>
                  )}
                  {agent.writeScope && (
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background: 'var(--bg-primary)',
                      border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                      color: STUDIO_THEME.textSecondary,
                      fontSize: '12px',
                      fontWeight: 500,
                      textTransform: 'capitalize',
                    }}>
                      {agent.writeScope}
                    </span>
                  )}
                  {eventStreamConnected && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      border: `1px solid color-mix(in srgb, var(--accent-primary) 40%, transparent)`,
                      color: STUDIO_THEME.accent,
                      fontSize: '12px',
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

            {/* Harness Configuration */}
            {agent.harness && (
              <div style={{ marginBottom: '20px', padding: '12px', borderRadius: '10px', background: 'var(--surface-hover)', border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                <div style={{
                  fontSize: '12px',
                  color: STUDIO_THEME.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: '10px',
                }}>
                  Harness
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>Mode</span>
                    <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary, textTransform: 'capitalize' }}>{agent.harness.mode}</span>
                  </div>
                  {agent.harness.mode === 'cloud' && agent.harness.cloud && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>Base URL</span>
                        <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary }}>{agent.harness.cloud.baseURL}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>Access Token</span>
                        <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary }}>
                          {agent.harness.cloud.accessToken ? '••••••••' : 'Not set'}
                        </span>
                      </div>
                    </>
                  )}
                  {agent.harness.mode === 'byok' && agent.harness.byok && (
                    <>
                      {(['anthropic', 'openai', 'google'] as const).map((provider) => {
                        const cfg = agent.harness?.byok?.[provider];
                        if (!cfg?.apiKey) return null;
                        return (
                          <div key={provider} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, textTransform: 'capitalize' }}>{provider} Key</span>
                            <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary }}>••••••••</span>
                          </div>
                        );
                      })}
                    </>
                  )}
                  {agent.harness.mode === 'local' && agent.harness.local && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>Base URL</span>
                      <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary }}>{agent.harness.local.baseURL}</span>
                    </div>
                  )}
                  {agent.harness.mode === 'subprocess' && agent.harness.subprocess && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>Command</span>
                        <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary }}>{agent.harness.subprocess.command}</span>
                      </div>
                      {agent.harness.subprocess.cwd && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>Working Directory</span>
                          <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary }}>{agent.harness.subprocess.cwd}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Agent Card / Storefront Metadata */}
            {agent.agentCard && (
              <div style={{ marginBottom: '20px', padding: '12px', borderRadius: '10px', background: 'var(--surface-hover)', border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                <div style={{
                  fontSize: '12px',
                  color: STUDIO_THEME.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: '10px',
                }}>
                  Agent Card
                </div>

                {agent.agentCard.tagline && (
                  <p style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary, fontStyle: 'italic', margin: '0 0 10px 0' }}>
                    "{agent.agentCard.tagline}"
                  </p>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  {agent.rating != null && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: STUDIO_THEME.textPrimary }}>
                      <Star weight="fill" style={{ width: 12, height: 12, color: 'var(--status-warning)' }} />
                      {agent.rating.toFixed(1)}
                      {agent.reviewCount != null && (
                        <span style={{ color: STUDIO_THEME.textMuted }}>({agent.reviewCount})</span>
                      )}
                    </span>
                  )}
                  {agent.totalRuns != null && (
                    <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>
                      {agent.totalRuns.toLocaleString()} runs
                    </span>
                  )}
                  {agent.successRate != null && (
                    <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>
                      {agent.successRate}% success
                    </span>
                  )}
                  {agent.avgResponseTime != null && (
                    <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>
                      {agent.avgResponseTime}s avg
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                  {agent.agentCard.trustTier && (
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '2px 8px', borderRadius: '999px',
                      background: Number(agent.agentCard.trustTier) <= 2 ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
                      color: Number(agent.agentCard.trustTier) <= 2 ? 'var(--status-success)' : 'var(--status-warning)',
                      fontSize: '12px',
                    }}>
                      <Shield weight="fill" style={{ width: 10, height: 10 }} />
                      Trust Tier {agent.agentCard.trustTier}
                    </span>
                  )}
                  {agent.agentCard.canDelegate && (
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '2px 8px', borderRadius: '999px',
                      background: 'color-mix(in srgb, var(--status-info) 12%, transparent)',
                      color: 'var(--status-info)',
                      fontSize: '12px',
                    }}>
                      <ArrowsLeftRight style={{ width: 10, height: 10 }} />
                      Can Delegate
                    </span>
                  )}
                  {agent.category && (
                    <span style={{
                      padding: '2px 8px', borderRadius: '999px',
                      background: `color-mix(in srgb, var(--accent-primary) 15%, transparent)`,
                      color: STUDIO_THEME.accent,
                      fontSize: '12px',
                    }}>
                      {agent.category}
                    </span>
                  )}
                  {agent.isPublic && (
                    <span style={{
                      padding: '2px 8px', borderRadius: '999px',
                      background: 'color-mix(in srgb, var(--status-info) 12%, transparent)',
                      color: 'var(--status-info)',
                      fontSize: '12px',
                    }}>
                      Public
                    </span>
                  )}
                </div>

                {agent.agentCard.capabilityDescription && (
                  <p style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary, lineHeight: 1.5, margin: '0 0 10px 0' }}>
                    {agent.agentCard.capabilityDescription}
                  </p>
                )}

                {agent.tags && agent.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                    {agent.tags.map((tag) => (
                      <span key={tag} style={{
                        padding: '2px 8px', borderRadius: '999px',
                        background: 'var(--surface-hover)',
                        color: STUDIO_THEME.textMuted,
                        fontSize: '12px',
                      }}>{tag}</span>
                    ))}
                  </div>
                )}

                {agent.agentCard.examples && agent.agentCard.examples.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>Examples</span>
                    {agent.agentCard.examples.slice(0, 3).map((ex, i) => (
                      <span key={`agentdetailview-${i}`} style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary, fontFamily: 'var(--font-mono)' }}>
                        → {ex}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Teammate Profile (from Multica) */}
            {agent.teammateProfile && (
              <div style={{ marginBottom: '20px', padding: '12px', borderRadius: '10px', background: 'var(--surface-hover)', border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                <div style={{
                  fontSize: '12px',
                  color: STUDIO_THEME.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: '8px',
                }}>
                  Teammate Profile
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>Status</span>
                    <span style={{
                      fontSize: '13px',
                      color: agent.teammateProfile.status === 'idle' ? 'var(--status-success)' : agent.teammateProfile.status === 'busy' ? 'var(--status-warning)' : 'var(--ui-text-muted)',
                      fontWeight: 500,
                    }}>
                      {agent.teammateProfile.status === 'idle' ? 'Available' : agent.teammateProfile.status === 'busy' ? 'Busy' : 'Offline'}
                    </span>
                  </div>
                  {agent.teammateProfile.bio && (
                    <p style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary, lineHeight: 1.5, margin: 0 }}>
                      {agent.teammateProfile.bio}
                    </p>
                  )}
                  {agent.teammateProfile.specialties && agent.teammateProfile.specialties.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {agent.teammateProfile.specialties.map((s) => (
                        <span key={s} style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: 'color-mix(in srgb, var(--status-info) 15%, transparent)',
                          color: 'var(--status-info)',
                          fontSize: '12px',
                        }}>{s}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                    <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>
                      Board: {agent.assignedBoardItemIds?.length || 0}
                    </span>
                    <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>
                      Tasks: {agent.assignedTaskIds?.length || 0}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Capabilities */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                fontSize: '12px',
                color: STUDIO_THEME.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'block',
                marginBottom: '8px',
              }}>
                Capabilities
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {agent.capabilities.map(cap => (
                  <span key={cap} style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: `color-mix(in srgb, var(--accent-primary) 15%, transparent)`,
                    color: STUDIO_THEME.accent,
                    fontSize: '12px',
                    fontWeight: 500,
                  }}>
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
              <button type="button"
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
              <button type="button"
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: 'var(--status-error)',
                  border: 'none',
                  color: 'var(--ui-text-inverse)',
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

        {/* Performance Card */}
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
              Performance
            </span>
          </div>

          <div style={{ padding: '20px', flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              padding: '12px 16px',
              borderRadius: '12px',
              background: `color-mix(in srgb, var(--accent-primary) 10%, transparent)`,
              border: `1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)`,
            }}>
              <div>
                <div style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, marginBottom: '2px' }}>Status</div>
                <div style={{ fontSize: '14px', color: STUDIO_THEME.textPrimary, fontWeight: 600, textTransform: 'capitalize' }}>{agent.status}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, marginBottom: '2px' }}>Total Runs</div>
                <div style={{ fontSize: '24px', color: STUDIO_THEME.accent, fontWeight: 700 }}>{agentRuns.length}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>Success Rate</span>
                <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary, fontWeight: 600 }}>
                  {successRate != null ? `${successRate}%` : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>Avg Response Time</span>
                <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary, fontWeight: 600 }}>
                  {avgResponseSeconds != null ? `${avgResponseSeconds}s` : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>Last Active</span>
                <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary, fontWeight: 600 }}>
                  {lastActive ? new Date(lastActive).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>

            {agentRuns.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0 0' }}>
                <Sparkle style={{ width: 32, height: 32, color: STUDIO_THEME.textMuted, margin: '0 auto 12px' }} />
                <p style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>
                  No runs yet — metrics will populate after this agent runs.
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
          setShowDashboard(true);
        }}
        style={{
          position: 'absolute',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 24px',
          borderRadius: '999px',
          background: `linear-gradient(to right, ${STUDIO_THEME.accent}, var(--accent-secondary))`,
          border: 'none',
          color: 'var(--ui-text-inverse)',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 8px 24px var(--surface-panel)',
        }}
      >
        <Activity style={{ width: 18, height: 18 }} />
        Launch Agent Dashboard
        <CaretRight style={{ width: 16, height: 16 }} />
      </motion.button>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div role="button" tabIndex={0} style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--shell-overlay-backdrop)',
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
              fontFamily: 'var(--font-research)',
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
              <button type="button"
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
              <button type="button"
                onClick={handleDelete}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: 'var(--status-error)',
                  border: 'none',
                  color: 'var(--ui-text-inverse)',
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


