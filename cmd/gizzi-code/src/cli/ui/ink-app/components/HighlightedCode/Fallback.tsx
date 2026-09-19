import { extname } from 'path';
import React, { Suspense, use, useMemo } from 'react';
import { Ansi, Text } from '../../ink';
import { getCliHighlightPromise } from '../../utils/cliHighlight';
import { logForDebugging } from '../../utils/debug';
import { convertLeadingTabsToSpaces } from '../../utils/file';
import { hashPair } from '../../utils/hash';
type Props = {
  code: string;
  filePath: string;
  dim?: boolean;
  skipColoring?: boolean;
};

// Module-level highlight cache — hl.highlight() is the hot cost on virtual-
// scroll remounts. useMemo doesn't survive unmount→remount. Keyed by hash
// of code+language to avoid retaining full source strings (#24180 RSS fix).
const HL_CACHE_MAX = 500;
const hlCache = new Map<string, string>();
function cachedHighlight(hl: NonNullable<Awaited<ReturnType<typeof getCliHighlightPromise>>>, code: string, language: string): string {
  const key = hashPair(language, code);
  const hit = hlCache.get(key);
  if (hit !== undefined) {
    hlCache.delete(key);
    hlCache.set(key, hit);
    return hit;
  }
  const out = hl.highlight(code, {
    language
  });
  if (hlCache.size >= HL_CACHE_MAX) {
    const first = hlCache.keys().next().value;
    if (first !== undefined) hlCache.delete(first);
  }
  hlCache.set(key, out);
  return out;
}
export function HighlightedCodeFallback({
    code,
    filePath,
    dim: t1,
    skipColoring: t2
}: Props) {
  const dim = t1 === undefined ? false : t1;
  const skipColoring = t2 === undefined ? false : t2;
  const t3 = convertLeadingTabsToSpaces(code);

  const codeWithSpaces = t3;
  if (skipColoring) {
    const t4 = <Ansi>{codeWithSpaces}</Ansi>;

    const t5 = <Text dimColor={dim}>{t4}</Text>;

    return t5;
  }
  const t4 = extname(filePath).slice(1);

  const language = t4;
  const t5 = <Ansi>{codeWithSpaces}</Ansi>;

  const t6 = <Highlighted codeWithSpaces={codeWithSpaces} language={language} />;

  const t7 = <Suspense fallback={t5}>{t6}</Suspense>;

  const t8 = <Text dimColor={dim}>{t7}</Text>;

  return t8;
}
function Highlighted(t0) {
  const {
    codeWithSpaces,
    language
  } = t0;
  const t1 = getCliHighlightPromise();

  const hl = use(t1);
  let t2;
  bb0: {
    if (!hl) {
      t2 = codeWithSpaces;
      break bb0;
    }
    let highlightLang = "markdown";
    if (language) {
      if (hl.supportsLanguage(language)) {
        highlightLang = language;
      } else {
        logForDebugging(`Language not supported while highlighting code, falling back to markdown: ${language}`);
      }
    }
    ;
    try {
      t2 = cachedHighlight(hl, codeWithSpaces, highlightLang);
    } catch (t3) {
      const e = t3;
      if (e instanceof Error && e.message.includes("Unknown language")) {
        logForDebugging(`Language not supported while highlighting code, falling back to markdown: ${e}`);
        const t4 = cachedHighlight(hl, codeWithSpaces, "markdown");

        t2 = t4;
        break bb0;
      }
      t2 = codeWithSpaces;
    }
  }
  

  const out = t2;
  const t3 = <Ansi>{out}</Ansi>;

  return t3;
}
