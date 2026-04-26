'use client';

import React from 'react';

// Deterministic hue from a string — same id always yields the same colour pair.
function hashToHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(h) % 360;
}

interface GenerativeCoverProps {
  id: string;
  badgeColor: string;
  style?: React.CSSProperties;
}

export function GenerativeCover({ id, badgeColor, style }: GenerativeCoverProps) {
  const hue = hashToHue(id);
  const hue2 = (hue + 60) % 360;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(135deg, hsl(${hue},55%,12%) 0%, hsl(${hue2},40%,8%) 60%, #0a0a0d 100%)`,
        ...style,
      }}
    >
      {/* Subtle radial accent using the badge colour */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          right: '10%',
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${badgeColor}18 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
