/**
 * @fileoverview Design Token Visual Test Page
 * 
 * Comprehensive visual test page demonstrating all design tokens.
 * Use this page to verify tokens render correctly in both light and dark modes.
 * 
 * @module design/tokens/__tests__/TokenTestPage
 * @version 1.0.0
 */

import React, { useState } from 'react';
import {
  theme,
  tokens,
  getModeColor,
  brand,
  semantic,
  neutral,
  fontSize,
  fontSizePx,
  fontWeight,
  spacing,
  elevation,
  glass,
  glow,
  radii,
  duration,
  easing,
  breakpointsPx,
  zIndexNum,
} from '../index';

// ============================================================================
// Styles
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: tokens.spacing['6'],
    fontFamily: tokens.typography.fontFamily.sans,
    transition: `background-color ${duration.normal} ${easing.easeInOut}, color ${duration.normal} ${easing.easeInOut}`,
  },
  header: {
    marginBottom: tokens.spacing['8'],
    borderBottom: `1px solid ${neutral[300]}`,
    paddingBottom: tokens.spacing['4'],
  },
  title: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    marginBottom: tokens.spacing['2'],
    letterSpacing: '-0.025em',
  },
  subtitle: {
    fontSize: fontSize.lg,
    color: neutral[500],
    marginBottom: tokens.spacing['4'],
  },
  section: {
    marginBottom: tokens.spacing['12'],
  },
  sectionTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.semibold,
    marginBottom: tokens.spacing['4'],
    paddingBottom: tokens.spacing['2'],
    borderBottom: `2px solid ${brand.DEFAULT}`,
    display: 'inline-block',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: tokens.spacing['4'],
  },
  colorSwatch: {
    padding: tokens.spacing['4'],
    borderRadius: radii.lg,
    textAlign: 'center' as const,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    boxShadow: elevation.sm,
    transition: `transform ${duration.fast} ${easing.easeOut}`,
    cursor: 'pointer',
  },
  typographySample: {
    marginBottom: tokens.spacing['4'],
    padding: tokens.spacing['4'],
    borderRadius: radii.md,
    border: `1px solid ${neutral[200]}`,
  },
  spacingBox: {
    backgroundColor: brand[100],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: brand[800],
    borderRadius: radii.sm,
  },
  shadowBox: {
    padding: tokens.spacing['6'],
    backgroundColor: 'white',
    borderRadius: radii.lg,
    marginBottom: tokens.spacing['4'],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radiusBox: {
    width: '80px',
    height: '80px',
    backgroundColor: brand[500],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  animationBox: {
    width: '60px',
    height: '60px',
    backgroundColor: brand[500],
    borderRadius: radii.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    cursor: 'pointer',
  },
  toggle: {
    position: 'fixed' as const,
    top: tokens.spacing['4'],
    right: tokens.spacing['4'],
    padding: `${tokens.spacing['2']} ${tokens.spacing['4']}`,
    backgroundColor: brand[500],
    color: 'white',
    border: 'none',
    borderRadius: radii.full,
    cursor: 'pointer',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    boxShadow: elevation.md,
    zIndex: zIndexNum.tooltip,
  },
};

// ============================================================================
// Components
// ============================================================================

/**
 * Color palette section showing brand colors
 */
const BrandColors: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <div style={styles.section}>
    <h2 style={styles.sectionTitle}>Brand Colors</h2>
    <div style={styles.grid}>
      {Object.entries(brand)
        .filter(([key]) => !isNaN(Number(key)) || key === 'DEFAULT' || key === 'light' || key === 'dark')
        .map(([key, value]) => (
          <div
            key={key}
            style={{
              ...styles.colorSwatch,
              backgroundColor: value as string,
              color: ['50', '100', '200', 'DEFAULT'].includes(key) ? neutral[900] : 'white',
            }}
          >
            {key}
            <br />
            <small>{value as string}</small>
          </div>
        ))}
    </div>
  </div>
);

/**
 * Semantic colors section
 */
