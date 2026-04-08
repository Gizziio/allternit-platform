'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ExtensionPromoModal } from './ExtensionPromoModal';
import { EXTENSION_PROMOS, type ExtensionPromo } from './extension-promos.data';

interface ExtensionPromoCarouselProps {
  /** Subset of promos to show — defaults to all four */
  promos?: ExtensionPromo[];
  /** Auto-advance interval in ms (default 6000). Set 0 to disable auto-advance. */
  interval?: number;
  /** Called when the user clicks the primary CTA */
  onCTA?: (promo: ExtensionPromo) => void;
  /** Called when the carousel is fully dismissed (all promos seen or explicit close) */
  onDismiss?: () => void;
}

/**
 * ExtensionPromoCarousel
 *
 * Rotates through all extension promos with dot indicators.
 * Auto-advances on a timer; pauses while the user hovers.
 * Dismisses the whole sequence when the user clicks "Maybe later" on any slide,
 * or after cycling through all promos once.
 *
 * Usage:
 *   <ExtensionPromoCarousel onDismiss={() => setShowPromo(false)} />
 */
export function ExtensionPromoCarousel({
  promos = EXTENSION_PROMOS,
  interval = 6000,
  onCTA,
  onDismiss,
}: ExtensionPromoCarouselProps) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const pausedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback(() => {
    setIndex((prev) => {
      const next = prev + 1;
      if (next >= promos.length) {
        // Cycled through all promos — dismiss
        setVisible(false);
        onDismiss?.();
        return prev;
      }
      return next;
    });
  }, [promos.length, onDismiss]);

  // Auto-advance timer
  useEffect(() => {
    if (!visible || interval === 0) return;

    const schedule = () => {
      timerRef.current = setTimeout(() => {
        if (!pausedRef.current) advance();
        schedule();
      }, interval);
    };

    schedule();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, interval, advance]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    onDismiss?.();
  }, [onDismiss]);

  const handleCTA = useCallback(
    (promo: ExtensionPromo) => {
      onCTA?.(promo);
      // Advance to next promo after CTA click, or dismiss if last
      if (index + 1 >= promos.length) {
        handleDismiss();
      } else {
        setIndex((prev) => prev + 1);
      }
    },
    [index, promos.length, onCTA, handleDismiss],
  );

  const goTo = useCallback((i: number) => {
    setIndex(i);
    // Reset the timer on manual navigation
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  if (!visible || promos.length === 0) return null;

  const current = promos[index];

  return (
    <div
      onMouseEnter={() => { pausedRef.current = true }}
      onMouseLeave={() => { pausedRef.current = false }}
    >
      <ExtensionPromoModal
        promo={current}
        onCTA={handleCTA}
        onDismiss={handleDismiss}
      />

      {/* Dot indicators — rendered inside the backdrop via portal-like positioning */}
      {promos.length > 1 && (
        <div style={dotStyles.container}>
          {promos.map((p, i) => (
            <button
              key={p.id}
              aria-label={`Go to ${p.extensionName} promo`}
              style={{
                ...dotStyles.dot,
                background: i === index ? current.accentColor : 'rgba(255,255,255,0.3)',
                width: i === index ? '20px' : '6px',
              }}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dot indicator styles ──────────────────────────────────────────────────────

const dotStyles = {
  container: {
    position: 'fixed' as const,
    bottom: 'calc(50% - 240px)',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    zIndex: 9001,
  },
  dot: {
    height: '6px',
    borderRadius: '100px',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    transition: 'width 0.25s ease, background 0.25s ease',
  },
} as const;
