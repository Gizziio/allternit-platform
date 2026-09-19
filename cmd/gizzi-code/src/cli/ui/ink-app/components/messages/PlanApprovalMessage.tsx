import * as React from 'react';
import { Markdown } from '../../components/Markdown';
import { Box, Text } from '../../ink';
import { jsonParse } from '../../utils/slowOperations';
import { type IdleNotificationMessage, isIdleNotification, isPlanApprovalRequest, isPlanApprovalResponse, type PlanApprovalRequestMessage, type PlanApprovalResponseMessage } from '../../utils/teammateMailbox';
import { getShutdownMessageSummary } from './ShutdownMessage';
import { getTaskAssignmentSummary } from './TaskAssignmentMessage';
type PlanApprovalRequestProps = {
  request: PlanApprovalRequestMessage;
};

/**
 * Renders a plan approval request with a planMode-colored border,
 * showing the plan content and instructions for approving/rejecting.
 */
export function PlanApprovalRequestDisplay(t0) {
  const {
    request
  } = t0;
  const t1 = <Box marginBottom={1}><Text color="planMode" bold={true}>Plan Approval Request from {request.from}</Text></Box>;

  const t2 = <Box borderStyle="dashed" borderColor="subtle" borderLeft={false} borderRight={false} flexDirection="column" paddingX={1} marginBottom={1}><Markdown>{request.planContent}</Markdown></Box>;

  const t3 = <Text dimColor={true}>Plan file: {request.planFilePath}</Text>;

  const t4 = <Box flexDirection="column" marginY={1}><Box borderStyle="round" borderColor="planMode" flexDirection="column" paddingX={1}>{t1}{t2}{t3}</Box></Box>;

  return t4;
}
type PlanApprovalResponseProps = {
  response: PlanApprovalResponseMessage;
  senderName: string;
};

/**
 * Renders a plan approval response with a success (green) or error (red) border.
 */
export function PlanApprovalResponseDisplay(t0) {
  const {
    response,
    senderName
  } = t0;
  if (response.approved) {
    const t1 = <Box><Text color="success" bold={true}>✓ Plan Approved by {senderName}</Text></Box>;

    const t2 = <Box marginTop={1}><Text>You can now proceed with implementation. Your plan mode restrictions have been lifted.</Text></Box>;

    const t3 = <Box flexDirection="column" marginY={1}><Box borderStyle="round" borderColor="success" flexDirection="column" paddingX={1} paddingY={1}>{t1}{t2}</Box></Box>;

    return t3;
  }
  const t1 = <Box><Text color="error" bold={true}>✗ Plan Rejected by {senderName}</Text></Box>;

  const t2 = response.feedback && <Box marginTop={1} borderStyle="dashed" borderColor="subtle" borderLeft={false} borderRight={false} paddingX={1}><Text>Feedback: {response.feedback}</Text></Box>;

  const t3 = <Box marginTop={1}><Text dimColor={true}>Please revise your plan based on the feedback and call ExitPlanMode again.</Text></Box>;

  const t4 = <Box flexDirection="column" marginY={1}><Box borderStyle="round" borderColor="error" flexDirection="column" paddingX={1} paddingY={1}>{t1}{t2}{t3}</Box></Box>;

  return t4;
}

/**
 * Try to parse and render a plan approval message from raw content.
 * Returns the rendered component if it's a plan approval message, null otherwise.
 */
export function tryRenderPlanApprovalMessage(content: string, senderName: string): React.ReactNode | null {
  const request = isPlanApprovalRequest(content);
  if (request) {
    return <PlanApprovalRequestDisplay request={request} />;
  }
  const response = isPlanApprovalResponse(content);
  if (response) {
    return <PlanApprovalResponseDisplay response={response} senderName={senderName} />;
  }
  return null;
}

/**
 * Get a brief summary text for a plan approval message.
 * Used in places like the inbox queue where we want a short description.
 * Returns null if the content is not a plan approval message.
 */
function getPlanApprovalSummary(content: string): string | null {
  const request = isPlanApprovalRequest(content);
  if (request) {
    return `[Plan Approval Request from ${request.from}]`;
  }
  const response = isPlanApprovalResponse(content);
  if (response) {
    if (response.approved) {
      return '[Plan Approved] You can now proceed with implementation';
    } else {
      return `[Plan Rejected] ${response.feedback || 'Please revise your plan'}`;
    }
  }
  return null;
}

/**
 * Get a brief summary text for an idle notification.
 */
function getIdleNotificationSummary(msg: IdleNotificationMessage): string {
  const parts: string[] = ['Agent idle'];
  if (msg.completedTaskId) {
    const status = msg.completedStatus || 'completed';
    parts.push(`Task ${msg.completedTaskId} ${status}`);
  }
  if (msg.summary) {
    parts.push(`Last DM: ${msg.summary}`);
  }
  return parts.join(' · ');
}

/**
 * Format teammate message content for display.
 * If it's a structured message (plan approval, shutdown, or idle), returns a formatted summary.
 * Otherwise returns the original content.
 */
export function formatTeammateMessageContent(content: string): string {
  const planSummary = getPlanApprovalSummary(content);
  if (planSummary) {
    return planSummary;
  }
  const shutdownSummary = getShutdownMessageSummary(content);
  if (shutdownSummary) {
    return shutdownSummary;
  }
  const idleMsg = isIdleNotification(content);
  if (idleMsg) {
    return getIdleNotificationSummary(idleMsg);
  }
  const taskAssignmentSummary = getTaskAssignmentSummary(content);
  if (taskAssignmentSummary) {
    return taskAssignmentSummary;
  }

  // Check for teammate_terminated message
  try {
    const parsed = jsonParse(content) as {
      type?: string;
      message?: string;
    };
    if (parsed?.type === 'teammate_terminated' && parsed.message) {
      return parsed.message;
    }
  } catch {
    // Not JSON
  }
  return content;
}
