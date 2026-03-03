import React from 'react';
import { GlassCard } from '../design/GlassCard';
import { tokens } from '../design/tokens';
import { 
  ChatText, 
  UsersThree, 
  Browser, 
  Robot, 
  ClockClockwise, 
  Star, 
  ArrowRight,
  Sparkle
} from '@phosphor-icons/react';

export function HomeView({ onAction, context }: any) {
  console.log('[HomeView] Rendered with context:', context?.viewType, context?.viewId);
  const quickActions = [
    { id: 'chat', label: 'New Chat', icon: ChatText, color: tokens.colors.chat.primary, desc: 'Start a fresh conversation' },
    { id: 'workspace', label: 'Cowork', icon: UsersThree, color: tokens.colors.cowork.primary, desc: 'Launch collaborative workspace' },
    { id: 'browser', label: 'Browser', icon: Browser, color: '#60a5fa', desc: 'Secure agent-controlled browsing' },
    { id: 'code', label: 'Terminal', icon: Robot, color: tokens.colors.code.primary, desc: 'Open external dev environment' },
  ];

  const recentSessions = [
    { id: '1', title: 'Refactor Design System', type: 'code', time: '2m ago' },
    { id: '2', title: 'Marketing Copy spike', type: 'chat', time: '1h ago' },
    { id: '3', title: 'Architecture Review', type: 'cowork', time: 'Yesterday' },
  ];

  return (
    <div style={{ padding: '40px ' + tokens.space.xxl + 'px', height: '100%', overflowY: 'auto', background: 'radial-gradient(circle at top left, rgba(96, 165, 250, 0.05), transparent 400px)' }}>
      <div style={{ marginBottom: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: tokens.colors.chat.primary, marginBottom: 8 }}>
            <Sparkle size={20} weight="fill" />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Next Gen Shell</span>
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Good morning, User</h1>
        </div>
        <div style={{ padding: '12px 24px', borderRadius: 14, background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(255,255,255,0.05)', fontSize: 13, fontWeight: 500 }}>
          <span style={{ opacity: 0.5 }}>Active WIH:</span> <span style={{ color: tokens.colors.chat.primary }}>P5-T0500</span>
        </div>
      </div>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: tokens.colors.system.textMuted, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Star size={16} weight="fill" />
          Quick Launch
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {quickActions.map(action => (
            <button 
              key={action.id}
              onClick={() => onAction(action.id)}
              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
            >
              <GlassCard style={{ height: 140, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ 
                    width: 44, 
                    height: 44, 
                    borderRadius: 12, 
                    background: 'rgba(0,0,0,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: action.color,
                    boxShadow: '0 4px 12px ' + action.color + '20'
                  }}>
                    <action.icon size={24} weight="duotone" />
                  </div>
                  <ArrowRight size={16} color="rgba(255,255,255,0.3)" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{action.label}</div>
                  <div style={{ fontSize: 12, opacity: 0.5 }}>{action.desc}</div>
                </div>
              </GlassCard>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: tokens.colors.system.textMuted, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClockClockwise size={16} weight="bold" />
          Continue Working
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {recentSessions.map(session => (
            <GlassCard key={session.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px' }}>
              <div style={{ 
                width: 8, height: 8, borderRadius: '50%', 
                background: ((tokens.colors as any)[session.type]?.primary) || '#60a5fa' 
              }} />
              <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{session.title}</div>
              <div style={{ fontSize: 12, opacity: 0.4 }}>{session.time}</div>
              <div style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(255,255,255,0.05)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', opacity: 0.6 }}>
                {session.type}
              </div>
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  );
}
