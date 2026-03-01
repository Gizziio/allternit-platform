import React, { useState } from 'react';
import { Code, MagnifyingGlass, Play, PencilSimple, Trash } from '@phosphor-icons/react';
import { GlassCard } from '../../design/GlassCard';

type SkillMode = 'Network' | 'DOM' | 'API';
type ModeFilter = 'All' | 'Network' | 'DOM' | 'API';

interface Skill {
  id: string;
  name: string;
  description: string;
  modes: SkillMode[];
  lastUsed: string;
  confidence: number;
  status: 'active' | 'inactive';
}

const mockSkills: Skill[] = [
  {
    id: '1',
    name: 'LinkedIn Profile Fetch',
    description: 'Network-based skill for retrieving LinkedIn profile data without direct API access',
    modes: ['Network'],
    lastUsed: '2 hours ago',
    confidence: 92,
    status: 'active'
  },
  {
    id: '2',
    name: 'GitHub Star List',
    description: 'DOM extraction skill for scraping GitHub star counts from repository pages',
    modes: ['DOM'],
    lastUsed: '1 day ago',
    confidence: 88,
    status: 'active'
  },
  {
    id: '3',
    name: 'Twitter Timeline',
    description: 'DOM-based timeline scraper for retrieving recent tweets and engagement metrics',
    modes: ['DOM'],
    lastUsed: '3 days ago',
    confidence: 85,
    status: 'active'
  },
  {
    id: '4',
    name: 'Stripe Checkout',
    description: 'Multi-mode skill combining network requests and API calls for payment processing',
    modes: ['API', 'Network'],
    lastUsed: '5 hours ago',
    confidence: 96,
    status: 'active'
  },
  {
    id: '5',
    name: 'Google Maps Search',
    description: 'Network-based skill for location search and geocoding via HTTP requests',
    modes: ['Network'],
    lastUsed: '30 minutes ago',
    confidence: 91,
    status: 'active'
  },
  {
    id: '6',
    name: 'HackerNews Scraper',
    description: 'DOM extraction skill for parsing HackerNews frontpage stories and comments',
    modes: ['DOM'],
    lastUsed: '4 hours ago',
    confidence: 89,
    status: 'active'
  },
  {
    id: '7',
    name: 'Shopify Product Catalog',
    description: 'Hybrid skill combining DOM scraping and REST API calls for product inventory',
    modes: ['DOM', 'API'],
    lastUsed: '12 hours ago',
    confidence: 87,
    status: 'active'
  },
  {
    id: '8',
    name: 'Slack Thread Reader',
    description: 'Network-based skill for fetching and analyzing Slack conversation threads',
    modes: ['Network'],
    lastUsed: '1 hour ago',
    confidence: 94,
    status: 'active'
  },
  {
    id: '9',
    name: 'Amazon Product Details',
    description: 'DOM extraction skill for scraping product information from Amazon listings',
    modes: ['DOM'],
    lastUsed: '6 hours ago',
    confidence: 86,
    status: 'inactive'
  },
  {
    id: '10',
    name: 'Notion Database Query',
    description: 'API-based skill for querying and updating Notion database properties',
    modes: ['API'],
    lastUsed: '20 minutes ago',
    confidence: 93,
    status: 'active'
  }
];

const getModeColor = (mode: SkillMode): string => {
  switch (mode) {
    case 'Network': return '#4a90fe';
    case 'DOM': return '#673ab7';
    case 'API': return '#34c759';
    default: return '#8e8e93';
  }
};

export function SkillsRegistryView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('All');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  const filteredSkills = mockSkills.filter(skill => {
    const matchesSearch = skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          skill.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMode = modeFilter === 'All' || skill.modes.includes(modeFilter as SkillMode);
    return matchesSearch && matchesMode;
  });

  const stats = {
    total: mockSkills.length,
    network: mockSkills.filter(s => s.modes.includes('Network')).length,
    dom: mockSkills.filter(s => s.modes.includes('DOM')).length,
    api: mockSkills.filter(s => s.modes.includes('API')).length,
    activeToday: mockSkills.filter(s => s.status === 'active' && 
      (s.lastUsed.includes('minute') || s.lastUsed.includes('hour'))).length
  };

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, fontSize: 20, fontWeight: 800, margin: 0 }}>
          <Code size={24} weight="fill" color="var(--accent-primary)" />
          Learned Abilities
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Triple-Mode Skill Registry</p>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Skills" value={stats.total} />
        <StatCard label="Network Mode" value={stats.network} />
        <StatCard label="DOM Mode" value={stats.dom} />
        <StatCard label="Active Today" value={stats.activeToday} />
      </div>

      {/* Mode Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['All', 'Network', 'DOM', 'API'] as ModeFilter[]).map(mode => (
          <button
            key={mode}
            onClick={() => setModeFilter(mode)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: modeFilter === mode ? 'var(--accent-chat)' : 'var(--bg-secondary)',
              color: modeFilter === mode ? 'white' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: 16, position: 'relative' }}>
        <MagnifyingGlass 
          size={16} 
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
        />
        <input
          type="text"
          placeholder="Search skills..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px 8px 36px',
            borderRadius: 8,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontFamily: 'inherit'
          }}
        />
      </div>

      {/* Skills Grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'grid', gap: 12 }}>
          {filteredSkills.map(skill => (
            <GlassCard
              key={skill.id}
              onClick={() => setSelectedSkill(selectedSkill === skill.id ? null : skill.id)}
              style={{
                padding: 16,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: selectedSkill === skill.id ? 'rgba(255, 255, 255, 0.08)' : undefined,
                borderColor: selectedSkill === skill.id ? 'var(--accent-chat)' : undefined
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      {skill.name}
                    </h3>
                    {skill.status === 'active' && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34c759' }} />
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                    {skill.description}
                  </p>

                  {/* Mode Badges */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {skill.modes.map(mode => (
                      <span
                        key={mode}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: `${getModeColor(mode)}20`,
                          color: getModeColor(mode)
                        }}
                      >
                        {mode}
                      </span>
                    ))}
                  </div>

                  {/* Metadata */}
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Last Used
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginTop: 2 }}>
                        {skill.lastUsed}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Confidence
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                        {skill.confidence}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#34c759',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 600
                    }}
                  >
                    <Play size={12} weight="fill" /> Run
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 600
                    }}
                  >
                    <PencilSimple size={12} /> Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 600
                    }}
                  >
                    <Trash size={12} />
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <GlassCard style={{ padding: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </GlassCard>
  );
}
