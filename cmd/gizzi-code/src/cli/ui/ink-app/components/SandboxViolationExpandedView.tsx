import * as React from 'react';
import { type ReactNode, useEffect, useState } from 'react';
import { Box, Text } from '../ink';
import type { SandboxViolationEvent } from '../utils/sandbox/sandbox-adapter';
import { SandboxManager } from '../utils/sandbox/sandbox-adapter';

/**
 * Format a timestamp as "h:mm:ssa" (e.g., "1:30:45pm").
 * Replaces date-fns format() to avoid pulling in a 39MB dependency for one call.
 */
function formatTime(date: Date): string {
  const h = date.getHours() % 12 || 12;
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const ampm = date.getHours() < 12 ? 'am' : 'pm';
  return `${h}:${m}:${s}${ampm}`;
}
import { getPlatform } from './../utils/platform.ts';
export function SandboxViolationExpandedView() {
  const t0 = [];

  const [violations, setViolations] = useState(t0);
  const [totalCount, setTotalCount] = useState(0);
  const t1 = () => {
      const store = SandboxManager.getSandboxViolationStore();
      const unsubscribe = store.subscribe(allViolations => {
        setViolations(allViolations.slice(-10));
        setTotalCount(store.getTotalCount());
      });
      return unsubscribe;
    };
  const t2 = [];

  useEffect(t1, t2);
  if (!SandboxManager.isSandboxingEnabled() || getPlatform() === "linux") {
    return null;
  }
  if (totalCount === 0) {
    return null;
  }
  const t3 = totalCount === 1 ? "operation" : "operations";
  const t4 = <Box marginLeft={0}><Text color="permission">⧈ Sandbox blocked {totalCount} total{" "}{t3}</Text></Box>;

  const t5 = violations.map(_temp);

  const t6 = Math.min(10, violations.length);
  const t7 = <Box paddingLeft={2}><Text dimColor={true}>… showing last {t6} of {totalCount}</Text></Box>;

  const t8 = <Box flexDirection="column" marginTop={1}>{t4}{t5}{t7}</Box>;

  return t8;
}
function _temp(v, i) {
  return <Box key={`${v.timestamp.getTime()}-${i}`} paddingLeft={2}><Text dimColor={true}>{formatTime(v.timestamp)}{v.command ? ` ${v.command}:` : ""} {v.line}</Text></Box>;
}
