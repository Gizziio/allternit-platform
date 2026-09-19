import figures from 'figures';
import React from 'react';
import { Text } from '../../ink';
type Status = 'success' | 'error' | 'warning' | 'info' | 'pending' | 'loading';
type Props = {
  /**
   * The status to display. Determines both the icon and color.
   *
   * - `success`: Green checkmark (✓)
   * - `error`: Red cross (✗)
   * - `warning`: Yellow warning symbol (⚠)
   * - `info`: Blue info symbol (ℹ)
   * - `pending`: Dimmed circle (○)
   * - `loading`: Dimmed ellipsis (…)
   */
  status: Status;
  /**
   * Include a trailing space after the icon. Useful when followed by text.
   * @default false
   */
  withSpace?: boolean;
};
const STATUS_CONFIG: Record<Status, {
  icon: string;
  color: 'success' | 'error' | 'warning' | 'suggestion' | undefined;
}> = {
  success: {
    icon: figures.tick,
    color: 'success'
  },
  error: {
    icon: figures.cross,
    color: 'error'
  },
  warning: {
    icon: figures.warning,
    color: 'warning'
  },
  info: {
    icon: figures.info,
    color: 'suggestion'
  },
  pending: {
    icon: figures.circle,
    color: undefined
  },
  loading: {
    icon: '…',
    color: undefined
  }
};

/**
 * Renders a status indicator icon with appropriate color.
 *
 * @example
 * // Success indicator
 * <StatusIcon status="success" />
 *
 * @example
 * // Error with trailing space for text
 * <Text><StatusIcon status="error" withSpace />Failed to connect</Text>
 *
 * @example
 * // Status line pattern
 * <Text>
 *   <StatusIcon status="pending" withSpace />
 *   Waiting for response
 * </Text>
 */
export function StatusIcon({
    status,
    withSpace: t1
}: Props) {
  const withSpace = t1 === undefined ? false : t1;
  const config = STATUS_CONFIG[status];
  const t2 = !config.color;
  const t3 = withSpace && " ";
  const t4 = <Text color={config.color} dimColor={t2}>{config.icon}{t3}</Text>;

  return t4;
}
