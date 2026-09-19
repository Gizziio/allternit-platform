import React from 'react';
import { Text } from '../../ink';
import type { CollapsedReadSearchGroup } from '../../types/message';

/**
 * Plain function (not a React component) so the React Compiler won't
 * hoist the teamMemory* property accesses for memoization. This module
 * is only loaded when feature('TEAMMEM') is true.
 */
export function checkHasTeamMemOps(message: CollapsedReadSearchGroup): boolean {
  return (message.teamMemorySearchCount ?? 0) > 0 || (message.teamMemoryReadCount ?? 0) > 0 || (message.teamMemoryWriteCount ?? 0) > 0;
}

/**
 * Renders team memory count parts for the collapsed read/search UI.
 * This module is only loaded when feature('TEAMMEM') is true,
 * so DCE removes it entirely from external builds.
 */
export function TeamMemCountParts(t0) {
  const {
    message,
    isActiveGroup,
    hasPrecedingParts
  } = t0;
  const tmReadCount = message.teamMemoryReadCount ?? 0;
  const tmSearchCount = message.teamMemorySearchCount ?? 0;
  const tmWriteCount = message.teamMemoryWriteCount ?? 0;
  if (tmReadCount === 0 && tmSearchCount === 0 && tmWriteCount === 0) {
    return null;
  }
  const nodes = [];
  let count = hasPrecedingParts ? 1 : 0;
  if (tmReadCount > 0) {
      const verb = isActiveGroup ? count === 0 ? "Recalling" : "recalling" : count === 0 ? "Recalled" : "recalled";
      if (count > 0) {
        const t2 = <Text key="comma-tmr">, </Text>;

        nodes.push(t2);
      }
      const t2 = <Text bold={true}>{tmReadCount}</Text>;

      const t3 = tmReadCount === 1 ? "memory" : "memories";
      const t4 = <Text key="team-mem-read">{verb} {t2} team{" "}{t3}</Text>;

      nodes.push(t4);
      count++;
    }
  if (tmSearchCount > 0) {
      const verb_0 = isActiveGroup ? count === 0 ? "Searching" : "searching" : count === 0 ? "Searched" : "searched";
      if (count > 0) {
        const t2 = <Text key="comma-tms">, </Text>;

        nodes.push(t2);
      }
      const t2 = `${verb_0} team memories`;
      const t3 = <Text key="team-mem-search">{t2}</Text>;

      nodes.push(t3);
      count++;
    }
  if (tmWriteCount > 0) {
      const verb_1 = isActiveGroup ? count === 0 ? "Writing" : "writing" : count === 0 ? "Wrote" : "wrote";
      if (count > 0) {
        const t2 = <Text key="comma-tmw">, </Text>;

        nodes.push(t2);
      }
      const t2 = <Text bold={true}>{tmWriteCount}</Text>;

      const t3 = tmWriteCount === 1 ? "memory" : "memories";
      const t4 = <Text key="team-mem-write">{verb_1} {t2} team{" "}{t3}</Text>;

      nodes.push(t4);
    }
  const t1 = <>{nodes}</>;

  return t1;
}
