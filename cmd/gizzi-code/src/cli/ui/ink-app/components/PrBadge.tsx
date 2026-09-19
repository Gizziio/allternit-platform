import React from 'react';
import { Link, Text } from '../ink';
import type { PrReviewState } from '../utils/ghPrStatus';
type Props = {
  number: number;
  url: string;
  reviewState?: PrReviewState;
  bold?: boolean;
};
export function PrBadge({
    number,
    url,
    reviewState,
    bold
}: Props) {
  const t1 = getPrStatusColor(reviewState);

  const statusColor = t1;
  const t2 = !statusColor && !bold;
  const t3 = <Text color={statusColor} dimColor={t2} bold={bold}>#{number}</Text>;

  const label = t3;
  const t4 = !bold;
  const t5 = <Text dimColor={t4}>PR</Text>;

  const t6 = !statusColor && !bold;
  const t7 = <Text color={statusColor} dimColor={t6} underline={true} bold={bold}>#{number}</Text>;

  const t8 = <Link url={url} fallback={label}>{t7}</Link>;

  const t9 = <Text>{t5}{" "}{t8}</Text>;

  return t9;
}
function getPrStatusColor(state?: PrReviewState): 'success' | 'error' | 'warning' | 'merged' | undefined {
  switch (state) {
    case 'approved':
      return 'success';
    case 'changes_requested':
      return 'error';
    case 'pending':
      return 'warning';
    case 'merged':
      return 'merged';
    default:
      return undefined;
  }
}
