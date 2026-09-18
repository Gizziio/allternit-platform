import { TrieMatch } from './keyword-trie.js';
import { ScorerTool } from './types.js';
import { SpecificityCategory, SPECIFICITY_CATEGORIES } from './shared.js';

export interface SpecificityResult {
  category: SpecificityCategory;
  confidence: number;
}

const DIMENSION_MAP: Record<SpecificityCategory, string[]> = {
  coding: ['codeGeneration', 'codeReview', 'technicalTerms', 'codeToProse'],
  web_browsing: ['webBrowsing'],
  data_analysis: ['domainSpecificity', 'dataAnalysis'],
  image_generation: ['imageGeneration'],
  video_generation: ['videoGeneration'],
  social_media: ['socialMedia'],
  email_management: ['emailManagement'],
  calendar_management: ['calendarManagement'],
  trading: ['trading'],
};

const TOOL_NAME_PATTERNS: Record<string, SpecificityCategory> = {
  browser_: 'web_browsing',
  playwright_: 'web_browsing',
  web_: 'web_browsing',
  code_: 'coding',
  editor_: 'coding',
  image_: 'image_generation',
  midjourney_: 'image_generation',
  firefly_: 'image_generation',
  leonardo_: 'image_generation',
  video_: 'video_generation',
  runway_: 'video_generation',
  sora_: 'video_generation',
  social_: 'social_media',
  hootsuite_: 'social_media',
  buffer_: 'social_media',
  email_: 'email_management',
  gmail_: 'email_management',
  outlook_: 'email_management',
  superhuman_: 'email_management',
  calendar_: 'calendar_management',
  gcal_: 'calendar_management',
  calendly_: 'calendar_management',
  reclaim_: 'calendar_management',
  trade_: 'trading',
  exchange_: 'trading',
  robinhood_: 'trading',
  kalshi_: 'trading',
  coinbase_: 'trading',
};

const DEFAULT_THRESHOLD = 1;

export function detectSpecificity(
  allMatches: TrieMatch[],
  tools?: ScorerTool[],
  headerOverride?: string,
  threshold = DEFAULT_THRESHOLD,
): SpecificityResult | null {
  if (headerOverride && isValidCategory(headerOverride)) {
    return { category: headerOverride, confidence: 1.0 };
  }

  const scores = new Map<SpecificityCategory, number>();
  for (const cat of SPECIFICITY_CATEGORIES) {
    const dims = DIMENSION_MAP[cat];
    const matchCount = allMatches.filter((m) => dims.includes(m.dimension)).length;
    scores.set(cat, matchCount);
  }

  if (tools && tools.length > 0) {
    applyToolHeuristics(tools, scores);
  }

  let best: SpecificityCategory | null = null;
  let bestScore = 0;
  for (const [cat, score] of scores) {
    if (score >= threshold && score > bestScore) {
      best = cat;
      bestScore = score;
    }
  }

  if (!best) return null;
  const confidence = Math.min(bestScore / (threshold * 3), 1.0);
  return { category: best, confidence };
}

function applyToolHeuristics(tools: ScorerTool[], scores: Map<SpecificityCategory, number>): void {
  for (const tool of tools) {
    const name = extractToolName(tool);
    if (!name) continue;
    const lower = name.toLowerCase();
    for (const [prefix, category] of Object.entries(TOOL_NAME_PATTERNS)) {
      if (lower.startsWith(prefix)) {
        scores.set(category, (scores.get(category) ?? 0) + 1);
        break;
      }
    }
  }
}

function extractToolName(tool: ScorerTool): string | null {
  if (typeof tool.name === 'string') return tool.name;
  const fn = tool.function as { name?: string } | undefined;
  if (fn && typeof fn.name === 'string') return fn.name;
  return null;
}

function isValidCategory(value: string): value is SpecificityCategory {
  return (SPECIFICITY_CATEGORIES as readonly string[]).includes(value);
}
