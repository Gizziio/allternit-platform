/**
 * Code Mode - Agent Orchestration
 */

import React, { useState } from 'react';
import {
  Users,
  Lightning,
  Pulse as Activity,
  Shield,
  Cube,
  Target,
  ListChecks,
  Brain,
  Chat,
  ChartBar,
  ShieldWarning,
  Network,
  Play,
  Pause,
  Plus,
  CheckCircle,
  Clock,
  X,
} from '@phosphor-icons/react';

import {
  MODE_COLORS,
  TEXT,
} from '@/design/allternit.tokens';

import { AgentSessionLayout } from './AgentSessionLayout';
import type { CodeModeADEProps } from './types';

const TABS = [
  { id: 'orchestrator', label: 'Orchestrator', icon: Network },
  { id: 'goal', label: 'Goal', icon: Target },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'thinking', label: 'Thinking', icon: Brain },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'chat', label: 'Chat', icon: Chat },
  { id: 'analytics', label: 'Analytics', icon: ChartBar },
  { id: 'monitor', label: 'Monitor', icon: ShieldWarning },
] as const;

type TabId = typeof TABS[number]['id'];

export function CodeModeADE({
  targetAgentId,
  onClose,
}: CodeModeADEProps) {
  const mode = 'code';
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.code;
  const [activeTab, setActiveTab] = useState<TabId>('orchestrator');
  const [isRunning, setIsRunning] = useState(false);

  return (
    <AgentSessionLayout
      mode={mode}
      title="Swarm ADE"
      agentName={targetAgentId || "Swarm Controller"}
      status={isRunning ? 'running' : 'idle'}
      onClose={onClose}
      computerView={
        <div className="h-full flex flex-col overflow-hidden">
          {/* Tab Bar - shrink-0 prevents compression */}
          <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0" style={{
            background: 'rgba(13, 11, 9, 0.98)',
            borderColor: 'rgba(255,255,255,0.05)',
          }}>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all shrink-0"
                  style={isActive ? {
                    background: `${modeColors.accent}20`,
                    color: modeColors.accent,
                    border: `1px solid ${modeColors.accent}50`,
                  } : {
                    background: 'transparent',
                    color: TEXT.tertiary,
                    border: '1px solid transparent',
                  }}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
            
            {/* Run Controls */}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {isRunning ? (
                <>
                  <button onClick={() => setIsRunning(false)} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-yellow-400">
                    <Pause size={16} />
                  </button>
                  <button onClick={() => setIsRunning(false)} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-red-400">
                    <X size={16} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsRunning(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0"
                  style={{
                    background: `${modeColors.accent}20`,
                    color: modeColors.accent,
                    border: `1px solid ${modeColors.accent}50`,
                  }}
                >
                  <Play size={14} />
                  Run
                </button>
              )}
            </div>
          </div>

          {/* Content - min-h-0 allows proper flex scrolling */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-6 h-full">
              {activeTab === 'orchestrator' && <OrchestratorView modeColors={modeColors} />}
              {activeTab === 'goal' && <GoalView modeColors={modeColors} />}
              {activeTab === 'tasks' && <TasksView modeColors={modeColors} />}
              {activeTab === 'thinking' && <ThinkingView modeColors={modeColors} />}
              {activeTab === 'teams' && <TeamsView modeColors={modeColors} />}
              {activeTab === 'chat' && <ChatView modeColors={modeColors} />}
              {activeTab === 'analytics' && <AnalyticsView modeColors={modeColors} isRunning={isRunning} />}
              {activeTab === 'monitor' && <MonitorView modeColors={modeColors} />}
            </div>
          </div>
        </div>
      }
      headerActions={
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
          style={{
            background: modeColors.soft,
            color: modeColors.accent,
            border: `1px solid ${modeColors.border}`
          }}
          onClick={() => setIsRunning(!isRunning)}
        >
          {isRunning ? <Activity size={14} className="animate-pulse" /> : <Lightning size={14} />}
          {isRunning ? 'Active' : 'Ignite'}
        </button>
      }
    >
      {/* Left Pane */}
      <div className="h-full flex flex-col overflow-hidden">
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h2 className="text-base font-bold mb-1" style={{ color: TEXT.primary }}>Swarm Control</h2>
            <p className="text-sm" style={{ color: TEXT.secondary }}>Real-time orchestration</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatCard label="Agents" value="4" icon={Users} />
            <StatCard label="Latency" value="24ms" icon={Lightning} />
            <StatCard label="Memory" value="1.4GB" icon={Cube} />
            <StatCard label="Success" value="99.8%" icon={Shield} />
          </div>

          {/* Activity */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: TEXT.tertiary }}>Activity</div>
            <div className="space-y-2">
              <ActivityItem icon={Network} title="Swarm Started" time="2m" desc="4 agents initialized" color={modeColors.accent} />
              <ActivityItem icon={Users} title="Agent Joined" time="1m" desc="RefactorExpert" color="#60a5fa" />
              <ActivityItem icon={Brain} title="Analysis Done" time="30s" desc="14 files" color="#a78bfa" />
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: TEXT.tertiary }}>
              <Plus size={18} />
            </button>
            <div className="flex-1 h-10 rounded-lg flex items-center px-3 text-sm" style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: TEXT.tertiary,
            }}>
              Commands...
            </div>
            <button className="p-2 rounded-lg" style={{
              background: `${modeColors.accent}20`,
              color: modeColors.accent,
            }}>
              <Play size={16} />
            </button>
          </div>
        </div>
      </div>
    </AgentSessionLayout>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={12} style={{ color: TEXT.tertiary }} />
        <span className="text-[10px] uppercase" style={{ color: TEXT.tertiary }}>{label}</span>
      </div>
      <div className="text-sm font-bold" style={{ color: TEXT.primary }}>{value}</div>
    </div>
  );
}

