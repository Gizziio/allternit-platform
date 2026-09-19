// @ts-nocheck
// TODO(types): compiler-artifact decompile kept nocheck — ShellProgress not exported by ../types/tools (dormant-shim drift); latent, not a conversion regression.
import React from 'react';
import { Box } from '../ink';
import { BashTool } from '../tools/BashTool/BashTool';
import type { ShellProgress } from '../types/tools';
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
