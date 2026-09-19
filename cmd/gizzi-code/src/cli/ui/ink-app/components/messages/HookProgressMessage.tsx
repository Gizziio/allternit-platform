import * as React from 'react';
import { HOOK_EVENTS } from './../../entrypoints/agentSdkTypes.ts';
import type { buildMessageLookups } from './../../utils/messages.ts';
import { Box, Text } from '../../ink';
import { MessageResponse } from '../MessageResponse';
type HookEvent = (typeof HOOK_EVENTS)[number];
type Props = {
  hookEvent: HookEvent;
  lookups: ReturnType<typeof buildMessageLookups>;
  toolUseID: string;
  verbose: boolean;
  isTranscriptMode?: boolean;
};
export function HookProgressMessage({
    hookEvent,
    lookups,
    toolUseID,
    isTranscriptMode
}: Props) {
  const t1 = lookups.inProgressHookCounts.get(toolUseID)?.get(hookEvent) ?? 0;

  const inProgressHookCount = t1;
  const resolvedHookCount = lookups.resolvedHookCounts.get(toolUseID)?.get(hookEvent) ?? 0;
  if (inProgressHookCount === 0) {
    return null;
  }
  if (hookEvent === "PreToolUse" || hookEvent === "PostToolUse") {
    if (isTranscriptMode) {
      const t2 = <Text dimColor={true}>{inProgressHookCount} </Text>;

      const t3 = <Text dimColor={true} bold={true}>{hookEvent}</Text>;

      const t4 = inProgressHookCount === 1 ? " hook" : " hooks";
      const t5 = <Text dimColor={true}>{t4} ran</Text>;

      const t6 = <MessageResponse><Box flexDirection="row">{t2}{t3}{t5}</Box></MessageResponse>;

      return t6;
    }
    return null;
  }
  if (resolvedHookCount === inProgressHookCount) {
    return null;
  }
  const t2 = <Text dimColor={true}>Running </Text>;

  const t3 = <Text dimColor={true} bold={true}>{hookEvent}</Text>;

  const t4 = inProgressHookCount === 1 ? " hook\u2026" : " hooks\u2026";
  const t5 = <Text dimColor={true}>{t4}</Text>;

  const t6 = <MessageResponse><Box flexDirection="row">{t2}{t3}{t5}</Box></MessageResponse>;

  return t6;
}
