import React from 'react';
import { m } from 'framer-motion';
import type { AnimationState, AgentModeGizziTheme } from '../AgentModeGizzi.types';

interface EntryEffectsProps {
  animState: AnimationState;
  theme: AgentModeGizziTheme;
  isClient: boolean;
}

export const EntryEffects = React.memo(({ animState, theme, isClient }: EntryEffectsProps) => {
  if (animState === 'pipe-entry') {
    return (
      <>
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[70px] h-[100px] bg-[linear-gradient(90deg,#1a5c1a_0%,#2d7a2d_20%,#4ade80_40%,#86efac_50%,#4ade80_60%,#2d7a2d_80%,#1a5c1a_100%)] rounded-t shadow-[inset_-6px_0_12px_rgba(0,0,0,0.4),inset_6px_0_12px_rgba(255,255,255,0.3)] pointer-events-none z-[2]" />
        <div className="absolute bottom-[15px] left-1/2 -translate-x-1/2 w-[85px] h-5 bg-[linear-gradient(90deg,#0f3d0f_0%,#1f5c1f_20%,#3ddc84_40%,#86efac_50%,#3ddc84_60%,#1f5c1f_80%,#0f3d0f_100%)] rounded-[10px] shadow-[0_3px_12px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.3)] z-[9]" />
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 w-[55px] h-2 bg-[radial-gradient(ellipse,rgba(0,0,0,0.8)_0%,rgba(0,0,0,0.4)_50%,transparent_100%)] rounded-full z-[8]" />
      </>
    );
  }

  if (animState === 'power-up') {
    return (
      <>
        <m.div
          initial={{ opacity: 0, scale: 0, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: -55 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
          className="absolute bottom-1/2 left-1/2 -translate-x-1/2 w-[100px] h-[45px] z-[40] pointer-events-none"
        >
          <div className="size-full rounded-md border-2 border-solid border-[#3a3a3a] relative overflow-hidden bg-[linear-gradient(135deg,#1a1a1a_0%,#2d2d2d_20%,#1f1f1f_50%,#151515_100%)] shadow-[0_0_30px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(255,255,255,0.05)]">
            <div className="absolute top-[15%] left-0 right-0 h-1/4 bg-[linear-gradient(90deg,transparent_0%,rgba(192,192,192,0.3)_20%,rgba(220,220,220,0.4)_50%,rgba(192,192,192,0.3)_80%,transparent_100%)]" />
            <div className="absolute right-2 top-1/5 w-[25px] h-3/5 rounded-sm opacity-80 bg-[repeating-linear-gradient(0deg,#0a0a0a_0px,#0a0a0a_2px,#1a1a1a_2px,#1a1a1a_4px)]" />
            <div className="absolute top-1/2 left-3 -translate-y-1/2 flex items-center gap-1">
              <div className="w-4 h-3 rounded-[0_50%_50%_0] relative bg-[#76b900]">
                <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-[#76b900]" />
              </div>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[12px] font-black tracking-widest text-[#e0e0e0] font-sans [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
              RTX 4090
            </div>
            <div className="absolute top-1/2 right-1 -translate-y-1/2 w-3 h-5 rounded-sm border border-solid border-[#333] flex flex-col justify-center items-center gap-px bg-[#1a1a1a]">
              {[...Array(4)].map((_, i) => (
                <div key={`gpu-pin-${i}`} className="w-1.5 h-0.5 rounded-[1px] bg-[#333]" />
              ))}
            </div>
            <div className="absolute bottom-1 left-[15%] w-2/5 h-1.5 rounded-[1px] opacity-60 bg-[repeating-linear-gradient(90deg,#0f0f0f_0px,#0f0f0f_3px,#2a2a2a_3px,#2a2a2a_5px)]" />
          </div>
        </m.div>
        {[...Array(8)].map((_, i) => (
          <m.div
            key={`gizzi-item-${i}`}
            initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1.2, 0],
              x: Math.cos((i * Math.PI) / 4) * 60,
              y: Math.sin((i * Math.PI) / 4) * 60,
            }}
            transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
            className="absolute bottom-1/2 left-1/2 size-2.5 -ml-[5px] -mb-[5px] rounded-full pointer-events-none z-[45] shadow-[0_0_16px_var(--spark-accent),0_0_32px_var(--spark-glow)] bg-[radial-gradient(circle,var(--spark-accent)_0%,var(--spark-glow)_100%)]"
            style={{ '--spark-accent': theme.accent, '--spark-glow': theme.glow } as React.CSSProperties}
          />
        ))}
      </>
    );
  }

  if (animState === 'one-up') {
    return (
      <>
        <div className="absolute bottom-[110%] left-1/2 -translate-x-1/2 w-[100px] h-3 bg-[rgba(14,17,20,0.9)] border-2 border-solid rounded-md overflow-hidden z-[50] pointer-events-none"
          style={{ borderColor: theme.accent }}
        >
          <m.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2, ease: 'linear' }}
            className="h-full bg-[linear-gradient(90deg,#22c55e_0%,#4ade80_50%,#22c55e_100%)] shadow-[0_0_12px_#22c55e]"
          />
        </div>
        {[...Array(4)].map((_, i) => (
          <m.div
            key={`gizzi-item-${i}`}
            initial={{ opacity: 0, pathLength: 0 }}
            animate={{ opacity: [0, 1, 0], pathLength: 1 }}
            transition={{ duration: 0.8, delay: 0.5 + i * 0.2 }}
            className="absolute bottom-[130%] left-1/2 -translate-x-1/2 w-[60px] h-5 z-[48] pointer-events-none"
            style={{ transform: `translateX(-50%) rotate(${i * 45}deg)` }}
          >
            <svg width="60" height="20" viewBox="0 0 60 20" className="overflow-visible">
              <m.path
                d="M0,10 Q15,0 30,10 T60,10"
                fill="none"
                stroke={theme.accent}
                strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: [0, 1, 0] }}
                transition={{ duration: 1, delay: i * 0.15, repeat: 1 }}
              />
            </svg>
          </m.div>
        ))}
        <m.div
          initial={{ opacity: 0, scale: 0.8, y: -30, x: 0 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1, 0.9, 0.6], y: [-30, -15, -5, 0], x: [0, 0, 0, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, times: [0, 0.3, 0.6, 1] }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 w-12 h-9 z-[55] pointer-events-none"
        >
          <div className="size-full bg-[linear-gradient(135deg,#2d3748_0%,#1a202c_50%,#171923_100%)] border-2 border-solid border-[#4a5568] rounded-sm shadow-[0_0_20px_rgba(74,85,104,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden">
            <div className="absolute top-1.5 left-1.5 right-1.5 h-0.5 bg-[#48bb78] rounded-[1px] shadow-[0_0_4px_#48bb78]" />
            <div className="absolute top-1.5 left-1.5 w-0.5 h-2.5 bg-[#48bb78] rounded-[1px] shadow-[0_0_4px_#48bb78]" />
            <div className="absolute top-1.5 right-1.5 w-0.5 h-2.5 bg-[#48bb78] rounded-[1px] shadow-[0_0_4px_#48bb78]" />
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-[#48bb78] rounded-[1px] shadow-[0_0_4px_#48bb78]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-3.5 bg-[#1a202c] border border-solid border-[#4a5568] rounded-[2px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[7px] font-extrabold text-[#48bb78] font-mono">01</div>
            <m.div animate={{ opacity: [0.3, 1, 0.3], x: [-10, 10] }} transition={{ duration: 0.4, repeat: 4 }} className="absolute top-[35%] left-0 w-2 h-px bg-[#48bb78] shadow-[0_0_4px_#48bb78]" />
            <m.div animate={{ opacity: [0.3, 1, 0.3], x: [10, -10] }} transition={{ duration: 0.4, repeat: 4, delay: 0.2 }} className="absolute bottom-[35%] right-0 w-2 h-px bg-[#48bb78] shadow-[0_0_4px_#48bb78]" />
          </div>
          <div className="absolute -bottom-1 left-1 right-1 flex justify-between">
            {[0, 1, 2, 3].map((i) => (<div key={`gizzi-item-${i}`} className="w-1 h-1 bg-[#718096] rounded-b-[1px]" />))}
          </div>
        </m.div>
        {[0, 1, 2, 3, 4].map((i) => (
          <m.div key={`byte-${i}`} initial={{ opacity: 0, y: -20 }} animate={{ opacity: [0, 1, 0], y: [-20 + i * 8, -10 + i * 4] }} transition={{ duration: 0.4, delay: 0.5 + i * 0.15, repeat: 2 }} className="absolute bottom-[110%] text-[12px] font-mono font-bold text-[#48bb78] [text-shadow:0_0_4px_#48bb78] z-[54]" style={{ left: `calc(50% + ${(i - 2) * 15}px)` }}>
            {['0x1A', '0xFF', '0x42', '0x7E', '0x01'][i]}
          </m.div>
        ))}
        <div className="absolute bottom-[140%] left-1/2 -translate-x-1/2 pointer-events-none z-[50]">
          <m.div initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -10], scale: [0.8, 1, 1, 0.9] }} transition={{ duration: 2.5, ease: 'easeOut' }} className="px-4 py-2 bg-[linear-gradient(135deg,#22c55e_0%,#16a34a_100%)] rounded-2xl shadow-[0_4px_20px_rgba(34,197,94,0.6),0_0_40px_var(--sparkle-glow)] text-base font-black text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.3)] tracking-wider whitespace-nowrap" style={{ '--sparkle-glow': theme.glow } as React.CSSProperties}>
            TOKENS REFRESHED +1
          </m.div>
        </div>
      </>
    );
  }

  if (animState === 'checkpoint') {
    return (
      <>
        <m.div initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3 }} style={{ position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: theme.accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            <span>💾</span><span>SAVING…</span>
          </div>
          <div style={{ width: 90, height: 10, background: 'rgba(14, 17, 20, 0.9)', border: `2px solid ${theme.soft}`, borderRadius: 5, overflow: 'hidden' }}>
            <m.div initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 1.5, ease: 'easeInOut' }} style={{ height: '100%', background: `linear-gradient(90deg, ${theme.accent} 0%, ${theme.glow} 100%)`, boxShadow: `0 0 10px ${theme.glow}` }} />
          </div>
        </m.div>
        {[...Array(3)].map((_, i) => (
          <m.div key={`gizzi-item-${i}`} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: [0, 0.8, 0], scale: [0.5, 2 + i * 0.5, 3] }} transition={{ duration: 2.0, delay: i * 0.2, ease: 'easeOut' }} style={{ position: 'absolute', bottom: '50%', left: '50%', transform: 'translate(-50%, 50%)', width: 60, height: 60, borderRadius: '50%', border: `3px solid ${theme.accent}`, boxShadow: `0 0 20px ${theme.glow}, inset 0 0 20px ${theme.soft}`, pointerEvents: 'none', zIndex: 35 }} />
        ))}
        <m.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.3, delay: 0.4 }} style={{ position: 'absolute', bottom: '50%', left: '50%', transform: 'translate(-50%, 50%)', width: 20, height: 20, borderRadius: '50%', background: `radial-gradient(circle, ${theme.accent} 0%, transparent 70%)`, boxShadow: `0 0 30px ${theme.accent}`, pointerEvents: 'none', zIndex: 36 }} />
        <m.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 1.5 }} style={{ position: 'absolute', bottom: '140%', left: '50%', transform: 'translateX(-50%)', padding: '4px 10px', background: theme.accent, borderRadius: 10, fontSize: 12, fontWeight: 800, color: '#000', zIndex: 50 }}>✓ SAVED</m.div>
      </>
    );
  }

  if (animState === 'warp-star') {
    return (
      <>
        {['#ff0040', '#ff4000', '#ff8000', '#ffc000', '#ffff00', '#c0ff00', '#00ff00', '#00ff80', '#0080ff', '#4000ff', '#8000ff', '#ff00ff'].map((color, i) => (
          <m.div key={`gizzi-item-${i}`} initial={{ opacity: 0, x: 0, y: 0, scale: 0 }} animate={{ opacity: [0, 1, 0], x: Math.cos((i * Math.PI * 2) / 12) * 120, y: Math.sin((i * Math.PI * 2) / 12) * 120, scale: [0, 1.5, 0] }} transition={{ duration: 1.8, delay: i * 0.05, ease: 'easeOut' }} style={{ position: 'absolute', bottom: '50%', left: '50%', width: 14, height: 14, marginLeft: -7, marginBottom: -7, borderRadius: '50%', background: color, boxShadow: `0 0 20px ${color}, 0 0 40px ${color}`, pointerEvents: 'none', zIndex: 40 }} />
        ))}
        <m.div initial={{ opacity: 0, scale: 0.5, rotate: 0 }} animate={{ opacity: 1, scale: 1.0, rotate: 360 }} transition={{ duration: 1.8, ease: 'linear' }} style={{ position: 'absolute', bottom: '50%', left: '50%', transform: 'translate(-50%, 50%)', width: 80, height: 80, pointerEvents: 'none', zIndex: 38 }}>
          <svg width="80" height="80" viewBox="0 0 100 100">
            <polygon points="50,5 60,35 95,35 67,55 77,85 50,68 23,85 33,55 5,35 40,35" fill="url(#rainbow2)" style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.5))' }} />
            <defs><linearGradient id="rainbow2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#e63950" /><stop offset="17%" stopColor="#e08a4a" /><stop offset="33%" stopColor="#d4c850" /><stop offset="50%" stopColor="#4ac54a" /><stop offset="67%" stopColor="#4a8ac5" /><stop offset="83%" stopColor="#8a4ac5" /><stop offset="100%" stopColor="#c54a6a" /></linearGradient></defs>
          </svg>
        </m.div>
      </>
    );
  }

  if (animState === 'pacman-trail') {
    return (
      <>
        {[40, 80, 120, 160, 200, 240].map((xPos, i) => (
          <m.div key={`gizzi-item-${i}`} initial={{ opacity: 1, scale: 1 }} animate={{ opacity: [1, 1, 0], scale: [1, 1.1, 0] }} transition={{ duration: 0.3, delay: 0.4 + i * 0.28, times: [0, 0.6, 1] }} style={{ position: 'absolute', bottom: '50%', left: `calc(50% + ${xPos}px)`, width: 22, height: 22, marginLeft: -11, marginBottom: -11, borderRadius: '50%', background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', border: '2px solid #fcd34d', boxShadow: `0 0 12px rgba(251, 191, 36, 0.8)`, pointerEvents: 'none', zIndex: 35, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 12, fontWeight: 800, color: '#000', fontFamily: 'var(--font-mono)' }}>⟨/⟩</span></m.div>
        ))}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <m.div key={`chomp-${i}`} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: [0, 0.7, 0], scale: [0.5, 1.3, 1.6] }} transition={{ duration: 0.3, delay: 0.4 + i * 0.28, times: [0, 0.5, 1] }} style={{ position: 'absolute', bottom: '50%', left: `calc(50% + ${40 + i * 40}px)`, transform: 'translate(-50%, 50%)', width: 35, height: 35, borderRadius: '50%', background: `radial-gradient(circle, ${theme.accent} 0%, transparent 70%)`, pointerEvents: 'none', zIndex: 36 }} />
        ))}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <m.div key={`score-${i}`} initial={{ opacity: 0, y: 0 }} animate={{ opacity: [0, 1, 0], y: -30 }} transition={{ duration: 0.6, delay: 0.5 + i * 0.28 }} style={{ position: 'absolute', bottom: '100%', left: `calc(50% + ${40 + i * 40}px)`, transform: 'translateX(-50%)', fontSize: 14, fontWeight: 800, color: '#fbbf24', fontFamily: 'var(--font-mono)', textShadow: '0 0 10px rgba(251, 191, 36, 0.8)', zIndex: 50 }}>200</m.div>
        ))}
      </>
    );
  }

  if (animState === 'the-drop') {
    return (
      <>
        <m.div initial={{ opacity: 0 }} animate={{ opacity: [0, 0.8, 0.6, 0] }} transition={{ duration: 2.2, times: [0, 0.2, 0.8, 1] }} style={{ position: 'absolute', bottom: '50%', left: '50%', transform: 'translateX(-50%)', width: 50, height: 500, background: `linear-gradient(to top, ${theme.accent} 0%, ${theme.glow} 30%, ${theme.soft} 60%, rgba(20,184,166,0.2) 80%, transparent 100%)`, borderRadius: '25px 25px 0 0', filter: 'blur(4px)', pointerEvents: 'none', zIndex: 5 }} />
        {['1', '0', '1', '0', '1', '0', '1', '0'].map((bit, i) => (
          <m.div key={`gizzi-item-${i}`} initial={{ opacity: 0, y: -200, x: 0 }} animate={isClient && { opacity: [0, 1, 0], y: [-(200 - i * 25), 0, 80], x: (Math.random() - 0.5) * 50 }} transition={{ duration: 0.8, delay: 0.3 + i * 0.1, ease: 'easeOut' }} style={{ position: 'absolute', bottom: '50%', left: '50%', fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, color: theme.accent, textShadow: `0 0 8px ${theme.glow}`, pointerEvents: 'none', zIndex: 6 }}>{bit}</m.div>
        ))}
        <m.svg initial={{ opacity: 0 }} animate={{ opacity: [0, 0.6, 0] }} transition={{ duration: 2.2 }} width="100" height="300" style={{ position: 'absolute', bottom: '30%', left: '50%', transform: 'translateX(-50%)', zIndex: 4 }}>
          <m.path d="M20,0 L20,100 L40,120 L40,200" fill="none" stroke={theme.soft} strokeWidth="1.5" strokeDasharray="4,4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5 }} />
          <m.path d="M80,0 L80,80 L60,100 L60,180" fill="none" stroke={theme.soft} strokeWidth="1.5" strokeDasharray="4,4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.2 }} />
          <m.circle cx="40" cy="120" r="4" fill={theme.accent} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} />
          <m.circle cx="60" cy="100" r="4" fill={theme.accent} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} />
        </m.svg>
        {[...Array(6)].map((_, i) => (
          <m.div key={`gizzi-item-${i}`} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], x: Math.cos((i * Math.PI * 2) / 6) * 60, y: Math.sin((i * Math.PI * 2) / 6) * 30 }} transition={{ duration: 0.5, delay: 1.8 }} style={{ position: 'absolute', bottom: '40%', left: '50%', width: 6, height: 6, borderRadius: '50%', background: theme.glow, boxShadow: `0 0 10px ${theme.accent}`, pointerEvents: 'none', zIndex: 7 }} />
        ))}
      </>
    );
  }

  if (animState === 'the-peek') {
    return (
      <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 45 }}>
        <div style={{ width: 180, background: 'rgba(10, 12, 14, 0.95)', border: `1px solid ${theme.soft}`, borderRadius: 8, boxShadow: `0 4px 20px ${theme.glow}`, overflow: 'hidden', fontFamily: 'var(--font-mono)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(255,255,255,0.05)', borderBottom: `1px solid ${theme.soft}` }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f56' }} /><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffbd2e' }} /><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#27ca40' }} /><span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(236,236,236,0.5)' }}>gizzi_boot.sh</span>
          </div>
          <div style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 12, color: theme.accent, marginBottom: 4 }}>$ initializing…</div>
            <m.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 0.6, delay: 0.2 }} style={{ height: 6, background: `linear-gradient(90deg, ${theme.accent} 0%, ${theme.glow} 100%)`, borderRadius: 3, marginBottom: 8 }} />
            {['loading modules...', 'mounting /dev/gizzi...', 'ready.'].map((text, i) => (
              <m.div key={`gizzi-item-${i}`} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: 0.4 + i * 0.15 }} style={{ fontSize: 12, color: 'rgba(236,236,236,0.7)', marginTop: 3 }}><span style={{ color: '#27ca40' }}>✓</span> {text}</m.div>
            ))}
            <m.div animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: 2 }} style={{ display: 'inline-block', width: 6, height: 12, background: theme.accent, marginTop: 6, verticalAlign: 'middle' }} />
          </div>
        </div>
      </m.div>
    );
  }

  if (animState === 'glitch-in') {
    return (
      <>
        {[...Array(6)].map((_, i) => (
          <m.div
            key={`glitch-slice-${i}`}
            initial={{ opacity: 0, x: 0 }}
            animate={{ opacity: [0, 0.8, 0], x: [0, (i % 2 === 0 ? 1 : -1) * (10 + Math.random() * 20), 0] }}
            transition={{ duration: 0.1, delay: i * 0.06, repeat: 4 }}
            className="absolute left-1/2 -translate-x-1/2 w-[90px] h-[8px] pointer-events-none z-[40]"
            style={{ bottom: `${20 + i * 10}%`, background: i % 2 === 0 ? theme.accent : theme.glow }}
          />
        ))}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.4, 0, 0.6, 0] }}
          transition={{ duration: 0.8 }}
          className="absolute -inset-[40px] pointer-events-none z-[35]"
          style={{ background: `repeating-linear-gradient(0deg, transparent 0px, transparent 2px, ${theme.soft}22 2px, ${theme.soft}22 4px)` }}
        />
        <m.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0, 1, 0], scale: [0.8, 1.2, 1] }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="absolute bottom-[110%] left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 border border-solid border-[#00ff41] rounded text-[10px] font-mono font-bold text-[#00ff41] pointer-events-none z-[50]"
        >
          DECODING...
        </m.div>
      </>
    );
  }

  if (animState === 'beam-in') {
    return (
      <>
        <m.div
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: [0, 0.7, 0.4, 0], scaleY: [0, 1, 1, 0] }}
          transition={{ duration: 1.2 }}
          className="absolute bottom-1/2 left-1/2 -translate-x-1/2 w-[60px] h-[300px] origin-bottom pointer-events-none z-[35]"
          style={{ background: `linear-gradient(to top, ${theme.accent} 0%, ${theme.glow} 40%, transparent 100%)`, filter: 'blur(8px)' }}
        />
        {[...Array(12)].map((_, i) => (
          <m.div
            key={`beam-particle-${i}`}
            initial={{ opacity: 0, y: -120, x: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], y: [-120, 0, 40], x: (Math.random() - 0.5) * 60, scale: [0, 1, 0] }}
            transition={{ duration: 0.8, delay: 0.2 + i * 0.06, ease: 'easeOut' }}
            className="absolute bottom-1/2 left-1/2 size-1.5 -ml-[3px] -mb-[3px] rounded-full pointer-events-none z-[45]"
            style={{ background: theme.glow, boxShadow: `0 0 10px ${theme.accent}` }}
          />
        ))}
      </>
    );
  }

  if (animState === 'bounce-in') {
    return (
      <>
        <m.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 0.6, 0], scale: [0, 1.5, 2] }}
          transition={{ duration: 0.4, delay: 0.55 }}
          className="absolute bottom-[15%] left-1/2 -translate-x-1/2 size-[80px] rounded-full pointer-events-none z-[35]"
          style={{ background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)` }}
        />
        {[...Array(8)].map((_, i) => (
          <m.div
            key={`dust-${i}`}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
            animate={{ opacity: [0, 0.8, 0], x: Math.cos((i * Math.PI * 2) / 8) * 50, y: Math.sin((i * Math.PI * 2) / 8) * 20, scale: [0, 1, 0] }}
            transition={{ duration: 0.5, delay: 0.55, ease: 'easeOut' }}
            className="absolute bottom-[20%] left-1/2 size-1.5 -ml-[3px] -mb-[3px] rounded-full pointer-events-none z-[40] bg-zinc-400/60"
          />
        ))}
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: [0, 1, 0], y: [10, -30, -50] }}
          transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
          className="absolute bottom-[110%] left-1/2 -translate-x-1/2 px-2 py-0.5 bg-zinc-900/80 border border-solid border-zinc-600 rounded text-[10px] font-black text-white pointer-events-none z-[50]"
        >
          BOING!
        </m.div>
      </>
    );
  }

  if (animState === 'flip-in') {
    return (
      <>
        <m.div
          initial={{ opacity: 0, rotateY: 90, scale: 0.6 }}
          animate={{ opacity: [0, 0.5, 0], rotateY: [90, 0, -30], scale: [0.6, 1.1, 1] }}
          transition={{ duration: 0.7 }}
          className="absolute -inset-[30px] rounded-2xl pointer-events-none z-[35]"
          style={{ background: `radial-gradient(circle, ${theme.soft}44 0%, transparent 70%)` }}
        />
        <m.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0, 1.4, 0], rotate: 180 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2 size-[100px] rounded-full pointer-events-none z-[36]"
          style={{ background: `conic-gradient(from 0deg, ${theme.accent}, ${theme.glow}, ${theme.accent})`, filter: 'blur(10px)' }}
        />
      </>
    );
  }

  if (animState === 'wave-hello') {
    return (
      <>
        <m.div
          initial={{ opacity: 0, scale: 0.5, x: 0 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1, 0.8], x: [0, 8, -4, 0] }}
          transition={{ duration: 0.9, times: [0, 0.3, 0.6, 1] }}
          className="absolute bottom-[110%] left-1/2 -translate-x-1/2 px-2.5 py-1 bg-zinc-900/80 border border-solid border-zinc-600 rounded-full text-[10px] font-black text-white pointer-events-none z-[50]"
        >
          HELLO!
        </m.div>
        {[...Array(3)].map((_, i) => (
          <m.div
            key={`wave-spark-${i}`}
            initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], x: 25 + i * 12, y: -10 - i * 8 }}
            transition={{ duration: 0.4, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
            className="absolute bottom-1/2 left-1/2 size-1 -ml-0.5 -mb-0.5 rounded-full pointer-events-none z-[40]"
            style={{ background: theme.accent, boxShadow: `0 0 8px ${theme.glow}` }}
          />
        ))}
      </>
    );
  }

  if (animState === 'coffee-boost') {
    return (
      <>
        <m.div
          initial={{ opacity: 0, y: 30, scale: 0.5, rotate: 10 }}
          animate={{ opacity: [0, 1, 1, 0], y: [30, -10, -20, -40], scale: [0.5, 1, 1, 0.8], rotate: [10, 0, -5, 0] }}
          transition={{ duration: 1.1, times: [0, 0.2, 0.5, 1] }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 w-7 h-8 z-[45] pointer-events-none"
        >
          <div className="size-full bg-[#8B4513] rounded-t-sm rounded-b-md border-2 border-solid border-[#5D3A1A] relative">
            <div className="absolute -right-2 top-1 w-2 h-3 rounded-r-sm border-2 border-l-0 border-solid border-[#5D3A1A] bg-[#8B4513]" />
            <div className="absolute top-1 left-1 right-1 h-2 bg-[#D2691E] rounded-sm" />
            <m.div animate={{ y: [0, -8, 0] }} transition={{ duration: 0.4, repeat: 2 }} className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white/20 blur-[2px]" />
          </div>
        </m.div>
        {[...Array(4)].map((_, i) => (
          <m.div
            key={`coffee-aura-${i}`}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 0.6, 0], scale: [0, 1.5, 2], x: (Math.random() - 0.5) * 40, y: -30 - Math.random() * 30 }}
            transition={{ duration: 0.5, delay: 0.6 + i * 0.1 }}
            className="absolute bottom-1/2 left-1/2 size-1 -ml-0.5 -mb-0.5 rounded-full pointer-events-none z-[35]"
            style={{ background: theme.glow }}
          />
        ))}
        <m.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 1, 1, 0], y: [-20, -40, -60] }}
          transition={{ duration: 0.8, delay: 0.7, ease: 'easeOut' }}
          className="absolute bottom-[120%] left-1/2 -translate-x-1/2 text-[11px] font-black text-[#D2691E] pointer-events-none z-[50]"
        >
          ZING!
        </m.div>
      </>
    );
  }

  if (animState === 'rocket-land') {
    return (
      <>
        <m.div
          initial={{ opacity: 0, y: -300, scale: 0.6 }}
          animate={{ opacity: [0, 1, 1, 0], y: [-300, -20, 0, 20], scale: [0.6, 0.8, 0.9, 0.6] }}
          transition={{ duration: 1.4, times: [0, 0.6, 0.85, 1] }}
          className="absolute bottom-[60%] left-1/2 -translate-x-1/2 w-8 h-14 z-[40] pointer-events-none"
        >
          <div className="w-full h-full bg-[linear-gradient(180deg,#e2e8f0_0%,#94a3b8_50%,#475569_100%)] rounded-t-full rounded-b-md relative border border-solid border-slate-500">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-sky-400 border border-solid border-sky-600" />
            <div className="absolute -left-1 bottom-2 w-1.5 h-4 bg-slate-600 rounded-l-sm" />
            <div className="absolute -right-1 bottom-2 w-1.5 h-4 bg-slate-600 rounded-r-sm" />
          </div>
        </m.div>
        <m.div
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: [0, 0.8, 0.4, 0], scaleY: [0, 1, 1.2, 0] }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="absolute bottom-[30%] left-1/2 -translate-x-1/2 w-6 h-16 origin-top pointer-events-none z-[35]"
          style={{ background: `linear-gradient(to top, ${theme.accent} 0%, ${theme.glow} 60%, transparent 100%)`, filter: 'blur(4px)' }}
        />
        {[...Array(6)].map((_, i) => (
          <m.div
            key={`land-dust-${i}`}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
            animate={{ opacity: [0, 0.8, 0], x: (Math.random() - 0.5) * 70, y: Math.random() * 20, scale: [0, 1, 0] }}
            transition={{ duration: 0.6, delay: 1.0 + i * 0.05 }}
            className="absolute bottom-[25%] left-1/2 size-1.5 -ml-[3px] -mb-[3px] rounded-full pointer-events-none z-[38] bg-zinc-400/70"
          />
        ))}
      </>
    );
  }

  if (animState === 'typing-emerge') {
    return (
      <>
        <m.div
          initial={{ opacity: 0, scale: 0.4, y: 60 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1, 1, 0.7], y: [60, 0, -5, -30] }}
          transition={{ duration: 1.2, times: [0, 0.25, 0.7, 1] }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 w-16 h-8 bg-zinc-800/90 border border-solid border-zinc-600 rounded-md z-[40] pointer-events-none flex items-center justify-center gap-0.5"
        >
          {[0, 1, 2].map((i) => (
            <m.div key={`key-${i}`} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.3, repeat: 3, delay: i * 0.1 }} className="w-3 h-2.5 rounded-[2px] bg-zinc-500" />
          ))}
        </m.div>
        {['{ }', '( )', '[ ]', '</>'].map((sym, i) => (
          <m.div
            key={`bracket-${i}`}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0, rotate: 0 }}
            animate={{ opacity: [0, 1, 0], x: (i % 2 === 0 ? -1 : 1) * (30 + i * 15), y: -40 - i * 10, scale: [0, 1, 0], rotate: i * 45 }}
            transition={{ duration: 0.7, delay: 0.4 + i * 0.12, ease: 'easeOut' }}
            className="absolute bottom-1/2 left-1/2 text-[12px] font-black font-mono pointer-events-none z-[45]"
            style={{ color: theme.accent, textShadow: `0 0 8px ${theme.glow}` }}
          >
            {sym}
          </m.div>
        ))}
        <m.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: [0, 1, 0], width: ['0%', '80%', '80%'] }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute bottom-[110%] left-1/2 -translate-x-1/2 h-1 rounded-full pointer-events-none z-[35]"
          style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)` }}
        />
      </>
    );
  }

  return null;
});

EntryEffects.displayName = 'EntryEffects';
