import type { ToolResultBlockParam } from '@allternit/gizzi-sdk/providers/allternit/resources/index.mjs';
import * as React from 'react';
import { stripUnderlineAnsi } from './shell/OutputLine.tsx';
import { extractTag } from './../utils/extractTag.js';
import { removeSandboxViolationTags } from './../utils/sandbox/sandbox-ui-utils.ts';
import { Box, Text } from '../ink';
import { useShortcutDisplay } from '../keybindings/useShortcutDisplay';
import { countCharInString } from '../utils/stringUtils';
import { MessageResponse } from './MessageResponse';
const MAX_RENDERED_LINES = 10;
type Props = {
  result: ToolResultBlockParam['content'];
  verbose: boolean;
};
export function FallbackToolUseErrorMessage({
    result,
    verbose
}: Props) {
  const transcriptShortcut = useShortcutDisplay("app:toggleTranscript", "Global", "ctrl+o");
  let error;
  if (typeof result !== "string") {
      error = "Tool execution failed";
    }
  else {
      const extractedError = extractTag(result, "tool_use_error") ?? result;
      const withoutSandboxViolations = removeSandboxViolationTags(extractedError);
      const withoutErrorTags = withoutSandboxViolations.replace(/<\/?error>/g, "");
      const trimmed = withoutErrorTags.trim();
      if (!verbose && trimmed.includes("InputValidationError: ")) {
        error = "Invalid tool parameters";
      } else {
        if (trimmed.startsWith("Error: ") || trimmed.startsWith("Cancelled: ")) {
          error = trimmed;
        } else {
          error = `Error: ${trimmed}`;
        }
      }
    }
  const plusLines = countCharInString(error, "\n") + 1 - MAX_RENDERED_LINES;
  const T2 = MessageResponse;
  const T1 = Box;
  const t3 = "column";
  const T0 = Text;
  const t1 = "error";
  const t2 = stripUnderlineAnsi(verbose ? error : error.split("\n").slice(0, MAX_RENDERED_LINES).join("\n"));

  const t4 = <T0 color={t1}>{t2}</T0>;

  const t5 = !verbose && plusLines > 0 && <Box><Text dimColor={true}>… +{plusLines} {plusLines === 1 ? "line" : "lines"} (</Text><Text dimColor={true} bold={true}>{transcriptShortcut}</Text><Text> </Text><Text dimColor={true}>to see all)</Text></Box>;

  const t6 = <T1 flexDirection={t3}>{t4}{t5}</T1>;

  const t7 = <T2>{t6}</T2>;

  return t7;
}
