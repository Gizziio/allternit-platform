import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Scissors, FileText, FastForward, Rewind, CheckCircle, VideoCamera, MusicNotes, SpeakerHigh } from '@phosphor-icons/react';
import { GlassCard } from '../../../design/GlassCard';

interface EditEvent {
  id: string;
  type: 'cut' | 'overlay' | 'audio';
  time: number;
  duration: number;
  content: string;
}

export function VideoEditorView() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [edl, setEdl] = useState<EditEvent[]>([
    { id: '1', type: 'cut', time: 0, duration: 5, content: 'Intro: User greeting' },
    { id: '2', type: 'overlay', time: 2, duration: 3, content: '[v:metric label="Growth" val="+24%"]' },
    { id: '3', type: 'cut', time: 5, duration: 10, content: 'Deep dive into metrics' },
  ]);

  const totalDuration = 15;
  const progress = (currentTime / totalDuration) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#050505", overflow: "hidden" }}>
      {/* Viewport Area */}
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
         <div style={{ width: "100%", maxWidth: "800px", aspectHeight: "16/9", background: "#0a0a0c", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}>
            {/* Active Overlay (Design-on-Steroids Sync) */}
            {edl.filter(e => e.type === 'overlay' && currentTime >= e.time && currentTime <= e.time + e.duration).map(e => (
               <div key={e.id} style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", zIndex: 10 }} className="animate-in fade-in zoom-in duration-300">
                  <GlassCard style={{ padding: "12px 24px", background: "rgba(212,176,140,0.1)", borderColor: "var(--accent-primary)" }}>
                     <div style={{ fontSize: "12px", color: "var(--accent-primary)", fontMono: "monospace" }}>{e.content}</div>
                  </GlassCard>
               </div>
            ))}
            
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)" }}>
               <VideoCamera size={48} style={{ margin: "0 auto 16px", opacity: 0.1 }} />
               <div style={{ fontSize: "14px", fontMono: "monospace" }}>[ VIDEO_USE_ENGINE: READY ]</div>
            </div>
         </div>
      </div>

      {/* Timeline Controls */}
      <div style={{ height: "300px", background: "rgba(15,13,12,0.98)", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column" }}>
         {/* Toolbar */}
         <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
               <button style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}><Rewind size={20} /></button>
               <button 
                onClick={() => setIsPlaying(!isPlaying)}
                style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--accent-primary)", color: "#000", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
               >
                  {isPlaying ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
               </button>
               <button style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}><FastForward size={20} /></button>
               <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)", margin: "0 8px" }} />
               <span style={{ fontSize: "12px", fontMono: "monospace", color: "rgba(255,255,255,0.6)" }}>
                 00:{currentTime.toFixed(2).padStart(5, '0')} / 00:{totalDuration.toFixed(2)}
               </span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
               <button style={{ padding: "6px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                  <Scissors size={14} style={{ display: "inline", marginRight: "6px" }} /> Split
               </button>
               <button style={{ padding: "6px 16px", borderRadius: "6px", background: "var(--accent-primary)", border: "none", color: "#000", fontSize: "11px", fontWeight: 800, cursor: "pointer" }}>
                  Export .MP4
               </button>
            </div>
         </div>

         {/* Tracks */}
         <div style={{ flex: 1, overflowX: "auto", position: "relative", padding: "20px 0" }}>
            {/* Scrubber Line */}
            <div style={{ position: "absolute", left: `${progress}%`, top: 0, bottom: 0, width: "2px", background: "#ff4d4d", zIndex: 10, transition: "left 0.1s linear" }} />
            
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
               {/* Video Track */}
               <div style={{ height: "40px", background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", padding: "0 20px" }}>
                  <VideoCamera size={14} style={{ color: "rgba(255,255,255,0.2)", width: "30px" }} />
                  <div style={{ flex: 1, height: "30px", background: "rgba(59,130,246,0.1)", borderRadius: "4px", border: "1px solid rgba(59,130,246,0.2)", display: "flex" }}>
                     {edl.filter(e => e.type === 'cut').map(e => (
                        <div key={e.id} style={{ width: `${(e.duration / totalDuration) * 100}%`, borderRight: "1px solid rgba(255,255,255,0.1)", padding: "4px 8px", fontSize: "9px", color: "rgba(255,255,255,0.4)", overflow: "hidden", whiteSpace: "nowrap" }}>
                           {e.content}
                        </div>
                     ))}
                  </div>
               </div>

               {/* Overlay Track */}
               <div style={{ height: "40px", background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", padding: "0 20px" }}>
                  <FileText size={14} style={{ color: "rgba(255,255,255,0.2)", width: "30px" }} />
                  <div style={{ flex: 1, position: "relative", height: "30px" }}>
                     {edl.filter(e => e.type === 'overlay').map(e => (
                        <div key={e.id} style={{ position: "absolute", left: `${(e.time / totalDuration) * 100}%`, width: `${(e.duration / totalDuration) * 100}%`, height: "24px", top: "3px", background: "rgba(139,92,246,0.1)", borderRadius: "4px", border: "1px solid rgba(139,92,246,0.3)", padding: "2px 6px", fontSize: "8px", color: "rgba(139,92,246,0.9)", fontWeight: 800 }}>
                           G-UI Artifact
                        </div>
                     ))}
                  </div>
               </div>

               {/* Audio Track */}
               <div style={{ height: "40px", background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", padding: "0 20px" }}>
                  <SpeakerHigh size={14} style={{ color: "rgba(255,255,255,0.2)", width: "30px" }} />
                  <div style={{ flex: 1, height: "30px", background: "rgba(16,185,129,0.05)", borderRadius: "4px", position: "relative", overflow: "hidden" }}>
                     {/* Waveform Visualization Placeholder */}
                     <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: "2px", padding: "0 4px" }}>
                        {Array.from({ length: 100 }).map((_, i) => (
                           <div key={i} style={{ flex: 1, height: `${Math.random() * 80 + 10}%`, background: "rgba(16,185,129,0.3)", borderRadius: "1px" }} />
                        ))}
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
