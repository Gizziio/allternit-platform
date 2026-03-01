/**
 * Storybook Decorators
 * 
 * Provides common wrapper components for stories including
 * theme, glass effects, and provider setups.
 */

import React from 'react';
import type { StoryContext, StoryFn } from '@storybook/react';
import { A2RThemeProvider, defaultTheme, lightTheme } from '../src/design/theme/a2r-theme';
import { tokens } from '../src/design/tokens';

/**
 * Theme decorator - wraps stories with theme provider
 * Uses the theme global from Storybook toolbar
 */
export const withTheme = (Story: StoryFn, context: StoryContext) => {
  const themeName = context.globals.theme || 'dark';
  const theme = themeName === 'light' ? lightTheme : defaultTheme;
  
  return (
    <A2RThemeProvider theme={theme}>
      <div 
        className="storybook-theme-wrapper"
        style={{
          minHeight: '100%',
          padding: '24px',
          background: theme.bg,
          color: theme.fg,
        }}
      >
        <Story />
      </div>
    </A2RThemeProvider>
  );
};

/**
 * Glass decorator - provides glass morphism background
 * Best used with glass-based components
 */
export const withGlass = (Story: StoryFn) => (
  <div 
    className="storybook-glass-wrapper"
    style={{
      minHeight: '400px',
      padding: '32px',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      borderRadius: '16px',
    }}
  >
    <Story />
  </div>
);

/**
 * Light theme decorator
 */
export const withLightTheme = (Story: StoryFn) => (
  <A2RThemeProvider theme={lightTheme}>
    <div 
      style={{
        minHeight: '100%',
        padding: '24px',
        background: lightTheme.bg,
        color: lightTheme.fg,
      }}
    >
      <Story />
    </div>
  </A2RThemeProvider>
);

/**
 * Dark theme decorator
 */
export const withDarkTheme = (Story: StoryFn) => (
  <A2RThemeProvider theme={defaultTheme}>
    <div 
      style={{
        minHeight: '100%',
        padding: '24px',
        background: defaultTheme.bg,
        color: defaultTheme.fg,
      }}
    >
      <Story />
    </div>
  </A2RThemeProvider>
);

/**
 * Centered decorator - centers content in the viewport
 */
export const centered = (Story: StoryFn) => (
  <div 
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '300px',
    }}
  >
    <Story />
  </div>
);

/**
 * Padded decorator - adds consistent padding
 */
export const padded = (padding: number = 24) => (Story: StoryFn) => (
  <div style={{ padding: `${padding}px` }}>
    <Story />
  </div>
);
