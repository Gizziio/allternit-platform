import * as React from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { Ansi, Box, type DOMElement, measureElement, NoSelect, Text, useTheme } from '../ink';
import { isFullscreenEnvEnabled } from '../utils/fullscreen';
import sliceAnsi from '../utils/sliceAnsi';
import { countCharInString } from '../utils/stringUtils';
import { HighlightedCodeFallback } from './HighlightedCode/Fallback';
import { expectColorFile } from './StructuredDiff/colorDiff';
type Props = {
  code: string;
  filePath: string;
  width?: number;
  dim?: boolean;
};
const DEFAULT_WIDTH = 80;
export const HighlightedCode = memo(function HighlightedCode({
    code,
    filePath,
    width,
    dim: t1
}: Props) {
  const dim = t1 === undefined ? false : t1;
  const ref = useRef(null);
  const [measuredWidth, setMeasuredWidth] = useState(width || DEFAULT_WIDTH);
  const [theme] = useTheme();
  const settings = useSettings();
  const syntaxHighlightingDisabled = settings.syntaxHighlightingDisabled ?? false;
  let t2;
  bb0: {
    if (syntaxHighlightingDisabled) {
      t2 = null;
      break bb0;
    }
    const t3 = expectColorFile();

    const ColorFile = t3;
    if (!ColorFile) {
      t2 = null;
      break bb0;
    }
    const t4 = new ColorFile(code, filePath);

    t2 = t4;
  }
  const colorFile = t2;
  const t3 = () => {
      if (!width && ref.current) {
        const {
          width: elementWidth
        } = measureElement(ref.current);
        if (elementWidth > 0) {
          setMeasuredWidth(elementWidth - 2);
        }
      }
    };
  const t4 = [width];

  useEffect(t3, t4);
  let t5;
  bb1: {
    if (colorFile === null) {
      t5 = null;
      break bb1;
    }
    const t6 = colorFile.render(theme, measuredWidth, dim);

    t5 = t6;
  }
  const lines = t5;
  let t6;
  bb2: {
    if (!isFullscreenEnvEnabled()) {
      t6 = 0;
      break bb2;
    }
    const lineCount = countCharInString(code, "\n") + 1;
    const t7 = lineCount.toString();

    t6 = t7.length + 2;
  }
  const gutterWidth = t6;
  const t7 = <Box ref={ref}>{lines ? <Box flexDirection="column">{lines.map((line, i) => gutterWidth > 0 ? <CodeLine key={i} line={line} gutterWidth={gutterWidth} /> : <Text key={i}><Ansi>{line}</Ansi></Text>)}</Box> : <HighlightedCodeFallback code={code} filePath={filePath} dim={dim} skipColoring={syntaxHighlightingDisabled} />}</Box>;

  return t7;
});
function CodeLine(t0) {
  const {
    line,
    gutterWidth
  } = t0;
  const t1 = sliceAnsi(line, 0, gutterWidth);

  const gutter = t1;
  const t2 = sliceAnsi(line, gutterWidth);

  const content = t2;
  const t3 = <NoSelect fromLeftEdge={true}><Text><Ansi>{gutter}</Ansi></Text></NoSelect>;

  const t4 = <Text><Ansi>{content}</Ansi></Text>;

  const t5 = <Box flexDirection="row">{t3}{t4}</Box>;

  return t5;
}
