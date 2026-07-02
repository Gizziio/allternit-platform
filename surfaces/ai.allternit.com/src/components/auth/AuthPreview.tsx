'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const SLIDES = [
  {
    id: 'chat',
    label: 'A:// chat',
    desc: 'Talk to any AI model. One clean interface, every conversation.',
    accent: '#6366f1',
    videoUrl: '/videos/canvas-demo.mp4',
    promoKicker: 'Allternit Platform',
    promoTitle: 'One operating layer for every model your team uses.',
    promoCopy: 'Run conversations, artifacts, and agent workflows in a single branded environment instead of scattering work across disconnected tabs and vendor silos.',
    promoNote: 'Designed for teams that want model flexibility, operational control, and a product surface that feels owned instead of rented.',
    promoStats: [
      { value: 'Multi-model', label: 'Claude, OpenAI, Gemini, and open runtimes in one workspace' },
      { value: 'Persistent', label: 'Shared context that carries across sessions, tools, and deliverables' },
      { value: 'Gizzi-led', label: 'A branded AI guide that keeps work coherent from prompt to outcome' },
    ],
    Mockup: ChatMockup,
  },
  {
    id: 'cowork',
    label: 'A:// cowork',
    desc: 'Build artifacts alongside an AI collaborator. Docs, slides, plans — live.',
    accent: '#D97757',
    videoUrl: '/videos/cowork-demo.mp4',
    promoKicker: 'Allternit Workflows',
    promoTitle: 'Move from prompt to polished output without breaking flow.',
    promoCopy: 'Draft strategies, decks, research packs, and operating documents beside an AI collaborator that keeps refining the work as decisions change.',
    promoNote: 'The platform is built to turn rough asks into production-ready artifacts, not just generate another disposable answer.',
    promoStats: [
      { value: 'Live docs', label: 'Artifacts stay editable, reviewable, and connected to the conversation' },
      { value: 'Side-by-side', label: 'Work with AI in the same surface where the deliverable is taking shape' },
      { value: 'Faster cycles', label: 'Less handoff, less copying, fewer dead-end iterations' },
    ],
    Mockup: CoworkMockup,
  },
  {
    id: 'code',
    label: 'A:// code',
    desc: 'Write, review, and ship code with AI at your side. No context switching.',
    accent: '#10b981',
    promoKicker: 'Allternit Code',
    promoTitle: 'Ship with agents that can do real implementation work.',
    promoCopy: 'Give teams a coding surface where AI can write, review, inspect, and iterate inside the product instead of acting like a detached suggestion box.',
    promoNote: 'Built for execution-heavy workflows where code quality, review loops, and environment context actually matter.',
    promoStats: [
      { value: 'Execution', label: 'Agents can move through multi-step tasks instead of stopping at advice' },
      { value: 'Review', label: 'Code suggestions stay close to the implementation and feedback loop' },
      { value: 'Context-aware', label: 'Work happens with infrastructure and project state in view' },
    ],
    Mockup: CodeMockup,
  },
  {
    id: 'browser',
    label: 'A:// browser',
    desc: 'AI that navigates the web, reads pages, and acts on your behalf.',
    accent: '#ec4899',
    promoKicker: 'Allternit Browser',
    promoTitle: 'Give agents a live web surface, not a static summary.',
    promoCopy: 'Research competitors, inspect live pages, and complete browser tasks from the same platform where your team plans, reviews, and acts.',
    promoNote: 'That means better context gathering, cleaner research trails, and fewer manual jumps between tools during execution.',
    promoStats: [
      { value: 'Live navigation', label: 'Browse and inspect active websites without leaving the workflow' },
      { value: 'Research trails', label: 'Keep findings connected to the project instead of buried in tabs' },
      { value: 'Actionable', label: 'Turn web context directly into next steps, decisions, and outputs' },
    ],
    Mockup: BrowserMockup,
  },
];

// ─── Chat mockup ──────────────────────────────────────────────────────────────

