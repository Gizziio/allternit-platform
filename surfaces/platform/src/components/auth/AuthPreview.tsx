'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SLIDES = [
  {
    id: 'chat',
    label: 'A:// chat',
    desc: 'Talk to any AI model. One clean interface, every conversation.',
    accent: '#6366f1',
    Mockup: ChatMockup,
  },
  {
    id: 'cowork',
    label: 'A:// cowork',
    desc: 'Build artifacts alongside an AI collaborator. Docs, slides, plans — live.',
    accent: '#D97757',
    Mockup: CoworkMockup,
  },
  {
    id: 'code',
    label: 'A:// code',
    desc: 'Write, review, and ship code with AI at your side. No context switching.',
    accent: '#10b981',
    Mockup: CodeMockup,
  },
  {
    id: 'browser',
    label: 'A:// browser',
    desc: 'AI that navigates the web, reads pages, and acts on your behalf.',
    accent: '#ec4899',
    Mockup: BrowserMockup,
  },
];

// ─── Chat mockup ──────────────────────────────────────────────────────────────

function ChatMockup({ accent }: { accent: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 20px 16px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14, overflowY: 'hidden' }}>
        {/* User */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{
            maxWidth: '78%', padding: '9px 13px',
            borderRadius: '14px 14px 3px 14px',
            background: '#1A1612', color: '#F5EDE3',
            fontSize: 11.5, lineHeight: 1.55,
          }}>
            Can you analyze this research and write a structured summary?
          </div>
        </div>

        {/* AI */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', background: accent,
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 800, color: '#fff', fontFamily: 'monospace',
          }}>G</div>
          <div style={{
            maxWidth: '80%', padding: '9px 13px',
            borderRadius: '3px 14px 14px 14px',
            background: '#fff', border: '1px solid rgba(0,0,0,0.07)',
            fontSize: 11.5, lineHeight: 1.6, color: '#1A1612',
          }}>
            <div style={{ marginBottom: 4, fontWeight: 600 }}>Here&apos;s the structured summary:</div>
            <div style={{ color: accent }}>→ <span style={{ color: '#4a3628' }}>Key finding: methodology validated</span></div>
            <div style={{ color: '#10b981' }}>→ <span style={{ color: '#4a3628' }}>Results: 94% accuracy across trials</span></div>
            <div style={{ color: '#6366f1' }}>→ <span style={{ color: '#4a3628' }}>Next: expand to larger dataset</span></div>
          </div>
        </div>

        {/* Typing indicator */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: 0.5 }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', background: '#e8ddd4',
            flexShrink: 0,
          }} />
          <div style={{ display: 'flex', gap: 3, padding: '8px 12px', background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.07)' }}>
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                style={{ width: 5, height: 5, borderRadius: '50%', background: '#8a7060' }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        padding: '9px 12px', borderRadius: 12,
        background: '#fff', border: '1px solid rgba(0,0,0,0.1)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <span style={{ flex: 1, fontSize: 11.5, color: '#9B8070' }}>Ask Gizzi anything…</span>
        <div style={{
          width: 26, height: 26, borderRadius: 8, background: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ color: '#fff', fontSize: 13, lineHeight: 1 }}>→</span>
        </div>
      </div>
    </div>
  );
}

// ─── Cowork mockup ────────────────────────────────────────────────────────────

