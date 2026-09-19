import type { ToolResultBlockParam } from '@allternit/gizzi-sdk/providers/allternit/resources/index.mjs';
import React from 'react';
import { CtrlOToExpand } from '../../components/CtrlOToExpand';
import { FallbackToolUseErrorMessage } from '../../components/FallbackToolUseErrorMessage';
import { MessageResponse } from '../../components/MessageResponse';
import { TOOL_SUMMARY_MAX_LENGTH } from '../../constants/toolLimits';
import { Box, Text } from '../../ink';
import type { ToolProgressData } from '../../Tool';
import type { ProgressMessage } from '../../types/message';
import { FILE_NOT_FOUND_CWD_NOTE, getDisplayPath } from '../../utils/file';
import { truncate } from '../../utils/format';
import { extractTag } from '../../utils/extractTag.js';

// Reusable component for search result summaries
function SearchResultSummary(t0) {
  const {
    count,
    countLabel,
    secondaryCount,
    secondaryLabel,
    content,
    verbose
  } = t0;
  const t1 = <Text bold={true}>{count} </Text>;

  const t2 = count === 0 || count > 1 ? countLabel : countLabel.slice(0, -1);

  const t3 = <Text>Found {t1}{t2}</Text>;

  const primaryText = t3;
  const t4 = secondaryCount !== undefined && secondaryLabel ? <Text>{" "}across <Text bold={true}>{secondaryCount} </Text>{secondaryCount === 0 || secondaryCount > 1 ? secondaryLabel : secondaryLabel.slice(0, -1)}</Text> : null;

  const secondaryText = t4;
  if (verbose) {
    const t5 = <Text dimColor={true}>  ⎿  </Text>;

    const t6 = <Box flexDirection="row"><Text>{t5}{primaryText}{secondaryText}</Text></Box>;

    const t7 = <Box marginLeft={5}><Text>{content}</Text></Box>;

    const t8 = <Box flexDirection="column">{t6}{t7}</Box>;

    return t8;
  }
  const t5 = count > 0 && <CtrlOToExpand />;

  const t6 = <MessageResponse height={1}><Text>{primaryText}{secondaryText} {t5}</Text></MessageResponse>;

  return t6;
}
type Output = {
  mode?: 'content' | 'files_with_matches' | 'count';
  numFiles: number;
  filenames: string[];
  content?: string;
  numLines?: number; // For content mode
  numMatches?: number; // For count mode
};
export function renderToolUseMessage({
  pattern,
  path
}: Partial<{
  pattern: string;
  path?: string;
}>, {
  verbose
}: {
  verbose: boolean;
}): React.ReactNode {
  if (!pattern) {
    return null;
  }
  const parts = [`pattern: "${pattern}"`];
  if (path) {
    parts.push(`path: "${verbose ? path : getDisplayPath(path)}"`);
  }
  return parts.join(', ');
}
export function renderToolUseErrorMessage(result: ToolResultBlockParam['content'], {
  verbose
}: {
  verbose: boolean;
}): React.ReactNode {
  if (!verbose && typeof result === 'string' && extractTag(result, 'tool_use_error')) {
    const errorMessage = extractTag(result, 'tool_use_error');
    if (errorMessage?.includes(FILE_NOT_FOUND_CWD_NOTE)) {
      return <MessageResponse>
          <Text color="error">File not found</Text>
        </MessageResponse>;
    }
    return <MessageResponse>
        <Text color="error">Error searching files</Text>
      </MessageResponse>;
  }
  return <FallbackToolUseErrorMessage result={result} verbose={verbose} />;
}
export function renderToolResultMessage({
  mode = 'files_with_matches',
  filenames,
  numFiles,
  content,
  numLines,
  numMatches
}: Output, _progressMessagesForMessage: ProgressMessage<ToolProgressData>[], {
  verbose
}: {
  verbose: boolean;
}): React.ReactNode {
  if (mode === 'content') {
    return <SearchResultSummary count={numLines ?? 0} countLabel="lines" content={content} verbose={verbose} />;
  }
  if (mode === 'count') {
    return <SearchResultSummary count={numMatches ?? 0} countLabel="matches" secondaryCount={numFiles} secondaryLabel="files" content={content} verbose={verbose} />;
  }

  // files_with_matches mode
  const fileListContent = filenames.map(filename => filename).join('\n');
  return <SearchResultSummary count={numFiles} countLabel="files" content={fileListContent} verbose={verbose} />;
}
export function getToolUseSummary(input: Partial<{
  pattern: string;
  path?: string;
  glob?: string;
  type?: string;
  output_mode?: 'content' | 'files_with_matches' | 'count';
  head_limit?: number;
}> | undefined): string | null {
  if (!input?.pattern) {
    return null;
  }
  return truncate(input.pattern, TOOL_SUMMARY_MAX_LENGTH);
}
