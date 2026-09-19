import type { TextBlockParam } from '@allternit/gizzi-sdk/providers/allternit/resources/index.mjs';
import figures from 'figures';
import * as React from 'react';
import { COMMAND_MESSAGE_TAG } from '../../constants/xml';
import { Box, Text } from '../../ink';
import { extractTag } from '../../utils/extractTag.js';
type Props = {
  addMargin: boolean;
  param: TextBlockParam;
};
export function UserCommandMessage({
    addMargin,
    param: t1
}: Props) {
  const {
    text
  } = t1;
  const t2 = extractTag(text, COMMAND_MESSAGE_TAG);

  const commandMessage = t2;
  const t3 = extractTag(text, "command-args");

  const args = t3;
  const isSkillFormat = extractTag(text, "skill-format") === "true";
  if (!commandMessage) {
    return null;
  }
  if (isSkillFormat) {
    const t4 = addMargin ? 1 : 0;
    const t5 = <Text color="subtle">{figures.pointer} </Text>;

    const t6 = <Text>{t5}<Text color="text">Skill({commandMessage})</Text></Text>;

    const t7 = <Box flexDirection="column" marginTop={t4} backgroundColor="userMessageBackground" paddingRight={1}>{t6}</Box>;

    return t7;
  }
  const t4 = [commandMessage, args].filter(Boolean);

  const content = `/${t4.join(" ")}`;
  const t5 = addMargin ? 1 : 0;
  const t6 = <Text color="subtle">{figures.pointer} </Text>;

  const t7 = <Text>{t6}<Text color="text">{content}</Text></Text>;

  const t8 = <Box flexDirection="column" marginTop={t5} backgroundColor="userMessageBackground" paddingRight={1}>{t7}</Box>;

  return t8;
}
