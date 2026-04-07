import React, { useEffect, useRef } from 'react';
import { useNotifications } from 'src/context/notifications';
import { Text } from 'src/ink';
import type { MCPServerConnection } from 'src/services/mcp/types';
import { getGlobalConfig, saveGlobalConfig } from 'src/utils/config';
import { detectIDEs, type IDEExtensionInstallationStatus, isJetBrainsIde, isSupportedTerminal } from 'src/utils/ide';
import { getIsRemoteMode } from '../../bootstrap/state';
import { useIdeConnectionStatus } from '../useIdeConnectionStatus';
import type { IDESelection } from '../useIdeSelection';

const MAX_IDE_HINT_SHOW_COUNT = 5;

type Props = {
  ideInstallationStatus: IDEExtensionInstallationStatus | null;
  ideSelection: IDESelection | undefined;
  mcpClients: MCPServerConnection[];
};

export function useIDEStatusIndicator({
  ideSelection,
  mcpClients,
  ideInstallationStatus
}: Props) {
  const { addNotification, removeNotification } = useNotifications();
  const { status: ideStatus, ideName } = useIdeConnectionStatus(mcpClients);
  const hasShownHintRef = useRef(false);

  const isJetBrains = ideInstallationStatus ? isJetBrainsIde(ideInstallationStatus?.ideType) : false;
  const showIDEInstallErrorOrJetBrainsInfo = ideInstallationStatus?.error || isJetBrains;
  const shouldShowIdeSelection = ideStatus === "connected" && (ideSelection?.filePath || ideSelection?.text && ideSelection.lineCount > 0);
  const shouldShowConnected = ideStatus === "connected" && !shouldShowIdeSelection;
  const showIDEInstallError = showIDEInstallErrorOrJetBrainsInfo && !isJetBrains && !shouldShowConnected && !shouldShowIdeSelection;
  const showJetBrainsInfo = showIDEInstallErrorOrJetBrainsInfo && isJetBrains && !shouldShowConnected && !shouldShowIdeSelection;

  useEffect(() => {
    if (getIsRemoteMode()) {
      return;
    }
    if (isSupportedTerminal() || ideStatus !== null || showJetBrainsInfo) {
      removeNotification("ide-status-hint");
      return;
    }
    if (hasShownHintRef.current || (getGlobalConfig().ideHintShownCount ?? 0) >= MAX_IDE_HINT_SHOW_COUNT) {
      return;
    }
    const timeoutId = setTimeout(() => {
      detectIDEs(true).then(infos => {
        const ideName_0 = infos[0]?.name;
        if (ideName_0 && !hasShownHintRef.current) {
          hasShownHintRef.current = true;
          saveGlobalConfig(current => ({
            ...current,
            ideHintShownCount: (current.ideHintShownCount ?? 0) + 1
          }));
          addNotification({
            key: "ide-status-hint",
            jsx: <Text dimColor={true}>/ide for <Text color="ide">{ideName_0}</Text></Text>,
            priority: "low"
          });
        }
      });
    }, 3000);
    return () => clearTimeout(timeoutId);
  }, [addNotification, removeNotification, ideStatus, showJetBrainsInfo]);

  useEffect(() => {
    if (showIDEInstallError || showJetBrainsInfo || ideStatus !== "disconnected" || !ideName) {
      removeNotification("ide-status-disconnected");
      return;
    }
    addNotification({
      key: "ide-status-disconnected",
      text: `${ideName} disconnected`,
      color: "error",
      priority: "medium"
    });
  }, [addNotification, removeNotification, ideStatus, ideName, showIDEInstallError, showJetBrainsInfo]);

  useEffect(() => {
    if (!showJetBrainsInfo) {
      removeNotification("ide-status-jetbrains-disconnected");
      return;
    }
    addNotification({
      key: "ide-status-jetbrains-disconnected",
      text: "IDE plugin not connected · /status for info",
      priority: "low"
    });
  }, [addNotification, removeNotification, showJetBrainsInfo]);

  useEffect(() => {
    if (!showIDEInstallError) {
      removeNotification("ide-status-install-error");
      return;
    }
    addNotification({
      key: "ide-status-install-error",
      text: "IDE extension install failed (see /status for info)",
      color: "error",
      priority: "medium"
    });
  }, [addNotification, removeNotification, showIDEInstallError]);
}
