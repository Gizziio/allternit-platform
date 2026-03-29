import React, { useState, useEffect } from 'react';
import { tokens } from '../design/tokens';

export function FloatingOrb() {
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'var(--shell-floating-bg)',
        backdropFilter: 'blur(12px) saturate(150%)',
        border: '1px solid var(--shell-floating-border)',
        boxShadow: isHovered 
          ? 'var(--shadow-xl)'
          : 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s ' + tokens.motion.spring,
        transform: 'scale(' + (isHovered ? 1.05 : pulse) + ')',
        cursor: 'pointer',
        position: 'fixed',
        bottom: 40,
        left: '50%',
        marginLeft: -40,
        zIndex: 1000,
      }}
    >
      <div style={{
        width: 60,
        height: 60,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--accent-cowork) 0%, var(--status-info) 50%, var(--accent-code) 100%)',
        opacity: 0.8,
        filter: 'blur(4px)',
      }} />
      <div style={{
        position: 'absolute',
        display: 'flex',
        gap: 8,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ui-text-inverse)' }} />
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ui-text-inverse)' }} />
      </div>
    </div>
  );
}
