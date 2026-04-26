import React, { useState } from 'react';
import { Palette, MagnifyingGlass, DownloadSimple, Check, ArrowSquareOut, Sparkle, User, IdentificationCard } from '@phosphor-icons/react';
import { GlassCard } from '../../design/GlassCard';
import { DESIGN_MARKETPLACE, DesignSystem } from '../../lib/design/design-registry';

import { useNav } from '../../nav/useNav';

interface DesignRegistryViewProps {
  onInstall?: (design: DesignSystem) => void;
  installedId?: string;
}

export function DesignRegistryView({ onInstall, installedId }: DesignRegistryViewProps) {
  const { dispatch } = useNav();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleInstall = (design: DesignSystem) => {
    if (onInstall) {
      onInstall(design);
    } else {
      // If used as a standalone full-screen view
      dispatch({
        type: 'PUSH_VIEW',
        viewType: 'allternit-ix' as any,
        viewId: 'allternit-ix',
        context: {
          stream: design.id === 'generative' ? '' : `[v:card title="Installed: ${design.name}" [v:metric label="Status" val="Active" trend="up"]]`,
          designMd: design.id === 'generative' ? 'GENERATIVE_TRIGGER' : design.designMd
        }
      });
    }
  };

  const filteredDesigns = DESIGN_MARKETPLACE.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1E1A16' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 24, fontWeight: 900, margin: 0, color: '#fff', tracking: '-0.02em' }}>
            <Palette size={28} weight="duotone" color="var(--accent-primary)" />
            Hyperdesign Marketplace
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Browse and install Design.md specifications for your agents
          </p>
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent-primary)', background: 'rgba(59,130,246,0.1)', padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(59,130,246,0.2)' }}>
          {DESIGN_MARKETPLACE.length} SYSTEMS AVAILABLE
        </div>
      </div>

      {/* Search & Filter */}
      <div style={{ marginBottom: 24, position: 'relative' }}>
        <MagnifyingGlass 
          size={18} 
          style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}
        />
        <input
          type="text"
          placeholder="Search by brand, vibe, or industry (e.g. 'fintech', 'neon')..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '14px 16px 14px 48px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            color: '#fff',
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(212,176,140,0.4)'}
          onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
        />
      </div>

      {/* Registry Grid */}
      <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          
          {/* Generative AI Design System Option */}
          <GlassCard
            onClick={() => handleInstall({
              id: 'generative',
              name: 'Generate New Design System',
              description: 'Use the AI architect to analyze a URL, extract brand logic, and formulate a new DESIGN.md spec from scratch.',
              vibe: 'Generative AI',
              author: 'Allternit AI',
              installs: 0,
              tags: ['custom', 'generative', 'ai'],
              previewColors: ['#000', '#3b82f6', '#8b5cf6'],
              designMd: ''
            })}
            style={{
              padding: 20,
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              background: 'linear-gradient(145deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1))',
              borderColor: 'var(--accent-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
             <Sparkle size={48} color="var(--accent-primary)" weight="duotone" />
             <div>
               <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#fff' }}>Generate Custom Design System</h3>
               <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 8, lineHeight: 1.5 }}>
                 Extract brand tokens from any URL or instruct the agent to build a new aesthetic from scratch.
               </p>
             </div>
          </GlassCard>

          {filteredDesigns.map(design => {
            const isInstalled = installedId === design.id;
            const isSelected = selectedId === design.id;

            return (
              <GlassCard
                key={design.id}
                onClick={() => setSelectedId(isSelected ? null : design.id)}
                style={{
                  padding: 20,
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: isSelected ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                  borderColor: isSelected ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                  transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16
                }}
              >
                {/* Visual Preview Bar */}
                <div style={{ display: 'flex', height: 40, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                   {design.previewColors.map((c, i) => (
                     <div key={i} style={{ flex: 1, background: c }} />
                   ))}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#fff', tracking: '-0.01em' }}>
                      {design.name}
                    </h3>
                    {isInstalled && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 900, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                        <Check size={10} weight="bold" /> Installed
                      </div>
                    )}
                  </div>
                  
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                    {design.description}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(212,176,140,0.8)', background: 'rgba(212,176,140,0.1)', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                       {design.vibe}
                    </div>
                    {design.tags.map(tag => (
                      <span key={tag} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', textTransform: 'lowercase' }}>
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.3)' }}>
                      <User size={12} />
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{design.author}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.3)' }}>
                      <DownloadSimple size={12} />
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{design.installs.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleInstall(design); }}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'var(--accent-primary)',
                        color: '#000',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 800
                      }}
                    >
                      <DownloadSimple size={14} weight="bold" /> {isInstalled ? 'Update Spec' : 'Install Design.md'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); }}
                      style={{
                        padding: '10px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="View Full Specification"
                    >
                      <ArrowSquareOut size={16} />
                    </button>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default DesignRegistryView;