const SemanticColors: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <div style={styles.section}>
    <h2 style={styles.sectionTitle}>Semantic Colors</h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: tokens.spacing['4'] }}>
      {[
        { name: 'Success', colors: semantic.success, icon: '✓' },
        { name: 'Warning', colors: semantic.warning, icon: '!' },
        { name: 'Danger', colors: semantic.danger, icon: '✕' },
        { name: 'Info', colors: semantic.info, icon: 'i' },
      ].map(({ name, colors, icon }) => (
        <div key={name} style={{ textAlign: 'center' }}>
          <div
            style={{
              ...styles.colorSwatch,
              backgroundColor: getModeColor(colors, isDark ? 'dark' : 'light'),
              color: 'white',
              fontSize: fontSize['2xl'],
              marginBottom: tokens.spacing['2'],
            }}
          >
            {icon}
          </div>
          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>{name}</div>
          <div style={{ fontSize: fontSize.xs, color: neutral[500] }}>
            {getModeColor(colors, isDark ? 'dark' : 'light')}
          </div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Neutral gray scale section
 */
const NeutralScale: React.FC = () => (
  <div style={styles.section}>
    <h2 style={styles.sectionTitle}>Neutral Scale</h2>
    <div style={styles.grid}>
      {Object.entries(neutral).map(([key, value]) => (
        <div
          key={key}
          style={{
            ...styles.colorSwatch,
            backgroundColor: value,
            color: Number(key) <= 400 ? neutral[900] : 'white',
          }}
        >
          {key}
          <br />
          <small>{value}</small>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Typography section
 */
const TypographySection: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const textColor = isDark ? 'white' : neutral[900];
  
  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>Typography</h2>
      
      <div style={{ marginBottom: tokens.spacing['6'] }}>
        <h3 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginBottom: tokens.spacing['3'] }}>
          Font Sizes
        </h3>
        {Object.entries(fontSize).map(([key, value]) => (
          <div key={key} style={{ ...styles.typographySample, color: textColor }}>
            <span style={{ fontSize: value, display: 'block', marginBottom: tokens.spacing['1'] }}>
              {key.toUpperCase()} Typography
            </span>
            <span style={{ fontSize: fontSize.xs, color: neutral[500] }}>
              {value} ({fontSizePx[key as keyof typeof fontSizePx]}px)
            </span>
          </div>
        ))}
      </div>

      <div>
        <h3 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginBottom: tokens.spacing['3'] }}>
          Font Weights
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacing['4'] }}>
          {Object.entries(fontWeight).map(([key, value]) => (
            <div
              key={key}
              style={{
                padding: tokens.spacing['3'],
                fontSize: fontSize.xl,
                fontWeight: value,
                color: textColor,
              }}
            >
              {key} ({value})
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: tokens.spacing['6'] }}>
        <h3 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginBottom: tokens.spacing['3'] }}>
          Font Families
        </h3>
        {Object.entries(tokens.typography.fontFamily).map(([key, value]) => (
          <div key={key} style={{ ...styles.typographySample, color: textColor, fontFamily: value }}>
            <span style={{ fontSize: fontSize.lg }}>{key}: The quick brown fox jumps over the lazy dog</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Spacing section
 */
const SpacingSection: React.FC = () => (
  <div style={styles.section}>
    <h2 style={styles.sectionTitle}>Spacing Scale (4px base)</h2>
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing['2'] }}>
      {Object.entries(spacing)
        .filter(([key]) => key !== '0')
        .slice(0, 20)
        .map(([key, value]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing['4'] }}>
            <span style={{ width: '60px', fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>
              {key}
            </span>
            <div
              style={{
                ...styles.spacingBox,
                width: value,
                height: tokens.spacing['8'],
              }}
            >
              {value}
            </div>
          </div>
        ))}
    </div>
  </div>
);

/**
 * Shadows section
 */
const ShadowsSection: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <div style={styles.section}>
    <h2 style={styles.sectionTitle}>Shadows & Elevation</h2>
    
    <h3 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginBottom: tokens.spacing['3'] }}>
      Elevation Shadows
    </h3>
    {Object.entries(elevation).map(([key, value]) => (
      <div key={key} style={{ ...styles.shadowBox, boxShadow: value, color: isDark ? neutral[900] : 'inherit' }}>
        <span style={{ fontWeight: fontWeight.medium }}>{key}</span>
        <span style={{ fontSize: fontSize.xs, color: neutral[500] }}>{value.slice(0, 50)}...</span>
      </div>
    ))}

    <h3 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginTop: tokens.spacing['6'], marginBottom: tokens.spacing['3'] }}>
      Glass Shadows
    </h3>
    {Object.entries(glass).map(([key, value]) => (
      <div
        key={key}
        style={{
          ...styles.shadowBox,
          boxShadow: value,
          backgroundColor: isDark ? neutral[800] : 'rgba(255,255,255,0.8)',
          color: isDark ? 'white' : 'inherit',
          backdropFilter: 'blur(10px)',
        }}
      >
        <span style={{ fontWeight: fontWeight.medium }}>glass-{key}</span>
        <span style={{ fontSize: fontSize.xs, color: neutral[500] }}>{value.slice(0, 50)}...</span>
      </div>
    ))}

    <h3 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginTop: tokens.spacing['6'], marginBottom: tokens.spacing['3'] }}>
      Glow Effects
    </h3>
    <div style={{ display: 'flex', gap: tokens.spacing['4'], flexWrap: 'wrap' }}>
      {Object.entries(glow).map(([key, value]) => (
        <div
          key={key}
          style={{
            width: '80px',
            height: '80px',
            borderRadius: radii.lg,
            backgroundColor: isDark ? neutral[800] : 'white',
            boxShadow: value,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: fontSize.xs,
            fontWeight: fontWeight.medium,
            color: isDark ? 'white' : neutral[700],
          }}
        >
          {key}
        </div>
      ))}
    </div>
  </div>
);

