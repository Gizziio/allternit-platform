import * as React from 'react';
import type { Command } from '../commands';
import { Box } from '../ink';
import type { Screen } from '../screens/REPL';
import type { Tools } from '../Tool';
import type {
  AssistantMessage,
  CollapsedReadSearchGroup,
  ContentBlock,
  GroupedToolUseMessage,
  MessageContent,
  NormalizedMessage,
  NormalizedUserMessage,
  RenderableMessage,
  SystemMessage,
} from '../types/message';
import { getDisplayMessageFromCollapsed, getToolSearchOrReadInfo, getToolUseIdsFromCollapsedGroup, hasAnyToolInProgress } from '../utils/collapseReadSearch';
import { type buildMessageLookups, EMPTY_STRING_SET, getProgressMessagesFromLookup, getSiblingToolUseIDsFromLookup, getToolUseID } from '../utils/messages';
import { hasThinkingContent, Message } from './Message';
import { MessageModel } from './MessageModel';
import { shouldRenderStatically } from './Messages';
import { MessageTimestamp } from './MessageTimestamp';
import { OffscreenFreeze } from './OffscreenFreeze';
// RenderableMessage drifted to a loose interface extending Message; the row
// logic and the collapseReadSearch/messages helpers still operate on the
// original discriminated union. One boundary cast restores that shape — only
// normalized, renderable messages reach MessageRow at runtime.
type RowMessage =
  | NormalizedUserMessage
  | AssistantMessage
  | SystemMessage
  | GroupedToolUseMessage
  | CollapsedReadSearchGroup;
const asRowMessage = (m: RenderableMessage): RowMessage => m as unknown as RowMessage;
export type Props = {
  message: RenderableMessage;
  /** Whether the previous message in renderableMessages is also a user message. */
  isUserContinuation: boolean;
  /**
   * Whether there is non-skippable content after this message in renderableMessages.
   * Only needs to be accurate for `collapsed_read_search` messages — used to decide
   * if the collapsed group spinner should stay active. Pass `false` otherwise.
   */
  hasContentAfter: boolean;
  tools: Tools;
  commands: Command[];
  verbose: boolean;
  inProgressToolUseIDs: Set<string>;
  streamingToolUseIDs: Set<string>;
  screen: Screen;
  canAnimate: boolean;
  onOpenRateLimitOptions?: () => void;
  lastThinkingBlockId: string | null;
  latestBashOutputUUID: string | null;
  columns: number;
  isLoading: boolean;
  lookups: ReturnType<typeof buildMessageLookups>;
};

/**
 * Scans forward from `index+1` to check if any "real" content follows. Used to
 * decide whether a collapsed read/search group should stay in its active
 * (grey dot, present-tense "Reading…") state while the query is still loading.
 *
 * Exported so Messages.tsx can compute this once per message and pass the
 * result as a boolean prop — avoids passing the full `renderableMessages` array
 * to each MessageRow (which React Compiler would pin in the fiber's memoCache,
 * accumulating every historical version of the array ≈ 1-2MB over a 7-turn session).
 */