function ChatMockup({ accent }: { accent: string }) {
  return (
    <div className="flex flex-col h-full p-[20px_20px_16px]">
      <div className="flex-1 flex flex-col gap-2.5 mb-3.5 overflow-hidden">
        {/* User */}
        <div className="flex justify-end">
          <div className="max-w-[78%] p-[9px_13px] rounded-[14px_14px_3px_14px] bg-[#1A1612] text-[#F5EDE3] text-[12.5px] leading-relaxed">
            Can you analyze this research and write a structured summary?
          </div>
        </div>

        {/* AI */}
        <div className="flex gap-2 items-start">
          <div className="size-6 rounded-full shrink-0 flex items-center justify-center text-[12px] font-extrabold text-[var(--ui-text-primary)] font-mono" style={{ background: accent }}>G</div>
          <div className="max-w-[80%] p-[9px_13px] rounded-[3px_14px_14px_14px] bg-white border border-solid border-black/5 text-[12.5px] leading-relaxed text-[#1A1612]">
            <div className="mb-1 font-semibold">Here&apos;s the structured summary:</div>
            <div style={{ color: accent }}>→ <span className="text-[#4a3628]">Key finding: methodology validated</span></div>
            <div className="text-[var(--status-success)]">→ <span className="text-[#4a3628]">Results: 94% accuracy across trials</span></div>
            <div className="text-[#6366f1]">→ <span className="text-[#4a3628]">Next: expand to larger dataset</span></div>
          </div>
        </div>

        {/* Typing indicator */}
        <div className="flex gap-2 items-center opacity-50">
          <div className="size-6 rounded-full bg-[#e8ddd4] shrink-0" />
          <div className="flex gap-0.5 p-[8px_12px] bg-white rounded-xl border border-solid border-black/5">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                className="size-1 rounded-full bg-[#8a7060]"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-2 items-center p-[9px_12px] rounded-xl bg-white border border-solid border-black/10 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <span className="flex-1 text-[12.5px] text-[#9B8070]">Ask Gizzi anything…</span>
        <div className="size-[26px] rounded-lg flex items-center justify-center shrink-0" style={{ background: accent }}>
          <span className="text-[var(--ui-text-primary)] text-[13px] leading-none">→</span>
        </div>
      </div>
    </div>
  );
}

// ─── Cowork mockup ────────────────────────────────────────────────────────────

