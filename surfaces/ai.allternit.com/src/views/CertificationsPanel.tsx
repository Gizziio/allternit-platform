/**
 * CertificationsPanel
 *
 * Displays user's A://Labs course certifications/badges.
 * Uses the Allternit design system: GlassCard, GlassSurface, Text, Fade, Stagger.
 */

import React, { useEffect, useState } from 'react';
import { Award, CheckCircle, ExternalLink, Layers, BarChart3, Rocket, Loader2 } from 'lucide-react';
import { GlassCardInteractive } from '@/design/glass/GlassCard';
import { GlassSurface, GlassSurfaceThin } from '@/design/glass/GlassSurface';
import { Fade } from '@/design/animation/Fade';
import { Stagger } from '@/design/animation/Stagger';
import { Text } from '@/components/typography/Text';

interface Certification {
  id: string;
  courseCode: string;
  courseTitle: string;
  tier: 'CORE' | 'OPS' | 'AGENTS' | 'ADV' | string;
  completedAt: string;
  capstoneUrl?: string;
  score?: number;
  verified: boolean;
}

function getTierColor(tier: string) {
  switch (tier) {
    case 'CORE': return 'var(--status-info)';
    case 'OPS': return '#8b5cf6';
    case 'AGENTS': return '#ec4899';
    case 'ADV': return 'var(--status-warning)';
    default: return 'var(--ui-text-muted)';
  }
}

function getTierIcon(tier: string) {
  switch (tier) {
    case 'CORE': return Layers;
    case 'OPS': return BarChart3;
    case 'AGENTS': return Rocket;
    default: return Award;
  }
}

export function CertificationsPanel() {
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/certifications')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load certifications');
        return res.json();
      })
      .then((data: Certification[]) => {
        setCerts(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <GlassSurfaceBase style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12 }}>
        <Loader2 size={20} className="animate-spin" color="var(--accent-primary)" />
        <Text variant="body" style={{ color: 'var(--text-muted, #a1a1aa)' }}>Loading certifications...</Text>
      </GlassSurfaceBase>
    );
  }

  if (error) {
    return (
      <GlassSurfaceBase style={{ padding: 24, border: '1px solid var(--status-error)' }}>
        <Text variant="body" style={{ color: 'var(--destructive, #ef4444)' }}>{error}</Text>
        <Text variant="caption" style={{ color: 'var(--text-muted, #a1a1aa)', marginTop: 8 }}>
          Certifications are stored locally in your Allternit database.
        </Text>
      </GlassSurfaceBase>
    );
  }

  const byTier: Record<string, Certification[]> = {
    CORE: [],
    OPS: [],
    AGENTS: [],
    ADV: [],
    OTHER: [],
  };

  for (const cert of certs) {
    const bucket = ['CORE', 'OPS', 'AGENTS', 'ADV'].includes(cert.tier) ? cert.tier : 'OTHER';
    byTier[bucket].push(cert);
  }

  return (
    <Fade in direction="up" distance={20}>
      <div style={{ padding: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={22} color="#fff" />
          </div>
          <div>
            <Text variant="heading" as="h2" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Your A://Labs Certifications</Text>
            <Text variant="body" style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #a1a1aa)' }}>
              {certs.length} course{certs.length === 1 ? '' : 's'} completed
            </Text>
          </div>
        </div>

        {certs.length === 0 && (
          <GlassSurfaceBase style={{ padding: 32, textAlign: 'center', border: '1px dashed var(--border-subtle, #27272a)' }}>
            <Award size={40} color="#52525b" style={{ marginBottom: 12 }} />
            <Text variant="subheading" as="h3" style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500 }}>No certifications yet</Text>
            <Text variant="body" style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #a1a1aa)' }}>
              Enroll in A://Labs tracks and complete capstones to earn badges.
            </Text>
          </GlassSurfaceBase>
        )}

        <Stagger staggerDelay={0.08} direction="up" distance={16}>
          {(['CORE', 'OPS', 'AGENTS', 'ADV', 'OTHER'] as const).map((tier) => {
            const tierCerts = byTier[tier];
            if (tierCerts.length === 0) return null;
            const TierIcon = getTierIcon(tier);
            const tierColor = getTierColor(tier);
            return (
              <div key={tier} style={{ marginBottom: 24 }}>
                <GlassSurfaceThin
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 12,
                    padding: '10px 14px',
                    background: `${tierColor}10`,
                    border: `1px solid ${tierColor}33`,
                    borderRadius: 8,
                  }}
                >
                  <TierIcon size={18} color={tierColor} />
                  <Text variant="subheading" style={{ fontSize: 14, fontWeight: 600, color: tierColor }}>
                    {tier === 'ADV' ? 'Advanced' : tier === 'OTHER' ? 'Other' : `${tier} Tier`}
                  </Text>
                  <Text variant="caption" style={{ fontSize: 12, color: 'var(--text-muted, #a1a1aa)', marginLeft: 'auto' }}>
                    {tierCerts.length} badge{tierCerts.length === 1 ? '' : 's'}
                  </Text>
                </GlassSurfaceThin>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {tierCerts.map((cert) => (
                    <GlassCardInteractive
                      key={cert.id}
                      hover="lift"
                      elevation="raised"
                      border="subtle"
                      blur="md"
                      style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: `${tierColor}22`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <CheckCircle size={18} color={tierColor} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text variant="subheading" style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                            {cert.courseTitle}
                          </Text>
                          <Text variant="caption" style={{ fontSize: 11, color: 'var(--text-muted, #a1a1aa)' }}>{cert.courseCode}</Text>
                        </div>
                        {cert.verified && (
                          <GlassSurfaceThin style={{
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: '#22c55e22',
                            border: '1px solid #22c55e44',
                          }}>
                            <Text variant="label" style={{ fontSize: 10, fontWeight: 700, color: 'var(--status-success)', textTransform: 'uppercase' }}>Verified</Text>
                          </GlassSurfaceThin>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted, #a1a1aa)' }}>
                        <Text variant="caption">Completed {new Date(cert.completedAt).toLocaleDateString()}</Text>
                        {cert.score != null && <Text variant="caption">Score: {cert.score}%</Text>}
                      </div>

                      {cert.capstoneUrl && (
                        <a
                          href={cert.capstoneUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12,
                            color: tierColor,
                            textDecoration: 'none',
                          }}
                        >
                          <ExternalLink size={14} />
                          <Text variant="caption" style={{ color: tierColor, fontWeight: 500 }}>View capstone</Text>
                        </a>
                      )}
                    </GlassCardInteractive>
                  ))}
                </div>
              </div>
            );
          })}
        </Stagger>
      </div>
    </Fade>
  );
}
