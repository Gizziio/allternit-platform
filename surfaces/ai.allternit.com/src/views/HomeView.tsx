import React from 'react';
import { GlassCard } from '../design/glass/GlassCard';
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
  console.debug('[HomeView] Rendered with context:', context?.viewType, context?.viewId);
  const quickActions = [
    { id: 'chat', label: 'New Chat', icon: ChatText, color: tokens.colors.chat.primary, desc: 'Start a fresh conversation' },
    { id: 'workspace', label: 'Cowork', icon: UsersThree, color: tokens.colors.cowork.primary, desc: 'Launch collaborative workspace' },
    { id: 'browser', label: 'Browser', icon: Browser, color: 'var(--status-info)', desc: 'Secure agent-controlled browsing' },
    { id: 'code', label: 'Terminal', icon: Robot, color: tokens.colors.code.primary, desc: 'Open external dev environment' },
  ];

  const recentSessions = [
    { id: '1', title: 'Refactor Design System', type: 'code', time: '2m ago' },
    { id: '2', title: 'Marketing Copy spike', type: 'chat', time: '1h ago' },
    { id: '3', title: 'Architecture Review', type: 'cowork', time: 'Yesterday' },
  ];

  return (
    <div className="p-10 h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.05),transparent_400px)] flex flex-col gap-12">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 text-[var(--accent-chat)] mb-2">
            <Sparkle size={20} weight="fill" />
            <span className="text-[12px] font-bold uppercase tracking-wider">Next Gen Shell</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight m-0">Good morning, User</h1>
        </div>
        <div className="px-6 py-3 rounded-2xl bg-black/5 border border-[var(--surface-hover)] text-[13px] font-medium">
          <span className="opacity-50">Active WIH:</span> <span className="text-[var(--accent-chat)]">P5-T0500</span>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] mb-5 flex items-center gap-2">
          <Star size={16} weight="fill" />
          Quick Launch
        </h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
          {quickActions.map(action => (
            <button 
              key={action.id}
              onClick={() => onAction(action.id)}
              className="bg-transparent border-none p-0 text-left cursor-pointer group"
            >
              <GlassCard className="h-[140px] flex flex-col justify-between p-5 transition-all group-hover:bg-white/5 group-active:scale-95">
                <div className="flex justify-between items-start">
                  <div 
                    className="size-11 rounded-xl bg-black/5 flex items-center justify-center"
                    style={{ 
                      color: action.color,
                      boxShadow: `0 4px 12px ${action.color}20`
                    }}
                  >
                    <action.icon size={24} weight="duotone" />
                  </div>
                  <ArrowRight size={16} className="text-white/30 transition-transform group-hover:tranzinc-x-1" />
                </div>
                <div>
                  <div className="font-bold text-base mb-1">{action.label}</div>
                  <div className="text-[12px] opacity-50">{action.desc}</div>
                </div>
              </GlassCard>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] mb-5 flex items-center gap-2">
          <ClockClockwise size={16} weight="bold" />
          Continue Working
        </h2>
        <div className="flex flex-col gap-3">
          {recentSessions.map(session => (
            <GlassCard key={session.id} className="flex items-center gap-4 p-3 px-5">
              <div 
                className="size-2 rounded-full"
                style={{ 
                  background: ((tokens.colors as any)[session.type]?.primary) || 'var(--status-info)' 
                }} 
              />
              <div className="flex-1 font-semibold text-sm">{session.title}</div>
              <div className="text-[12px] opacity-40">{session.time}</div>
              <div className="px-2 py-1 rounded-md bg-black/5 border border-[var(--surface-hover)] text-[12px] font-bold uppercase opacity-60">
                {session.type}
              </div>
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  );
}
