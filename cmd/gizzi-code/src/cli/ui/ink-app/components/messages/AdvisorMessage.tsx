import figures from 'figures';
import React from 'react';
import { Box, Text } from '../../ink';
import type { AdvisorBlock } from '../../utils/advisor';
import { renderModelName } from '../../utils/model/model';
import { jsonStringify } from '../../utils/slowOperations';
import { CtrlOToExpand } from '../CtrlOToExpand';
import { MessageResponse } from '../MessageResponse';
import { ToolUseLoader } from '../ToolUseLoader';
type Props = {
  block: AdvisorBlock;
  addMargin: boolean;
  resolvedToolUseIDs: Set<string>;
  erroredToolUseIDs: Set<string>;
  shouldAnimate: boolean;
  verbose: boolean;
  advisorModel?: string;
};
export function AdvisorMessage({
    block,
    addMargin,
    resolvedToolUseIDs,
    erroredToolUseIDs,
    shouldAnimate,
    verbose,
    advisorModel
}: Props) {
  if (block.type === "server_tool_use") {
    const t1 = block.input && Object.keys(block.input).length > 0 ? jsonStringify(block.input) : null;

    const input = t1;
    const t2 = addMargin ? 1 : 0;
    const t3 = resolvedToolUseIDs.has(block.id);

    const t4 = !t3;
    const t5 = erroredToolUseIDs.has(block.id);

    const t6 = <ToolUseLoader shouldAnimate={shouldAnimate} isUnresolved={t4} isError={t5} />;

    const t7 = <Text bold={true}>Advising</Text>;

    const t8 = advisorModel ? <Text dimColor={true}> using {renderModelName(advisorModel)}</Text> : null;

    const t9 = input ? <Text dimColor={true}> · {input}</Text> : null;

    const t10 = <Box marginTop={t2} paddingRight={2} flexDirection="row">{t6}{t7}{t8}{t9}</Box>;

    return t10;
  }
  let body;
  bb0: switch (block.content.type) {
    case "advisor_tool_result_error":
      {
        const t1 = <Text color="error">Advisor unavailable ({block.content.error_code})</Text>;

        body = t1;
        break bb0;
      }
    case "advisor_result":
      {
        const t1 = verbose ? <Text dimColor={true}>{block.content.text}</Text> : <Text dimColor={true}>{figures.tick} Advisor has reviewed the conversation and will apply the feedback <CtrlOToExpand /></Text>;

        body = t1;
        break bb0;
      }
    case "advisor_redacted_result":
      {
        const t1 = <Text dimColor={true}>{figures.tick} Advisor has reviewed the conversation and will apply the feedback</Text>;

        body = t1;
      }
  }
  const t1 = <Box paddingRight={2}><MessageResponse>{body}</MessageResponse></Box>;

  return t1;
}
