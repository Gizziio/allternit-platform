import React from 'react';
import { m } from 'framer-motion';
import type { AnimationState, AgentModeGizziTheme } from '../AgentModeGizzi.types';

interface ExitEffectsProps {
  animState: AnimationState;
  theme: AgentModeGizziTheme;
  isClient: boolean;
}

export const ExitEffects = React.memo(({ animState, theme, isClient }: ExitEffectsProps) => {
  if (animState === 'to-the-cloud') {
    return (
      <>
        {[...Array(6)].map((_, i) => (
          <m.div key={`gizzi-item-${i}`} initial={{ opacity: 0, y: 0, x: 0, scale: 0.5 }} animate={isClient && { opacity: [0, 1, 1, 0], y: [-20, -80 - i * 30, -150 - i * 20], x: (Math.random() - 0.5) * 80, scale: [0.5, 1, 0.8], rotate: [0, 15, -15, 0] }} transition={{ duration: 2.5, delay: i * 0.15, ease: 'easeOut' }} style={{ position: 'absolute', bottom: '60%', left: '50%', fontSize: 24, zIndex: 45 }}>📦</m.div>
        ))}
        <m.div initial={{ opacity: 0, y: -50, scale: 0.8 }} animate={{ opacity: [0, 1, 1, 0], y: -200, scale: [0.8, 1.2, 1.5] }} transition={{ duration: 2.5, delay: 0.5 }} style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', fontSize: 60, zIndex: 40, filter: `drop-shadow(0 0 20px ${theme.glow})` }}>☁️</m.div>
        <m.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 2.5 }} style={{ position: 'absolute', bottom: '140%', left: '50%', transform: 'translateX(-50%)', fontSize: 14, fontWeight: 700, color: theme.accent, zIndex: 50 }}>UPLOADING...</m.div>
      </>
    );
  }

  if (animState === 'wheel-out') {
    return (
      <>
        <m.div initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: [0, 0.95, 0.6, 0], scaleX: [0, 1, 1.6, 2] }} transition={{ duration: 2.0 }} className="absolute -bottom-[10px] left-1/2 -translate-x-1/2 w-20 h-3 rounded-sm blur-[1px] pointer-events-none z-[3] bg-[repeating-linear-gradient(90deg,#0a0a0a_0px,#0a0a0a_5px,transparent_5px,transparent_9px)]" style={{ transform: 'translateX(-50%) rotate(-5deg)' }} />
        <m.div initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: [0, 0.9, 0.55, 0], scaleX: [0, 1, 1.5, 1.9] }} transition={{ duration: 2.0, delay: 0.1 }} className="absolute -bottom-[18px] left-[45%] -translate-x-1/2 w-[70px] h-2.5 rounded-sm blur-[0.5px] pointer-events-none z-[3] bg-[repeating-linear-gradient(90deg,#0d0d0d_0px,#0d0d0d_4px,transparent_4px,transparent_8px)]" style={{ transform: 'translateX(-50%) rotate(-10deg)' }} />
        <m.div initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: [0, 0.85, 0.4, 0], scaleX: [0, 1, 1.4, 1.8] }} transition={{ duration: 2.0, delay: 0.05 }} className="absolute -bottom-[25px] left-[48%] -translate-x-1/2 w-[90px] h-2 rounded-sm blur-[0.5px] pointer-events-none z-[3] bg-[repeating-linear-gradient(90deg,#111_0px,#111_6px,transparent_6px,transparent_12px)]" style={{ transform: 'translateX(-50%) rotate(-3deg)' }} />
        {[0, 1, 2, 3, 4].map((i) => (
          <m.div key={`smoke-${i}`} initial={{ opacity: 0, scale: 0.3, x: 0 }} animate={{ opacity: [0, 0.7 - i * 0.1, 0.4 - i * 0.05, 0], scale: [0.3, 1.2 + i * 0.3, 1.8 + i * 0.4, 2.5 + i * 0.5], x: i % 2 === 0 ? [0, -30 - i * 10, -60 - i * 15] : [0, 25 + i * 8, 50 + i * 12], y: [0, -10 - i * 5, -25 - i * 10] }} transition={{ duration: 2.0, delay: i * 0.1, ease: 'easeOut' }} className="absolute rounded-full pointer-events-none" style={{ bottom: `${10 + i * 5}%`, left: i % 2 === 0 ? `${15 + i * 5}%` : 'auto', right: i % 2 === 1 ? `${10 + i * 4}%` : 'auto', width: 50 + i * 15, height: 40 + i * 12, background: `radial-gradient(ellipse at center, rgba(${60 + i * 10}, ${60 + i * 10}, ${60 + i * 10}, ${0.6 - i * 0.08}) 0%, rgba(${40 + i * 5}, ${40 + i * 5}, ${40 + i * 5}, ${0.4 - i * 0.06}) 30%, rgba(20, 20, 20, ${0.2 - i * 0.03}) 60%, transparent 100%)`, filter: `blur(${4 + i}px)`, zIndex: 44 - i }} />
        ))}
        <m.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: [0, 0.9, 0.6, 0], scale: [0.5, 1.8, 2.8, 3.5], x: [-10, -40, -80] }} transition={{ duration: 2.0, delay: 0.15 }} className="absolute bottom-[5%] left-1/5 w-[70px] h-[55px] rounded-full blur-md z-[45] pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(30,30,30,0.85)_0%,rgba(20,20,20,0.6)_25%,rgba(10,10,10,0.3)_50%,transparent_100%)]" />
        {isClient && [...Array(12)].map((_, i) => {
          const angle = (i * Math.PI * 2) / 12 + Math.random() * 0.5;
          const distance = 40 + Math.random() * 60;
          return (
            <m.div key={`particle-${i}`} initial={{ opacity: 0, scale: 0, x: 0, y: 0 }} animate={{ opacity: [0, 1, 0.8, 0], scale: [0, 0.8, 1, 0.6], x: Math.cos(angle) * distance, y: Math.sin(angle) * distance * 0.6 - 20, rotate: Math.random() * 360 }} transition={{ duration: 1.2, delay: 0.3 + i * 0.05, ease: 'easeOut' }} className="absolute bottom-[15%] rounded-lg z-[46] pointer-events-none" style={{ left: i % 2 === 0 ? '25%' : '75%', width: 3 + Math.random() * 4, height: 3 + Math.random() * 4, background: i % 3 === 0 ? '#1a1a1a' : i % 3 === 1 ? '#2d2d2d' : '#0f0f0f' }} />
          );
        })}
        <m.div initial={{ opacity: 0, x: 0 }} animate={{ opacity: [0, 1, 0], x: [-10, 0, 10] }} transition={{ duration: 0.15, repeat: 4 }} className="absolute bottom-full left-1/2 -translate-x-1/2 px-3 py-1 bg-zinc-900/90 border border-solid border-zinc-700 rounded-[10px] text-[12px] font-black text-zinc-400 pointer-events-none z-[50] whitespace-nowrap font-mono tracking-widest">▓▒░ SCREECH! ░▒▓</m.div>
      </>
    );
  }

  if (animState === 'buffer-overflow') {
    return (
      <>
        {[...Array(8)].map((_, col) => (
          <m.div key={`exiteffects-${col}`} initial={{ opacity: 0, y: -100 }} animate={{ opacity: [0, 0.8, 0.6, 0], y: [-100, 50, 150, 300] }} transition={{ duration: 2.0, delay: col * 0.1, times: [0, 0.3, 0.7, 1] }} className="absolute bottom-1/2 font-mono text-[12px] font-bold text-[#00ff41] [text-shadow:0_0_8px_#00ff41] z-[45] flex flex-col gap-0.5" style={{ left: `${15 + col * 10}%` }}>
            {['1', '0', '1', '0', '1', '0', '1', '0'].map((bit, i) => (<m.span key={`gizzi-item-${i}`} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.5, 1] }} transition={{ duration: 0.3, delay: i * 0.05 }}>{bit}</m.span>))}
          </m.div>
        ))}
        <m.div animate={{ x: [0, -4, 4, -2, 2, 0], opacity: [1, 0.6, 1, 0.4, 1, 0] }} transition={{ duration: 2.0, times: [0, 0.15, 0.3, 0.45, 0.6, 1] }} className="absolute -inset-[30px] border-[3px] border-solid border-[#00ff41] rounded-xl pointer-events-none z-[40] shadow-[0_0_20px_rgba(0,255,65,0.5)]" />
        <m.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1.05, 1] }} transition={{ duration: 2.0 }} className="absolute bottom-[120%] left-1/2 -translate-x-1/2 px-4 py-2 bg-black border-2 border-solid border-[#00ff41] rounded-lg pointer-events-none z-[55]"><div className="text-sm font-extrabold text-[#00ff41] font-mono tracking-wider">BUFFER OVERFLOW</div><div className="text-[12px] text-[#00ff41] font-mono mt-0.5 opacity-80">0xDEADBEEF</div></m.div>
      </>
    );
  }

  if (animState === 'context-scatter') {
    return (
      <>
        {isClient && [...Array(20)].map((_, i) => {
          const angle = (i * Math.PI * 2) / 20;
          const distance = 80 + Math.random() * 80;
          return (
            <m.div key={`gizzi-item-${i}`} initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }} animate={{ opacity: [0, 1, 1, 0], x: Math.cos(angle) * distance, y: Math.sin(angle) * distance - 40, scale: [0.5, 1, 0.6], rotate: Math.random() * 720 }} transition={{ duration: 2.0, ease: [0.3, 0, 0.5, 1.2] }} className="absolute bottom-1/2 left-1/2 w-4 h-5 -ml-2 -mb-2.5 flex items-center justify-center rounded-full shadow-[0_3px_12px_rgba(0,0,0,0.3)] pointer-events-none z-[40] text-[12px] font-black text-black" style={{ background: i % 4 === 0 ? '#fbbf24' : i % 4 === 1 ? '#60a5fa' : i % 4 === 2 ? '#a78bfa' : '#f472b6' }}>⟨/⟩</m.div>
          );
        })}
        <m.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: [0, 1, 0], scale: [0, 2, 0] }} transition={{ duration: 0.5, delay: 0.3 }} className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2 w-[100px] h-[100px] pointer-events-none z-[38]" style={{ background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)` }} />
        {[...Array(8)].map((_, i) => (
          <m.div key={`sparkle-${i}`} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], rotate: [0, 180] }} transition={{ duration: 0.6, delay: 0.3 + i * 0.05 }} className="absolute bottom-1/2 left-1/2 size-5 -ml-[10px] -mb-[10px] z-[42]"><svg width="20" height="20" viewBox="0 0 20 20"><path d="M10,0 L12,8 L20,10 L12,12 L10,20 L8,12 L0,10 L8,8 Z" fill={theme.accent} transform={`rotate(${i * 45} 10 10) translate(${Math.cos(i * Math.PI / 4) * 30}, ${Math.sin(i * Math.PI / 4) * 30})`} /></svg></m.div>
        ))}
        <m.div initial={{ opacity: 0, scale: 1 }} animate={{ opacity: [0, 0.5, 0], scale: [1, 1.4, 1.8] }} transition={{ duration: 0.5 }} className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2 size-[60px] rounded-full border-[3px] border-dashed pointer-events-none z-[35]" style={{ borderColor: theme.accent }} />
      </>
    );
  }

  if (animState === 'fan-spin') {
    return (
      <>
        <m.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2 w-[100px] h-[100px] z-[48]"><svg width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="none" stroke="#2a2a2a" strokeWidth="4" /><circle cx="50" cy="50" r="42" fill="none" stroke="#3a3a3a" strokeWidth="1" /><circle cx="15" cy="15" r="3" fill="#1a1a1a" stroke="#444" strokeWidth="1" /><circle cx="85" cy="15" r="3" fill="#1a1a1a" stroke="#444" strokeWidth="1" /><circle cx="15" cy="85" r="3" fill="#1a1a1a" stroke="#444" strokeWidth="1" /><circle cx="85" cy="85" r="3" fill="#1a1a1a" stroke="#444" strokeWidth="1" /><line x1="15" y1="15" x2="35" y2="35" stroke="#2a2a2a" strokeWidth="4" /><line x1="85" y1="15" x2="65" y2="35" stroke="#2a2a2a" strokeWidth="4" /><line x1="15" y1="85" x2="35" y2="65" stroke="#2a2a2a" strokeWidth="4" /><line x1="85" y1="85" x2="65" y2="65" stroke="#2a2a2a" strokeWidth="4" /></svg></m.div>
        <m.div initial={{ opacity: 0, rotate: 0 }} animate={{ opacity: 1, rotate: 2880 }} transition={{ duration: 2.0, ease: 'linear' }} className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2 w-[85px] h-[85px] z-[50]"><svg width="85" height="85" viewBox="0 0 85 85">{[0, 40, 80, 120, 160, 200, 240, 280, 320].map((angle, i) => (<g key={angle} transform={`rotate(${angle} 42.5 42.5)`}><path d="M42.5,42.5 Q38,25 35,12 Q42.5,8 50,12 Q47,25 42.5,42.5" fill={`hsl(${i * 40}, 70%, 45%)`} stroke="#222" strokeWidth="0.5" opacity={0.9} /></g>))}</svg></m.div>
        <m.div animate={{ opacity: [0, 0.3, 0.3, 0], rotate: 2880 }} transition={{ duration: 2.0, ease: 'linear' }} className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2 size-20 rounded-full bg-[conic-gradient(from_0deg,transparent,rgba(255,255,255,0.1),transparent,rgba(255,255,255,0.1),transparent)] z-[51] pointer-events-none" />
        <m.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.1 }} className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2 size-6 z-[52]"><div className="size-full rounded-full bg-[linear-gradient(135deg,#3a3a3a_0%,#1a1a1a_100%)] border-2 border-solid border-[#555] flex items-center justify-center"><span className="text-[12px] font-black text-white font-sans">G</span></div></m.div>
        {[...Array(5)].map((_, i) => (
          <m.div key={`gizzi-item-${i}`} initial={{ opacity: 0, y: 0, scale: 0.5 }} animate={isClient && { opacity: [0, 0.6, 0], y: [-20, -60 - i * 20], x: (Math.random() - 0.5) * 40, scale: [0.5, 1.5, 2] }} transition={{ duration: 1.5, delay: 0.5 + i * 0.15, repeat: 1 }} className="absolute bottom-3/5 left-1/2 size-[25px] -ml-3 rounded-full blur-sm z-[51] bg-[radial-gradient(circle,rgba(150,150,150,0.6)_0%,transparent_70%)]" />
        ))}
        <m.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1, 1, 0.9] }} transition={{ duration: 2.0 }} className="absolute bottom-[130%] left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-2 bg-red-600 rounded-[10px] z-[55]"><span className="text-[18px]">🌡️</span><span className="text-[13px] font-extrabold text-white uppercase">OVERHEATING!</span></m.div>
        <m.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 2.0 }} className="absolute bottom-[160%] left-1/2 -translate-x-1/2 text-[20px] font-black text-red-600 font-mono z-[55]">98°C</m.div>
      </>
    );
  }

  if (animState === 'system-crash') {
    return (
      <m.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 2.5 }} className="fixed inset-0 bg-[#0078D7] z-[1000] flex flex-col items-center justify-center p-10">
        <m.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.2 }} className="text-[120px] mb-8">:(</m.div>
        <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }} className="text-2xl font-medium text-white mb-5 text-center">Your PC ran into a problem and needs to restart.</m.div>
        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.6 }} className="text-sm text-white opacity-90 text-center max-w-[500px] leading-relaxed">We're just collecting some error info, and then we'll restart for you.</m.div>
        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.8 }} className="text-base text-white mt-8"><m.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: 2 }}>0% complete</m.span></m.div>
        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 1 }} className="mt-10 p-2.5 bg-white rounded flex items-center justify-center">
          <div className="size-20 bg-black grid grid-cols-5 grid-rows-5 gap-0.5 p-1">{[...Array(25)].map((_, i) => (<div key={`gizzi-item-${i}`} className={isClient ? (Math.random() > 0.5 ? 'bg-black' : 'bg-white') : 'bg-black'} />))}</div>
        </m.div>
        <m.div initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ duration: 0.5, delay: 1.2 }} className="text-[12px] text-white mt-4 text-center">For more information about this issue and possible fixes, visit https://www.windows.com/stopcode</m.div>
      </m.div>
    );
  }

  if (animState === 'collapse') {
    return (
      <>
        <m.div initial={{ opacity: 0.3 }} animate={{ opacity: [0.3, 0.1, 0] }} transition={{ duration: 0.3 }} className="absolute -inset-[60px] pointer-events-none z-[40]" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 70%)' }} />
        <m.div initial={{ opacity: 0, scaleY: 0.8 }} animate={{ opacity: [0, 1, 1, 0.8, 0], scaleY: [0.8, 0.08, 0.04, 0.01, 0], scaleX: [1, 1, 0.9, 0.7, 0.3] }} transition={{ duration: 0.8, times: [0, 0.1, 0.3, 0.6, 1] }} className="absolute bottom-1/2 left-[5%] right-[5%] h-1.5 bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_30px_#fff,0_0_60px_rgba(255,255,255,0.8),0_0_100px_rgba(255,255,255,0.4)] rounded-sm z-[50]" />
        <m.div initial={{ opacity: 0 }} animate={{ opacity: [0, 0.3, 0.2, 0] }} transition={{ duration: 0.8 }} className="absolute -inset-10 rounded-full z-[45] pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />
        <m.div initial={{ opacity: 0 }} animate={{ opacity: [0, 0.6, 0] }} transition={{ duration: 0.15 }} className="absolute -inset-[50px] bg-white z-[49] pointer-events-none" />
      </>
    );
  }

  if (animState === 'fizzle-out') {
    return (
      <>
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0.3, 0] }}
          transition={{ duration: 1.2 }}
          className="absolute -inset-[30px] pointer-events-none z-[35]"
          style={{ background: `repeating-linear-gradient(0deg, transparent 0px, transparent 3px, ${theme.accent}22 3px, ${theme.accent}22 6px)` }}
        />
        {isClient && [...Array(20)].map((_, i) => (
          <m.div
            key={`static-${i}`}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], x: (Math.random() - 0.5) * 70, y: (Math.random() - 0.5) * 70, scale: [0, Math.random() * 2 + 1, 0] }}
            transition={{ duration: 0.4, delay: i * 0.04, repeat: 2 }}
            className="absolute bottom-1/2 left-1/2 size-1 -ml-0.5 -mb-0.5 rounded-sm pointer-events-none z-[40]"
            style={{ background: i % 2 === 0 ? theme.accent : '#fff' }}
          />
        ))}
        <m.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 1, 1, 0], y: [-10, -30, -50] }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="absolute bottom-[110%] left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900/90 border border-solid border-zinc-600 rounded text-[10px] font-mono font-bold text-zinc-300 pointer-events-none z-[50]"
        >
          SIGNAL LOST
        </m.div>
      </>
    );
  }

  if (animState === 'black-hole') {
    return (
      <>
        <m.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 0.8, 0.4], scale: [0, 1, 1.5] }}
          transition={{ duration: 1.0 }}
          className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2 size-[40px] rounded-full pointer-events-none z-[40]"
          style={{ background: 'radial-gradient(circle, #000 0%, #1a1a1a 40%, transparent 70%)', boxShadow: `0 0 30px ${theme.glow}` }}
        />
        {[...Array(12)].map((_, i) => (
          <m.div
            key={`suck-${i}`}
            initial={{ opacity: 1, x: Math.cos((i * Math.PI * 2) / 12) * 80, y: Math.sin((i * Math.PI * 2) / 12) * 80, scale: 1 }}
            animate={{ opacity: [1, 0], x: 0, y: 0, scale: [1, 0] }}
            transition={{ duration: 0.8, delay: i * 0.03, ease: 'easeIn' }}
            className="absolute bottom-1/2 left-1/2 size-1.5 -ml-[3px] -mb-[3px] rounded-full pointer-events-none z-[38]"
            style={{ background: theme.accent }}
          />
        ))}
        <m.div
          initial={{ opacity: 0, scaleX: 1 }}
          animate={{ opacity: [0, 0.6, 0], scaleX: [1, 0.2, 0] }}
          transition={{ duration: 1.0, ease: 'easeIn' }}
          className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2 w-[120px] h-[10px] rounded-full pointer-events-none z-[39]"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${theme.glow} 50%, transparent 100%)`, filter: 'blur(4px)' }}
        />
      </>
    );
  }

  if (animState === 'teleport-out') {
    return (
      <>
        <m.div
          initial={{ opacity: 0, scaleY: 1 }}
          animate={{ opacity: [0, 0.7, 0.3, 0], scaleY: [1, 1, 0] }}
          transition={{ duration: 1.2 }}
          className="absolute bottom-1/2 left-1/2 -translate-x-1/2 w-[60px] h-[250px] origin-bottom pointer-events-none z-[35]"
          style={{ background: `linear-gradient(to top, ${theme.accent} 0%, ${theme.glow} 50%, transparent 100%)`, filter: 'blur(8px)' }}
        />
        {[...Array(16)].map((_, i) => (
          <m.div
            key={`tele-particle-${i}`}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: [1, 0], x: (Math.random() - 0.5) * 40, y: -60 - Math.random() * 80, scale: [1, 0] }}
            transition={{ duration: 0.8, delay: i * 0.04, ease: 'easeOut' }}
            className="absolute bottom-1/2 left-1/2 size-1 -ml-0.5 -mb-0.5 rounded-full pointer-events-none z-[45]"
            style={{ background: theme.glow, boxShadow: `0 0 8px ${theme.accent}` }}
          />
        ))}
      </>
    );
  }

  if (animState === 'shrink-out') {
    return (
      <>
        <m.div
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: [0, 0.5, 0], scale: [1, 0.5, 0] }}
          transition={{ duration: 0.5 }}
          className="absolute -inset-[20px] rounded-full pointer-events-none z-[35]"
          style={{ background: `radial-gradient(circle, ${theme.soft}33 0%, transparent 70%)` }}
        />
        {[...Array(6)].map((_, i) => (
          <m.div
            key={`wobble-${i}`}
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], x: [0, (i % 2 === 0 ? 8 : -8), 0], y: [0, -5, 0] }}
            transition={{ duration: 0.12, delay: i * 0.06, repeat: 3 }}
            className="absolute -inset-[10px] border-2 border-solid rounded-xl pointer-events-none z-[40]"
            style={{ borderColor: theme.accent }}
          />
        ))}
        <m.div
          initial={{ opacity: 0, scale: 1, y: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [1, 0.4, 0], y: [0, 10, 20] }}
          transition={{ duration: 0.5, ease: 'easeIn' }}
          className="absolute bottom-[120%] left-1/2 -translate-x-1/2 text-[18px] font-black text-white pointer-events-none z-[50]"
        >
          POP!
        </m.div>
      </>
    );
  }

  if (animState === 'wave-goodbye') {
    return (
      <>
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: [0, 1, 1, 0], y: [10, -20, -30, -50] }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute bottom-[110%] left-1/2 -translate-x-1/2 px-2.5 py-1 bg-zinc-900/80 border border-solid border-zinc-600 rounded-full text-[10px] font-black text-white pointer-events-none z-[50]"
        >
          BYE!
        </m.div>
        {[...Array(3)].map((_, i) => (
          <m.div
            key={`bye-spark-${i}`}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], x: (i - 1) * 20, y: -15 - i * 10 }}
            transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
            className="absolute bottom-1/2 left-1/2 size-1 -ml-0.5 -mb-0.5 rounded-full pointer-events-none z-[40]"
            style={{ background: theme.accent, boxShadow: `0 0 8px ${theme.glow}` }}
          />
        ))}
      </>
    );
  }

  if (animState === 'sleep-curl') {
    return (
      <>
        {[...Array(3)].map((_, i) => (
          <m.div
            key={`zzz-${i}`}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 0], x: 10 + i * 8, y: -25 - i * 18, scale: [0.5, 1, 1.2] }}
            transition={{ duration: 1.0, delay: 0.3 + i * 0.25, ease: 'easeOut' }}
            className="absolute bottom-[100%] left-1/2 text-[14px] font-black text-zinc-300 pointer-events-none z-[50]"
          >
            Z
          </m.div>
        ))}
        <m.div
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: [0, 0.4, 0], scale: [1, 0.9, 0.8] }}
          transition={{ duration: 1.2 }}
          className="absolute -inset-[15px] rounded-full pointer-events-none z-[35]"
          style={{ background: `radial-gradient(circle, ${theme.soft}22 0%, transparent 70%)` }}
        />
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.3, 0] }}
          transition={{ duration: 1.2 }}
          className="absolute bottom-[110%] left-1/2 -translate-x-1/2 px-2 py-0.5 bg-zinc-900/60 border border-solid border-zinc-700 rounded text-[9px] font-mono text-zinc-400 pointer-events-none z-[45]"
        >
          sleeping…
        </m.div>
      </>
    );
  }

  if (animState === 'rocket-blast') {
    return (
      <>
        <m.div
          initial={{ opacity: 1, y: 0, scale: 1 }}
          animate={{ opacity: [1, 1, 0], y: [0, -60, -200], scale: [1, 0.9, 0.6] }}
          transition={{ duration: 1.0, times: [0, 0.6, 1] }}
          className="absolute bottom-1/2 left-1/2 -translate-x-1/2 w-7 h-12 z-[40] pointer-events-none"
        >
          <div className="w-full h-full bg-[linear-gradient(180deg,#e2e8f0_0%,#94a3b8_50%,#475569_100%)] rounded-t-full rounded-b-md relative border border-solid border-slate-500">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-sky-400 border border-solid border-sky-600" />
            <div className="absolute -left-1 bottom-1.5 w-1.5 h-3.5 bg-slate-600 rounded-l-sm" />
            <div className="absolute -right-1 bottom-1.5 w-1.5 h-3.5 bg-slate-600 rounded-r-sm" />
          </div>
        </m.div>
        <m.div
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: [0, 0.9, 0.6, 0], scaleY: [0, 1, 1.5, 0] }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute bottom-1/2 left-1/2 -translate-x-1/2 w-5 h-24 origin-top pointer-events-none z-[35]"
          style={{ background: `linear-gradient(to bottom, ${theme.accent} 0%, ${theme.glow} 50%, transparent 100%)`, filter: 'blur(5px)' }}
        />
        {[...Array(8)].map((_, i) => (
          <m.div
            key={`blast-particle-${i}`}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
            animate={{ opacity: [0, 0.8, 0], x: (Math.random() - 0.5) * 50, y: 20 + Math.random() * 40, scale: [0, 1, 0] }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.05 }}
            className="absolute bottom-[35%] left-1/2 size-1 -ml-0.5 -mb-0.5 rounded-full pointer-events-none z-[38]"
            style={{ background: theme.glow }}
          />
        ))}
      </>
    );
  }

  if (animState === 'smoke-poof') {
    return (
      <>
        <m.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.8, 0], scale: [0.5, 1.6, 2.2] }}
          transition={{ duration: 0.6 }}
          className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2 size-[70px] rounded-full pointer-events-none z-[40]"
          style={{ background: `radial-gradient(circle, rgba(200,200,200,0.6) 0%, rgba(150,150,150,0.3) 40%, transparent 70%)`, filter: 'blur(6px)' }}
        />
        {[...Array(5)].map((_, i) => (
          <m.div
            key={`poof-puff-${i}`}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
            animate={{ opacity: [0, 0.7, 0], x: (Math.random() - 0.5) * 60, y: -20 - Math.random() * 30, scale: [0, 1 + Math.random(), 1.5] }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="absolute bottom-1/2 left-1/2 size-4 -ml-2 -mb-2 rounded-full pointer-events-none z-[38]"
            style={{ background: `radial-gradient(circle, rgba(220,220,220,0.5) 0%, transparent 70%)`, filter: 'blur(3px)' }}
          />
        ))}
        <m.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0, 1, 0], scale: [0.8, 1.1, 0.9] }}
          transition={{ duration: 0.5 }}
          className="absolute bottom-[110%] left-1/2 -translate-x-1/2 text-[12px] font-black text-zinc-300 pointer-events-none z-[50]"
        >
          POOF!
        </m.div>
      </>
    );
  }

  return null;
});

ExitEffects.displayName = 'ExitEffects';
