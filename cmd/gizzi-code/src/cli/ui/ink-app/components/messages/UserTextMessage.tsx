import { feature } from 'bun:bundle';
import type { TextBlockParam } from '@allternit/gizzi-sdk/providers/allternit/resources/index.mjs';
import * as React from 'react';
import { NO_CONTENT_MESSAGE } from '../../constants/messages';
import { COMMAND_MESSAGE_TAG, LOCAL_COMMAND_CAVEAT_TAG, TASK_NOTIFICATION_TAG, TEAMMATE_MESSAGE_TAG, TICK_TAG } from '../../constants/xml';
import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled';
import { extractTag } from '../../utils/extractTag.js';
import { INTERRUPT_MESSAGE, INTERRUPT_MESSAGE_FOR_TOOL_USE } from '../../utils/syntheticMessages.js';
import { InterruptedByUser } from '../InterruptedByUser';
import { MessageResponse } from '../MessageResponse';
import { UserAgentNotificationMessage } from './UserAgentNotificationMessage';
import { UserBashInputMessage } from './UserBashInputMessage';
import { UserBashOutputMessage } from './UserBashOutputMessage';
import { UserCommandMessage } from './UserCommandMessage';
import { UserLocalCommandOutputMessage } from './UserLocalCommandOutputMessage';
import { UserMemoryInputMessage } from './UserMemoryInputMessage';
import { UserPlanMessage } from './UserPlanMessage';
import { UserPromptMessage } from './UserPromptMessage';
import { UserResourceUpdateMessage } from './UserResourceUpdateMessage';
import { UserTeammateMessage } from './UserTeammateMessage';
type Props = {
  addMargin: boolean;
  param: TextBlockParam;
  verbose: boolean;
  planContent?: string;
  isTranscriptMode?: boolean;
  timestamp?: string;
};
export function UserTextMessage({
    addMargin,
    param,
    verbose,
    planContent,
    isTranscriptMode,
    timestamp
}: Props) {
  if (param.text.trim() === NO_CONTENT_MESSAGE) {
    return null;
  }
  if (planContent) {
    const t1 = <UserPlanMessage addMargin={addMargin} planContent={planContent} />;

    return t1;
  }
  if (extractTag(param.text, TICK_TAG)) {
    return null;
  }
  if (param.text.includes(`<${LOCAL_COMMAND_CAVEAT_TAG}>`)) {
    return null;
  }
  if (param.text.startsWith("<bash-stdout") || param.text.startsWith("<bash-stderr")) {
    const t1 = <UserBashOutputMessage content={param.text} verbose={verbose} />;

    return t1;
  }
  if (param.text.startsWith("<local-command-stdout") || param.text.startsWith("<local-command-stderr")) {
    const t1 = <UserLocalCommandOutputMessage content={param.text} />;

    return t1;
  }
  if (param.text === INTERRUPT_MESSAGE || param.text === INTERRUPT_MESSAGE_FOR_TOOL_USE) {
    const t1 = <MessageResponse height={1}><InterruptedByUser /></MessageResponse>;

    return t1;
  }
  if (feature("KAIROS_GITHUB_WEBHOOKS")) {
    if (param.text.startsWith("<github-webhook-activity>")) {
      const t1 = require("./UserGitHubWebhookMessage.js");

      const {
        UserGitHubWebhookMessage
      } = t1 as any;
      const t2 = <UserGitHubWebhookMessage addMargin={addMargin} param={param} />;

      return t2;
    }
  }
  if (param.text.includes("<bash-input>")) {
    const t1 = <UserBashInputMessage addMargin={addMargin} param={param} />;

    return t1;
  }
  if (param.text.includes(`<${COMMAND_MESSAGE_TAG}>`)) {
    const t1 = <UserCommandMessage addMargin={addMargin} param={param} />;

    return t1;
  }
  if (param.text.includes("<user-memory-input>")) {
    const t1 = <UserMemoryInputMessage addMargin={addMargin} text={param.text} />;

    return t1;
  }
  if (isAgentSwarmsEnabled() && param.text.includes(`<${TEAMMATE_MESSAGE_TAG}`)) {
    const t1 = <UserTeammateMessage addMargin={addMargin} param={param} isTranscriptMode={isTranscriptMode} />;

    return t1;
  }
  if (param.text.includes(`<${TASK_NOTIFICATION_TAG}`)) {
    const t1 = <UserAgentNotificationMessage addMargin={addMargin} param={param} />;

    return t1;
  }
  if (param.text.includes("<mcp-resource-update") || param.text.includes("<mcp-polling-update")) {
    const t1 = <UserResourceUpdateMessage addMargin={addMargin} param={param} />;

    return t1;
  }
  if (feature("FORK_SUBAGENT")) {
    if (param.text.includes("<fork-boilerplate>")) {
      const t1 = require("./UserForkBoilerplateMessage.js");

      const {
        UserForkBoilerplateMessage
      } = t1 as any;
      const t2 = <UserForkBoilerplateMessage addMargin={addMargin} param={param} />;

      return t2;
    }
  }
  if (param.text.includes("<cross-session-message")) {
    const t1 = require("./UserCrossSessionMessage.js");

    const {
        UserCrossSessionMessage
      } = t1 as any;
    const t2 = <UserCrossSessionMessage addMargin={addMargin} param={param} />;

    return t2;
  }
  if (feature("KAIROS") || feature("KAIROS_CHANNELS")) {
    if (param.text.includes("<channel source=\"")) {
      const t1 = require("./UserChannelMessage.js");

      const {
        UserChannelMessage
      } = t1 as typeof import('./UserChannelMessage.js');
      const t2 = <UserChannelMessage addMargin={addMargin} param={param} />;

      return t2;
    }
  }
  const t1 = <UserPromptMessage addMargin={addMargin} param={param} isTranscriptMode={isTranscriptMode} timestamp={timestamp} />;

  return t1;
}
