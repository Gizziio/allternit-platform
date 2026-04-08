import React, { useState, useEffect } from 'react';
import { apiRequest, API_BASE_URL } from '@/lib/agents/api-config';
import { Wrench, Brain, User, Terminal, Play, Pause, SkipBack, SkipForward, CaretLeft, CaretRight, Clock } from '@phosphor-icons/react';
import { GlassCard } from '../../design/GlassCard';

type StepType = 'tool_call' | 'llm_response' | 'human_message' | 'system_log';

interface ReplayStep {
  id: number;
  type: StepType;
  timestamp: string;
  duration: number;
  title: string;
  preview: string;
  content: any;
  expanded?: boolean;
}

// Session replay steps are loaded from the backend — no static data

const getStepIcon = (type: StepType) => {
  switch (type) {
    case 'tool_call': return Wrench;
    case 'llm_response': return Brain;
    case 'human_message': return User;
    case 'system_log': return Terminal;
  }
};

const getStepColor = (type: StepType): string => {
  switch (type) {
    case 'tool_call': return '#4a90fe';
    case 'llm_response': return '#9d4edd';
    case 'human_message': return '#3a86ff';
    case 'system_log': return '#ffa500';
  }
};

const getStepLabel = (type: StepType): string => {
  switch (type) {
    case 'tool_call': return 'Tool Call';
    case 'llm_response': return 'LLM Response';
    case 'human_message': return 'User Message';
    case 'system_log': return 'System Log';
  }
};

