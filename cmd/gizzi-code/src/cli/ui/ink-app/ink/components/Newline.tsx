import React from 'react';
export type Props = {
  /**
   * Number of newlines to insert.
   *
   * @default 1
   */
  readonly count?: number;
};

/**
 * Adds one or more newline (\n) characters. Must be used within <Text> components.
 */
export default function Newline(t0) {
  const {
    count: t1
  } = t0;
  const count = t1 === undefined ? 1 : t1;
  const t2 = "\n".repeat(count);

  const t3 = <ink-text>{t2}</ink-text>;

  return t3;
}
