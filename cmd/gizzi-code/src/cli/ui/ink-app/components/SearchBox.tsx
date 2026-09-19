import React from 'react';
import { Box, Text } from '../ink';
type Props = {
  query: string;
  placeholder?: string;
  isFocused: boolean;
  isTerminalFocused: boolean;
  prefix?: string;
  width?: number | string;
  cursorOffset?: number;
  borderless?: boolean;
};
export function SearchBox({
    query,
    placeholder: t1,
    isFocused,
    isTerminalFocused,
    prefix: t2,
    width,
    cursorOffset,
    borderless: t3
}: Props) {
  const placeholder = t1 === undefined ? "Search\u2026" : t1;
  const prefix = t2 === undefined ? "\u2315" : t2;
  const borderless = t3 === undefined ? false : t3;
  const offset = cursorOffset ?? query.length;
  const t4 = borderless ? undefined : "round";
  const t5 = isFocused ? "suggestion" : undefined;
  const t6 = !isFocused;
  const t7 = borderless ? 0 : 1;
  const t8 = !isFocused;
  const t9 = isFocused ? <>{query ? isTerminalFocused ? <><Text>{query.slice(0, offset)}</Text><Text inverse={true}>{offset < query.length ? query[offset] : " "}</Text>{offset < query.length && <Text>{query.slice(offset + 1)}</Text>}</> : <Text>{query}</Text> : isTerminalFocused ? <><Text inverse={true}>{placeholder.charAt(0)}</Text><Text dimColor={true}>{placeholder.slice(1)}</Text></> : <Text dimColor={true}>{placeholder}</Text>}</> : query ? <Text>{query}</Text> : <Text>{placeholder}</Text>;

  const t10 = <Text dimColor={t8}>{prefix}{" "}{t9}</Text>;

  const t11 = <Box flexShrink={0} borderStyle={t4} borderColor={t5} borderDimColor={t6} paddingX={t7} width={width}>{t10}</Box>;

  return t11;
}
