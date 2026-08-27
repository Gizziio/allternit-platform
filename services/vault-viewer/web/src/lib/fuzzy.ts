/**
 * Fuzzy search — port of Obsidian's prepareQuery/fuzzySearch behaviour
 * (docs/obsidian-desktop-internals.md §9) so suggester ranking matches.
 *
 * Score: 0 is perfect, more negative is worse:
 *   score = −max(0, numRanges − 1)        // fragmentation
 *           − midWordPenalties / 10        // matches starting mid-word
 *           − (matchSpan − queryLen) / 100 // sparseness inside the span
 *           − firstMatchOffset / 1000      // earlier matches win
 *           − targetLen / 10000            // shorter targets win
 */

export interface PreparedQuery {
  query: string;
  tokens: string[];
  fuzzy: string[];
}

export interface FuzzyMatch {
  score: number;
  matches: [number, number][];
}

const PUNCT_RE = /[ -⁯⸀-⹿\\'!"#$%&()*+,\-./:;<=>?@[\]^_`{|}~]/;
const CJK_RE = /[ༀ-࿿぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]/;

export function prepareQuery(query: string): PreparedQuery {
  const q = query.toLowerCase();
  const tokens: string[] = [];
  let cur = '';
  const flush = () => {
    if (cur) tokens.push(cur);
    cur = '';
  };
  for (const ch of q) {
    if (/\s/.test(ch)) {
      flush();
    } else if (PUNCT_RE.test(ch) || CJK_RE.test(ch)) {
      flush();
      tokens.push(ch);
    } else {
      cur += ch;
    }
  }
  flush();
  const fuzzy = [...q].filter((c) => !/\s/.test(c));
  return { query: q, tokens, fuzzy };
}

const isWordChar = (c: string | undefined) => c !== undefined && !/\s/.test(c) && !PUNCT_RE.test(c);

/** Word boundary at `idx`: start of string, after space/punct, or camelCase bump. */
function atBoundary(target: string, lower: string, idx: number): boolean {
  if (idx === 0) return true;
  if (!isWordChar(lower[idx - 1])) return true;
  // camelCase: previous original char lowercase, current original char uppercase
  const prev = target[idx - 1];
  const curC = target[idx];
  return prev === prev.toLowerCase() && curC === curC.toUpperCase() && curC !== curC.toLowerCase();
}

function pushRange(ranges: [number, number][], from: number, to: number) {
  const last = ranges[ranges.length - 1];
  if (last && from <= last[1]) last[1] = Math.max(last[1], to);
  else ranges.push([from, to]);
}

function scoreOf(ranges: [number, number][], midWord: number, queryLen: number, targetLen: number): number {
  const first = ranges[0][0];
  const span = ranges[ranges.length - 1][1] - first;
  return (
    0 -
    Math.max(0, ranges.length - 1) -
    midWord / 10 -
    (span - queryLen) / 100 -
    first / 1000 -
    targetLen / 10000
  );
}

export function fuzzySearch(pq: PreparedQuery, target: string): FuzzyMatch | null {
  if (!pq.query) return { score: 0, matches: [] };
  const lower = target.toLowerCase();

  // (1) token pass — each token via indexOf, starting after the previous match
  if (pq.tokens.length) {
    const ranges: [number, number][] = [];
    let midWord = 0;
    let pos = 0;
    let ok = true;
    let qLen = 0;
    for (const tok of pq.tokens) {
      const idx = lower.indexOf(tok, pos);
      if (idx < 0) {
        ok = false;
        break;
      }
      if (!atBoundary(target, lower, idx)) midWord++;
      pushRange(ranges, idx, idx + tok.length);
      pos = idx + tok.length;
      qLen += tok.length;
    }
    if (ok && ranges.length) return { score: scoreOf(ranges, midWord, qLen, target.length), matches: ranges };
  }

  // (2) per-char fuzzy pass — chars in order; mid-word only if adjacent to previous
  const ranges: [number, number][] = [];
  let midWord = 0;
  let pos = 0;
  for (const ch of pq.fuzzy) {
    let idx = lower.indexOf(ch, pos);
    while (idx >= 0) {
      const adjacent = ranges.length > 0 && idx === ranges[ranges.length - 1][1];
      if (adjacent || atBoundary(target, lower, idx)) break;
      idx = lower.indexOf(ch, idx + 1);
    }
    if (idx < 0) return null;
    if (!atBoundary(target, lower, idx) && !(ranges.length && idx === ranges[ranges.length - 1][1])) midWord++;
    pushRange(ranges, idx, idx + 1);
    pos = idx + 1;
  }
  if (!ranges.length) return null;
  return { score: scoreOf(ranges, midWord, pq.fuzzy.length, target.length), matches: ranges };
}

/** Filename-style search: try basename first; a full-path-only match scores −1 (§9). */
export function fuzzySearchPath(pq: PreparedQuery, path: string): FuzzyMatch | null {
  const slash = path.lastIndexOf('/');
  const base = slash >= 0 ? path.slice(slash + 1) : path;
  const m = fuzzySearch(pq, base);
  if (m) {
    const off = slash + 1;
    return { score: m.score, matches: m.matches.map(([a, b]) => [a + off, b + off]) };
  }
  const full = fuzzySearch(pq, path);
  if (full) return { score: full.score - 1, matches: full.matches };
  return null;
}
