'use client';

import React from 'react';

// =============================================================================
// CHAT MODE MOCKUP
// =============================================================================

export function ChatMockup() {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex-1 space-y-3">
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-white/[0.08] px-3 py-2 text-[10px] leading-relaxed text-white/70">
            Analyze this research and write a summary
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D97757] text-[7px] font-bold text-white">
            G
          </div>
          <div className="max-w-[85%] space-y-1.5 rounded-2xl rounded-bl-sm border border-white/[0.06] bg-white/[0.04] px-3 py-2">
            <div className="text-[10px] font-medium text-white/80">Here's the summary:</div>
            <div className="text-[9px] text-white/40">→ Key finding: methodology validated</div>
            <div className="text-[9px] text-white/40">→ Results: 94% accuracy across trials</div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
        <span className="text-[10px] text-white/20">Ask Gizzi anything…</span>
        <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-md bg-[#D97757]">
          <span className="text-[10px] text-white">→</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// CODE MODE MOCKUP
// =============================================================================

export function CodeMockup() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-3 py-2">
        {['#ff5f56', '#ffbd2e', '#27c93f'].map((c) => (
          <div key={c} className="h-2 w-2 rounded-full" style={{ background: c }} />
        ))}
        <span className="ml-2 text-[9px] text-white/30">agent.ts</span>
      </div>
      <div className="flex-1 space-y-1.5 p-3 font-mono text-[9px] leading-relaxed">
        <div>
          <span className="text-purple-400/80">async function</span>{' '}
          <span className="text-[#D97757]">createAgent</span>
          <span className="text-white/50">(config) {'{'}</span>
        </div>
        <div>
          <span className="text-white/30">1</span>{' '}
          <span className="text-white/50">{'  '}const agent = </span>
          <span className="text-purple-400/80">await</span>
          <span className="text-white/50"> Gizzi.spawn(config)</span>
        </div>
        <div>
          <span className="text-white/30">2</span>{' '}
          <span className="text-white/50">{'  '}await agent.run()</span>
        </div>
        <div>
          <span className="text-white/30">3</span>{' '}
          <span className="text-white/50">{'  '}</span>
          <span className="text-purple-400/80">return</span>
          <span className="text-white/50"> agent.result</span>
        </div>
        <div>
          <span className="text-white/50">{'}'}</span>
        </div>
      </div>
      <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-[#D97757]/10 bg-[#D97757]/5 px-3 py-2">
        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#D97757] text-[7px] font-bold text-white">
          AI
        </div>
        <span className="text-[9px] text-white/50">Add error handling for network timeouts</span>
        <span className="ml-auto text-[8px] font-semibold text-[#D97757]">Apply →</span>
      </div>
    </div>
  );
}

// =============================================================================
// COWORK MODE MOCKUP
// =============================================================================

export function CoworkMockup() {
  return (
    <div className="flex h-full">
      <div className="w-[40%] border-r border-white/[0.06] p-3">
        <div className="mb-2 text-[8px] font-bold uppercase tracking-wider text-white/20">
          Conversation
        </div>
        <div className="space-y-2">
          <div className="rounded-lg bg-white/[0.08] px-2.5 py-1.5 text-[9px] text-white/70">
            Write a go-to-market plan
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[9px] text-white/50">
            Building your GTM now…
          </div>
        </div>
      </div>
      <div className="flex-1 p-3">
        <div className="mb-2 text-[8px] font-bold uppercase tracking-wider text-white/20">
          Artifact · GTM Plan
        </div>
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-white/80">Go-to-Market Strategy</div>
          <div className="text-[9px] font-medium text-[#D97757]/80">Phase 1 — Positioning</div>
          <div className="text-[9px] text-white/30">Define ICP and core value prop…</div>
          <div className="text-[9px] font-medium text-emerald-400/80">Phase 2 — Channels</div>
          <div className="text-[9px] text-white/30">Identify top 3 acquisition loops…</div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// BROWSER MODE MOCKUP
// =============================================================================

export function BrowserMockup() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
        {['←', '→', '↻'].map((a) => (
          <span key={a} className="text-[10px] text-white/20">{a}</span>
        ))}
        <div className="ml-1 flex-1 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[9px] text-white/40">
          docs.allternit.com/agents
        </div>
      </div>
      <div className="relative flex-1 p-3">
        <div className="mb-2 text-[11px] font-semibold text-white/80">Agent Documentation</div>
        <div className="mb-3 text-[9px] leading-relaxed text-white/30">
          Gizzi agents are autonomous workers that can execute multi-step tasks, call tools, and report back results…
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['Spawning', 'Tools', 'Memory', 'Delegation'].map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[8px] text-white/30"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl border border-[#D97757]/15 bg-[#0F0C0A]/90 px-3 py-2 backdrop-blur-sm">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#D97757] text-[7px] font-bold text-white">
            G
          </div>
          <span className="text-[9px] text-white/50">Found the agent API docs. Want me to extract the key endpoints?</span>
          <span className="ml-auto text-[8px] font-semibold text-[#D97757]">Yes →</span>
        </div>
      </div>
    </div>
  );
}
