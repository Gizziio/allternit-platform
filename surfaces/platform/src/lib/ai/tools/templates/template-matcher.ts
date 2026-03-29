// ============================================================================
// Template Matcher
// ============================================================================
// Keyword-based retrieval for few-shot injection.
// Given a user prompt + kind, returns the top N most relevant templates
// by scoring tag/title/description overlap against tokenized prompt terms.
//
// Deliberately lightweight — no embeddings, no vector DB. Scoring is fast
// enough to run inline on every tool call with negligible overhead.
// ============================================================================

import { ARTIFACT_TEMPLATES, type ArtifactKind, type ArtifactTemplate } from './artifact-templates';

// Words that carry no semantic signal
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'is','it','i','me','my','we','you','do','be','as','by','so','up',
  'make','build','create','generate','write','add','show','give','use',
  'that','this','these','those','from','into','then','than','can','will',
  'please','want','need','like','just','get','let','new','some',
]);

/** Tokenize a string into lowercase meaningful terms */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Score a template against a set of query tokens.
 * Returns a number 0–100+ (can exceed 100 for very close matches).
 */
function scoreTemplate(template: ArtifactTemplate, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;

  let score = 0;
  const titleTokens = tokenize(template.title);
  const descTokens  = tokenize(template.description);
  const tagSet      = new Set(template.tags.flatMap(t => tokenize(t)));

  for (const qToken of queryTokens) {
    // Exact tag match — highest weight
    if (tagSet.has(qToken)) score += 12;

    // Partial tag containment
    for (const tag of template.tags) {
      if (tag.includes(qToken) || qToken.includes(tag)) score += 4;
    }

    // Title match — high weight
    if (titleTokens.includes(qToken)) score += 10;
    for (const t of titleTokens) {
      if (t.includes(qToken) || qToken.includes(t)) score += 3;
    }

    // Description match — lower weight
    if (descTokens.includes(qToken)) score += 5;
  }

  // Normalise by query length so short prompts don't always lose to long ones
  return score / Math.sqrt(queryTokens.length);
}

export interface TemplateMatch {
  template: ArtifactTemplate;
  score: number;
}

/**
 * Find the most relevant templates for a user prompt.
 *
 * @param prompt  - The user's generation prompt
 * @param kind    - Preferred artifact kind; templates of the same kind score +15
 * @param count   - How many matches to return (default 1 for few-shot, up to 3 for gallery)
 * @param minScore - Minimum score threshold; below this the template is excluded
 */
export function findRelevantTemplates(
  prompt: string,
  kind: ArtifactKind = 'html',
  count = 1,
  minScore = 3,
): TemplateMatch[] {
  const queryTokens = tokenize(prompt);

  return ARTIFACT_TEMPLATES
    .map(template => {
      let score = scoreTemplate(template, queryTokens);
      // Boost same-kind templates
      if (template.kind === kind) score += 15;
      return { template, score };
    })
    .filter(m => m.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

/**
 * Return the single best matching template for few-shot injection.
 * Returns null if no template reaches the minimum relevance bar.
 */
export function getBestTemplate(
  prompt: string,
  kind: ArtifactKind = 'html',
): ArtifactTemplate | null {
  const matches = findRelevantTemplates(prompt, kind, 1, 6);
  return matches[0]?.template ?? null;
}
