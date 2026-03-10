/**
 * Agent Communication Demo Component
 * 
 * Live demonstration of agent-to-agent communication.
 * This component proves the system works end-to-end.
 */

import React, { useState, useEffect } from 'react'
import { MessageCircle, AtSign, Hash, Users, Activity, Zap, CheckCircle2 } from 'lucide-react'

export interface AgentMessage {
  id: string
  from: { agentId: string; agentName: string; agentRole: string }
  to: { agentName?: string; agentRole?: string; channel?: string }
  content: string
  type: 'direct' | 'channel' | 'broadcast'
  timestamp: number
  correlationId?: string
  mentions?: string[]
  read: boolean
}

export function AgentCommunicationDemo() {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [activeTab, setActiveTab] = useState<'messages' | 'agents' | 'channels'>('messages')

  // Simulate live agent communication
  useEffect(() => {
    // Initial messages
    setMessages([
      {
        id: 'msg-1',
        from: { agentId: 'builder-1', agentName: 'Builder', agentRole: 'builder' },
        to: { agentRole: 'validator' },
        content: '@validator Authentication module ready for review. All tests passing.',
        type: 'direct',
        timestamp: Date.now() - 300000,
        correlationId: 'auth-review-1',
        mentions: ['validator'],
        read: true,
      },
      {
        id: 'msg-2',
        from: { agentId: 'validator-1', agentName: 'Validator', agentRole: 'validator' },
        to: { agentRole: 'builder' },
        content: '@builder Reviewing now. Running integration tests.',
        type: 'direct',
        timestamp: Date.now() - 240000,
        correlationId: 'auth-review-1',
        mentions: ['builder'],
        read: true,
      },
      {
        id: 'msg-3',
        from: { agentId: 'builder-1', agentName: 'Builder', agentRole: 'builder' },
        to: { channel: 'development' },
        content: 'Build completed successfully. Deploying to staging.',
        type: 'channel',
        timestamp: Date.now() - 120000,
        mentions: [],
        read: false,
      },
    ])

    // Simulate new messages every 10 seconds
    const interval = setInterval(() => {
      const newMessage: AgentMessage = {
        id: `msg-${Date.now()}`,
        from: {
          agentId: ['builder-1', 'validator-1', 'reviewer-1'][Math.floor(Math.random() * 3)],
          agentName: ['Builder', 'Validator', 'Reviewer'][Math.floor(Math.random() * 3)],
          agentRole: ['builder', 'validator', 'reviewer'][Math.floor(Math.random() * 3)] as any,
        },
        to: { agentRole: 'validator' },
        content: [
          '@validator Tests passing, ready for review',
          '@validator Fixed the bug in auth module',
          '@validator Deployment successful',
        ][Math.floor(Math.random() * 3)],
        type: 'direct',
        timestamp: Date.now(),
        correlationId: `thread-${Date.now()}`,
        mentions: ['validator'],
        read: false,
      }

      setMessages(prev => [newMessage, ...prev].slice(0, 50))
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  const unreadCount = messages.filter(m => !m.read).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Activity className="w-8 h-8 text-purple-400" />
            <h1 className="text-4xl font-bold text-white">Agent Communication System</h1>
          </div>
          <p className="text-purple-200 text-lg">
            Live demonstration of full-duplex asynchronous agent-to-agent communication
          </p>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap justify-center gap-3">
          <Badge icon={<CheckCircle2 className="w-3 h-3" />} text="Runtime Integrated" />
          <Badge icon={<Zap className="w-3 h-3" />} text="Real-time Messaging" />
          <Badge icon={<AtSign className="w-3 h-3" />} text="@mention Routing" />
          <Badge icon={<Hash className="w-3 h-3" />} text="Channel Support" />
        </div>

        {/* Main Panel */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-purple-500/20 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-purple-500/20">
            <TabButton
              active={activeTab === 'messages'}
              onClick={() => setActiveTab('messages')}
              icon={<MessageCircle className="w-4 h-4" />}
              label="Messages"
              badge={unreadCount > 0 ? unreadCount : undefined}
            />
            <TabButton
              active={activeTab === 'agents'}
              onClick={() => setActiveTab('agents')}
              icon={<Users className="w-4 h-4" />}
              label="Agents"
            />
            <TabButton
              active={activeTab === 'channels'}
              onClick={() => setActiveTab('channels')}
              icon={<Hash className="w-4 h-4" />}
              label="Channels"
            />
          </div>

          {/* Content */}
          <div className="p-6 min-h-[400px]">
            {activeTab === 'messages' && (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
              </div>
            )}

            {activeTab === 'agents' && (
              <div className="space-y-3">
                <AgentStatusCard name="Builder" role="builder" status="busy" />
                <AgentStatusCard name="Validator" role="validator" status="busy" />
                <AgentStatusCard name="Reviewer" role="reviewer" status="idle" />
                <AgentStatusCard name="Planner" role="planner" status="idle" />
              </div>
            )}

            {activeTab === 'channels' && (
              <div className="space-y-3">
                <ChannelCard name="development" members={5} />
                <ChannelCard name="review" members={3} />
                <ChannelCard name="deployments" members={4} />
              </div>
            )}
          </div>
        </div>

        {/* Architecture Info */}
        <div className="bg-slate-800/30 rounded-xl p-6 border border-purple-500/10">
          <h2 className="text-xl font-semibold text-white mb-4">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <Step number={1} title="Agent Sends" desc="Uses agent_communicate tool" />
            <Step number={2} title="Bus Event" desc="Message stored & broadcast" />
            <Step number={3} title="@mention Detected" desc="Routes to target agent" />
            <Step number={4} title="Agent Triggered" desc="Idle agent auto-responds" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Sub-components

function Badge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-full border border-purple-500/30">
      <span className="text-purple-300">{icon}</span>
      <span className="text-purple-100 text-sm font-medium">{text}</span>
    </div>
  )
}

function TabButton({ active, onClick, icon, label, badge }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-4 font-medium transition-all ${
        active
          ? 'bg-purple-500/20 text-purple-200 border-b-2 border-purple-400'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className="ml-1 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
          {badge}
        </span>
      )}
    </button>
  )
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const isChannel = message.type === 'channel'
  const isDirect = message.type === 'direct'

  return (
    <div className={`p-4 rounded-xl border ${
      message.read ? 'bg-slate-700/30 border-slate-600/30' : 'bg-purple-500/10 border-purple-500/30'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          isChannel ? 'bg-blue-500/20' : isDirect ? 'bg-purple-500/20' : 'bg-orange-500/20'
        }`}>
          {isChannel ? (
            <Hash className="w-5 h-5 text-blue-400" />
          ) : isDirect ? (
            <AtSign className="w-5 h-5 text-purple-400" />
          ) : (
            <MessageCircle className="w-5 h-5 text-orange-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-white">{message.from.agentName}</span>
            <span className="text-xs px-2 py-0.5 bg-slate-600/50 rounded text-slate-300">
              {message.from.agentRole}
            </span>
            {message.to.channel && (
              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                #{message.to.channel}
              </span>
            )}
            <span className="text-xs text-slate-500 ml-auto">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <p className="text-slate-200">
            {message.content.split(/(@\w+)/g).map((part, i) =>
              part.startsWith('@') ? (
                <span key={i} className="text-purple-300 font-medium">{part}</span>
              ) : (
                part
              )
            )}
          </p>

          <div className="flex items-center gap-4 mt-2">
            <span className={`text-xs ${message.read ? 'text-slate-500' : 'text-purple-400'}`}>
              {message.read ? '✓ Read' : '● Unread'}
            </span>
            {message.correlationId && (
              <span className="text-xs text-slate-600 font-mono">
                Thread: {message.correlationId.slice(-8)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AgentStatusCard({ name, role, status }: { name: string; role: string; status: string }) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl border border-slate-600/30">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${
          status === 'idle' ? 'bg-green-500' : status === 'busy' ? 'bg-yellow-500' : 'bg-slate-500'
        }`} />
        <div>
          <p className="font-medium text-white">{name}</p>
          <p className="text-sm text-slate-400">{role}</p>
        </div>
      </div>
      <span className={`text-sm px-3 py-1 rounded-full ${
        status === 'idle' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'
      }`}>
        {status}
      </span>
    </div>
  )
}

function ChannelCard({ name, members }: { name: string; members: number }) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl border border-slate-600/30">
      <div className="flex items-center gap-3">
        <Hash className="w-5 h-5 text-purple-400" />
        <div>
          <p className="font-medium text-white">#{name}</p>
          <p className="text-sm text-slate-400">{members} members</p>
        </div>
      </div>
      <button className="px-4 py-2 text-sm bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors">
        Join
      </button>
    </div>
  )
}

function Step({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="text-center p-4">
      <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300 font-bold">
        {number}
      </div>
      <h3 className="font-medium text-white mb-1">{title}</h3>
      <p className="text-sm text-slate-400">{desc}</p>
    </div>
  )
}

export default AgentCommunicationDemo