function CoworkMockup({ accent }: { accent: string }) {
  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      {/* Left — chat pane */}
      <div style={{
        width: '38%', borderRight: '1px solid rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column', padding: '16px 14px',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#9B8070', textTransform: 'uppercase', marginBottom: 12 }}>
          Conversation
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          {[
            { user: true, text: 'Write a go-to-market plan' },
            { user: false, text: 'Building your GTM now…' },
          ].map((m, i) => (
            <div key={i} style={{
              padding: '7px 10px', borderRadius: 10, fontSize: 11,
              background: m.user ? '#1A1612' : '#fff',
              color: m.user ? '#F5EDE3' : '#1A1612',
              border: m.user ? 'none' : '1px solid rgba(0,0,0,0.07)',
              lineHeight: 1.5,
            }}>{m.text}</div>
          ))}
        </div>
        <div style={{
          marginTop: 10, padding: '7px 10px', borderRadius: 10, fontSize: 11,
          background: '#fff', border: '1px solid rgba(0,0,0,0.1)', color: '#9B8070',
        }}>Reply…</div>
      </div>

      {/* Right — artifact pane */}
      <div style={{ flex: 1, padding: '16px 14px', overflowY: 'hidden' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#9B8070', textTransform: 'uppercase', marginBottom: 12 }}>
          Artifact · GTM Plan
        </div>
        <div style={{ fontSize: 11.5, color: '#1A1612', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Go-to-Market Strategy</div>
          <div style={{ color: accent, fontWeight: 600, marginBottom: 3, fontSize: 10.5 }}>Phase 1 — Positioning</div>
          <div style={{ color: '#5a4030', marginBottom: 8, fontSize: 10.5 }}>Define ICP and core value prop across segments…</div>
          <div style={{ color: '#10b981', fontWeight: 600, marginBottom: 3, fontSize: 10.5 }}>Phase 2 — Channels</div>
          <div style={{ color: '#5a4030', fontSize: 10.5 }}>Identify top 3 acquisition loops with lowest CAC…</div>
        </div>
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ width: 2, height: 16, background: accent, marginTop: 4, borderRadius: 1 }}
        />
      </div>
    </div>
  );
}

// ─── Code mockup ──────────────────────────────────────────────────────────────

function CodeMockup({ accent }: { accent: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 16px',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        background: 'rgba(0,0,0,0.02)',
      }}>
        {['●', '●', '●'].map((d, i) => (
          <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: ['#ff5f56','#ffbd2e','#27c93f'][i] }} />
        ))}
        <div style={{ marginLeft: 8, fontSize: 10.5, color: '#8a7060', fontFamily: 'monospace' }}>agent.ts</div>
      </div>

      {/* Code */}
      <div style={{ flex: 1, padding: '14px 16px', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.75, overflowY: 'hidden' }}>
        <div><span style={{ color: '#9b8070' }}>1 </span><span style={{ color: '#6366f1' }}>async function</span> <span style={{ color: accent }}>createAgent</span><span style={{ color: '#4a3628' }}>(config: AgentConfig) {'{'}</span></div>
        <div><span style={{ color: '#9b8070' }}>2 </span><span style={{ color: '#4a3628' }}>  </span><span style={{ color: '#6366f1' }}>const</span><span style={{ color: '#4a3628' }}> agent = </span><span style={{ color: '#6366f1' }}>await</span><span style={{ color: '#4a3628' }}> Gizzi.spawn(config)</span></div>
        <div><span style={{ color: '#9b8070' }}>3 </span><span style={{ color: '#4a3628' }}>  </span><span style={{ color: '#6366f1' }}>await</span><span style={{ color: '#4a3628' }}> agent.run()</span></div>
        <div><span style={{ color: '#9b8070' }}>4 </span><span style={{ color: '#4a3628' }}>  </span><span style={{ color: '#6366f1' }}>return</span><span style={{ color: '#4a3628' }}> agent.result</span></div>
        <div><span style={{ color: '#9b8070' }}>5 </span><span style={{ color: '#4a3628' }}>{'}'}</span></div>
      </div>

      {/* AI suggestion */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        style={{
          margin: '0 12px 12px',
          padding: '9px 12px', borderRadius: 10,
          background: `color-mix(in srgb, ${accent} 8%, #fff)`,
          border: `1px solid color-mix(in srgb, ${accent} 22%, transparent)`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: 5, background: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ color: '#fff', fontSize: 9, fontWeight: 800 }}>AI</span>
        </div>
        <span style={{ fontSize: 11, color: '#1A1612' }}>Add error handling for network timeouts</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: accent, fontWeight: 600, cursor: 'pointer' }}>Apply →</span>
      </motion.div>
    </div>
  );
}

