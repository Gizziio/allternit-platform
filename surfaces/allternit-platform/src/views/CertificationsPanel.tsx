/**
 * CertificationsPanel
 *
 * Displays user's A://Labs course certifications/badges.
 */

import React, { useEffect, useState } from 'react';
import { Award, CheckCircle, ExternalLink, Layers, BarChart3, Rocket, Loader2 } from 'lucide-react';

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
    case 'CORE': return '#3b82f6';
    case 'OPS': return '#8b5cf6';
    case 'AGENTS': return '#ec4899';
    case 'ADV': return '#f59e0b';
    default: return '#6b7280';
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12, color: 'var(--text-muted, #a1a1aa)' }}>
        <Loader2 size={20} className="animate-spin" />
        <span>Loading certifications...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: 'var(--destructive, #ef4444)', background: 'var(--bg-secondary, #111113)', borderRadius: 8 }}>
        <p>{error}</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted, #a1a1aa)', marginTop: 8 }}>
          Certifications are stored locally in your Allternit database.
        </p>
      </div>
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
    <div style={{ padding: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Award size={22} color="#fff" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Your A://Labs Certifications</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #a1a1aa)' }}>
            {certs.length} course{certs.length === 1 ? '' : 's'} completed
          </p>
        </div>
      </div>

      {certs.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', background: 'var(--bg-secondary, #111113)', borderRadius: 10, border: '1px dashed var(--border-subtle, #27272a)' }}>
          <Award size={40} color="#52525b" style={{ marginBottom: 12 }} />
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500 }}>No certifications yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #a1a1aa)' }}>
            Enroll in A://Labs tracks and complete capstones to earn badges.
          </p>
        </div>
      )}

      {(['CORE', 'OPS', 'AGENTS', 'ADV', 'OTHER'] as const).map((tier) => {
        const tierCerts = byTier[tier];
        if (tierCerts.length === 0) return null;
        const TierIcon = getTierIcon(tier);
        return (
          <div key={tier} style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
              padding: '10px 14px',
              background: 'var(--bg-secondary, #111113)',
              border: `1px solid ${getTierColor(tier)}33`,
              borderRadius: 8,
            }}>
              <TierIcon size={18} color={getTierColor(tier)} />
              <span style={{ fontSize: 14, fontWeight: 600, color: getTierColor(tier) }}>
                {tier === 'ADV' ? 'Advanced' : tier === 'OTHER' ? 'Other' : `${tier} Tier`}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted, #a1a1aa)', marginLeft: 'auto' }}>
                {tierCerts.length} badge{tierCerts.length === 1 ? '' : 's'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {tierCerts.map((cert) => (
                <div
                  key={cert.id}
                  style={{
                    background: 'var(--bg-secondary, #111113)',
                    border: '1px solid var(--border-subtle, #27272a)',
                    borderRadius: 10,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: `${getTierColor(cert.tier)}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <CheckCircle size={18} color={getTierColor(cert.tier)} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cert.courseTitle}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted, #a1a1aa)' }}>{cert.courseCode}</div>
                    </div>
                    {cert.verified && (
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        background: '#22c55e22',
                        color: '#22c55e',
                        textTransform: 'uppercase',
                      }}>Verified</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted, #a1a1aa)' }}>
                    <span>Completed {new Date(cert.completedAt).toLocaleDateString()}</span>
                    {cert.score != null && <span>Score: {cert.score}%</span>}
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
                        color: getTierColor(cert.tier),
                        textDecoration: 'none',
                      }}
                    >
                      <ExternalLink size={14} />
                      <span>View capstone</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
