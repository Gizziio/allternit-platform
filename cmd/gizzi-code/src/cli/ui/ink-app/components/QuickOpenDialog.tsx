import * as path from 'path';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useRegisterOverlay } from '../context/overlayContext';
// overlayContext is still a compiler artifact whose untyped second param is
// required; cast restores intent (id + optional enabled) until its own
// conversion lands.
const registerOverlay = useRegisterOverlay as (id: string, enabled?: boolean) => void;
import { generateFileSuggestions } from '../hooks/fileSuggestions';
import { useTerminalSize } from '../hooks/useTerminalSize';
import { Text } from '../ink';
import { logEvent } from '../services/analytics/index';
import { getCwd } from '../utils/cwd';
import { openFileInExternalEditor } from '../utils/editor';
import { truncatePathMiddle, truncateToWidth } from '../utils/format';
import { highlightMatch } from '../utils/highlightMatch';
import { readFileInRange } from '../utils/readFileInRange';
import { FuzzyPicker } from './design-system/FuzzyPicker';
import { LoadingState } from './design-system/LoadingState';
type Props = {
  onDone: () => void;
  onInsert: (text: string) => void;
};
const VISIBLE_RESULTS = 8;
const PREVIEW_LINES = 20;

/**
 * Quick Open dialog (ctrl+shift+p / cmd+shift+p).
 * Fuzzy file finder with a syntax-highlighted preview of the focused file.
 */
export function QuickOpenDialog({
    onDone,
    onInsert
}: Props) {
  registerOverlay("quick-open");
  const {
    columns,
    rows
  } = useTerminalSize();
  const visibleResults = Math.min(VISIBLE_RESULTS, Math.max(4, rows - 14));
  const t1 = [];

  const [results, setResults] = useState(t1);
  const [query, setQuery] = useState("");
  const [focusedPath, setFocusedPath] = useState(undefined);
  const [preview, setPreview] = useState(null);
  const queryGenRef = useRef(0);
  const t2 = () => () => {
      queryGenRef.current = queryGenRef.current + 1;
      return void queryGenRef.current;
    };
  const t3 = [];

  useEffect(t2, t3);
  const previewOnRight = columns >= 120;
  const effectivePreviewLines = previewOnRight ? VISIBLE_RESULTS - 1 : PREVIEW_LINES;
  const t4 = q => {
      setQuery(q);
      const gen = queryGenRef.current = queryGenRef.current + 1;
      if (!q.trim()) {
        setResults([]);
        return;
      }
      generateFileSuggestions(q, true).then(items => {
        if (gen !== queryGenRef.current) {
          return;
        }
        const paths = items.filter(_temp).map(_temp2).filter(_temp3).map(_temp4);
        setResults(paths);
      });
    };

  const handleQueryChange = t4;
  const t5 = () => {
      if (!focusedPath) {
        setPreview(null);
        return;
      }
      const controller = new AbortController();
      const absolute = path.resolve(getCwd(), focusedPath);
      readFileInRange(absolute, 0, effectivePreviewLines, undefined, controller.signal).then(r => {
        if (controller.signal.aborted) {
          return;
        }
        setPreview({
          path: focusedPath,
          content: r.content
        });
      }).catch(() => {
        if (controller.signal.aborted) {
          return;
        }
        setPreview({
          path: focusedPath,
          content: "(preview unavailable)"
        });
      });
      return () => controller.abort();
    };
  const t6 = [focusedPath, effectivePreviewLines];

  useEffect(t5, t6);
  const maxPathWidth = previewOnRight ? Math.max(20, Math.floor((columns - 10) * 0.4)) : Math.max(20, columns - 8);
  const previewWidth = previewOnRight ? Math.max(40, columns - maxPathWidth - 14) : columns - 6;
  const t7 = p_1 => {
      const opened = openFileInExternalEditor(path.resolve(getCwd(), p_1));
      logEvent("tengu_quick_open_select", {
        result_count: results.length,
        opened_editor: opened
      });
      onDone();
    };

  const handleOpen = t7;
  const t8 = (p_2, mention) => {
      onInsert(mention ? `@${p_2} ` : `${p_2} `);
      logEvent("tengu_quick_open_insert", {
        result_count: results.length,
        mention
      });
      onDone();
    };

  const handleInsert = t8;
  const t9 = previewOnRight ? "right" : "bottom";
  const t10 = {
      action: "mention",
      handler: p_4 => handleInsert(p_4, true)
    };

  const t11 = {
      action: "insert path",
      handler: p_5 => handleInsert(p_5, false)
    };

  const t12 = (p_6, isFocused) => <Text color={isFocused ? "suggestion" : undefined}>{truncatePathMiddle(p_6, maxPathWidth)}</Text>;

  const t13 = p_7 => preview ? <><Text dimColor={true}>{truncatePathMiddle(p_7, previewWidth)}{preview.path !== p_7 ? " \xB7 loading\u2026" : ""}</Text>{preview.content.split("\n").map((line, i_1) => <Text key={i_1}>{highlightMatch(truncateToWidth(line, previewWidth), query)}</Text>)}</> : <LoadingState message={"Loading preview\u2026"} dimColor={true} />;

  const t14 = <FuzzyPicker title="Quick Open" placeholder={"Type to search files\u2026"} items={results} getKey={_temp5} visibleCount={visibleResults} direction="up" previewPosition={t9} onQueryChange={handleQueryChange} onFocus={setFocusedPath} onSelect={handleOpen} onTab={t10} onShiftTab={t11} onCancel={onDone} emptyMessage={_temp6} selectAction="open in editor" renderItem={t12} renderPreview={t13} />;

  return t14;
}
function _temp6(q_0) {
  return q_0 ? "No matching files" : "Start typing to search\u2026";
}
function _temp5(p_3) {
  return p_3;
}
function _temp4(p_0) {
  return p_0.split(path.sep).join("/");
}
function _temp3(p) {
  return !p.endsWith(path.sep);
}
function _temp2(i_0) {
  return i_0.displayText;
}
function _temp(i) {
  return i.id.startsWith("file-");
}
