import React, { useState, useEffect } from 'react';
import { tokens } from '../design/tokens';
import { cn } from '@/lib/utils';

export function FloatingOrb(): React.ReactNode {
  const [isHovered, setIsHovered] = useState(false);
  const [pulse, setPulse] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(p => p === 1 ? 1.05 : 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      role="button"
      tabIndex={0}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { /* action */ } }}
      className={cn(
        "fixed bottom-10 left-1/2 -ml-10 size-20 rounded-full bg-[var(--shell-floating-bg)] backdrop-blur-md backdrop-saturate-[150%] border border-solid border-[var(--shell-floating-border)] flex items-center justify-center cursor-pointer z-[100] transition-all duration-300",
        isHovered ? "shadow-[var(--shadow-xl)]" : "shadow-[var(--shadow-lg)]"
      )}
      style={{
        transitionTimingFunction: tokens.motion.spring,
        transform: `scale(${isHovered ? 1.05 : pulse})`,
      }}
    >
      <div className="size-[60px] rounded-full bg-[linear-gradient(135deg,var(--accent-cowork)_0%,var(--status-info)_50%,var(--accent-code)_100%)] opacity-80 blur-[4px]" />
      <div className="absolute flex gap-2">
        <div className="size-1.5 rounded-full bg-[var(--ui-text-inverse)]" />
        <div className="size-1.5 rounded-full bg-[var(--ui-text-inverse)]" />
      </div>
    </div>
  );
}
