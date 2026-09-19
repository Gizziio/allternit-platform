import React from 'react';
import { envDynamic } from './../utils/envDynamic.ts';
import { Box, Text } from '../ink';
import { useKeybindings } from '../keybindings/useKeybinding';
import { getGlobalConfig, saveGlobalConfig } from '../utils/config';
import { env } from '../utils/env';
import { getTerminalIdeType, type IDEExtensionInstallationStatus, isJetBrainsIde, toIDEDisplayName } from '../utils/ide';
import { Dialog } from './design-system/Dialog';
interface Props {
  onDone: () => void;
  installationStatus: IDEExtensionInstallationStatus | null;
}
export function IdeOnboardingDialog({
    onDone,
    installationStatus
}: Props) {
  markDialogAsShown();
  const t1 = {
      "confirm:yes": onDone,
      "confirm:no": onDone
    };

  const t2 = {
      context: "Confirmation"
    };

  useKeybindings(t1, t2);
  const t3 = installationStatus?.ideType ?? getTerminalIdeType();

  const ideType = t3;
  const isJetBrains = isJetBrainsIde(ideType);
  const t4 = toIDEDisplayName(ideType);

  const ideName = t4;
  const installedVersion = installationStatus?.installedVersion;
  const pluginOrExtension = isJetBrains ? "plugin" : "extension";
  const mentionShortcut = env.platform === "darwin" ? "Cmd+Option+K" : "Ctrl+Alt+K";
  const t5 = <Text color="gizzi">● </Text>;

  const t6 = <>{t5}<Text>Welcome to Gizzi Code for {ideName}</Text></>;

  const t7 = installedVersion ? `installed ${pluginOrExtension} v${installedVersion}` : undefined;
  const t8 = <Text color="suggestion">⧉ open files</Text>;

  const t9 = <Text>• Gizzi has context of {t8}{" "}and <Text color="suggestion">⧉ selected lines</Text></Text>;

  const t10 = <Text color="diffAddedWord">+11</Text>;

  const t11 = <Text>• Review Gizzi Code's changes{" "}{t10}{" "}<Text color="diffRemovedWord">-22</Text> in the comfort of your IDE</Text>;

  const t12 = <Text>• Cmd+Esc<Text dimColor={true}> for Quick Launch</Text></Text>;

  const t13 = <Box flexDirection="column" gap={1}>{t9}{t11}{t12}<Text>• {mentionShortcut}<Text dimColor={true}> to reference files or lines in your input</Text></Text></Box>;

  const t14 = <Dialog title={t6} subtitle={t7} color="ide" onCancel={onDone} hideInputGuide={true}>{t13}</Dialog>;

  const t15 = <Box paddingX={1}><Text dimColor={true} italic={true}>Press Enter to continue</Text></Box>;

  const t16 = <>{t14}{t15}</>;

  return t16;
}
export function hasIdeOnboardingDialogBeenShown(): boolean {
  const config = getGlobalConfig();
  const terminal = envDynamic.terminal || 'unknown';
  return config.hasIdeOnboardingBeenShown?.[terminal] === true;
}
function markDialogAsShown(): void {
  if (hasIdeOnboardingDialogBeenShown()) {
    return;
  }
  const terminal = envDynamic.terminal || 'unknown';
  saveGlobalConfig(current => ({
    ...current,
    hasIdeOnboardingBeenShown: {
      ...current.hasIdeOnboardingBeenShown,
      [terminal]: true
    }
  }));
}
