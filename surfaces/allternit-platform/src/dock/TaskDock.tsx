import React from 'react';
import { useTicketStore } from './ticket.store';

import { GlassSurface } from '../design/GlassSurface';
import { tokens } from '../design/tokens';
import {
  CheckCircle,
  CircleDashed,
  Play,
  X,
  Bug,
  Lightning,
  ArrowUpRight,
  DotsThreeVertical,
} from '@phosphor-icons/react';

type TaskDockVariant = 'floating' | 'panel';

export function TaskDock({
  variant = 'floating',
  maxItems = 5,
  showActions,
  onViewActivity,
}: {
  variant?: TaskDockVariant;
  maxItems?: number;
  showActions?: boolean;
  onViewActivity?: () => void;
}) {
  const { tickets, addTicket } = useTicketStore();

  const isPanel = variant === 'panel';
  const shouldShowActions = showActions ?? !isPanel;
  const textColor = tokens.colors.textPrimary;
  const mutedText = tokens.colors.textTertiary;
  const cardBorder = isPanel ? '1px solid var(--border-subtle)' : '1px solid rgba(255,255,255,0.05)';
  const cardBackground = isPanel ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)';
  const actionBackground = isPanel ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)';
  const actionBorder = isPanel ? '1px solid var(--border-subtle)' : '1px solid rgba(255,255,255,0.08)';
  const handleViewActivity = () => {
    if (onViewActivity) {
      onViewActivity();
    }
  };

  return (
    <div style={{
      position: isPanel ? 'relative' : 'absolute',
      right: isPanel ? 'auto' : 20,
      bottom: isPanel ? 'auto' : 204,
      width: isPanel ? '100%' : 340,
      zIndex: 100,
      color: textColor,
    }}>
      <GlassSurface 
        intensity={isPanel ? 'base' : 'thick'}
        style={{
          padding: isPanel ? 12 : 16,
          borderRadius: 20,
          border: isPanel ? '1px solid var(--border-default)' : '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: isPanel ? tokens.shadows.sm : '0 24px 48px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ 
            width: 32, 
            height: 32, 
            borderRadius: 8, 
            background: tokens.colors.chat.primary, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 0 12px ' + tokens.colors.chat.primary + '40'
          }}>
            <Lightning size={18} className="fill-white text-white" />
          </div>
          <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em' }}>Task Dock</div>
          <div style={{ flex: 1 }} />
          {shouldShowActions && (
            <button 
              onClick={() => addTicket({ title: 'New Task' })}
              style={{ background: actionBackground, border: actionBorder, borderRadius: 6, padding: '4px 8px', color: textColor, cursor: 'pointer' }}
            >
              + New
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tickets.length === 0 ? (
            <div style={{ padding: '16px 0', textAlign: 'center', color: mutedText, fontSize: 12 }}>
              No active tasks
            </div>
          ) : tickets.slice(0, maxItems).map((t) => (
            <div key={t.id} style={{ 
              padding: 12, 
              borderRadius: 14, 
              background: cardBackground, 
              border: cardBorder,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {(t.status as string) === 'open' ? (
                  <CircleDashed size={16} color={tokens.colors.chat.primary} strokeWidth={2.5} />
                ) : (
                  <CheckCircle size={16} color={tokens.colors.code.primary} className="fill-current" />
                )}
                <div style={{ flex: 1, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: textColor }}>
                  {t.title}
                </div>
                <DotsThreeVertical size={16} style={{ opacity: 0.4, color: mutedText }} />
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: '45%', height: '100%', background: tokens.colors.chat.primary, boxShadow: '0 0 8px ' + tokens.colors.chat.primary }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: mutedText, textTransform: 'uppercase' }}>45%</span>
              </div>
            </div>
          ))}
        </div>

        {shouldShowActions && (
          <button 
            onClick={handleViewActivity}
            style={{ 
              width: '100%', 
              marginTop: 16,
              padding: '10px',
              borderRadius: 10,
              background: actionBackground,
              border: actionBorder,
              color: textColor,
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer'
            }}
          >
            <ArrowUpRight size={14} strokeWidth={2.5} />
            View Full Activity
          </button>
        )}
      </GlassSurface>
    </div>
  );
}
