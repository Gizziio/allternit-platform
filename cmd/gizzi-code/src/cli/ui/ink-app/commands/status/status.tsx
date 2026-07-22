// @ts-nocheck
import * as React from 'react';
import type { LocalJSXCommandContext } from '../../commands';
import { Settings } from '../../components/Settings/Settings';
import type { LocalJSXCommandOnDone } from '../../types/command';
import {
  getCwdState,
  getOriginalCwd,
  getSessionId,
  getTotalCostUSD,
  getTotalDuration,
  getTotalInputTokens,
  getTotalOutputTokens,
  getTotalCacheReadInputTokens,
  getTotalCacheCreationInputTokens,
} from '../../bootstrap/state.js';
import { formatDuration, formatTokens } from '../../utils/format.js';
import {
  calculateContextPercentages,
  getContextWindowForModel,
} from '../../utils/context.js';
import { getCurrentUsage } from '../../utils/tokens.js';
import {
  getRuntimeMainLoopModel,
  renderModelName,
} from '../../utils/model/model.js';

const PROGRESS_BAR_WIDTH = 24;

function renderProgressBar(ratio: number, width: number): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  const filled = Math.round(clamped * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function renderInlineStatus(context: LocalJSXCommandContext): string {
  const messages = context.getAppState().messages ?? [];
  const model = getRuntimeMainLoopModel({
    permissionMode: context.getAppState().toolPermissionContext.mode,
    mainLoopModel: context.options.mainLoopModel,
    exceeds200kTokens: false,
  });

  const modelDisplay = renderModelName(model);
  const cwd = getCwdState();
  const projectDir = getOriginalCwd();
  const sessionId = getSessionId();
  const version = (typeof MACRO !== 'undefined' ? MACRO.VERSION : undefined) ?? 'unknown';

  const contextWindowSize = getContextWindowForModel(model, undefined);
  const currentUsage = getCurrentUsage(messages);
  const contextPercentages = calculateContextPercentages(
    currentUsage,
    contextWindowSize,
  );

  const totalCost = getTotalCostUSD();
  const totalDuration = getTotalDuration();
  const totalInput = getTotalInputTokens();
  const totalOutput = getTotalOutputTokens();
  const cacheRead = getTotalCacheReadInputTokens();
  const cacheCreation = getTotalCacheCreationInputTokens();

  const mcpClients = context.options.mcpClients ?? [];

  const lines: string[] = [];
  lines.push('');
  lines.push('╭────────────────────────────────────────╮');
  lines.push('│  Status                                │');
  lines.push('╰────────────────────────────────────────╯');
  lines.push('');
  lines.push(`  Model:     ${modelDisplay}`);
  lines.push(`  Directory: ${cwd}`);
  if (projectDir && projectDir !== cwd) {
    lines.push(`  Project:   ${projectDir}`);
  }
  lines.push(`  Session:   ${sessionId}`);
  lines.push(`  Version:   ${version}`);
  lines.push('');

  lines.push('Context window');
  if (contextPercentages.used !== null && currentUsage) {
    const totalInputNow =
      currentUsage.input_tokens +
      currentUsage.cache_creation_input_tokens +
      currentUsage.cache_read_input_tokens;
    const ratio = contextPercentages.used / 100;
    const bar = renderProgressBar(ratio, PROGRESS_BAR_WIDTH);
    lines.push(
      `  ${bar}  ${contextPercentages.used}% (${formatTokens(totalInputNow)} / ${formatTokens(contextWindowSize)})`,
    );
  } else {
    lines.push('  No context usage data available.');
  }

  lines.push('');
  lines.push('Session usage');
  lines.push(`  Cost:      $${totalCost.toFixed(4)}`);
  lines.push(`  Duration:  ${formatDuration(totalDuration, { mostSignificantOnly: true })}`);
  lines.push(`  Tokens:    ${formatTokens(totalInput + totalOutput)}`);
  lines.push(`             ${formatTokens(totalInput)} in / ${formatTokens(totalOutput)} out`);
  if (cacheRead > 0 || cacheCreation > 0) {
    lines.push(`             ${formatTokens(cacheRead)} cache read / ${formatTokens(cacheCreation)} cache write`);
  }

  if (mcpClients.length > 0) {
    lines.push('');
    lines.push(`MCP servers: ${mcpClients.length} connected`);
    for (const client of mcpClients.slice(0, 5)) {
      const name = client.name ?? 'unknown';
      const status = client.status ?? 'unknown';
      lines.push(`  • ${name} (${status})`);
    }
    if (mcpClients.length > 5) {
      lines.push(`  ... and ${mcpClients.length - 5} more`);
    }
  }

  lines.push('');

  return lines.join('\n');
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  args: string,
): Promise<React.ReactNode> {
  if (args.trim() === '--inline') {
    onDone(renderInlineStatus(context), { display: 'system' });
    return null;
  }
  return <Settings onClose={onDone} context={context} defaultTab="Status" />;
}
