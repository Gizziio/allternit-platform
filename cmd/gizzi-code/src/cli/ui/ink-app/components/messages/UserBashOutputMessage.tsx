import * as React from 'react';
import BashToolResultMessage from '../../tools/BashTool/BashToolResultMessage';
import { extractTag } from '../../utils/extractTag.js';
export function UserBashOutputMessage(t0) {
  const {
    content,
    verbose
  } = t0;
  const rawStdout = extractTag(content, "bash-stdout") ?? "";
  const t1 = extractTag(rawStdout, "persisted-output") ?? rawStdout;

  const stdout = t1;
  const t2 = extractTag(content, "bash-stderr") ?? "";

  const stderr = t2;
  const t3 = {
      stdout,
      stderr
    };

  const t4 = !!verbose;
  const t5 = <BashToolResultMessage content={t3} verbose={t4} />;

  return t5;
}
