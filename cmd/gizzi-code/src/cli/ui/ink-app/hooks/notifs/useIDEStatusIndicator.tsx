import React, { useEffect, useRef } from 'react';
import { useNotifications } from '../../../../../context/notifications';
import { Text } from './../../ink.ts';
import type { MCPServerConnection } from './../../services/mcp/types.ts';
import { getGlobalConfig, saveGlobalConfig } from './../../utils/config.ts';
import { detectIDEs, type IDEExtensionInstallationStatus, isJetBrainsIde, isSupportedTerminal } from './../../utils/ide.ts';
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
  const {
    addNotification,
    removeNotification
  } = useNotifications();
  const {
    status: ideStatus,
    ideName
  } = useIdeConnectionStatus(mcpClients);
  const hasShownHintRef = useRef(false);
  const t1 = ideInstallationStatus ? isJetBrainsIde(ideInstallationStatus?.ideType) : false;

  const isJetBrains = t1;
  const showIDEInstallErrorOrJetBrainsInfo = ideInstallationStatus?.error || isJetBrains;
  const shouldShowIdeSelection = ideStatus === "connected" && (ideSelection?.filePath || ideSelection?.text && ideSelection.lineCount > 0);
  const shouldShowConnected = ideStatus === "connected" && !shouldShowIdeSelection;
  const showIDEInstallError = showIDEInstallErrorOrJetBrainsInfo && !isJetBrains && !shouldShowConnected && !shouldShowIdeSelection;
  const showJetBrainsInfo = showIDEInstallErrorOrJetBrainsInfo && isJetBrains && !shouldShowConnected && !shouldShowIdeSelection;
  const t2 = () => {
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
      const timeoutId = setTimeout(_temp2, 3000, hasShownHintRef, addNotification);
      return () => clearTimeout(timeoutId);
    };
  const t3 = [addNotification, removeNotification, ideStatus, showJetBrainsInfo];

  useEffect(t2, t3);
  const t4 = () => {
      if (getIsRemoteMode()) {
        return;
      }
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
    };
  const t5 = [addNotification, removeNotification, ideStatus, ideName, showIDEInstallError, showJetBrainsInfo];

  useEffect(t4, t5);
  const t6 = () => {
      if (getIsRemoteMode()) {
        return;
      }
      if (!showJetBrainsInfo) {
        removeNotification("ide-status-jetbrains-disconnected");
        return;
      }
      addNotification({
        key: "ide-status-jetbrains-disconnected",
        text: "IDE plugin not connected \xB7 /status for info",
        priority: "medium"
      });
    };
  const t7 = [addNotification, removeNotification, showJetBrainsInfo];

  useEffect(t6, t7);
  const t8 = () => {
      if (getIsRemoteMode()) {
        return;
      }
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
    };
  const t9 = [addNotification, removeNotification, showIDEInstallError];

  useEffect(t8, t9);
}
function _temp2(hasShownHintRef_0, addNotification_0) {
  detectIDEs(true).then(infos => {
    const ideName_0 = infos[0]?.name;
    if (ideName_0 && !hasShownHintRef_0.current) {
      hasShownHintRef_0.current = true;
      saveGlobalConfig(_temp);
      addNotification_0({
        key: "ide-status-hint",
        jsx: <Text dimColor={true}>/ide for <Text color="ide">{ideName_0}</Text></Text>,
        priority: "low"
      });
    }
  });
}
function _temp(current) {
  return {
    ...current,
    ideHintShownCount: (current.ideHintShownCount ?? 0) + 1
  };
}