export function RunReplayView() {
  const [steps, setSteps] = useState<ReplayStep[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStepId, setActiveStepId] = useState(1);
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // TODO: wire sessionId from router/store when replay backend is available
    apiRequest<{ steps: ReplayStep[] }>(`${API_BASE_URL}/sessions/replay`, { method: 'POST', body: JSON.stringify({}) })
      .then(({ steps: loaded }) => { setSteps(loaded); if (loaded.length > 0) setActiveStepId(loaded[0].id); })
      .catch(() => {});
  }, []);

  const activeStep = steps.find(s => s.id === activeStepId);
  const totalDuration = steps.reduce((sum, s) => sum + s.duration, 0);
  const totalTokens = steps
    .filter(s => s.type === 'llm_response' && s.content.tokens)
    .reduce((sum, s) => sum + s.content.tokens.input + s.content.tokens.output, 0);

  const toggleExpanded = (stepId: number) => {
    setExpandedSteps(prev => 
      prev.includes(stepId) ? prev.filter(id => id !== stepId) : [...prev, stepId]
    );
  };

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', gap: 20, overflow: 'hidden' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Clock size={24} weight="fill" color="var(--accent-primary)" />
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Run Replay</h2>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
          Session run-2025-02-26-001 · Duration: {(totalDuration / 1000).toFixed(2)}s
        </div>
      </div>

      {/* Playback Controls */}
      <GlassCard style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button
            onClick={() => setActiveStepId(Math.max(1, activeStepId - 5))}
            style={{ padding: 6, border: 'none', background: 'var(--bg-secondary)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <CaretLeft size={16} weight="fill" />
          </button>
          <button
            onClick={() => setActiveStepId(Math.max(1, activeStepId - 1))}
            style={{ padding: 6, border: 'none', background: 'var(--bg-secondary)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <SkipBack size={16} weight="fill" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              padding: 6,
              border: 'none',
              background: 'var(--accent-primary)',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'white',
              fontWeight: 700
            }}
          >
            {isPlaying ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
          </button>
          <button
            onClick={() => setActiveStepId(Math.min(steps.length, activeStepId + 1))}
            style={{ padding: 6, border: 'none', background: 'var(--bg-secondary)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <SkipForward size={16} weight="fill" />
          </button>
          <button
            onClick={() => setActiveStepId(Math.min(steps.length, activeStepId + 5))}
            style={{ padding: 6, border: 'none', background: 'var(--bg-secondary)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <CaretRight size={16} weight="fill" />
          </button>

          {/* Progress Scrubber */}
          <input
            type="range"
            min="1"
            max={steps.length}
            value={activeStepId}
            onChange={(e) => setActiveStepId(parseInt(e.target.value))}
            style={{ flex: 1, cursor: 'pointer' }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', minWidth: 40 }}>
            {activeStepId}/{steps.length}
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', height: 4, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              background: 'var(--accent-primary)',
              width: `${(activeStepId / steps.length) * 100}%`,
              transition: 'width 0.3s ease'
            }}
          />
        </div>
      </GlassCard>

      {/* Main Content - Timeline and Details */}
      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
        {/* Timeline */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Execution Timeline
          </h3>
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {steps.map(step => {
              const Icon = getStepIcon(step.type);
              const isActive = step.id === activeStepId;
              const isExpanded = expandedSteps.includes(step.id);

              return (
                <div key={step.id}>
                  <GlassCard
                    onClick={() => setActiveStepId(step.id)}
                    style={{
                      padding: 12,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: isActive ? 'rgba(255, 255, 255, 0.08)' : undefined,
                      borderColor: isActive ? 'var(--accent-primary)' : undefined
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div
                        style={{
                          minWidth: 28,
                          height: 28,
                          borderRadius: 6,
                          background: `${getStepColor(step.type)}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: 2
                        }}
                      >
                        <Icon size={14} color={getStepColor(step.type)} weight="fill" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {step.title}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                              {step.preview}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', minWidth: 'fit-content' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                              {step.timestamp}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                              {step.duration}ms
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(step.id);
                          }}
                          style={{
                            marginTop: 8,
                            padding: '4px 8px',
                            fontSize: 10,
                            fontWeight: 600,
                            color: 'var(--accent-chat)',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          {isExpanded ? '▼ Collapse' : '▶ Expand'}
                        </button>
                      </div>
                    </div>
                  </GlassCard>

                  {isExpanded && (
                    <GlassCard style={{ padding: 12, marginLeft: 8, marginTop: 4, background: 'rgba(255, 255, 255, 0.04)' }}>
                      <pre style={{
                        fontSize: 10,
                        fontFamily: 'JetBrains Mono, monospace',
                        color: 'var(--text-secondary)',
                        margin: 0,
                        overflow: 'auto',
                        maxHeight: 120,
                        padding: 8,
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: 4
                      }}>
                        {JSON.stringify(step.content, null, 2)}
                      </pre>
                    </GlassCard>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Detail Panel */}
        <div style={{ width: 280, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Step Detail
          </h3>
          <GlassCard style={{ flex: 1, padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {activeStep ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      background: `${getStepColor(activeStep.type)}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {React.createElement(getStepIcon(activeStep.type), { size: 14, color: getStepColor(activeStep.type), weight: 'fill' })}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>
                      {getStepLabel(activeStep.type)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {activeStep.title}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
                    Timing
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <strong>Timestamp:</strong> {activeStep.timestamp}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    <strong>Duration:</strong> {activeStep.duration}ms
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
                    Content
                  </div>
                  <pre style={{
                    fontSize: 9,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--text-secondary)',
                    margin: 0,
                    padding: 8,
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: 4,
                    overflow: 'auto',
                    maxHeight: '100%'
                  }}>
                    {JSON.stringify(activeStep.content, null, 2)}
                  </pre>
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                Select a step to view details
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Stats Footer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatItem label="Total Steps" value={steps.length.toString()} />
        <StatItem label="Total Tokens" value={totalTokens.toString()} />
        <StatItem label="Elapsed Time" value={`${(totalDuration / 1000).toFixed(2)}s`} />
        <StatItem label="Tool Calls" value={steps.filter(s => s.type === 'tool_call').length.toString()} />
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard style={{ padding: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </GlassCard>
  );
}
