import type { ToolResultBlockParam } from '@allternit/gizzi-sdk/providers/allternit/resources/index.mjs';
import React from 'react';
import { CtrlOToExpand } from '../../components/CtrlOToExpand';
import { FallbackToolUseErrorMessage } from '../../components/FallbackToolUseErrorMessage';
import { MessageResponse } from '../../components/MessageResponse';
import { Box, Text } from '../../ink';
import { getDisplayPath } from '../../utils/file';
import { extractTag } from '../../utils/extractTag.js';
import type { Input, Output } from './LSPTool';
import { getSymbolAtPosition } from './symbolContext';

// Lookup map for operation-specific labels
const OPERATION_LABELS: Record<Input['operation'], {
  singular: string;
  plural: string;
  special?: string;
}> = {
  goToDefinition: {
    singular: 'definition',
    plural: 'definitions'
  },
  findReferences: {
    singular: 'reference',
    plural: 'references'
  },
  documentSymbol: {
    singular: 'symbol',
    plural: 'symbols'
  },
  workspaceSymbol: {
    singular: 'symbol',
    plural: 'symbols'
  },
  hover: {
    singular: 'hover info',
    plural: 'hover info',
    special: 'available'
  },
  goToImplementation: {
    singular: 'implementation',
    plural: 'implementations'
  },
  prepareCallHierarchy: {
    singular: 'call item',
    plural: 'call items'
  },
  incomingCalls: {
    singular: 'caller',
    plural: 'callers'
  },
  outgoingCalls: {
    singular: 'callee',
    plural: 'callees'
  }
};

/**
 * Reusable component for LSP result summaries with collapsed/expanded views
 */
function LSPResultSummary(t0) {
  const {
    operation,
    resultCount,
    fileCount,
    content,
    verbose
  } = t0;
  const t1 = OPERATION_LABELS[operation] || {
      singular: "result",
      plural: "results"
    };

  const labelConfig = t1;
  const countLabel = resultCount === 1 ? labelConfig.singular : labelConfig.plural;
  const t2 = operation === "hover" && resultCount > 0 && labelConfig.special ? <Text>Hover info {labelConfig.special}</Text> : <Text>Found <Text bold={true}>{resultCount} </Text>{countLabel}</Text>;

  const primaryText = t2;
  const t3 = fileCount > 1 ? <Text>{" "}across <Text bold={true}>{fileCount} </Text>files</Text> : null;

  const secondaryText = t3;
  if (verbose) {
    const t4 = <Text dimColor={true}>  ⎿  </Text>;

    const t5 = <Box flexDirection="row"><Text>{t4}{primaryText}{secondaryText}</Text></Box>;

    const t6 = <Box marginLeft={5}><Text>{content}</Text></Box>;

    const t7 = <Box flexDirection="column">{t5}{t6}</Box>;

    return t7;
  }
  const t4 = resultCount > 0 && <CtrlOToExpand />;

  const t5 = <MessageResponse height={1}><Text>{primaryText}{secondaryText} {t4}</Text></MessageResponse>;

  return t5;
}
export function userFacingName(): string {
  return 'LSP';
}
export function renderToolUseMessage(input: Partial<Input>, {
  verbose
}: {
  verbose: boolean;
}): React.ReactNode {
  if (!input.operation) {
    return null;
  }
  const parts: string[] = [];

  // For position-based operations (goToDefinition, findReferences, hover, goToImplementation),
  // show the symbol at the position for better context
  if ((input.operation === 'goToDefinition' || input.operation === 'findReferences' || input.operation === 'hover' || input.operation === 'goToImplementation') && input.filePath && input.line !== undefined && input.character !== undefined) {
    // Convert from 1-based (user input) to 0-based (internal file reading)
    const symbol = getSymbolAtPosition(input.filePath, input.line - 1, input.character - 1);
    const displayPath = verbose ? input.filePath : getDisplayPath(input.filePath);
    if (symbol) {
      parts.push(`operation: "${input.operation}"`);
      parts.push(`symbol: "${symbol}"`);
      parts.push(`in: "${displayPath}"`);
    } else {
      parts.push(`operation: "${input.operation}"`);
      parts.push(`file: "${displayPath}"`);
      parts.push(`position: ${input.line}:${input.character}`);
    }
    return parts.join(', ');
  }

  // For other operations (documentSymbol, workspaceSymbol),
  // show operation and file without position details
  parts.push(`operation: "${input.operation}"`);
  if (input.filePath) {
    const displayPath = verbose ? input.filePath : getDisplayPath(input.filePath);
    parts.push(`file: "${displayPath}"`);
  }
  return parts.join(', ');
}
export function renderToolUseErrorMessage(result: ToolResultBlockParam['content'], {
  verbose
}: {
  verbose: boolean;
}): React.ReactNode {
  if (!verbose && typeof result === 'string' && extractTag(result, 'tool_use_error')) {
    return <MessageResponse>
        <Text color="error">LSP operation failed</Text>
      </MessageResponse>;
  }
  return <FallbackToolUseErrorMessage result={result} verbose={verbose} />;
}
export function renderToolResultMessage(output: Output, _progressMessages: unknown[], {
  verbose
}: {
  verbose: boolean;
}): React.ReactNode {
  // Use collapsed/expanded view if we have count information
  if (output.resultCount !== undefined && output.fileCount !== undefined) {
    return <LSPResultSummary operation={output.operation} resultCount={output.resultCount} fileCount={output.fileCount} content={output.result} verbose={verbose} />;
  }

  // Fallback for error cases where counts aren't available
  // (e.g., LSP server initialization failures, request errors)
  return <MessageResponse>
      <Text>{output.result}</Text>
    </MessageResponse>;
}
