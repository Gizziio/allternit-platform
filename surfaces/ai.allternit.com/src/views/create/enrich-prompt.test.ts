import { describe, it, expect } from 'vitest';
import { enrichCreationPrompt, parseCreationPayload } from './enrich-prompt';
import { getDefaultFormatSelection } from './presets';

describe('enrichCreationPrompt', () => {
  it('passes non-creation input through unchanged', () => {
    const input = 'Tell me about dinosaurs';
    expect(enrichCreationPrompt(input, 'research', null)).toBe(input);
    expect(enrichCreationPrompt(input, null, null)).toBe(input);
  });

  it('injects deterministic markers for docs creation', () => {
    const format = getDefaultFormatSelection('docs')!;
    const enriched = enrichCreationPrompt('Q3 marketing plan', 'docs', format);

    expect(enriched).toContain('[CREATE_MODE: docs]');
    expect(enriched).toContain('[FORMAT_TAB: type]');
    expect(enriched).toContain('[FORMAT: proposal]');
    expect(enriched).toContain('User request: Q3 marketing plan');
    expect(enriched).toContain('deterministic creation mode');
  });

  it('preserves active style and web-search prefixes for creation modes', () => {
    const format = getDefaultFormatSelection('website')!;
    const enriched = enrichCreationPrompt('landing page for a bakery', 'website', format);

    expect(enriched).toContain('[CREATE_MODE: website]');
    expect(enriched).toContain('landing page for a bakery');
  });

  it('includes custom size when selected', () => {
    const format = {
      modeId: 'design',
      tabId: 'aspect-ratio',
      optionId: 'custom',
      custom: { width: 1200, height: 628, unit: 'px' as const },
    };
    const enriched = enrichCreationPrompt('social banner', 'design', format);

    expect(enriched).toContain('[CUSTOM_SIZE: 1200 × 628 px]');
  });
});

describe('parseCreationPayload', () => {
  it('round-trips an enriched prompt', () => {
    const format = getDefaultFormatSelection('slides')!;
    const enriched = enrichCreationPrompt('pitch for a fintech app', 'slides', format);
    const payload = parseCreationPayload(enriched);

    expect(payload).not.toBeNull();
    expect(payload?.modeId).toBe('slides');
    expect(payload?.prompt).toContain('pitch for a fintech app');
    expect(payload?.formatSelection.modeId).toBe('slides');
  });

  it('returns null for plain chat input', () => {
    expect(parseCreationPayload('hello world')).toBeNull();
  });
});
