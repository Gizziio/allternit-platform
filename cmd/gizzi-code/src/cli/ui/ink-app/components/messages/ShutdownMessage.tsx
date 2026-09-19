import * as React from 'react';
import { Box, Text } from '../../ink';
import { isShutdownApproved, isShutdownRejected, isShutdownRequest, type ShutdownRejectedMessage, type ShutdownRequestMessage } from '../../utils/teammateMailbox';
type ShutdownRequestProps = {
  request: ShutdownRequestMessage;
};

/**
 * Renders a shutdown request with a warning-colored border.
 */
export function ShutdownRequestDisplay(t0) {
  const {
    request
  } = t0;
  const t1 = <Box marginBottom={1}><Text color="warning" bold={true}>Shutdown request from {request.from}</Text></Box>;

  const t2 = request.reason && <Box><Text>Reason: {request.reason}</Text></Box>;

  const t3 = <Box flexDirection="column" marginY={1}><Box borderStyle="round" borderColor="warning" flexDirection="column" paddingX={1} paddingY={1}>{t1}{t2}</Box></Box>;

  return t3;
}
type ShutdownRejectedProps = {
  response: ShutdownRejectedMessage;
};

/**
 * Renders a shutdown rejected message with a subtle (grey) border.
 */
export function ShutdownRejectedDisplay(t0) {
  const {
    response
  } = t0;
  const t1 = <Text color="subtle" bold={true}>Shutdown rejected by {response.from}</Text>;

  const t2 = <Box marginTop={1} borderStyle="dashed" borderColor="subtle" borderLeft={false} borderRight={false} paddingX={1}><Text>Reason: {response.reason}</Text></Box>;

  const t3 = <Box marginTop={1}><Text dimColor={true}>Teammate is continuing to work. You may request shutdown again later.</Text></Box>;

  const t4 = <Box flexDirection="column" marginY={1}><Box borderStyle="round" borderColor="subtle" flexDirection="column" paddingX={1} paddingY={1}>{t1}{t2}{t3}</Box></Box>;

  return t4;
}

/**
 * Try to parse and render a shutdown message from raw content.
 * Returns the rendered component if it's a shutdown message, null otherwise.
 */
export function tryRenderShutdownMessage(content: string): React.ReactNode | null {
  const request = isShutdownRequest(content);
  if (request) {
    return <ShutdownRequestDisplay request={request} />;
  }

  // Shutdown approved is handled inline by the caller — skip it here
  if (isShutdownApproved(content)) {
    return null;
  }
  const rejected = isShutdownRejected(content);
  if (rejected) {
    return <ShutdownRejectedDisplay response={rejected} />;
  }
  return null;
}

/**
 * Get a brief summary text for a shutdown message.
 * Used in places like the inbox queue where we want a short description.
 * Returns null if the content is not a shutdown message.
 */
export function getShutdownMessageSummary(content: string): string | null {
  const request = isShutdownRequest(content);
  if (request) {
    return `[Shutdown Request from ${request.from}]${request.reason ? ` ${request.reason}` : ''}`;
  }
  const approved = isShutdownApproved(content);
  if (approved) {
    return `[Shutdown Approved] ${approved.from} is now exiting`;
  }
  const rejected = isShutdownRejected(content);
  if (rejected) {
    return `[Shutdown Rejected] ${rejected.from}: ${rejected.reason}`;
  }
  return null;
}
