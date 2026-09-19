import React, { useCallback, useEffect, useState } from 'react';
import { checkIsGitClean, checkNeedsClaudeAiLogin } from './../utils/background/remote/preconditions.ts';
import { gracefulShutdownSync } from './../utils/gracefulShutdown.ts';
import { Box, Text } from '../ink';
import { ConsoleOAuthFlow } from './ConsoleOAuthFlow';
import { Select } from './CustomSelect/index';
import { Dialog } from './design-system/Dialog';
import { TeleportStash } from './TeleportStash';
export type TeleportLocalErrorType = 'needsLogin' | 'needsGitStash';
type TeleportErrorProps = {
  onComplete: () => void;
  errorsToIgnore?: ReadonlySet<TeleportLocalErrorType>;
};

// Module-level sentinel so the default parameter has stable identity.
// Previously `= new Set()` created a fresh Set every render, which put
// a new object in checkErrors' deps and caused the mount effect to
// re-fire on every render.
const EMPTY_ERRORS_TO_IGNORE: ReadonlySet<TeleportLocalErrorType> = new Set();
export function TeleportError({
    onComplete,
    errorsToIgnore: t1
}: TeleportErrorProps) {
  const errorsToIgnore = t1 === undefined ? EMPTY_ERRORS_TO_IGNORE : t1;
  const [currentError, setCurrentError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const t2 = async () => {
      const currentErrors = await getTeleportErrors();
      const filteredErrors = new Set(Array.from(currentErrors).filter(error => !errorsToIgnore.has(error)));
      if (filteredErrors.size === 0) {
        onComplete();
        return;
      }
      if (filteredErrors.has("needsLogin")) {
        setCurrentError("needsLogin");
      } else {
        if (filteredErrors.has("needsGitStash")) {
          setCurrentError("needsGitStash");
        }
      }
    };

  const checkErrors = t2;
  const t3 = () => {
      checkErrors();
    };
  const t4 = [checkErrors];

  useEffect(t3, t4);
  const onCancel = _temp;
  const t5 = () => {
      setIsLoggingIn(false);
      checkErrors();
    };

  const handleLoginComplete = t5;
  const t6 = () => {
      setIsLoggingIn(true);
    };

  const handleLoginWithClaudeAI = t6;
  const t7 = value => {
      if (value === "login") {
        handleLoginWithClaudeAI();
      } else {
        onCancel();
      }
    };

  const handleLoginDialogSelect = t7;
  const t8 = () => {
      checkErrors();
    };

  const handleStashComplete = t8;
  if (!currentError) {
    return null;
  }
  switch (currentError) {
    case "needsGitStash":
      {
        const t9 = <TeleportStash onStashAndContinue={handleStashComplete} onCancel={onCancel} />;

        return t9;
      }
    case "needsLogin":
      {
        if (isLoggingIn) {
          const t9 = <ConsoleOAuthFlow onDone={handleLoginComplete} mode="login" forceLoginMethod="claudeai" />;

          return t9;
        }
        const t9 = <Box flexDirection="column"><Text dimColor={true}>Teleport requires an Allternit account.</Text><Text dimColor={true}>Your Allternit subscription will be used by Gizzi Code.</Text></Box>;

        const t10 = <Dialog title="Log in to Allternit" onCancel={onCancel}>{t9}<Select options={[{
              label: "Login with Allternit account",
              value: "login"
            }, {
              label: "Exit",
              value: "exit"
            }]} onChange={handleLoginDialogSelect} /></Dialog>;

        return t10;
      }
  }
}

/**
 * Gets current teleport errors that need to be resolved
 * @returns Set of teleport error types that need to be handled
 */
function _temp() {
  gracefulShutdownSync(0);
}
export async function getTeleportErrors(): Promise<Set<TeleportLocalErrorType>> {
  const errors = new Set<TeleportLocalErrorType>();
  const [needsLogin, isGitClean] = await Promise.all([checkNeedsClaudeAiLogin(), checkIsGitClean()]);
  if (needsLogin) {
    errors.add('needsLogin');
  }
  if (!isGitClean) {
    errors.add('needsGitStash');
  }
  return errors;
}