function ActivityItem({ icon: Icon, title, time, desc, color }: { icon: any; title: string; time: string; desc: string; color: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15`, border: `1px solid ${color}40` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold" style={{ color: TEXT.primary }}>{title}</span>
          <span className="text-[10px]" style={{ color: TEXT.tertiary }}>{time}</span>
        </div>
        <p className="text-xs" style={{ color: TEXT.secondary }}>{desc}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Tab Views
// ============================================================================

function OrchestratorView({ modeColors }: { modeColors: any }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-20 h-20 rounded-2xl mb-6 flex items-center justify-center" style={{ background: `${modeColors.accent}20`, border: `1px solid ${modeColors.accent}40` }}>
        <Network size={40} style={{ color: modeColors.accent }} />
      </div>
      <h3 className="text-base font-bold mb-2" style={{ color: TEXT.primary }}>Visual Editor</h3>
      <p className="text-sm mb-6 max-w-md" style={{ color: TEXT.secondary }}>Drag-and-drop swarm builder with real-time execution</p>
      <button className="px-6 py-3 rounded-lg text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.1)', color: TEXT.primary }}>
        Launch Editor
      </button>
    </div>
  );
}

function GoalView({ modeColors }: { modeColors: any }) {
  const [goal, setGoal] = useState('');
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h3 className="text-base font-bold mb-2" style={{ color: TEXT.primary }}>Define Goal</h3>
      <p className="text-sm mb-6" style={{ color: TEXT.secondary }}>Describe what to accomplish</p>
      <textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g., Build a React component..." className="w-full h-40 px-4 py-3 rounded-xl text-sm resize-none outline-none" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: TEXT.primary }} />
      <div className="flex items-center justify-between mt-4">
        <span className="text-xs" style={{ color: TEXT.tertiary }}>AI-powered decomposition</span>
        <button disabled={!goal.trim()} className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ background: `${modeColors.accent}20`, color: modeColors.accent, border: `1px solid ${modeColors.accent}40` }}>Decompose</button>
      </div>
    </div>
  );
}

function TasksView({ modeColors }: { modeColors: any }) {
  const tasks = [
    { name: 'Analyze requirements', progress: 100, done: true },
    { name: 'Create plan', progress: 60, done: false },
    { name: 'Implement', progress: 0, done: false },
    { name: 'Test', progress: 0, done: false },
  ];
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h3 className="text-base font-bold mb-2" style={{ color: TEXT.primary }}>Tasks</h3>
      <p className="text-sm mb-6" style={{ color: TEXT.secondary }}>Task breakdown</p>
      <div className="space-y-3">
        {tasks.map((task, i) => (
          <div key={i} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: task.done ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)' }}>
                {task.done ? <CheckCircle size={20} style={{ color: '#22c55e' }} /> : <Clock size={20} style={{ color: '#6b7280' }} />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold" style={{ color: TEXT.primary }}>{task.name}</span>
                  <span className="text-sm font-bold" style={{ color: modeColors.accent }}>{task.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="h-full" style={{ width: `${task.progress}%`, background: task.done ? '#22c55e' : '#6b7280' }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThinkingView({ modeColors }: { modeColors: any }) {
  const thoughts = [
    { type: 'Analysis', content: 'Analyzing requirements...', time: '2m' },
    { type: 'Planning', content: 'Creating implementation plan', time: '1m' },
    { type: 'Decision', content: 'Using modular architecture', time: '30s' },
  ];
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h3 className="text-base font-bold mb-2" style={{ color: TEXT.primary }}>Thinking</h3>
      <p className="text-sm mb-6" style={{ color: TEXT.secondary }}>Agent reasoning</p>
      <div className="space-y-6">
        {thoughts.map((t, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: modeColors.accent }} />
              {i < thoughts.length - 1 && <div className="w-px h-12 mt-2" style={{ background: 'rgba(255,255,255,0.1)' }} />}
            </div>
            <div className="flex-1 pb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase" style={{ color: modeColors.accent }}>{t.type}</span>
                <span className="text-xs" style={{ color: TEXT.tertiary }}>{t.time}</span>
              </div>
              <p className="text-sm" style={{ color: TEXT.secondary }}>{t.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamsView({ modeColors }: { modeColors: any }) {
  const templates = [
    { name: 'Code Review', agents: 4 },
    { name: 'Feature Dev', agents: 3 },
    { name: 'Bug Fix', agents: 2 },
    { name: 'Research', agents: 3 },
    { name: 'Testing', agents: 2 },
    { name: 'DevOps', agents: 3 },
  ];
  return (
    <div className="max-w-5xl mx-auto p-6">
      <h3 className="text-base font-bold mb-2" style={{ color: TEXT.primary }}>Teams</h3>
      <p className="text-sm mb-6" style={{ color: TEXT.secondary }}>Team templates</p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => (
          <button key={t.name} className="p-4 rounded-xl text-left" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="w-10 h-10 rounded-lg mb-3 flex items-center justify-center" style={{ background: `${modeColors.accent}20`, border: `1px solid ${modeColors.accent}40` }}>
              <Users size={20} style={{ color: modeColors.accent }} />
            </div>
            <h4 className="text-sm font-semibold mb-1" style={{ color: TEXT.primary }}>{t.name}</h4>
            <p className="text-xs" style={{ color: TEXT.tertiary }}>{t.agents} agents</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatView({ modeColors }: { modeColors: any }) {
  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col p-6">
      <h3 className="text-base font-bold mb-2" style={{ color: TEXT.primary }}>Chat</h3>
      <p className="text-sm mb-6" style={{ color: TEXT.secondary }}>Multi-agent communication</p>
      <div className="flex-1 space-y-4 mb-6">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${modeColors.accent}20`, border: `1px solid ${modeColors.accent}40` }}>
            <Cpu size={16} style={{ color: modeColors.accent }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold" style={{ color: modeColors.accent }}>Planner</span>
              <span className="text-xs" style={{ color: TEXT.tertiary }}>2m</span>
            </div>
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-sm" style={{ color: TEXT.secondary }}>Ready to proceed?</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <div className="flex-1 text-right">
            <div className="flex items-center justify-end gap-2 mb-2">
              <span className="text-xs" style={{ color: TEXT.tertiary }}>1m</span>
              <span className="text-xs font-semibold" style={{ color: '#4ade80' }}>You</span>
            </div>
            <div className="p-3 rounded-lg inline-block" style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <p className="text-sm" style={{ color: TEXT.primary }}>Yes, proceed.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 h-10 rounded-lg flex items-center px-3 text-sm" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: TEXT.tertiary }}>Message...</div>
        <button className="px-4 rounded-lg text-xs font-semibold" style={{ background: `${modeColors.accent}20`, color: modeColors.accent, border: `1px solid ${modeColors.accent}40` }}>Send</button>
      </div>
    </div>
  );
}

