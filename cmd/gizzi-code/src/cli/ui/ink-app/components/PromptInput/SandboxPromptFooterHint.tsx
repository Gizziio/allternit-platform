import * as React from 'react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Box, Text } from '../../ink';
import { useShortcutDisplay } from '../../keybindings/useShortcutDisplay';
import { SandboxManager } from '../../utils/sandbox/sandbox-adapter';
export function SandboxPromptFooterHint() {
  const [recentViolationCount, setRecentViolationCount] = useState(0);
  const timerRef = useRef(null);
  const detailsShortcut = useShortcutDisplay("app:toggleTranscript", "Global", "ctrl+o");
  const t0 = () => {
      if (!SandboxManager.isSandboxingEnabled()) {
        return;
      }
      const store = SandboxManager.getSandboxViolationStore();
      let lastCount = store.getTotalCount();
      const unsubscribe = store.subscribe(() => {
        const currentCount = store.getTotalCount();
        const newViolations = currentCount - lastCount;
        if (newViolations > 0) {
          setRecentViolationCount(newViolations);
          lastCount = currentCount;
          if (timerRef.current) {
            clearTimeout(timerRef.current);
          }
          timerRef.current = setTimeout(setRecentViolationCount, 5000, 0);
        }
      });
      return () => {
        unsubscribe();
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    };
  const t1 = [];

  useEffect(t0, t1);
  if (!SandboxManager.isSandboxingEnabled() || recentViolationCount === 0) {
    return null;
  }
  const t2 = recentViolationCount === 1 ? "operation" : "operations";
  const t3 = <Box paddingX={0} paddingY={0}><Text color="inactive" wrap="truncate">⧈ Sandbox blocked {recentViolationCount}{" "}{t2} ·{" "}{detailsShortcut} for details · /sandbox to disable</Text></Box>;

  return t3;
}