// ─── Browser mockup ───────────────────────────────────────────────────────────

function BrowserMockup({ accent }: { accent: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* URL bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        background: 'rgba(0,0,0,0.02)',
      }}>
        {['←', '→', '⟳'].map((a, i) => (
          <div key={i} style={{ fontSize: 11, color: '#9B8070', cursor: 'pointer', width: 16, textAlign: 'center' }}>{a}</div>
        ))}
        <div style={{
          flex: 1, padding: '4px 10px', borderRadius: 8,
          background: '#fff', border: '1px solid rgba(0,0,0,0.1)',
          fontSize: 10.5, color: '#4a3628', fontFamily: 'monospace',
        }}>
          docs.allternit.com/agents
        </div>
      </div>

      {/* Page content */}
      <div style={{ flex: 1, padding: '14px 16px', position: 'relative', overflowY: 'hidden' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1612', marginBottom: 6 }}>Agent Documentation</div>
        <div style={{ fontSize: 11, color: '#5a4030', lineHeight: 1.65, marginBottom: 10 }}>
          Gizzi agents are autonomous workers that can execute multi-step tasks, call tools, and report back results without human intervention…
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Spawning', 'Tools', 'Memory', 'Delegation'].map(tag => (
            <div key={tag} style={{
              padding: '3px 9px', borderRadius: 6, fontSize: 10,
              background: '#fff', border: '1px solid rgba(0,0,0,0.1)', color: '#5a4030',
            }}>{tag}</div>
          ))}
        </div>

        {/* AI action overlay */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            position: 'absolute', bottom: 12, left: 12, right: 12,
            padding: '10px 13px', borderRadius: 12,
            background: '#1A1612',
            border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
            boxShadow: `0 4px 20px rgba(0,0,0,0.25)`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: 6, background: accent, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 800, color: '#fff',
          }}>G</div>
          <span style={{ fontSize: 11, color: '#C4A78A', flex: 1 }}>
            Found the agent API docs. Want me to extract the key endpoints?
          </span>
          <div style={{
            padding: '4px 10px', borderRadius: 7, background: accent,
            fontSize: 10, fontWeight: 700, color: '#fff', cursor: 'pointer',
          }}>Yes →</div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AuthPreview() {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const t = setInterval(() => {
      setDirection(1);
      setActive(i => (i + 1) % SLIDES.length);
    }, 6000);
    return () => clearInterval(t);
  }, []);

  const slide = SLIDES[active];

  return (
    <div style={{ width: '100%', maxWidth: 580, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Label + description */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id + '-label'}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.3 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 5 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontFamily: 'monospace', fontSize: 14, fontWeight: 800,
              color: slide.accent, letterSpacing: '-0.01em',
            }}>
              {slide.label}
            </span>
            <div style={{ flex: 1, height: 1, background: `color-mix(in srgb, ${slide.accent} 20%, transparent)` }} />
          </div>
          <p style={{ fontSize: 13, color: '#664E3A', lineHeight: 1.55, margin: 0 }}>
            {slide.desc}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Preview card */}
      <div style={{
        background: '#F5EDE3',
        borderRadius: 20,
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 40px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        overflow: 'hidden',
        position: 'relative',
        height: 320,
      }}>
        {/* Grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: [
            'linear-gradient(rgba(26,22,18,0.04) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(26,22,18,0.04) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: '30px 30px',
        }} />

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={slide.id}
            custom={direction}
            initial={{ x: direction * 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -40, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ position: 'absolute', inset: 0 }}
          >
            <slide.Mockup accent={slide.accent} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot nav */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 7, alignItems: 'center' }}>
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => { setDirection(i > active ? 1 : -1); setActive(i); }}
            style={{
              width: i === active ? 24 : 7,
              height: 7, borderRadius: 4, border: 'none', cursor: 'pointer', padding: 0,
              background: i === active ? slide.accent : 'rgba(255,255,255,0.15)',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}