function AnalyticsView({ modeColors, isRunning }: { modeColors: any; isRunning: boolean }) {
  const metrics = [
    { label: 'Success', value: '91.7%', color: '#22c55e' },
    { label: 'Avg Time', value: '4.3s', color: '#3b82f6' },
    { label: 'Cost', value: '$1.45', color: '#f59e0b' },
    { label: 'Agents', value: '4/6', color: '#a78bfa' },
  ];
  
  if (!isRunning) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 rounded-xl mb-4 flex items-center justify-center" style={{ background: `${modeColors.accent}20`, border: `1px solid ${modeColors.accent}40` }}>
          <ChartBar size={32} style={{ color: modeColors.accent, opacity: 0.5 }} />
        </div>
        <p className="text-sm font-semibold mb-2" style={{ color: TEXT.primary }}>Start swarm to see analytics</p>
        <p className="text-sm" style={{ color: TEXT.secondary }}>Metrics appear during execution</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-5xl mx-auto p-6">
      <h3 className="text-base font-bold mb-2" style={{ color: TEXT.primary }}>Analytics</h3>
      <p className="text-sm mb-6" style={{ color: TEXT.secondary }}>Performance metrics</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xs mb-3" style={{ color: TEXT.tertiary }}>{m.label}</p>
            <p className="text-2xl font-bold" style={{ color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonitorView({ modeColors }: { modeColors: any }) {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <h3 className="text-base font-bold mb-2" style={{ color: TEXT.primary }}>Monitor</h3>
      <p className="text-sm mb-6" style={{ color: TEXT.secondary }}>Swarm health</p>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-xs mb-2" style={{ color: TEXT.tertiary }}>Circuit Breakers</p>
          <p className="text-2xl font-bold" style={{ color: '#22c55e' }}>0 Open</p>
          <p className="text-xs mt-1" style={{ color: TEXT.tertiary }}>All healthy</p>
        </div>
        <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-xs mb-2" style={{ color: TEXT.tertiary }}>Quarantined</p>
          <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>0</p>
          <p className="text-xs mt-1" style={{ color: TEXT.tertiary }}>None</p>
        </div>
      </div>
      <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-xs font-bold uppercase mb-4" style={{ color: TEXT.tertiary }}>Activity</p>
        <div className="space-y-3">
          {[
            { event: 'Agent conversation', time: '2m' },
            { event: 'Tool: file_write', time: '1m' },
            { event: 'Checkpoint', time: '30s' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span style={{ color: TEXT.secondary }}>{item.event}</span>
              <span style={{ color: TEXT.tertiary }}>{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CodeModeADE;