export function hasContentAfterIndex(messages: RenderableMessage[], index: number, tools: Tools, streamingToolUseIDs: Set<string>): boolean {
  for (let i = index + 1; i < messages.length; i++) {
    const msg = messages[i];
    if (msg?.type === 'assistant') {
      const content = msg.message.content[0];
      if (content?.type === 'thinking' || content?.type === 'redacted_thinking') {
        continue;
      }
      if (content?.type === 'tool_use') {
        if (getToolSearchOrReadInfo(content.name, content.input, tools).isCollapsible) {
          continue;
        }
        // Non-collapsible tool uses appear in syntheticStreamingToolUseMessages
        // before their ID is added to inProgressToolUseIDs. Skip while streaming
        // to avoid briefly finalizing the read group.
        if (streamingToolUseIDs.has(content.id)) {
          continue;
        }
      }
      return true;
    }
    if (msg?.type === 'system' || msg?.type === 'attachment') {
      continue;
    }
    // Tool results arrive while the collapsed group is still being built
    if (msg?.type === 'user') {
      const content = msg.message.content[0];
      if (content?.type === 'tool_result') {
        continue;
      }
    }
    // Collapsible grouped_tool_use messages arrive transiently before being
    // merged into the current collapsed group on the next render cycle
    if (msg?.type === 'grouped_tool_use') {
      const firstInput = msg.messages[0]?.message.content[0]?.input;
      if (getToolSearchOrReadInfo(msg.toolName, firstInput, tools).isCollapsible) {
        continue;
      }
    }
    return true;
  }
  return false;
}
function MessageRowImpl({
    message: msg,
    isUserContinuation,
    hasContentAfter,
    tools,
    commands,
    verbose,
    inProgressToolUseIDs,
    streamingToolUseIDs,
    screen,
    canAnimate,
    onOpenRateLimitOptions,
    lastThinkingBlockId,
    latestBashOutputUUID,
    columns,
    isLoading,
    lookups
}: Props) {
  const rowMsg = asRowMessage(msg);
  const isTranscriptMode = screen === "transcript";
  const isGrouped = rowMsg.type === "grouped_tool_use";
  const isCollapsed = rowMsg.type === "collapsed_read_search";
  const t1 = isCollapsed && (hasAnyToolInProgress(rowMsg, inProgressToolUseIDs) || isLoading && !hasContentAfter);

  const isActiveCollapsedGroup = t1;
  const t2 = isGrouped ? rowMsg.displayMessage : isCollapsed ? getDisplayMessageFromCollapsed(rowMsg) : rowMsg;

  const displayMsg = t2;
  const t3 = isGrouped || isCollapsed ? [] : getProgressMessagesFromLookup(rowMsg, lookups);

  const progressMessagesForMessage = t3;
  const siblingToolUseIDs = isGrouped || isCollapsed ? EMPTY_STRING_SET : getSiblingToolUseIDsFromLookup(rowMsg, lookups);
  const t4 = shouldRenderStatically(msg, streamingToolUseIDs, inProgressToolUseIDs, siblingToolUseIDs, screen, lookups);

  const isStatic = t4;
  let shouldAnimate = false;
  if (canAnimate) {
    if (isGrouped) {
      const t6 = m => {
            const content = m.message.content[0];
            return content?.type === "tool_use" && inProgressToolUseIDs.has(content.id);
          };

      const t5 = rowMsg.messages.some(t6);

      shouldAnimate = t5;
    } else {
      if (isCollapsed) {
        const t5 = hasAnyToolInProgress(rowMsg, inProgressToolUseIDs);

        shouldAnimate = t5;
      } else {
        const toolUseID = getToolUseID(rowMsg);
        const t5 = !toolUseID || inProgressToolUseIDs.has(toolUseID);

        shouldAnimate = t5;
      }
    }
  }
  const t5 = isTranscriptMode && displayMsg.type === "assistant" && (displayMsg.message.content as Array<MessageContent | ContentBlock>).some(_temp) && (displayMsg.timestamp || displayMsg.message.model);

  const hasMetadata = t5;
  const t6 = !hasMetadata;
  const t7 = hasMetadata ? undefined : columns;
  const t8 = <Message message={rowMsg} lookups={lookups} addMargin={t6} containerWidth={t7} tools={tools} commands={commands} verbose={verbose} inProgressToolUseIDs={inProgressToolUseIDs} progressMessagesForMessage={progressMessagesForMessage} shouldAnimate={shouldAnimate} shouldShowDot={true} isTranscriptMode={isTranscriptMode} isStatic={isStatic} onOpenRateLimitOptions={onOpenRateLimitOptions} isActiveCollapsedGroup={isActiveCollapsedGroup} isUserContinuation={isUserContinuation} lastThinkingBlockId={lastThinkingBlockId} latestBashOutputUUID={latestBashOutputUUID} />;

  const messageEl = t8;
  if (!hasMetadata) {
    const t9 = <OffscreenFreeze>{messageEl}</OffscreenFreeze>;

    return t9;
  }
  const t9 = <Box flexDirection="row" justifyContent="flex-end" gap={1} marginTop={1}><MessageTimestamp message={displayMsg as unknown as NormalizedMessage} isTranscriptMode={isTranscriptMode} /><MessageModel message={displayMsg as unknown as NormalizedMessage} isTranscriptMode={isTranscriptMode} /></Box>;

  const t10 = <OffscreenFreeze><Box width={columns} flexDirection="column">{t9}{messageEl}</Box></OffscreenFreeze>;

  return t10;
}

