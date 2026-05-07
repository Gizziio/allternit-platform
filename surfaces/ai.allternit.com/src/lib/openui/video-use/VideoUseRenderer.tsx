import React, { useState, useRef } from 'react';
import { Play, Pause, FileText, CheckCircle } from '@phosphor-icons/react';

interface VideoUseRendererProps {
  videoUrl?: string; // Placeholder for actual video source
  transcript: Array<{ time: number; text: string }>;
  title?: string;
}

/**
 * VideoUseRenderer
 * 
 * Renders an AI-generated video walkthrough alongside its word-level transcript.
 * This is used when an agent completes a complex task or builds a new blueprint
 * and needs to visually demonstrate how to use it.
 */
export const VideoUseRenderer: React.FC<VideoUseRendererProps> = ({
  videoUrl,
  transcript,
  title = "AI Walkthrough Demo"
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  return (
    <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-black/40 overflow-hidden flex flex-col shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center text-[var(--accent-primary)]">
            <Play weight="fill" size={14} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Automated Demonstration</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-green-400 bg-green-400/10 px-3 py-1.5 rounded-full font-bold uppercase tracking-widest">
           <CheckCircle size={14} /> Self-Eval Passed
        </div>
      </div>

      {/* Media Player Area (Mock for now, would be actual video element) */}
      <div className="relative aspect-video bg-black flex items-center justify-center group">
         {videoUrl ? (
           <video 
             ref={videoRef}
             src={videoUrl} 
             className="w-full h-full object-cover"
             onTimeUpdate={handleTimeUpdate}
             onEnded={() => setIsPlaying(false)}
           />
         ) : (
           <div className="text-center text-white/30 flex flex-col items-center">
             <div className="w-16 h-16 rounded-full border-2 border-white/10 flex items-center justify-center mb-4">
               <Play size={24} weight="fill" />
             </div>
             <p className="text-sm font-mono">[Video Output Stream: Pending Connection]</p>
           </div>
         )}

         {/* Overlay Controls */}
         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button 
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-[var(--accent-primary)] text-black flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
            >
              {isPlaying ? <Pause size={24} weight="fill" /> : <Play size={24} weight="fill" />}
            </button>
         </div>
      </div>

      {/* Transcript Area */}
      <div className="h-48 border-t border-white/10 bg-black/20 p-4 overflow-y-auto">
        <div className="flex items-center gap-2 mb-4 text-white/40 border-b border-white/5 pb-2">
           <FileText size={14} />
           <span className="text-[10px] font-bold uppercase tracking-widest">Reasoning Transcript</span>
        </div>
        <div className="flex flex-col gap-2">
          {transcript.map((item, idx) => {
            const isActive = currentTime >= item.time && (idx === transcript.length - 1 || currentTime < transcript[idx + 1].time);
            return (
              <div 
                key={idx} 
                className={`flex gap-4 p-2 rounded-lg transition-colors ${isActive ? 'bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30' : 'hover:bg-white/5'}`}
              >
                <div className={`text-[10px] font-mono mt-1 ${isActive ? 'text-[var(--accent-primary)]' : 'text-white/30'}`}>
                  {Math.floor(item.time / 60).toString().padStart(2, '0')}:{Math.floor(item.time % 60).toString().padStart(2, '0')}
                </div>
                <div className={`text-xs leading-relaxed ${isActive ? 'text-white font-medium' : 'text-white/60'}`}>
                  {item.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VideoUseRenderer;
