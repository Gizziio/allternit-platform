import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTerminalSize } from '../../hooks/useTerminalSize';
import { useTerminalViewport } from '../../ink/hooks/use-terminal-viewport';
import { Box, type DOMElement, measureElement } from '../../ink';
type Props = {
  children: React.ReactNode;
  lock?: 'always' | 'offscreen';
};
export function Ratchet({
    children,
    lock: t1
}: Props) {
  const lock = t1 === undefined ? "always" : t1;
  const [viewportRef, t2] = useTerminalViewport();
  const {
    isVisible
  } = t2;
  const {
    rows
  } = useTerminalSize();
  const innerRef = useRef(null);
  const maxHeight = useRef(0);
  const [minHeight, setMinHeight] = useState(0);
  const t3 = el => {
      viewportRef(el);
    };

  const outerRef = t3;
  const engaged = lock === "always" || !isVisible;
  const t4 = () => {
      if (!innerRef.current) {
        return;
      }
      const {
        height
      } = measureElement(innerRef.current);
      if (height > maxHeight.current) {
        maxHeight.current = Math.min(height, rows);
        setMinHeight(maxHeight.current);
      }
    };

  useLayoutEffect(t4);
  const t5 = engaged ? minHeight : undefined;
  const t6 = <Box ref={innerRef} flexDirection="column">{children}</Box>;

  const t7 = <Box minHeight={t5} ref={outerRef}>{t6}</Box>;

  return t7;
}
