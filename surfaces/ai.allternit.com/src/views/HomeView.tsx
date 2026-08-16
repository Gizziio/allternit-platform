import React, { useMemo } from 'react';
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
  Sparkle,
  ChatTeardropText,
  TerminalWindow,
} from '@phosphor-icons/react';
import { useChatSessionStore } from './chat/ChatSessionStore';
import { useCodeSessionStore } from './code/CodeSessionStore';
import { useCoworkSessionStore } from './cowork/CoworkSessionStore';
import { useAgentStore } from '@/lib/agents/agent.store';
import { isBot } from '@/lib/bots/bot-profile';

interface ViewContext {
  viewType?: string;
  viewId?: string;
}

interface HomeViewProps {
  onAction?: (actionId: string) => void;
  context?: ViewContext;
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const QUICK_ACTIONS = [
  { id: 'chat',      label: 'New Chat',  icon: ChatText,  color: tokens.colors.chat.primary,   desc: 'Start a fresh conversation' },
  { id: 'workspace', label: 'Cowork',    icon: UsersThree, color: tokens.colors.cowork.primary, desc: 'Launch collaborative workspace' },
  { id: 'browser',   label: 'ACI',  icon: Browser,   color: 'var(--status-info)',          desc: 'Secure agent-controlled browsing' },
  { id: 'code',      label: 'Terminal', icon: Robot,     color: tokens.colors.code.primary,    desc: 'Open external dev environment' },
];

const SESSION_ICON: Record<string, React.ElementType> = {
  chat:   ChatTeardropText,
  cowork: UsersThree,
  code:   TerminalWindow,
};

export function HomeView({ onAction, context: _context }: HomeViewProps) {
  const chatSessions   = useChatSessionStore((s) => s.sessions);
  const codeSessions   = useCodeSessionStore((s) => s.sessions);
  const coworkSessions = useCoworkSessionStore((s) => s.sessions);
  const agents = useAgentStore((s) => s.agents);

  const recentSessions = useMemo(() => {
    const bots = agents.filter(isBot);
    const botNames = new Set(bots.map((b) => b.name.toLowerCase()));
    const isBotSession = (s: typeof chatSessions[0]) => {
      if (s.metadata?.isBot === true) return true;
      if (s.metadata?.agentId != null) return true;
      if ((s.metadata as Record<string, unknown> | undefined)?.agent_id != null) return true;
      if (s.metadata?.agentName && botNames.has(String(s.metadata.agentName).toLowerCase())) return true;
      return false;
    };
    const all = [
      ...chatSessions
        .filter((s) => !isBotSession(s))
        .map((s) => ({ id: s.id, title: s.name || 'Untitled chat', type: 'chat', updatedAt: s.updatedAt })),
      ...coworkSessions.map((s) => ({ id: s.id, title: s.name || 'Untitled cowork', type: 'cowork', updatedAt: s.updatedAt })),
    ];
    all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return all.slice(0, 4);
  }, [chatSessions, coworkSessions, agents]);

  return (
    <div className="p-10 h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.05),transparent_400px)] flex flex-col gap-12">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 text-[var(--accent-chat)] mb-2">
            <Sparkle size={20} weight="fill" />
            <span className="text-[12px] font-bold uppercase tracking-wider">Allternit</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight m-0">{timeGreeting()}</h1>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] mb-5 flex items-center gap-2">
          <Star size={16} weight="fill" />
          Quick Launch
        </h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
          {QUICK_ACTIONS.map((action) => (
            <button type="button"
              key={action.id}
              onClick={() => onAction?.(action.id)}
              className="bg-transparent border-none p-0 text-left cursor-pointer group"
            >
              <GlassCard className="h-[140px] flex flex-col justify-between p-5 transition-all group-hover:bg-white/5 group-active:scale-95">
                <div className="flex justify-between items-start">
                  <div
                    className="size-11 rounded-xl bg-black/5 flex items-center justify-center"
                    style={{ color: action.color, boxShadow: `0 4px 12px ${action.color}20` }}
                  >
                    <action.icon size={24} weight="duotone" />
                  </div>
                  <ArrowRight size={16} className="text-white/30 transition-transform group-hover:translate-x-1" />
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

      {recentSessions.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] mb-5 flex items-center gap-2">
            <ClockClockwise size={16} weight="bold" />
            Continue Working
          </h2>
          <div className="flex flex-col gap-3">
            {recentSessions.map((session) => {
              const Icon = SESSION_ICON[session.type] ?? ChatTeardropText;
              const color = session.type === 'chat'
                ? tokens.colors.chat.primary
                : session.type === 'code'
                ? tokens.colors.code.primary
                : tokens.colors.cowork.primary;
              return (
                <GlassCard key={session.id} className="flex items-center gap-4 p-3 px-5">
                  <Icon size={14} style={{ color, flexShrink: 0 }} />
                  <div className="flex-1 font-semibold text-sm truncate">{session.title}</div>
                  <div className="px-2 py-1 rounded-md bg-black/5 border border-[var(--surface-hover)] text-[12px] font-bold uppercase opacity-60">
                    {session.type}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
