import React, { useState, useEffect } from 'react';
import { Play, Pause, FastForward, Rewind, CheckCircle, VideoCamera, SpeakerHigh, Cursor, TextT, MonitorPlay, Sparkle, DownloadSimple, Code, CircleNotch } from '@phosphor-icons/react';
import { motion } from 'framer-motion';

// Mock types for the timeline
interface TrackItem {
  id: string;
  type: 'ui_render' | 'typing' | 'cursor' | 'voiceover' | 'transition';
  start: number;
  duration: number;
  label: string;
  color: string;
}

export function VideoEditorView() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  
  const totalDuration = 30;
  const progress = (currentTime / totalDuration) * 100;

  const [tracks] = useState<{ id: string; name: string; icon: React.ReactNode; items: TrackItem[] }[]>([
    {
      id: 'ui',
      name: 'UI Manifestation',
      icon: <MonitorPlay size={16} />,
      items: [
        { id: '1', type: 'ui_render', start: 5, duration: 10, label: 'Render Banking Dashboard', color: 'var(--status-info)' },
        { id: '2', type: 'transition', start: 15, duration: 2, label: 'Glass Morph Transition', color: '#8b5cf6' },
        { id: '3', type: 'ui_render', start: 17, duration: 10, label: 'Apply Dark Mode Tokens', color: 'var(--status-info)' }
      ]
    },
    {
      id: 'agent',
      name: 'Agent Typing',
      icon: <TextT size={16} />,
      items: [
        { id: '4', type: 'typing', start: 1, duration: 4, label: '"Mock up a banking dashboard..."', color: 'var(--accent-primary)' },
        { id: '5', type: 'typing', start: 15, duration: 2, label: '"Make it dark mode"', color: 'var(--accent-primary)' }
      ]
    },
    {
      id: 'cursor',
      name: 'Cursor Movement',
      icon: <Cursor size={16} />,
      items: [
        { id: '6', type: 'cursor', start: 4, duration: 1, label: 'Click Send', color: 'var(--status-success)' },
        { id: '7', type: 'cursor', start: 20, duration: 3, label: 'Interact with Chart', color: 'var(--status-success)' }
      ]
    },
    {
      id: 'audio',
      name: 'AI Voiceover',
      icon: <SpeakerHigh size={16} />,
      items: [
        { id: '8', type: 'voiceover', start: 0, duration: 5, label: 'Welcome to the new studio...', color: 'var(--status-warning)' },
        { id: '9', type: 'voiceover', start: 6, duration: 8, label: 'Instantly generate high-fidelity UI...', color: 'var(--status-warning)' }
      ]
    }
  ]);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(t => {
          if (t >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return t + 0.1;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleRender = async () => {
     setIsRendering(true);
     // Simulate tool call to video_render_ops
     setTimeout(() => {
        setIsRendering(false);
        alert("Render Complete! File saved to /Users/macbook/Desktop/allternit-studio/exports/campaign_reel.mp4");
     }, 3000);
  };

  return (
    <div className="flex flex-col h-full bg-[#111113] text-white font-sans overflow-hidden rounded-3xl border border-white/5 shadow-2xl">
      
      {/* Top Header */}
      <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-[#16161a]">
         <div className="flex items-center gap-3">
            <VideoCamera size={20} className="text-[var(--accent-primary)]" weight="fill" />
            <span className="font-bold text-sm tracking-wide uppercase">Cutscene Studio</span>
            <span className="px-2 py-0.5 rounded bg-[var(--accent-primary)]/10 text-[10px] font-bold text-[var(--accent-primary)] ml-2 uppercase tracking-widest border border-[var(--accent-primary)]/20">Programmatic Engine</span>
         </div>
         <div className="flex gap-3">
            <button className="px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-white/70 hover:bg-white/10 transition-colors flex items-center gap-2">
               <CheckCircle size={14} /> Sync UI State
            </button>
            <button 
               onClick={handleRender}
               disabled={isRendering}
               className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-bold flex items-center gap-2 hover:bg-[#d97757] transition-colors disabled:opacity-50"
            >
               {isRendering ? <CircleNotch className="animate-spin" size={14} /> : <DownloadSimple size={14} weight="bold" />}
               {isRendering ? 'Rendering...' : 'Render MP4'}
            </button>
         </div>
      </div>

      {/* Main Workspace Split */}
      <div className="flex-1 flex overflow-hidden">
         
         {/* Left Asset Panel */}
         <div className="w-64 border-r border-white/10 bg-[#16161a] p-4 flex flex-col gap-6 overflow-y-auto">
            <div>
               <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">Project Assets</h3>
               <div className="flex flex-col gap-2">
                  <AssetItem icon={<Code size={16} />} title="Design.md Tokens" type="Data" />
                  <AssetItem icon={<MonitorPlay size={16} />} title="Banking Dashboard" type="UI Block" />
                  <AssetItem icon={<MonitorPlay size={16} />} title="Analytics Chart" type="UI Block" />
               </div>
            </div>
            
            <div>
               <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">Generative Effects</h3>
               <div className="flex flex-col gap-2">
                  <AssetItem icon={<TextT size={16} />} title="Auto-Type Prompt" type="Animation" color="var(--accent-primary)" />
                  <AssetItem icon={<Cursor size={16} />} title="Smooth Cursor" type="Animation" color="#10b981" />
                  <AssetItem icon={<Sparkle size={16} />} title="Glass Morph" type="Transition" color="#8b5cf6" />
               </div>
            </div>
         </div>

         {/* Center Preview Player */}
         <div className="flex-1 flex flex-col bg-[#0a0a0c] relative">
            <div className="flex-1 flex items-center justify-center p-8">
               {/* Video Frame */}
               <div className="w-full max-w-3xl aspect-video bg-black rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden flex items-center justify-center">
                  
                  {/* Simulated Content based on time */}
                  {currentTime < 5 ? (
                     <div className="w-2/3 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center px-4">
                        <span className="font-mono text-sm text-white/80 border-r-2 border-[var(--accent-primary)] pr-1 animate-pulse">
                           Mock up a banking dashboard...
                        </span>
                     </div>
                  ) : currentTime < 15 ? (
                     <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="w-3/4 h-3/4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6"
                     >
                        <div className="w-1/3 h-4 bg-white/20 rounded mb-6" />
                        <div className="grid grid-cols-3 gap-4">
                           <div className="h-20 bg-white/10 rounded-xl border border-white/5" />
                           <div className="h-20 bg-white/10 rounded-xl border border-white/5" />
                           <div className="h-20 bg-white/10 rounded-xl border border-white/5" />
                        </div>
                     </motion.div>
                  ) : (
                     <motion.div 
                        initial={{ backgroundColor: 'var(--ui-border-default)' }}
                        animate={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
                        className="w-3/4 h-3/4 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
                     >
                        <div className="w-1/3 h-4 bg-white/10 rounded mb-6" />
                        <div className="grid grid-cols-3 gap-4">
                           <div className="h-20 bg-white/5 rounded-xl border border-white/5" />
                           <div className="h-20 bg-white/5 rounded-xl border border-white/5" />
                           <div className="h-20 bg-white/5 rounded-xl border border-white/5" />
                        </div>
                     </motion.div>
                  )}

                  {/* Watermark/Status */}
                  <div className="absolute bottom-4 right-4 text-[10px] font-mono text-white/30 tracking-widest">
                     [ REMOTION_ENGINE : {currentTime.toFixed(2)}s ]
                  </div>
               </div>
            </div>

            {/* Playback Controls */}
            <div className="h-12 bg-[#16161a] border-t border-white/10 flex items-center justify-center gap-6">
               <button onClick={() => setCurrentTime(0)} className="text-white/50 hover:text-white transition-colors"><Rewind size={20} weight="fill" /></button>
               <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
               >
                  {isPlaying ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" className="ml-0.5" />}
               </button>
               <button onClick={() => setCurrentTime(totalDuration)} className="text-white/50 hover:text-white transition-colors"><FastForward size={20} weight="fill" /></button>
               
               <div className="w-px h-4 bg-white/20 mx-4" />
               <span className="font-mono text-[11px] text-white/60 w-24">
                  00:{(currentTime < 10 ? '0' : '') + currentTime.toFixed(1)} / 00:{totalDuration}
               </span>
            </div>
         </div>

      </div>

      {/* Bottom Timeline */}
      <div className="h-72 bg-[#1a1a1e] border-t border-white/10 flex flex-col relative select-none">
         <div className="h-8 border-b border-white/5 flex">
            <div className="w-48 border-r border-white/5 bg-[#16161a]" />
            <div className="flex-1 relative bg-[#111113]">
               {Array.from({ length: totalDuration + 1 }).map((_, i) => (
                  <div key={i} className="absolute top-0 bottom-0 border-l border-white/5 flex flex-col justify-end pb-1" style={{ left: `${(i / totalDuration) * 100}%` }}>
                     {i % 5 === 0 && <span className="text-[9px] text-white/30 ml-1 mb-1">{i}s</span>}
                  </div>
               ))}
               <div className="absolute top-0 bottom-0 w-px bg-[var(--accent-primary)] z-50 pointer-events-none" style={{ left: `${progress}%` }}>
                  <div className="absolute -top-2 -left-1.5 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-[var(--accent-primary)]" />
               </div>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col relative">
            {tracks.map(track => (
               <div key={track.id} className="h-14 border-b border-white/5 flex group">
                  <div className="w-48 bg-[#16161a] border-r border-white/5 px-4 flex items-center gap-3">
                     <div className="text-white/40 group-hover:text-white/80 transition-colors">{track.icon}</div>
                     <span className="text-xs font-bold text-white/70 truncate uppercase tracking-wider">{track.name}</span>
                  </div>
                  <div className="flex-1 relative bg-[#111113]/50 hover:bg-[#111113] transition-colors">
                     {track.items.map(item => (
                        <div 
                           key={item.id}
                           className="absolute top-2 bottom-2 rounded-lg border border-white/10 flex items-center px-3 overflow-hidden shadow-lg cursor-pointer hover:brightness-110 transition-all"
                           style={{ 
                              left: `${(item.start / totalDuration) * 100}%`, 
                              width: `${(item.duration / totalDuration) * 100}%`,
                              backgroundColor: `${item.color}25`,
                              borderColor: `${item.color}50`
                           }}
                        >
                           <span className="text-[9px] font-black truncate uppercase tracking-widest" style={{ color: item.color }}>{item.label}</span>
                        </div>
                     ))}
                  </div>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
}

function AssetItem({ icon, title, type, color = "#fff" }: any) {
   return (
      <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center gap-3 cursor-grab hover:bg-white/[0.05] hover:border-white/[0.1] transition-all">
         <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center" style={{ color }}>
            {icon}
         </div>
         <div>
            <div className="text-[11px] font-bold text-white/80">{title}</div>
            <div className="text-[9px] font-bold text-white/30 uppercase tracking-tight">{type}</div>
         </div>
      </div>
   );
}