/**
 * Border radius section
 */
const RadiusSection: React.FC = () => (
  <div style={styles.section}>
    <h2 style={styles.sectionTitle}>Border Radius</h2>
    <div style={{ display: 'flex', gap: tokens.spacing['6'], flexWrap: 'wrap' }}>
      {Object.entries(radii).map(([key, value]) => (
        <div key={key} style={{ textAlign: 'center' }}>
          <div style={{ ...styles.radiusBox, borderRadius: value }}>
            {key}
          </div>
          <div style={{ marginTop: tokens.spacing['2'], fontSize: fontSize.xs, color: neutral[500] }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Animation section
 */
const AnimationSection: React.FC = () => {
  const [animate, setAnimate] = useState(false);

  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>Animation</h2>
      
      <div style={{ marginBottom: tokens.spacing['6'] }}>
        <h3 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginBottom: tokens.spacing['3'] }}>
          Durations
        </h3>
        <div style={{ display: 'flex', gap: tokens.spacing['4'], flexWrap: 'wrap' }}>
          {Object.entries(duration).map(([key, value]) => (
            <div
              key={key}
              style={{
                padding: `${tokens.spacing['3']} ${tokens.spacing['4']}`,
                backgroundColor: brand[100],
                borderRadius: radii.md,
                fontSize: fontSize.sm,
              }}
            >
              <strong>{key}</strong>: {value}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: tokens.spacing['6'] }}>
        <h3 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginBottom: tokens.spacing['3'] }}>
          Easing Functions
        </h3>
        <div style={{ display: 'flex', gap: tokens.spacing['4'], flexWrap: 'wrap' }}>
          {Object.entries(easing).map(([key, value]) => (
            <div
              key={key}
              style={{
                padding: `${tokens.spacing['3']} ${tokens.spacing['4']}`,
                backgroundColor: brand[100],
                borderRadius: radii.md,
                fontSize: fontSize.sm,
                maxWidth: '300px',
              }}
            >
              <strong>{key}</strong>
              <br />
              <small style={{ color: neutral[500] }}>{value}</small>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginBottom: tokens.spacing['3'] }}>
          Interactive Demo (Click boxes)
        </h3>
        <div style={{ display: 'flex', gap: tokens.spacing['4'], flexWrap: 'wrap' }}>
          {['ease', 'easeIn', 'easeOut', 'easeInOut', 'spring', 'bounce'].map((easeKey) => (
            <div
              key={easeKey}
              onClick={() => setAnimate(!animate)}
              style={{
                ...styles.animationBox,
                transition: `transform ${duration.slow} ${(easing as Record<string, string>)[easeKey]}`,
                transform: animate ? 'scale(1.2) rotate(10deg)' : 'scale(1) rotate(0deg)',
              }}
            >
              {easeKey}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Breakpoints section
 */
const BreakpointsSection: React.FC = () => (
  <div style={styles.section}>
    <h2 style={styles.sectionTitle}>Breakpoints</h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: tokens.spacing['4'] }}>
      {Object.entries(breakpointsPx).map(([key, value]) => (
        <div
          key={key}
          style={{
            padding: tokens.spacing['4'],
            backgroundColor: brand[100],
            borderRadius: radii.lg,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: brand[700] }}>
            {key}
          </div>
          <div style={{ fontSize: fontSize.sm, color: neutral[600] }}>
            {value}px
          </div>
          <div style={{ fontSize: fontSize.xs, color: neutral[400], marginTop: tokens.spacing['1'] }}>
            @media (min-width: {value}px)
          </div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Z-Index section
 */
const ZIndexSection: React.FC = () => (
  <div style={styles.section}>
    <h2 style={styles.sectionTitle}>Z-Index Scale</h2>
    <div style={{ position: 'relative', height: '400px', backgroundColor: neutral[100], borderRadius: radii.lg, overflow: 'hidden' }}>
      {Object.entries(zIndexNum).map(([key, value], index) => (
        <div
          key={key}
          style={{
            position: 'absolute',
            top: `${index * 35}px`,
            left: `${index * 30}px`,
            width: '200px',
            padding: tokens.spacing['3'],
            backgroundColor: brand[500],
            color: 'white',
            borderRadius: radii.md,
            boxShadow: elevation.md,
            zIndex: value,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            opacity: 0.9,
          }}
        >
          {key}: {value}
        </div>
      ))}
    </div>
  </div>
);

// ============================================================================
// Main Test Page Component
// ============================================================================

/**
 * Design Token Visual Test Page
 * 
 * Comprehensive test page showing all design tokens.
 * Toggle between light and dark modes to verify both variants.
 */
export const TokenTestPage: React.FC = () => {
  const [isDark, setIsDark] = useState(false);

  const pageStyle = {
    ...styles.page,
    backgroundColor: isDark ? neutral[950] : neutral[50],
    color: isDark ? 'white' : neutral[900],
  };

  return (
    <div style={pageStyle}>
      <button
        style={styles.toggle}
        onClick={() => setIsDark(!isDark)}
      >
        {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </button>

      <header style={styles.header}>
        <h1 style={styles.title}>allternit Design Tokens</h1>
        <p style={styles.subtitle}>
          Comprehensive visual test of all design tokens. Toggle dark mode to verify color variants.
        </p>
      </header>

      <BrandColors isDark={isDark} />
      <SemanticColors isDark={isDark} />
      <NeutralScale />
      <TypographySection isDark={isDark} />
      <SpacingSection />
      <ShadowsSection isDark={isDark} />
      <RadiusSection />
      <AnimationSection />
      <BreakpointsSection />
      <ZIndexSection />

      <footer style={{ marginTop: tokens.spacing['16'], paddingTop: tokens.spacing['8'], borderTop: `1px solid ${neutral[300]}`, textAlign: 'center', color: neutral[500] }}>
        <p>Design Token System v1.0.0 | allternit Platform</p>
        <p style={{ fontSize: fontSize.sm, marginTop: tokens.spacing['2'] }}>
          All tokens are type-safe with full TypeScript support
        </p>
      </footer>
    </div>
  );
};

export default TokenTestPage;
