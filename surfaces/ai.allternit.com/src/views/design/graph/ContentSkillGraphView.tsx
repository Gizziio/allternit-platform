"use client";
import React, { useState } from 'react';
import {
  X as XIcon, LinkedinLogo, InstagramLogo, TiktokLogo, YoutubeLogo,
  ChatCircle, Envelope, Megaphone,
  MicrophoneStage, Lightning, CalendarBlank, Stack,
  UsersThree, User,
  Graph, ArrowRight, Sparkle,
} from '@phosphor-icons/react';
import { useDesignSessionStore, useDesignSessionActions } from '../DesignSessionStore';

// ── Node data built from /Users/macbook/Desktop/content-skill-graph/ ─────────

const GRAPH_NODES = {
  root: {
    id: 'root', label: 'Command Center', desc: 'Manages 10 social accounts from one idea. Turn one topic into 10 platform-native posts.',
    color: 'var(--accent-primary)', textColor: '#fff',
  },
  categories: [
    {
      id: 'platforms', label: 'Platforms', color: '#6366f1', textColor: '#fff',
      desc: 'Platform-specific writing rules, tone, frequency, and format guides.',
      children: [
        { id: 'x',         label: 'X / Twitter', icon: <XIcon size={13} weight="bold" />,          desc: '280 chars max, contrarian takes, step-by-step threads. Post 5×/week.',          freq: '5×/week' },
        { id: 'linkedin',  label: 'LinkedIn',    icon: <LinkedinLogo size={13} weight="fill" />,   desc: 'Long-form 1500+ words, professional tone, personal stories. Post 3×/week.',    freq: '3×/week' },
        { id: 'instagram', label: 'Instagram',   icon: <InstagramLogo size={13} weight="fill" />,  desc: '7-slide carousels, bold claim on slide 1. Reels for short-form. 4×/week.',      freq: '4×/week' },
        { id: 'tiktok',    label: 'TikTok',      icon: <TiktokLogo size={13} weight="fill" />,     desc: '45-60s screen recordings. Hook in first 2 seconds. Post 5×/week.',             freq: '5×/week' },
        { id: 'youtube',   label: 'YouTube',     icon: <YoutubeLogo size={13} weight="fill" />,    desc: 'SEO-optimized, 8-12 min format, evergreen content. Post 2×/week.',             freq: '2×/week' },
        { id: 'threads',   label: 'Threads',     icon: <ChatCircle size={13} weight="fill" />,     desc: 'Conversational, opinion-driven, casual X alternative. Post 3×/week.',          freq: '3×/week' },
        { id: 'facebook',  label: 'Facebook',    icon: <Megaphone size={13} weight="fill" />,      desc: 'Community-focused, longer captions, group engagement. Post 3×/week.',          freq: '3×/week' },
        { id: 'newsletter',label: 'Newsletter',  icon: <Envelope size={13} weight="fill" />,       desc: 'Deep-dive 1000-2000 words, actionable frameworks. Send 1×/week.',              freq: '1×/week' },
      ],
    },
    {
      id: 'voice', label: 'Voice', color: '#ec4899', textColor: '#fff',
      desc: 'Core personality, tone markers, and per-platform voice adaptation rules.',
      children: [
        { id: 'brand-voice',   label: 'Brand Voice',   icon: <MicrophoneStage size={13} />, desc: 'Core personality, values, tone markers, and vocabulary across ALL platforms.' },
        { id: 'platform-tone', label: 'Platform Tone', icon: <Sparkle size={13} />,         desc: 'Same voice, different room. How core voice adapts per platform context.' },
      ],
    },
    {
      id: 'engine', label: 'Engine', color: '#22c55e', textColor: '#fff',
      desc: 'Production workflows: hooks, repurposing chain, scheduling, and content formats.',
      children: [
        { id: 'hooks',         label: 'Hook Formulas', icon: <Lightning size={13} weight="fill" />,   desc: 'Scroll-stopping openers: contrarian, proof, discovery, replacement, playbook.' },
        { id: 'repurpose',     label: 'Repurpose',     icon: <ArrowRight size={13} weight="bold" />,  desc: '1 idea → 10 outputs. Platform order, adaptation chain, what changes per version.' },
        { id: 'scheduling',    label: 'Scheduling',    icon: <CalendarBlank size={13} weight="fill" />, desc: 'Posting calendar, best times per platform, frequency rules, batch workflow.' },
        { id: 'content-types', label: 'Content Types', icon: <Stack size={13} weight="fill" />,        desc: 'Format definitions: threads, carousels, reels, articles, short takes, scripts.' },
      ],
    },
    {
      id: 'audience', label: 'Audience', color: '#f59e0b', textColor: '#fff',
      desc: 'Audience personas — who we write for and what they need from each piece.',
      children: [
        { id: 'builders', label: 'Builders',     icon: <UsersThree size={13} weight="fill" />, desc: 'Indie hackers, AI engineers, SaaS founders. Want actionable playbooks and real numbers.' },
        { id: 'casual',   label: 'Casual',       icon: <User size={13} weight="fill" />,       desc: 'Curious about AI/tech, not building yet. Want inspiration and simplified explanations.' },
      ],
    },
  ],
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ContentSkillGraphView(): JSX.Element {
  const [selected, setSelected]     = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const activeSessionId = useDesignSessionStore(s => s.activeSessionId);
  const { sendMessageStream }       = useDesignSessionActions();

  const selectedNode = (() => {
    if (!selected) return null;
    if (selected === 'root') return GRAPH_NODES.root;
    for (const cat of GRAPH_NODES.categories) {
      if (cat.id === selected) return { ...cat, isCategory: true };
      const child = cat.children.find(c => c.id === selected);
      if (child) return { ...child, parentColor: cat.color, isChild: true };
    }
    return null;
  })();

  async function generateForNode(nodeId: string, nodeLabel: string) {
    if (!activeSessionId) return;
    await sendMessageStream(activeSessionId, {
      text: `[Content Skill Graph] Generate content for: ${nodeLabel} (node: ${nodeId}). Read the brand voice and platform tone nodes, then produce a platform-native post following the execution instructions in the Command Center.`,
    });
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-secondary)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>

      {/* ── Left: graph canvas ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px', minWidth: 0 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'color-mix(in srgb, var(--accent-primary) 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Graph size={16} color="var(--accent-primary)" weight="fill" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Content Skill Graph</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>Command Center · 10 platforms · 4 engines</div>
            </div>
          </div>
        </div>

        {/* Root node */}
        <GraphNode
          id="root" label={GRAPH_NODES.root.label}
          desc={GRAPH_NODES.root.desc}
          color={GRAPH_NODES.root.color} textColor={GRAPH_NODES.root.textColor}
          selected={selected === 'root'} isRoot
          onClick={() => setSelected(selected === 'root' ? null : 'root')}
        />

        <div style={{ width: 2, height: 20, background: 'var(--border-subtle)', margin: '0 auto' }} />

        {/* Category groups */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {GRAPH_NODES.categories.map(cat => (
            <div key={cat.id}>
              {/* Category header node */}
              <GraphNode
                id={cat.id} label={cat.label} desc={cat.desc}
                color={cat.color} textColor={cat.textColor}
                selected={selected === cat.id}
                isCategory
                onClick={() => {
                  setSelected(selected === cat.id ? null : cat.id);
                  setActiveGroup(activeGroup === cat.id ? null : cat.id);
                }}
              />
              {/* Children */}
              <div style={{ marginLeft: 12, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, borderLeft: `2px solid ${cat.color}30`, paddingLeft: 10 }}>
                {cat.children.map(child => (
                  <button
                    key={child.id}
                    onClick={() => setSelected(selected === child.id ? null : child.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                      borderRadius: 8, border: `1px solid ${selected === child.id ? cat.color + '60' : 'var(--border-subtle)'}`,
                      background: selected === child.id ? cat.color + '10' : 'var(--bg-primary)',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s', width: '100%',
                    }}
                    onMouseEnter={e => { if (selected !== child.id) e.currentTarget.style.borderColor = cat.color + '40'; }}
                    onMouseLeave={e => { if (selected !== child.id) e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                  >
                    <div style={{ color: cat.color, opacity: 0.8, flexShrink: 0 }}>{child.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{child.label}</div>
                      {(child as any).freq && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>{(child as any).freq}</div>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: detail panel ── */}
      <div style={{ width: 260, borderLeft: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {selectedNode ? (
          <>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>{selectedNode.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.65 }}>{selectedNode.desc}</div>
            </div>
            <div style={{ flex: 1, padding: '14px' }}>
              {activeSessionId && (
                <button
                  onClick={() => generateForNode(selected!, selectedNode.label)}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'var(--accent-primary)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                >
                  <Sparkle size={13} weight="fill" /> Generate content
                </button>
              )}
              {!activeSessionId && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>
                  Start a session to generate content for this node.
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, textAlign: 'center' }}>
            <Graph size={28} color="var(--text-tertiary)" weight="duotone" />
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              Select a node to see its description and generate content.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GraphNode({ id, label, desc, color, textColor, selected, isRoot, isCategory, onClick }: {
  id: string; label: string; desc?: string; color: string; textColor: string;
  selected: boolean; isRoot?: boolean; isCategory?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: isRoot ? '100%' : '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: isRoot ? '14px 18px' : '10px 14px',
        borderRadius: isRoot ? 14 : 12,
        border: `1px solid ${selected ? color : color + '40'}`,
        background: selected ? color : color + '15',
        color: selected ? textColor : 'var(--text-primary)',
        cursor: 'pointer', textAlign: 'left',
        transition: 'all 0.15s',
        boxShadow: selected ? `0 4px 14px ${color}30` : 'none',
        marginBottom: isRoot ? 0 : 0,
      }}
    >
      <div style={{ width: isRoot ? 36 : 28, height: isRoot ? 36 : 28, borderRadius: isRoot ? 10 : 8, background: selected ? 'rgba(255,255,255,0.2)' : color + '25', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isRoot ? <Graph size={18} color={selected ? '#fff' : color} weight="fill" /> : <Sparkle size={14} color={selected ? '#fff' : color} />}
      </div>
      <div>
        <div style={{ fontSize: isRoot ? 14 : 12, fontWeight: 700, letterSpacing: '-0.01em' }}>{label}</div>
        {desc && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2, lineHeight: 1.4, maxWidth: 280 }}>{desc.slice(0, 80)}{desc.length > 80 ? '…' : ''}</div>}
      </div>
    </button>
  );
}
