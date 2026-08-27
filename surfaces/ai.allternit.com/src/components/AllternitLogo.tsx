import React from 'react';
import { AProtocolWordmark } from './AProtocolWordmark';

interface AllternitLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'horizontal' | 'stacked' | 'icon-only';
  showText?: boolean;
}

/**
 * Allternit Brand Logo Component
 *
 * Uses the canonical A://TERNIT wordmark. Avoids placing the Matrix logo
 * next to the word "Allternit" — the wordmark is the single source of truth.
 */
export function AllternitLogo({ size = 'md', variant = 'horizontal', showText = true }: AllternitLogoProps) {
  const height = size === 'sm' ? 16 : size === 'md' ? 22 : 32;

  if (variant === 'icon-only' || !showText) {
    return <AProtocolWordmark collapsed theme="adaptive" height={height} />;
  }

  if (variant === 'stacked') {
    return (
      <div className="flex flex-col items-center gap-2">
        <AProtocolWordmark collapsed theme="adaptive" height={height} />
        <AProtocolWordmark theme="adaptive" height={height} />
      </div>
    );
  }

  // Horizontal (default) — full A://TERNIT wordmark
  return <AProtocolWordmark theme="adaptive" height={height} />;
}
