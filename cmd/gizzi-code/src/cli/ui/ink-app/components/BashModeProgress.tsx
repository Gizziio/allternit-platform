import React from 'react';
import { Box } from '../ink';
import { BashTool } from '../tools/BashTool/BashTool';
// ../types/tools is a dormant stub in this fork (never exported
// ShellProgress); local contract mirror of the ShellProgressMessage props.
type ShellProgress = {
  output: string;
  fullOutput: string;
  elapsedTimeSeconds?: number;
  totalLines?: number;
};
import { UserBashInputMessage } from './messages/UserBashInputMessage';
import { ShellProgressMessage } from './shell/ShellProgressMessage';
type Props = {
  input: string;
  progress: ShellProgress | null;
  verbose: boolean;
};
export function BashModeProgress({
    input,
    progress,
    verbose
}: Props) {
  const t1 = `<bash-input>${input}</bash-input>`;
  const t2 = <UserBashInputMessage addMargin={false} param={{
      text: t1,
      type: "text"
    }} />;

  const t3 = progress ? <ShellProgressMessage fullOutput={progress.fullOutput} output={progress.output} elapsedTimeSeconds={progress.elapsedTimeSeconds} totalLines={progress.totalLines} verbose={verbose} /> : BashTool.renderToolUseProgressMessage?.([], {
      verbose,
      tools: [],
      terminalSize: undefined
    });

  const t4 = <Box flexDirection="column" marginTop={1}>{t2}{t3}</Box>;

  return t4;
}
