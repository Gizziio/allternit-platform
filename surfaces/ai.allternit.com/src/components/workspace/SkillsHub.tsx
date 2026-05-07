/**
 * Skills Hub Component
 * 
 * UI for managing portable skills across LLM tools.
 */

import React, { useEffect, useState } from 'react';
import { GlassCard } from '../../design/GlassCard';

interface SkillStatus {
  name: string;
  description?: string;
  installations: {
    llm: string;
    installed: boolean;
    path?: string;
  }[];
}

interface SkillsHubProps {
  onSync?: (skillName: string, llms: string[]) => void;
}

export function SkillsHub({ onSync }: SkillsHubProps) {
  const [skills, setSkills] = useState<SkillStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Mock data - in production this would fetch from the API
  useEffect(() => {
    setSkills([
      {
        name: 'code-reviewer',
        description: 'Reviews code for quality and bugs',
        installations: [
          { llm: 'Claude', installed: true },
          { llm: 'Codex', installed: true },
          { llm: 'OpenCode', installed: false },
          { llm: 'Kimi', installed: true },
        ],
      },
      {
        name: 'security-auditor',
        description: 'Security-focused code review',
        installations: [
          { llm: 'Claude', installed: true },
          { llm: 'Codex', installed: false },
          { llm: 'OpenCode', installed: false },
          { llm: 'Kimi', installed: false },
        ],
      },
    ]);
  }, []);

  const handleSync = (skillName: string) => {
    const skill = skills.find((s) => s.name === skillName);
    if (!skill) return;

    const targetLlms = skill.installations
      .filter((i) => !i.installed)
      .map((i) => i.llm);

    if (onSync) {
      onSync(skillName, targetLlms);
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--ui-text-primary)' }}>
          Portable Skills
        </h3>
        <button
          style={{
            padding: '6px 12px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          + Import
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {skills.map((skill) => (
          <GlassCard
            key={skill.name}
            style={{
              padding: 12,
              background: 'var(--surface-panel)',
              border: '1px solid #374151',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--ui-text-primary)',
                    marginBottom: 4,
                  }}
                >
                  {skill.name}
                </div>
                {skill.description && (
                  <div
                    style={{ fontSize: 11, color: 'var(--ui-text-muted)', marginBottom: 8 }}
                  >
                    {skill.description}
                  </div>
                )}
              </div>
            </div>

            {/* LLM Status */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 8,
                flexWrap: 'wrap',
              }}
            >
              {skill.installations.map((inst) => (
                <span
                  key={inst.llm}
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: inst.installed ? '#065f46' : 'var(--ui-border-default)',
                    color: inst.installed ? 'var(--status-success)' : 'var(--ui-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {inst.installed ? '●' : '○'} {inst.llm}
                </span>
              ))}
            </div>

            {/* Sync Button */}
            {skill.installations.some((i) => !i.installed) && (
              <button
                onClick={() => handleSync(skill.name)}
                style={{
                  marginTop: 12,
                  width: '100%',
                  padding: '8px',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Sync to Missing LLMs
              </button>
            )}
          </GlassCard>
        ))}
      </div>

      {skills.length === 0 && !isLoading && (
        <div
          style={{
            textAlign: 'center',
            padding: 32,
            color: 'var(--ui-text-muted)',
            fontSize: 12,
          }}
        >
          No skills configured
        </div>
      )}
    </div>
  );
}
