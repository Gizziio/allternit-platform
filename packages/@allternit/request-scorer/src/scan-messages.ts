import { ScorerMessage, ScorerTool } from './types.js';
import { DEFAULT_CONFIG } from './config.js';
import { KeywordTrie, TrieMatch } from './keyword-trie.js';
import { extractUserTexts } from './text-extractor.js';
import { detectSpecificity, SpecificityResult } from './specificity-detector.js';

let defaultTrie: KeywordTrie | null = null;

function getDefaultTrie(): KeywordTrie {
  if (!defaultTrie) {
    const dims = DEFAULT_CONFIG.dimensions
      .filter((d) => d.keywords && d.keywords.length > 0)
      .map((d) => ({ name: d.name, keywords: d.keywords! }));
    defaultTrie = new KeywordTrie(dims);
  }
  return defaultTrie;
}

export function scanMessages(
  messages: ScorerMessage[],
  tools?: ScorerTool[],
  headerOverride?: string,
): SpecificityResult | null {
  if (!messages || messages.length === 0) return null;
  const extracted = extractUserTexts(messages);
  if (extracted.length === 0) return null;
  const lastUserText = extracted[extracted.length - 1].text;
  if (lastUserText.length === 0) return null;
  const trie = getDefaultTrie();
  const allMatches: TrieMatch[] = trie.scan(lastUserText);
  return detectSpecificity(allMatches, tools, headerOverride);
}
