import * as React from 'react';
import { Text } from '../../ink';
import type { Theme } from '../../utils/theme';
type Props = {
  char: string;
  index: number;
  glimmerIndex: number;
  messageColor: keyof Theme;
  shimmerColor: keyof Theme;
};
export function ShimmerChar({
    char,
    index,
    glimmerIndex,
    messageColor,
    shimmerColor
}: Props) {
  const isHighlighted = index === glimmerIndex;
  const isNearHighlight = Math.abs(index - glimmerIndex) === 1;
  const shouldUseShimmer = isHighlighted || isNearHighlight;
  const t1 = shouldUseShimmer ? shimmerColor : messageColor;
  const t2 = <Text color={t1}>{char}</Text>;

  return t2;
}