/**
 * Checks if a message is "streaming" - i.e., its content may still be changing.
 * Exported for testing.
 */
function _temp(c) {
  return c.type === "text";
}
export function isMessageStreaming(msg: RenderableMessage, streamingToolUseIDs: Set<string>): boolean {
  const rowMsg = asRowMessage(msg);
  if (rowMsg.type === 'grouped_tool_use') {
    return rowMsg.messages.some(m => {
      const content = m.message.content[0];
      return content?.type === 'tool_use' && streamingToolUseIDs.has(content.id);
    });
  }
  if (rowMsg.type === 'collapsed_read_search') {
    const toolIds = getToolUseIdsFromCollapsedGroup(rowMsg);
    return toolIds.some(id => streamingToolUseIDs.has(id));
  }
  const toolUseID = getToolUseID(rowMsg);
  return !!toolUseID && streamingToolUseIDs.has(toolUseID);
}

/**
 * Checks if all tools in a message are resolved.
 * Exported for testing.
 */
export function allToolsResolved(msg: RenderableMessage, resolvedToolUseIDs: Set<string>): boolean {
  const rowMsg = asRowMessage(msg);
  if (rowMsg.type === 'grouped_tool_use') {
    return rowMsg.messages.every(m => {
      const content = m.message.content[0];
      return content?.type === 'tool_use' && resolvedToolUseIDs.has(content.id);
    });
  }
  if (rowMsg.type === 'collapsed_read_search') {
    const toolIds = getToolUseIdsFromCollapsedGroup(rowMsg);
    return toolIds.every(id => resolvedToolUseIDs.has(id));
  }
  if (rowMsg.type === 'assistant') {
    const block = (rowMsg.message.content as Array<MessageContent | ContentBlock>)[0];
    if (block?.type === 'server_tool_use') {
      return resolvedToolUseIDs.has(block.id);
    }
  }
  const toolUseID = getToolUseID(rowMsg);
  return !toolUseID || resolvedToolUseIDs.has(toolUseID);
}

/**
 * Conservative memo comparator that only bails out when we're CERTAIN
 * the message won't change. Fails safe by re-rendering when uncertain.
 *
 * Exported for testing.
 */
export function areMessageRowPropsEqual(prev: Props, next: Props): boolean {
  // Different message reference = content may have changed, must re-render
  if (prev.message !== next.message) return false;

  // Screen mode change = re-render
  if (prev.screen !== next.screen) return false;

  // Verbose toggle changes thinking block visibility
  if (prev.verbose !== next.verbose) return false;

  // collapsed_read_search is never static in prompt mode (matches shouldRenderStatically)
  if (prev.message.type === 'collapsed_read_search' && next.screen !== 'transcript') {
    return false;
  }

  // Width change affects Box layout
  if (prev.columns !== next.columns) return false;

  // latestBashOutputUUID affects rendering (full vs truncated output)
  const prevIsLatestBash = prev.latestBashOutputUUID === prev.message.uuid;
  const nextIsLatestBash = next.latestBashOutputUUID === next.message.uuid;
  if (prevIsLatestBash !== nextIsLatestBash) return false;

  // lastThinkingBlockId affects thinking block visibility — but only for
  // messages that HAVE thinking content. Checking unconditionally busts the
  // memo for every scrollback message whenever thinking starts/stops (CC-941).
  if (prev.lastThinkingBlockId !== next.lastThinkingBlockId && hasThinkingContent(next.message as unknown as Parameters<typeof hasThinkingContent>[0])) {
    return false;
  }

  // Check if this message is still "in flight"
  const isStreaming = isMessageStreaming(prev.message, prev.streamingToolUseIDs);
  const isResolved = allToolsResolved(prev.message, prev.lookups.resolvedToolUseIDs);

  // Only bail out for truly static messages
  if (isStreaming || !isResolved) return false;

  // Static message - safe to skip re-render
  return true;
}
export const MessageRow = React.memo(MessageRowImpl, areMessageRowPropsEqual);
