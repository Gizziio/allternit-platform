import { describe, it, expect } from 'vitest';
import { parseDesignMd, tokensToCssVars } from './design-md-parser';

describe('design-md-parser', () => {
  const sampleMd = `
# Brand: ACME Corp
## Intent
To be the best at what we do.
## Accessibility
High contrast mode mandatory.
## Colors
- primary: #ff0000
- background: #ffffff
## Typography
- fontFamily: "Roboto"
## Spacing
- base: 8px
## Radii
- base: 12px
## Shadows
- soft: 0 2px 4px rgba(0,0,0,0.1)
  `;

  it('parses metadata correctly', () => {
    const tokens = parseDesignMd(sampleMd);
    expect(tokens.metadata.brandName).toBe('ACME Corp');
    expect(tokens.metadata.intent?.trim()).toBe('To be the best at what we do.');
    expect(tokens.metadata.accessibility?.trim()).toBe('High contrast mode mandatory.');
  });

  it('parses tokens correctly', () => {
    const tokens = parseDesignMd(sampleMd);
    expect(tokens.colors.primary).toBe('#ff0000');
    expect(tokens.colors.background).toBe('#ffffff');
    expect(tokens.typography.fontFamily).toBe('Roboto');
    expect(tokens.spacing.base).toBe('8px');
    expect(tokens.radii.base).toBe('12px');
    expect(tokens.shadows.soft).toBe('0 2px 4px rgba(0,0,0,0.1)');
  });

  it('converts to css vars', () => {
    const tokens = parseDesignMd(sampleMd);
    const cssVars = tokensToCssVars(tokens);
    expect(cssVars['--design-color-primary']).toBe('#ff0000');
    expect(cssVars['--design-type-fontFamily']).toBe('Roboto');
  });

  it('handles empty or malformed input gracefully', () => {
      const tokens = parseDesignMd('');
      expect(tokens.colors.primary).toBe('#d4b08c'); // Should return defaults
  });
});
