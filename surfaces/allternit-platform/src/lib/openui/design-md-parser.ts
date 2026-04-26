/**
 * Design.md Parser
 * 
 * Parses a DESIGN.md specification document into CSS variables (design tokens)
 * and metadata that can be applied to the Allternit platform or OpenUI renderer.
 */

export interface DesignTokens {
  colors: Record<string, string>;
  typography: Record<string, string>;
  spacing: Record<string, string>;
  radii: Record<string, string>;
  shadows: Record<string, string>;
  metadata: {
    brandName?: string;
    intent?: string;
    accessibility?: string;
  };
}

const DEFAULT_TOKENS: DesignTokens = {
  colors: {
    primary: '#d4b08c',
    background: '#0f0d0c',
    surface: 'rgba(255, 255, 255, 0.03)',
    text: '#e8e0d8',
    muted: 'rgba(255, 255, 255, 0.4)',
  },
  typography: {
    fontFamily: '"Inter", sans-serif',
    baseSize: '14px',
    headingScale: '1.2',
  },
  spacing: {
    base: '4px',
    container: '16px',
  },
  radii: {
    base: '8px',
    card: '16px',
    button: '6px',
  },
  shadows: {
    soft: '0 4px 12px rgba(0,0,0,0.2)',
    hard: '0 8px 24px rgba(0,0,0,0.5)',
  },
  metadata: {
    brandName: 'Allternit Default',
  }
};

/**
 * Parses a markdown string looking for specific design token tables or lists.
 * This is a simplified parser designed to read output from the design-extractor skill.
 * 
 * Expected Markdown Format:
 * # Brand: [Name]
 * ## Colors
 * - primary: #hex
 * - background: #hex
 * ## Typography
 * - fontFamily: "Font Name"
 */
export function parseDesignMd(markdown: string): DesignTokens {
  if (!markdown || typeof markdown !== 'string') {
    return DEFAULT_TOKENS;
  }

  const tokens: DesignTokens = JSON.parse(JSON.stringify(DEFAULT_TOKENS)); // Deep copy default
  const lines = markdown.split('\n');
  
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Parse Headers
    if (trimmed.startsWith('# Brand:')) {
      tokens.metadata.brandName = trimmed.replace('# Brand:', '').trim();
      continue;
    }
    if (trimmed.startsWith('## Colors')) { currentSection = 'colors'; continue; }
    if (trimmed.startsWith('## Typography')) { currentSection = 'typography'; continue; }
    if (trimmed.startsWith('## Spacing')) { currentSection = 'spacing'; continue; }
    if (trimmed.startsWith('## Radii')) { currentSection = 'radii'; continue; }
    if (trimmed.startsWith('## Shadows')) { currentSection = 'shadows'; continue; }
    if (trimmed.startsWith('## Intent')) { currentSection = 'intent'; continue; }
    if (trimmed.startsWith('## Accessibility')) { currentSection = 'accessibility'; continue; }

    // Parse list items
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.substring(2).trim();
      const splitIndex = content.indexOf(':');
      
      if (splitIndex !== -1) {
        const key = content.substring(0, splitIndex).trim();
        const value = content.substring(splitIndex + 1).trim().replace(/['"`]/g, ''); // Remove quotes

        if (currentSection === 'colors' && tokens.colors) tokens.colors[key] = value;
        else if (currentSection === 'typography' && tokens.typography) tokens.typography[key] = value;
        else if (currentSection === 'spacing' && tokens.spacing) tokens.spacing[key] = value;
        else if (currentSection === 'radii' && tokens.radii) tokens.radii[key] = value;
        else if (currentSection === 'shadows' && tokens.shadows) tokens.shadows[key] = value;
      }
    } else if (currentSection === 'intent' && trimmed.length > 0 && !trimmed.startsWith('#')) {
       tokens.metadata.intent = (tokens.metadata.intent || '') + ' ' + trimmed;
    } else if (currentSection === 'accessibility' && trimmed.length > 0 && !trimmed.startsWith('#')) {
       tokens.metadata.accessibility = (tokens.metadata.accessibility || '') + ' ' + trimmed;
    }
  }

  return tokens;
}

/**
 * Converts parsed DesignTokens into a React style object containing CSS Custom Properties.
 */
export function tokensToCssVars(tokens: DesignTokens): React.CSSProperties {
  const vars: Record<string, string> = {};
  
  Object.entries(tokens.colors).forEach(([k, v]) => { vars[`--design-color-${k}`] = v; });
  Object.entries(tokens.typography).forEach(([k, v]) => { vars[`--design-type-${k}`] = v; });
  Object.entries(tokens.spacing).forEach(([k, v]) => { vars[`--design-space-${k}`] = v; });
  Object.entries(tokens.radii).forEach(([k, v]) => { vars[`--design-radius-${k}`] = v; });
  Object.entries(tokens.shadows).forEach(([k, v]) => { vars[`--design-shadow-${k}`] = v; });

  return vars as React.CSSProperties;
}
