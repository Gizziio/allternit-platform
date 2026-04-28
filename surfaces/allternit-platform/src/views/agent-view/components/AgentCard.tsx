"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Robot, 
  GearSix, 
  Star, 
  CheckCircle, 
  Network, 
  SpeakerHigh, 
  Clock 
} from "@phosphor-icons/react";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { Agent } from "@/lib/agents/agent.types";
import { parseCharacterBlueprint } from "@/lib/agents";
import { 
  CHARACTER_SETUPS, 
  getSetupStatDefinitions 
} from "@/lib/agents/character.service";
import type { AvatarConfig } from "@/lib/agents/character.types";
import { createDefaultAvatarConfig } from "@/lib/agents/character.types";
import { AgentAvatar } from "@/components/Avatar";
import { formatRelativeTime } from "@/lib/time";
import { STUDIO_THEME } from "../AgentView.constants";

export function AgentCard({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const blueprint = parseCharacterBlueprint(agent.config);
  const setupId = blueprint?.setup || "generalist";
  const setupMeta = CHARACTER_SETUPS.find((setup) => setup.id === setupId) || null;
  const agentCharacterStats = useAgentStore((state) => state.characterStats[agent.id]);
  const loadCharacterLayer = useAgentStore((state) => state.loadCharacterLayer);

  const avatarConfig = (agent.config?.avatar as AvatarConfig) || createDefaultAvatarConfig(setupId);

  useEffect(() => {
    if (!agentCharacterStats) {
      void loadCharacterLayer(agent.id);
    }
  }, [agent.id, agentCharacterStats, loadCharacterLayer]);
  
  const getTypeIcon = () => {
    switch (agent.type) {
      case 'orchestrator': return <Network style={{ width: 14, height: 14 }} />;
      case 'worker': return <GearSix style={{ width: 14, height: 14 }} />;
      case 'specialist': return <Star style={{ width: 14, height: 14 }} />;
      case 'reviewer': return <CheckCircle style={{ width: 14, height: 14 }} />;
      default: return <Robot style={{ width: 14, height: 14 }} />;
    }
  };

  const getTypeLabel = () => {
    switch (agent.type) {
      case 'orchestrator': return 'Orchestrator';
      case 'sub-agent': return 'Sub-Agent';
      case 'worker': return 'Worker';
      case 'specialist': return 'Specialist';
      case 'reviewer': return 'Reviewer';
      default: return 'Agent';
    }
  };

  const previewStatDefinitions = getSetupStatDefinitions(setupId)
    .filter((definition) => agentCharacterStats?.relevantStats.includes(definition.key))
    .slice(0, 2);

  const statusColors: Record<string, string> = {
    'online': 'var(--status-success)',
    'offline': 'var(--ui-text-muted)',
    'busy': 'var(--status-warning)',
    'error': 'var(--status-error)',
    'running': 'var(--status-warning)'
  };
  
  return (
    <motion.div
      onClick={onClick}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      style={{
        cursor: 'pointer',
        borderRadius: '12px',
        border: `1px solid ${isHovered ? `${STUDIO_THEME.accent}50` : STUDIO_THEME.borderSubtle}`,
        background: STUDIO_THEME.bgCard,
        overflow: 'hidden',
        boxShadow: isHovered ? '0 8px 24px var(--surface-panel)' : '0 2px 8px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease'
      }}
    >
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <div style={{
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              position: 'relative'
            }}>
              <AgentAvatar 
                config={avatarConfig}
                size={44}
                emotion="steady"
                isAnimating={isHovered}
              />
              <div style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: statusColors[agent.status] || 'var(--ui-text-muted)',
                border: `2px solid ${STUDIO_THEME.bgCard}`
              }} />
            </div>
            
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: isHovered ? STUDIO_THEME.accent : STUDIO_THEME.textPrimary,
                margin: '0 0 6px 0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transition: 'color 0.2s ease'
              }}>
                {agent.name}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: `${STUDIO_THEME.accent}15`,
                  color: STUDIO_THEME.accent,
                  fontSize: '11px',
                  fontWeight: 500,
                  border: `1px solid ${STUDIO_THEME.accent}25`
                }}>
                  {getTypeIcon()}
                  {getTypeLabel()}
                </span>
                {setupMeta && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'var(--ui-border-muted)',
                    color: STUDIO_THEME.textSecondary,
                    fontSize: '11px',
                    fontWeight: 500
                  }}>
                    {setupMeta.label}
                  </span>
                )}
                {agentCharacterStats && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: 'var(--status-info)',
                    fontSize: '11px',
                    fontWeight: 500
                  }}>
                    Lv{agentCharacterStats.level}
                  </span>
                )}
                {/* Teammate profile status */}
                {agent.teammateProfile && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: agent.teammateProfile.status === 'busy' ? 'rgba(245, 158, 11, 0.15)' : agent.teammateProfile.status === 'offline' ? 'rgba(107, 114, 128, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: agent.teammateProfile.status === 'busy' ? 'var(--status-warning)' : agent.teammateProfile.status === 'offline' ? 'var(--ui-text-muted)' : 'var(--status-success)',
                    fontSize: '11px',
                    fontWeight: 500
                  }}>
                    {agent.teammateProfile.status === 'idle' ? 'Available' : agent.teammateProfile.status === 'busy' ? 'Busy' : 'Offline'}
                  </span>
                )}
                {/* Assignment count */}
                {(agent.assignedBoardItemIds?.length ?? 0) > 0 && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: '#a78bfa',
                    fontSize: '11px',
                    fontWeight: 500
                  }}>
                    {agent.assignedBoardItemIds?.length ?? 0} board
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {agent.voice?.enabled && (
            <div style={{
              padding: '4px 8px',
              borderRadius: '999px',
              background: `${STUDIO_THEME.accent}15`,
              border: `1px solid ${STUDIO_THEME.accent}25`,
              display: 'flex',
              alignItems: 'center'
            }}>
              <SpeakerHigh style={{ width: 14, height: 14, color: STUDIO_THEME.accent }} />
            </div>
          )}
        </div>
        
        <p style={{
          fontSize: '14px',
          color: STUDIO_THEME.textSecondary,
          margin: '12px 0 0 0',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {agent.description || "No description provided"}
        </p>
        
        {blueprint && blueprint.specialtySkills.length > 0 && (
          <div style={{
            marginTop: '12px',
            padding: '10px',
            borderRadius: '8px',
            background: 'var(--surface-hover)',
            border: `1px solid ${STUDIO_THEME.borderSubtle}`
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {blueprint.specialtySkills.slice(0, 3).map((skill) => (
                <span key={skill} style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  background: `${STUDIO_THEME.accent}15`,
                  color: STUDIO_THEME.accent,
                  fontSize: '12px',
                  fontWeight: 500
                }}>
                  {skill}
                  {typeof agentCharacterStats?.specialtyScores?.[skill] === "number" && (
                    <span style={{ marginLeft: '4px', opacity: 0.7 }}>
                      {agentCharacterStats.specialtyScores[skill]}
                    </span>
                  )}
                </span>
              ))}
              {blueprint.specialtySkills.length > 3 && (
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  background: 'var(--ui-border-muted)',
                  color: STUDIO_THEME.textMuted,
                  fontSize: '12px'
                }}>
                  +{blueprint.specialtySkills.length - 3}
                </span>
              )}
            </div>
          </div>
        )}
        
        {agentCharacterStats && previewStatDefinitions.length > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {previewStatDefinitions.map((definition) => (
              <div key={definition.key} style={{
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'var(--surface-hover)',
                border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary }}>
                  {definition.label}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: STUDIO_THEME.textPrimary }}>
                  {agentCharacterStats.stats[definition.key] ?? 0}
                </span>
              </div>
            ))}
          </div>
        )}
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
          {agent.capabilities.slice(0, 3).map(cap => (
            <span key={cap} style={{
              padding: '3px 10px',
              borderRadius: '6px',
              background: 'var(--ui-border-muted)',
              color: STUDIO_THEME.textSecondary,
              fontSize: '12px',
              border: `1px solid ${STUDIO_THEME.borderSubtle}`
            }}>
              {cap}
            </span>
          ))}
        </div>
      </div>
      
      <div style={{
        padding: '12px 16px',
        borderTop: `1px solid ${STUDIO_THEME.borderSubtle}`,
        background: 'rgba(0,0,0,0.15)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          color: STUDIO_THEME.textMuted
        }}>
          <Clock style={{ width: 14, height: 14 }} />
          Last run: {agent.lastRunAt ? formatRelativeTime(agent.lastRunAt) : 'Never'}
        </div>
      </div>
    </motion.div>
  );
}
