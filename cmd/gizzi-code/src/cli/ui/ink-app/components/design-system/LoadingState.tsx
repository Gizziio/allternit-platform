import React from 'react';
import { Box, Text } from '../../ink';
import { Spinner } from '../Spinner';
type LoadingStateProps = {
  /**
   * The loading message to display next to the spinner.
   */
  message: string;

  /**
   * Display the message in bold.
   * @default false
   */
  bold?: boolean;

  /**
   * Display the message in dimmed color.
   * @default false
   */
  dimColor?: boolean;

  /**
   * Optional subtitle displayed below the main message.
   */
  subtitle?: string;
};

/**
 * A spinner with loading message for async operations.
 *
 * @example
 * // Basic loading
 * <LoadingState message="Loading..." />
 *
 * @example
 * // Bold loading message
 * <LoadingState message="Loading sessions" bold />
 *
 * @example
 * // With subtitle
 * <LoadingState
 *   message="Loading sessions"
 *   bold
 *   subtitle="Fetching your Gizzi Code sessions..."
 * />
 */
export function LoadingState({
    message,
    bold: t1,
    dimColor: t2,
    subtitle
}: LoadingStateProps) {
  const bold = t1 === undefined ? false : t1;
  const dimColor = t2 === undefined ? false : t2;
  const t3 = <Spinner />;

  const t4 = <Box flexDirection="row">{t3}<Text bold={bold} dimColor={dimColor}>{" "}{message}</Text></Box>;

  const t5 = subtitle && <Text dimColor={true}>{subtitle}</Text>;

  const t6 = <Box flexDirection="column">{t4}{t5}</Box>;

  return t6;
}
