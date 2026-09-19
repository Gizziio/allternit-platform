import React from 'react';
import { removeSandboxViolationTags } from './../../utils/sandbox/sandbox-ui-utils.ts';
import { KeyboardShortcutHint } from '../../components/design-system/KeyboardShortcutHint';
import { MessageResponse } from '../../components/MessageResponse';
import { OutputLine } from '../../components/shell/OutputLine';
import { ShellTimeDisplay } from '../../components/shell/ShellTimeDisplay';
import { Box, Text } from '../../ink';
import type { Out as BashOut } from './BashTool';
type Props = {
  content: Omit<BashOut, 'interrupted'>;
  verbose: boolean;
  timeoutMs?: number;
};

// Pattern to match "Shell cwd was reset to <path>" message
// Use (?:^|\n) to match either start of string or after a newline
const SHELL_CWD_RESET_PATTERN = /(?:^|\n)(Shell cwd was reset to .+)$/;

/**
 * Extracts sandbox violations from stderr if present
 * Returns both the cleaned stderr and the violations content
 */
function extractSandboxViolations(stderr: string): {
  cleanedStderr: string;
} {
  const violationsMatch = stderr.match(/<sandbox_violations>([\s\S]*?)<\/sandbox_violations>/);
  if (!violationsMatch) {
    return {
      cleanedStderr: stderr
    };
  }

  // Remove the sandbox violations section from stderr
  const cleanedStderr = removeSandboxViolationTags(stderr).trim();
  return {
    cleanedStderr
  };
}

/**
 * Extracts the "Shell cwd was reset" warning message from stderr
 * Returns the cleaned stderr and the warning message separately
 */
function extractCwdResetWarning(stderr: string): {
  cleanedStderr: string;
  cwdResetWarning: string | null;
} {
  const match = stderr.match(SHELL_CWD_RESET_PATTERN);
  if (!match) {
    return {
      cleanedStderr: stderr,
      cwdResetWarning: null
    };
  }

  // Extract the warning message from capture group 1
  const cwdResetWarning = match[1] ?? null;
  // Remove the warning from stderr (replace the full match)
  const cleanedStderr = stderr.replace(SHELL_CWD_RESET_PATTERN, '').trim();
  return {
    cleanedStderr,
    cwdResetWarning
  };
}
export default function BashToolResultMessage({
    content: t1,
    verbose,
    timeoutMs
}: Props) {
  const {
    stdout: t2,
    stderr: t3,
    isImage,
    returnCodeInterpretation,
    noOutputExpected,
    backgroundTaskId
  } = t1;
  const stdout = t2 === undefined ? "" : t2;
  const stdErrWithViolations = t3 === undefined ? "" : t3;
  let T0;
  let cwdResetWarning;
  let stderr;
  let t4;
  let t5;
  let t6;
  let t7;
  t7 = Symbol.for("react.early_return_sentinel");
  bb0: {
    const {
      cleanedStderr: stderrWithoutViolations
    } = extractSandboxViolations(stdErrWithViolations);
    ({
      cleanedStderr: stderr,
      cwdResetWarning
    } = extractCwdResetWarning(stderrWithoutViolations));
    if (isImage) {
      const t8 = <MessageResponse height={1}><Text dimColor={true}>[Image data detected and sent to Gizzi]</Text></MessageResponse>;

      t7 = t8;
      break bb0;
    }
    T0 = Box;
    t4 = "column";

      t5 = stdout !== "" ? <OutputLine content={stdout} verbose={verbose} /> : null;
    
    t6 = stderr.trim() !== "" ? <OutputLine content={stderr} verbose={verbose} isError={true} /> : null;
  }
  

  if (t7 !== Symbol.for("react.early_return_sentinel")) {
    return t7;
  }
  const t8 = cwdResetWarning ? <MessageResponse><Text dimColor={true}>{cwdResetWarning}</Text></MessageResponse> : null;

  const t9 = stdout === "" && stderr.trim() === "" && !cwdResetWarning ? <MessageResponse height={1}><Text dimColor={true}>{backgroundTaskId ? <>Running in the background{" "}<KeyboardShortcutHint shortcut={"\u2193"} action="manage" parens={true} /></> : returnCodeInterpretation || (noOutputExpected ? "Done" : "(No output)")}</Text></MessageResponse> : null;

  const t10 = timeoutMs && <MessageResponse><ShellTimeDisplay timeoutMs={timeoutMs} /></MessageResponse>;

  const t11 = <T0 flexDirection={t4}>{t5}{t6}{t8}{t9}{t10}</T0>;

  return t11;
}
