import * as React from 'react';
import { Text } from '../../core/ink';
import { isClaudeAISubscriber } from '../../vendor/utils/auth';
import { isChromeExtensionInstalled, shouldEnableClaudeInChrome } from '../../vendor/utils/claudeInChrome/setup';
import { isRunningOnHomespace } from '../../vendor/utils/envUtils';
import { useStartupNotification } from './notifs/useStartupNotification';

function getChromeFlag(): boolean | undefined {
  if (process.argv.includes('--chrome')) {
    return true;
  }
  if (process.argv.includes('--no-chrome')) {
    return false;
  }
  return undefined;
}

export function useChromeExtensionNotification() {
  useStartupNotification(async () => {
    const chromeFlag = getChromeFlag();
    if (!shouldEnableClaudeInChrome(chromeFlag)) {
      return null;
    }
    if (!isClaudeAISubscriber()) {
      return {
        key: "chrome-requires-subscription",
        jsx: <Text color="error">Claude in Chrome requires a claude.ai subscription</Text>,
        priority: "immediate",
        timeoutMs: 5000
      };
    }
    const installed = await isChromeExtensionInstalled();
    if (!installed && !isRunningOnHomespace()) {
      return {
        key: "chrome-extension-not-detected",
        jsx: <Text color="warning">Chrome extension not detected · https://claude.ai/chrome to install</Text>,
        priority: "immediate",
        timeoutMs: 3000
      };
    }
    if (chromeFlag === undefined) {
      return {
        key: "claude-in-chrome-default-enabled",
        text: "Claude in Chrome enabled · /chrome",
        priority: "low"
      };
    }
    return null;
  });
}
