import React, { useCallback, useState } from 'react';
import TextInput from '../../components/TextInput';
import { useTerminalSize } from '../../hooks/useTerminalSize';
import { Box, color, Text, useTheme } from '../../ink';
import { useKeybindings } from '../../keybindings/useKeybinding';
interface ApiKeyStepProps {
  existingApiKey: string | null;
  useExistingKey: boolean;
  apiKeyOrOAuthToken: string;
  onApiKeyChange: (value: string) => void;
  onToggleUseExistingKey: (useExisting: boolean) => void;
  onSubmit: () => void;
  onCreateOAuthToken?: () => void;
  selectedOption?: 'existing' | 'new' | 'oauth';
  onSelectOption?: (option: 'existing' | 'new' | 'oauth') => void;
}
export function ApiKeyStep({
    existingApiKey,
    apiKeyOrOAuthToken,
    onApiKeyChange,
    onSubmit,
    onToggleUseExistingKey,
    onCreateOAuthToken,
    selectedOption: t1,
    onSelectOption
}: ApiKeyStepProps) {
  const selectedOption = t1 === undefined ? existingApiKey ? "existing" : onCreateOAuthToken ? "oauth" : "new" : t1;
  const [cursorOffset, setCursorOffset] = useState(0);
  const terminalSize = useTerminalSize();
  const [theme] = useTheme();
  const t2 = () => {
      if (selectedOption === "new" && onCreateOAuthToken) {
        onSelectOption?.("oauth");
      } else {
        if (selectedOption === "oauth" && existingApiKey) {
          onSelectOption?.("existing");
          onToggleUseExistingKey(true);
        }
      }
    };

  const handlePrevious = t2;
  const t3 = () => {
      if (selectedOption === "existing") {
        onSelectOption?.(onCreateOAuthToken ? "oauth" : "new");
        onToggleUseExistingKey(false);
      } else {
        if (selectedOption === "oauth") {
          onSelectOption?.("new");
        }
      }
    };

  const handleNext = t3;
  const t4 = () => {
      if (selectedOption === "oauth" && onCreateOAuthToken) {
        onCreateOAuthToken();
      } else {
        onSubmit();
      }
    };

  const handleConfirm = t4;
  const isTextInputVisible = selectedOption === "new";
  const t5 = {
      "confirm:previous": handlePrevious,
      "confirm:next": handleNext,
      "confirm:yes": handleConfirm
    };

  const t6 = !isTextInputVisible;
  const t7 = {
      context: "Confirmation",
      isActive: t6
    };

  useKeybindings(t5, t7);
  const t8 = {
      "confirm:previous": handlePrevious,
      "confirm:next": handleNext
    };

  const t9 = {
      context: "Confirmation",
      isActive: isTextInputVisible
    };

  useKeybindings(t8, t9);
  const t10 = <Box flexDirection="column" marginBottom={1}><Text bold={true}>Install GitHub App</Text><Text dimColor={true}>Choose API key</Text></Box>;

  const t11 = existingApiKey && <Box marginBottom={1}><Text>{selectedOption === "existing" ? color("success", theme)("> ") : "  "}Use your existing Gizzi Code API key</Text></Box>;

  const t12 = onCreateOAuthToken && <Box marginBottom={1}><Text>{selectedOption === "oauth" ? color("success", theme)("> ") : "  "}Create a long-lived token with your Claude subscription</Text></Box>;

  const t13 = selectedOption === "new" ? color("success", theme)("> ") : "  ";

  const t14 = <Box marginBottom={1}><Text>{t13}Enter a new API key</Text></Box>;

  const t15 = selectedOption === "new" && <TextInput value={apiKeyOrOAuthToken} onChange={onApiKeyChange} onSubmit={onSubmit} onPaste={onApiKeyChange} focus={true} placeholder={"Create a new key at https://platform.allternit.com/api-keys"} mask="*" columns={terminalSize.columns} cursorOffset={cursorOffset} onChangeCursorOffset={setCursorOffset} showCursor={true} />;

  const t16 = <Box flexDirection="column" borderStyle="round" paddingX={1}>{t10}{t11}{t12}{t14}{t15}</Box>;

  const t17 = <Box marginLeft={3}><Text dimColor={true}>↑/↓ to select · Enter to continue</Text></Box>;

  const t18 = <>{t16}{t17}</>;

  return t18;
}
