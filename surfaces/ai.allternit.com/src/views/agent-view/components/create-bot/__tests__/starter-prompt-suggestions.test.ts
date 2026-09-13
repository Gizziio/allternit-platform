import { describe, it, expect } from 'vitest';
import {
  STARTER_PROMPT_MAX,
  STARTER_PROMPT_SUGGESTIONS,
  addStarterPrompt,
  starterPromptSuggestionsFor,
} from '../starter-prompt-suggestions';
import { BOT_CATEGORIES } from '@/lib/bots/bot-profile';

describe('starter-prompt-suggestions', () => {
  it('keys every bot category id used by the wizard category Select', () => {
    for (const id of Object.keys(BOT_CATEGORIES)) {
      expect(STARTER_PROMPT_SUGGESTIONS[id], `missing suggestions for ${id}`).toBeDefined();
      expect(STARTER_PROMPT_SUGGESTIONS[id].length).toBeGreaterThanOrEqual(6);
      expect(STARTER_PROMPT_SUGGESTIONS[id].length).toBeLessThanOrEqual(10);
    }
    expect(STARTER_PROMPT_SUGGESTIONS.default.length).toBeGreaterThanOrEqual(6);
  });

  it('has no duplicate suggestions within a category', () => {
    for (const [id, list] of Object.entries(STARTER_PROMPT_SUGGESTIONS)) {
      expect(new Set(list).size, `duplicates in ${id}`).toBe(list.length);
    }
  });

  it('falls back to the default list for unknown or empty categories', () => {
    expect(starterPromptSuggestionsFor(undefined)).toBe(STARTER_PROMPT_SUGGESTIONS.default);
    expect(starterPromptSuggestionsFor('not-a-category')).toBe(STARTER_PROMPT_SUGGESTIONS.default);
    expect(starterPromptSuggestionsFor('research')).toBe(STARTER_PROMPT_SUGGESTIONS.research);
  });
});

describe('addStarterPrompt', () => {
  it('appends a trimmed prompt', () => {
    expect(addStarterPrompt(['a'], ' b ')).toEqual(['a', 'b']);
  });

  it('returns null for duplicates', () => {
    expect(addStarterPrompt(['a'], 'a')).toBeNull();
    expect(addStarterPrompt(['a'], ' a ')).toBeNull();
  });

  it('returns null at the cap', () => {
    const full = Array.from({ length: STARTER_PROMPT_MAX }, (_, i) => `p${i}`);
    expect(addStarterPrompt(full, 'one more')).toBeNull();
  });

  it('ignores empty prompts', () => {
    expect(addStarterPrompt([], '   ')).toBeNull();
    expect(addStarterPrompt(undefined, '')).toBeNull();
  });
});
