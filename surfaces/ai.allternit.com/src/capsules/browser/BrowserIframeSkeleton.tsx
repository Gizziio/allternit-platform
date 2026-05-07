"use client";

import { RADIUS } from "@/design/allternit.tokens";
// Theme-aware tokens for browser chrome
const BACKGROUND = {
  primary: 'var(--bg-primary)',
  secondary: 'var(--bg-secondary)',
  tertiary: 'var(--bg-tertiary)',
  elevated: 'var(--bg-elevated)',
  hover: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
  active: 'color-mix(in srgb, var(--text-primary) 8%, transparent)',
};

const TEXT = {
  primary: 'var(--text-primary)',
  secondary: 'var(--text-secondary)',
  tertiary: 'var(--text-muted)',
  disabled: 'var(--text-disabled)',
  inverse: 'var(--text-inverse)',
};

const BORDER = {
  subtle: 'var(--border-subtle)',
  default: 'var(--border-default)',
  strong: 'var(--border-strong)',
  hover: 'var(--border-focus)',
  focus: 'var(--border-focus)',
};

const SHADOW = {
  xs: '0 2px 8px rgba(0,0,0,0.15)',
  sm: '0 4px 16px rgba(0,0,0,0.18)',
  md: '0 8px 32px rgba(0,0,0,0.2)',
  lg: '0 12px 48px rgba(0,0,0,0.3)',
  xl: '0 20px 64px rgba(0,0,0,0.35)',
  glow: '0 0 20px color-mix(in srgb, var(--accent-primary) 25%, transparent)',
};

const STATUS = {
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#60a5fa',
  neutral: 'var(--text-muted)',
};

const SAND = {
  50: 'var(--bg-primary)',
  100: 'var(--bg-secondary)',
  200: 'color-mix(in srgb, var(--accent-primary) 20%, transparent)',
  300: 'color-mix(in srgb, var(--accent-primary) 30%, transparent)',
  400: 'color-mix(in srgb, var(--accent-primary) 40%, transparent)',
  500: 'var(--accent-primary)',
  600: 'color-mix(in srgb, var(--accent-primary) 80%, black)',
  700: 'color-mix(in srgb, var(--accent-primary) 60%, black)',
  800: 'color-mix(in srgb, var(--accent-primary) 40%, black)',
  900: 'color-mix(in srgb, var(--accent-primary) 20%, black)',
  950: 'color-mix(in srgb, var(--bg-primary) 80%, black)',
};


export function BrowserIframeSkeleton() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: BACKGROUND.primary,
        display: "flex",
        flexDirection: "column",
        padding: 24,
        gap: 16,
      }}
    >
      {/* URL bar skeleton */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          className="animate-pulse"
          style={{
            width: 32,
            height: 32,
            borderRadius: RADIUS.full,
            background: BORDER.subtle,
          }}
        />
        <div
          className="animate-pulse"
          style={{
            flex: 1,
            height: 32,
            borderRadius: RADIUS.full,
            background: BORDER.subtle,
          }}
        />
      </div>
      {/* Content skeleton blocks */}
      <div
        className="animate-pulse"
        style={{
          width: "60%",
          height: 24,
          borderRadius: RADIUS.sm,
          background: BORDER.subtle,
        }}
      />
      <div
        className="animate-pulse"
        style={{
          width: "100%",
          height: 160,
          borderRadius: RADIUS.md,
          background: BORDER.subtle,
        }}
      />
      <div style={{ display: "flex", gap: 12 }}>
        <div
          className="animate-pulse"
          style={{
            flex: 1,
            height: 120,
            borderRadius: RADIUS.md,
            background: BORDER.subtle,
          }}
        />
        <div
          className="animate-pulse"
          style={{
            flex: 1,
            height: 120,
            borderRadius: RADIUS.md,
            background: BORDER.subtle,
          }}
        />
      </div>
      <div
        className="animate-pulse"
        style={{
          width: "80%",
          height: 16,
          borderRadius: RADIUS.sm,
          background: BORDER.subtle,
        }}
      />
      <div
        className="animate-pulse"
        style={{
          width: "90%",
          height: 16,
          borderRadius: RADIUS.sm,
          background: BORDER.subtle,
        }}
      />
      <div
        className="animate-pulse"
        style={{
          width: "50%",
          height: 16,
          borderRadius: RADIUS.sm,
          background: BORDER.subtle,
        }}
      />
    </div>
  );
}
