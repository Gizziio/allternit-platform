/**
 * ViewHookMode shows read-only details for a single configured hook.
 *
 * The /hooks menu is read-only; this view replaces the former delete-hook
 * confirmation screen and directs users to settings.json or Claude for edits.
 */
import * as React from 'react';
import { Box, Text } from '../../ink';
import { hookSourceDescriptionDisplayString, type IndividualHookConfig } from '../../utils/hooks/hooksSettings';
import { Dialog } from '../design-system/Dialog';
type Props = {
  selectedHook: IndividualHookConfig;
  eventSupportsMatcher: boolean;
  onCancel: () => void;
};
export function ViewHookMode({
    selectedHook,
    eventSupportsMatcher,
    onCancel
}: Props) {
  const t1 = <Text>Event: <Text bold={true}>{selectedHook.event}</Text></Text>;

  const t2 = eventSupportsMatcher && <Text>Matcher: <Text bold={true}>{selectedHook.matcher || "(all)"}</Text></Text>;

  const t3 = <Text>Type: <Text bold={true}>{selectedHook.config.type}</Text></Text>;

  const t4 = hookSourceDescriptionDisplayString(selectedHook.source);

  const t5 = <Text>Source:{" "}<Text dimColor={true}>{t4}</Text></Text>;

  const t6 = selectedHook.pluginName && <Text>Plugin: <Text dimColor={true}>{selectedHook.pluginName}</Text></Text>;

  const t7 = <Box flexDirection="column">{t1}{t2}{t3}{t5}{t6}</Box>;

  const t8 = getContentFieldLabel(selectedHook.config);

  const t9 = <Text dimColor={true}>{t8}:</Text>;

  const t10 = getContentFieldValue(selectedHook.config);

  const t11 = <Box borderStyle="round" borderDimColor={true} paddingLeft={1} paddingRight={1}><Text>{t10}</Text></Box>;

  const t12 = <Box flexDirection="column">{t9}{t11}</Box>;

  const t13 = "statusMessage" in selectedHook.config && selectedHook.config.statusMessage && <Text>Status message:{" "}<Text dimColor={true}>{selectedHook.config.statusMessage}</Text></Text>;

  const t14 = <Text dimColor={true}>To modify or remove this hook, edit settings.json directly or ask Gizzi to help.</Text>;

  const t15 = <Box flexDirection="column" gap={1}>{t7}{t12}{t13}{t14}</Box>;

  const t16 = <Dialog title="Hook details" onCancel={onCancel} inputGuide={_temp}>{t15}</Dialog>;

  return t16;
}

/**
 * Get a human-readable label for the primary content field of a hook
 * based on its type.
 */
function _temp() {
  return <Text>Esc to go back</Text>;
}
function getContentFieldLabel(config: IndividualHookConfig['config']): string {
  switch (config.type) {
    case 'command':
      return 'Command';
    case 'prompt':
      return 'Prompt';
    case 'agent':
      return 'Prompt';
    case 'http':
      return 'URL';
  }
}

/**
 * Get the actual content value for a hook's primary field, bypassing
 * statusMessage so the detail view always shows the real command/prompt/URL.
 */
function getContentFieldValue(config: IndividualHookConfig['config']): string {
  switch (config.type) {
    case 'command':
      return config.command;
    case 'prompt':
      return config.prompt;
    case 'agent':
      return config.prompt;
    case 'http':
      return config.url;
  }
}
