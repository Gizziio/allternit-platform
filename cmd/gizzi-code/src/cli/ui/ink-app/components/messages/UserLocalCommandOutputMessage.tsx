import * as React from 'react';
import { DIAMOND_FILLED, DIAMOND_OPEN } from '../../constants/figures';
import { NO_CONTENT_MESSAGE } from '../../constants/messages';
import { Box, Text } from '../../ink';
import { extractTag } from '../../utils/extractTag.js';
import { Markdown } from '../Markdown';
import { MessageResponse } from '../MessageResponse';
type Props = {
  content: string;
};
export function UserLocalCommandOutputMessage({
    content
}: Props) {
  const stdout = extractTag(content, "local-command-stdout");
  const stderr = extractTag(content, "local-command-stderr");
  if (!stdout && !stderr) {
    const t2 = <MessageResponse><Text dimColor={true}>{NO_CONTENT_MESSAGE}</Text></MessageResponse>;

    return t2;
  }
  const lines: React.ReactNode[] = [];
  if (stdout?.trim()) {
    lines.push(<IndentedContent key="stdout">{stdout.trim()}</IndentedContent>);
  }
  if (stderr?.trim()) {
    lines.push(<IndentedContent key="stderr">{stderr.trim()}</IndentedContent>);
  }
  return lines;
}
function IndentedContent(t0) {
  const {
    children
  } = t0;
  if (children.startsWith(`${DIAMOND_OPEN} `) || children.startsWith(`${DIAMOND_FILLED} `)) {
    const t1 = <CloudLaunchContent>{children}</CloudLaunchContent>;

    return t1;
  }
  const t1 = <Text dimColor={true}>{"  \u23BF  "}</Text>;

  const t2 = <Box flexDirection="row">{t1}<Box flexDirection="column" flexGrow={1}><Markdown>{children}</Markdown></Box></Box>;

  return t2;
}
function CloudLaunchContent(t0) {
  const {
    children
  } = t0;
  const diamond = children[0];
  const nl = children.indexOf("\n");
  const header = nl === -1 ? children.slice(2) : children.slice(2, nl);
  const rest = nl === -1 ? "" : children.slice(nl + 1).trim();
  const sep = header.indexOf(" \xB7 ");
  const label = sep === -1 ? header : header.slice(0, sep);
  const t1 = sep === -1 ? "" : header.slice(sep);

  const suffix = t1;
  const t2 = <Text color="background">{diamond} </Text>;

  const t3 = <Text bold={true}>{label}</Text>;

  const t4 = suffix && <Text dimColor={true}>{suffix}</Text>;

  const t5 = <Text>{t2}{t3}{t4}</Text>;

  const t6 = rest && <Box flexDirection="row"><Text dimColor={true}>{"  \u23BF  "}</Text><Text dimColor={true}>{rest}</Text></Box>;

  const t7 = <Box flexDirection="column">{t5}{t6}</Box>;

  return t7;
}
