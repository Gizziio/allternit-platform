'use client';

import React from 'react';
import { X } from '@phosphor-icons/react';
import type { ExtensionPromo } from './extension-promos.data';

interface ExtensionPromoModalProps {
  promo: ExtensionPromo;
  onCTA: (promo: ExtensionPromo) => void;
  onDismiss: () => void;
}

export function ExtensionPromoModal({ promo, onCTA, onDismiss }: ExtensionPromoModalProps) {
  return (
    <div style={styles.backdrop} onClick={onDismiss}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="promo-headline">

        {/* ── Left panel — content ── */}
        <div style={styles.leftPanel}>

          {/* Close */}
          <button style={styles.closeButton} onClick={onDismiss} aria-label="Dismiss">
            <X size={16} weight="bold" />
          </button>

          {/* Badge */}
          {promo.badge && (
            <span style={{ ...styles.badge, borderColor: `${promo.accentColor}55`, color: promo.accentColor }}>
              {promo.badge}
            </span>
          )}

          {/* Headline */}
          <h2 id="promo-headline" style={styles.headline}>
            {promo.headline}
          </h2>

          {/* Bullets */}
          <ul style={styles.bulletList}>
            {promo.bullets.map((bullet, i) => (
              <li key={i} style={styles.bulletItem}>
                <span style={{ ...styles.bulletDot, background: promo.accentColor }} />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div style={styles.ctaRow}>
            <button
              style={{ ...styles.ctaPrimary, borderColor: promo.accentColor, color: promo.accentColor }}
              onClick={() => onCTA(promo)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = `${promo.accentColor}18`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              {promo.ctaLabel}
            </button>
            <button
              style={styles.ctaSecondary}
              onClick={onDismiss}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)';
              }}
            >
              Maybe later
            </button>
          </div>
        </div>

        {/* ── Right panel — product visual ── */}
        <div style={{ ...styles.rightPanel, background: promo.accentColor }}>
          <div style={styles.visualWrapper}>
            <img
              src={promo.visual}
              alt={promo.visualAlt}
              style={styles.visual}
              draggable={false}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'var(--shell-overlay-backdrop)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9000,
    padding: '16px',
  },
  modal: {
    display: 'flex',
    width: '100%',
    maxWidth: '820px',
    minHeight: '440px',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 32px 80px var(--shell-overlay-backdrop)',
  },
  leftPanel: {
    flex: '0 0 50%',
    background: '#1A1A1A',
    padding: '40px 40px 36px',
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const,
    gap: '0px',
  },
  closeButton: {
    position: 'absolute' as const,
    top: '16px',
    right: '16px',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '1px solid var(--ui-border-default)',
    background: 'var(--ui-border-muted)',
    color: 'rgba(255,255,255,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'color 0.15s, background 0.15s',
    padding: 0,
  },
  badge: {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    padding: '3px 10px',
    borderRadius: '100px',
    border: '1px solid',
    marginBottom: '16px',
    width: 'fit-content',
  },
  headline: {
    fontSize: '26px',
    fontWeight: 700,
    lineHeight: 1.25,
    color: 'var(--ui-text-primary)',
    margin: '0 0 24px 0',
    letterSpacing: '-0.02em',
  },
  bulletList: {
    listStyle: 'none',
    margin: '0 0 32px 0',
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    flex: 1,
  },
  bulletItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    fontSize: '14px',
    lineHeight: 1.5,
    color: 'rgba(255,255,255,0.75)',
  },
  bulletDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    marginTop: '7px',
    flexShrink: 0,
  },
  ctaRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  ctaPrimary: {
    height: '44px',
    borderRadius: '8px',
    border: '1.5px solid',
    background: 'transparent',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
    letterSpacing: '-0.01em',
  },
  ctaSecondary: {
    height: '44px',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    fontSize: '14px',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
    transition: 'color 0.15s',
    letterSpacing: '-0.01em',
  },
  rightPanel: {
    flex: '0 0 50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    transition: 'background 0.4s ease',
  },
  visualWrapper: {
    width: '100%',
    maxWidth: '320px',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
  },
  visual: {
    width: '100%',
    height: 'auto',
    display: 'block',
    userSelect: 'none' as const,
  },
} as const;