function CoworkMockup({ accent }: { accent: string }) {
  return (
    <div className="flex h-full gap-0">
      {/* Left — chat pane */}
      <div className="w-[38%] border-r border-solid border-black/10 flex flex-col p-4">
        <div className="text-[12px] font-bold tracking-wider text-[#9B8070] uppercase mb-3">
          Conversation
        </div>
        <div className="flex flex-col gap-2 flex-1">
          {[
            { user: true, text: 'Write a go-to-market plan' },
            { user: false, text: 'Building your GTM now…' },
          ].map((m, i) => (
            <div key={`${m.text}-${i}`} className={cn(
              "p-[7px_10px] rounded-lg text-[12px] leading-relaxed",
              m.user ? "bg-[#1A1612] text-[#F5EDE3]" : "bg-white text-[#1A1612] border border-solid border-black/5"
            )}>{m.text}</div>
          ))}
        </div>
        <div className="mt-2.5 p-[7px_10px] rounded-lg text-[12px] bg-white border border-solid border-black/10 text-[#9B8070]">Reply…</div>
      </div>

      {/* Right — artifact pane */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="text-[12px] font-bold tracking-wider text-[#9B8070] uppercase mb-3">
          Artifact · GTM Plan
        </div>
        <div className="text-[12.5px] text-[#1A1612] leading-relaxed">
          <div className="font-bold mb-1.5">Go-to-Market Strategy</div>
          <div className="font-semibold mb-1" style={{ color: accent }}>Phase 1 — Positioning</div>
          <div className="text-[#5a4030] mb-2">Define ICP and core value prop across segments…</div>
          <div className="text-[var(--status-success)] font-semibold mb-1">Phase 2 — Channels</div>
          <div className="text-[#5a4030]">Identify top 3 acquisition loops with lowest CAC…</div>
        </div>
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="w-0.5 h-4 mt-1 rounded-sm"
          style={{ background: accent }}
        />
      </div>
    </div>
  );
}

// ─── Code mockup ──────────────────────────────────────────────────────────────

function CodeMockup({ accent }: { accent: string }) {
  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1.5 p-[10px_16px] border-b border-solid border-black/10 bg-black/5">
        {['#ff5f56', '#ffbd2e', '#27c93f'].map((c) => (
          <div key={c} className="size-[9px] rounded-full" style={{ background: c }} />
        ))}
        <div className="ml-2 text-[12.5px] text-[#8a7060] font-mono">agent.ts</div>
      </div>

      {/* Code */}
      <div className="flex-1 p-[14px_16px] font-mono text-[12px] leading-loose overflow-hidden">
        <div><span className="text-[#9b8070]">1 </span><span className="text-[#6366f1]">async function</span> <span style={{ color: accent }}>createAgent</span><span className="text-[#4a3628]">(config: AgentConfig) {'{'}</span></div>
        <div><span className="text-[#9b8070]">2 </span><span className="text-[#4a3628]">  </span><span className="text-[#6366f1]">const</span><span className="text-[#4a3628]"> agent = </span><span className="text-[#6366f1]">await</span><span className="text-[#4a3628]"> Gizzi.spawn(config)</span></div>
        <div><span className="text-[#9b8070]">3 </span><span className="text-[#4a3628]">  </span><span className="text-[#6366f1]">await</span><span className="text-[#4a3628]"> agent.run()</span></div>
        <div><span className="text-[#9b8070]">4 </span><span className="text-[#4a3628]">  </span><span className="text-[#6366f1]">return</span><span className="text-[#4a3628]"> agent.result</span></div>
        <div><span className="text-[#9b8070]">5 </span><span className="text-[#4a3628]">{'}'}</span></div>
      </div>

      {/* AI suggestion */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="m-[0_12px_12px] p-[9px_12px] rounded-lg border border-solid flex items-center gap-2"
        style={{
          background: `color-mix(in srgb, ${accent} 8%, #fff)`,
          borderColor: `color-mix(in srgb, ${accent} 22%, transparent)`,
        }}
      >
        <div className="size-[18px] rounded-md flex items-center justify-center shrink-0" style={{ background: accent }}>
          <span className="text-[var(--ui-text-primary)] text-[12px] font-extrabold">AI</span>
        </div>
        <span className="text-[12px] text-[#1A1612]">Add error handling for network timeouts</span>
        <span className="ml-auto text-[12px] font-semibold cursor-pointer" style={{ color: accent }}>Apply →</span>
      </motion.div>
    </div>
  );
}

// ─── Browser mockup ───────────────────────────────────────────────────────────

function BrowserMockup({ accent }: { accent: string }) {
  return (
    <div className="flex flex-col h-full">
      {/* URL bar */}
      <div className="flex items-center gap-2 p-[10px_14px] border-b border-solid border-black/10 bg-black/5">
        {['←', '→', '⟳'].map((a) => (
          <div key={a} className="text-[12px] text-[#9B8070] cursor-pointer w-4 text-center">{a}</div>
        ))}
        <div className="flex-1 p-[4px_10px] rounded-lg bg-white border border-solid border-black/10 text-[12.5px] text-[#4a3628] font-mono">
          docs.allternit.com/agents
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 p-[14px_16px] relative overflow-hidden">
        <div className="text-[13px] font-bold text-[#1A1612] mb-1.5">Agent Documentation</div>
        <div className="text-[12px] text-[#5a4030] leading-relaxed mb-2.5">
          Gizzi agents are autonomous workers that can execute multi-step tasks, call tools, and report back results without human intervention…
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['Spawning', 'Tools', 'Memory', 'Delegation'].map(tag => (
            <div key={tag} className="p-[3px_9px] rounded-md text-[12px] bg-white border border-solid border-black/10 text-[#5a4030]">{tag}</div>
          ))}
        </div>

        {/* AI action overlay */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="absolute bottom-3 left-3 right-3 p-[10px_13px] rounded-xl bg-[#1A1612] border border-solid shadow-[0_4px_20px_rgba(0,0,0,0.25)] flex items-center gap-2.5"
          style={{
            borderColor: `color-mix(in srgb, ${accent} 30%, transparent)`,
          }}
        >
          <div className="size-[22px] rounded-md shrink-0 flex items-center justify-center text-[12px] font-extrabold text-[var(--ui-text-primary)]" style={{ background: accent }}>G</div>
          <span className="text-[12px] text-[#C4A78A] flex-1">
            Found the agent API docs. Want me to extract the key endpoints?
          </span>
          <div className="p-[4px_10px] rounded-md text-[12px] font-bold text-[var(--ui-text-primary)] cursor-pointer" style={{ background: accent }}>Yes →</div>
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
    <div className="w-full max-w-[580px] flex flex-col gap-4">
      {/* Label + description */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id + '-label'}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-1.5"
        >
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[14px] font-extrabold tracking-tight" style={{ color: slide.accent }}>
              {slide.label}
            </span>
            <div className="flex-1 h-px" style={{ background: `color-mix(in srgb, ${slide.accent} 20%, transparent)` }} />
          </div>
          <p className="text-[13px] text-[#664E3A] leading-relaxed m-0">
            {slide.desc}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Preview card */}
      <div className="h-80 bg-[#F5EDE3] rounded-[20px] border border-solid border-black/5 shadow-[0_40px_100px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden relative">
        {/* Grid */}
        <div 
          className="absolute inset-0 pointer-events-none" 
          style={{
            backgroundImage: 'linear-gradient(rgba(26,22,18,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(26,22,18,0.04) 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }} 
        />

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={slide.id}
            custom={direction}
            initial={{ x: direction * 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -40, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute inset-0 w-full h-full flex items-center justify-center bg-black"
          >
            {slide.videoUrl ? (
              <video
                src={slide.videoUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <slide.Mockup accent={slide.accent} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot nav */}
      <div className="flex justify-center gap-1.5 items-center">
        {SLIDES.map((s, i) => (
          <button type="button"
            key={s.id}
            onClick={() => { setDirection(i > active ? 1 : -1); setActive(i); }}
            className={cn(
              "h-1.5 rounded-full border-none cursor-pointer p-0 transition-all duration-300",
              i === active ? "w-6" : "w-1.5 bg-white/15"
            )}
            style={i === active ? { background: slide.accent } : undefined}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id + '-promo'}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35 }}
          className="rounded-[20px] p-[28px_28px_24px] shadow-[0_28px_80px_rgba(0,0,0,0.34)] border border-solid"
          style={{
            background: `linear-gradient(180deg, color-mix(in srgb, ${slide.accent} 5%, #17120e), #100c09 72%)`,
            borderColor: `color-mix(in srgb, ${slide.accent} 16%, rgba(255,255,255,0.08))`,
          }}
        >
          <div className="flex items-center gap-3 mb-4.5">
            <div className="w-11 h-px" style={{ background: `linear-gradient(90deg, ${slide.accent}, transparent)` }} />
            <span className="text-[12px] tracking-[0.14em] uppercase text-[#A78672] font-bold">
              {slide.promoKicker}
            </span>
          </div>

          <div className="grid gap-4.5">
            <div className="max-w-[500px]">
              <div className="text-[34px] leading-[1.02] tracking-tight text-[#F4E9DE] font-bold">
                {slide.promoTitle}
              </div>
              <p className="mt-3.5 text-[14px] leading-relaxed text-[#A88974] m-0">
                {slide.promoCopy}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-4.5 items-stretch">
              <div className="rounded-2xl p-[18px_18px_16px] bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)]">
                <div className="text-[12px] tracking-[0.12em] uppercase text-[#7F6656] mb-3.5 font-bold">
                  Why teams choose it
                </div>
                <div className="grid gap-3.5">
                  {slide.promoStats.map((item) => (
                    <div key={item.value} className="grid gap-1">
                      <div className="text-[#F0E2D5] text-[15px] font-bold tracking-tight">{item.value}</div>
                      <div className="text-[#8E7361] text-[12.5px] leading-relaxed">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div 
                className="rounded-2xl p-[18px_18px_16px] border border-solid flex flex-col justify-between min-h-[216px]"
                style={{
                  background: `linear-gradient(180deg, color-mix(in srgb, ${slide.accent} 8%, rgba(255,255,255,0.02)), rgba(255,255,255,0.02))`,
                  borderColor: `color-mix(in srgb, ${slide.accent} 16%, rgba(255,255,255,0.06))`,
                }}
              >
                <div>
                  <div className="text-[12px] tracking-[0.12em] uppercase text-[#7F6656] mb-3 font-bold">
                    Branded experience
                  </div>
                  <p className="m-0 text-[13px] leading-relaxed text-[#CDB9AA]">
                    {slide.promoNote}
                  </p>
                </div>

                <div className="mt-4.5 pt-4 border-t border-solid border-[var(--ui-border-muted)] grid gap-2">
                  <div className="text-[#F2E4D6] text-[12px] font-bold leading-snug">Gizzi keeps the product feeling guided, not generic.</div>
                  <div className="text-[#876D5D] text-[12.5px] leading-relaxed">
                    A clearer voice, a stronger brand surface, and a workflow that reads like a finished product.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
