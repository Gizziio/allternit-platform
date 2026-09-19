import { basename } from 'path';
import { toString as qrToString, type QRCodeToStringOptionsOther } from 'qrcode';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { getOriginalCwd } from '../bootstrap/state';
import { buildActiveFooterText, buildIdleFooterText, FAILED_FOOTER_TEXT, getBridgeStatus } from '../bridge/bridgeStatusUtil';
import { BRIDGE_FAILED_INDICATOR, BRIDGE_READY_INDICATOR } from '../constants/figures';
import { useRegisterOverlay } from '../context/overlayContext';
// eslint-disable-next-line custom-rules/prefer-use-keybindings -- raw 'd' key for disconnect, not a configurable keybinding action
import { Box, Text, useInput } from '../ink';
import { useKeybindings } from '../keybindings/useKeybinding';
import { useAppState, useSetAppState } from '../state/AppState';
import { saveGlobalConfig } from '../utils/config';
import { getBranch } from '../utils/git';
import { Dialog } from './design-system/Dialog';
type Props = {
  onDone: () => void;
};
export function BridgeDialog({
    onDone
}: Props) {
  useRegisterOverlay("bridge-dialog", undefined);
  const connected = useAppState(_temp);
  const sessionActive = useAppState(_temp2);
  const reconnecting = useAppState(_temp3);
  const connectUrl = useAppState(_temp4);
  const sessionUrl = useAppState(_temp5);
  const error = useAppState(_temp6);
  const explicit = useAppState(_temp7);
  const environmentId = useAppState(_temp8);
  const sessionId = useAppState(_temp9);
  const verbose = useAppState(_temp0);
  const setAppState = useSetAppState();
  const [showQR, setShowQR] = useState(false);
  const [qrText, setQrText] = useState("");
  const [branchName, setBranchName] = useState("");
  const t1 = basename(getOriginalCwd());

  const repoName = t1;
  const t2 = () => {
      getBranch().then(setBranchName).catch(_temp1);
    };
  const t3 = [];

  useEffect(t2, t3);
  const displayUrl = sessionActive ? sessionUrl : connectUrl;
  const t4 = () => {
      if (!showQR || !displayUrl) {
        setQrText("");
        return;
      }
      // `small` is only declared on the Terminal variant in @types/qrcode,
      // but the runtime utf8 renderer honors it (upstream parity) — type
      // the options as the utf8 variant widened with `small`.
      const qrOptions: QRCodeToStringOptionsOther & { small: boolean } = {
        type: "utf8",
        errorCorrectionLevel: "L",
        small: true
      };
      qrToString(displayUrl, qrOptions).then(setQrText).catch(() => setQrText(""));
    };
  const t5 = [showQR, displayUrl];

  useEffect(t4, t5);
  const t6 = () => {
      setShowQR(_temp10);
    };

  const t7 = {
      "confirm:yes": onDone,
      "confirm:toggle": t6
    };

  const t8 = {
      context: "Confirmation"
    };

  useKeybindings(t7, t8);
  const t9 = input => {
      if (input === "d") {
        if (explicit) {
          saveGlobalConfig(_temp11);
        }
        setAppState(_temp12);
        onDone();
      }
    };

  useInput(t9);
  const t10 = getBridgeStatus({
      error,
      connected,
      sessionActive,
      reconnecting
    });

  const {
    label: statusLabel,
    color: statusColor
  } = t10;
  const indicator = error ? BRIDGE_FAILED_INDICATOR : BRIDGE_READY_INDICATOR;
  let T0;
  let T1;
  let footerText;
  let t11;
  let t12;
  let t13;
  let t14;
  let t15;
  let t16;
  let t17;
  const qrLines = qrText ? qrText.split("\n").filter(_temp13) : [];
  const contextParts = [];
  if (repoName) {
      contextParts.push(repoName);
    }
  if (branchName) {
      contextParts.push(branchName);
    }

  const contextSuffix = contextParts.length > 0 ? " \xB7 " + contextParts.join(" \xB7 ") : "";
  const t18 = error ? FAILED_FOOTER_TEXT : displayUrl ? sessionActive ? buildActiveFooterText(displayUrl) : buildIdleFooterText(displayUrl) : undefined;

  footerText = t18;
  T1 = Dialog;
  t15 = "Remote Control";
  t16 = onDone;
  t17 = true;
  T0 = Box;
  t11 = "column";
  t12 = 1;
  const t19 = <Text color={statusColor}>{indicator} {statusLabel}</Text>;

  const t20 = <Text dimColor={true}>{contextSuffix}</Text>;

  const t21 = <Text>{t19}{t20}</Text>;

  const t22 = error && <Text color="error">{error}</Text>;

  const t23 = verbose && environmentId && <Text dimColor={true}>Environment: {environmentId}</Text>;

  const t24 = verbose && sessionId && <Text dimColor={true}>Session: {sessionId}</Text>;


    t13 = <Box flexDirection="column">{t21}{t22}{t23}{t24}</Box>;
  
  t14 = showQR && qrLines.length > 0 && <Box flexDirection="column">{qrLines.map(_temp14)}</Box>;
  

  const t18_2 = footerText && <Text dimColor={true}>{footerText}</Text>;

  const t19_2 = <Text dimColor={true}>d to disconnect · space for QR code · Enter/Esc to close</Text>;

  const t20_2 = <T0 flexDirection={t11} gap={t12}>{t13}{t14}{t18_2}{t19_2}</T0>;

  const t21_2 = <T1 title={t15} onCancel={t16} hideInputGuide={t17}>{t20_2}</T1>;

  return t21_2;
}
function _temp14(line, i) {
  return <Text key={i}>{line}</Text>;
}
function _temp13(l) {
  return l.length > 0;
}
function _temp12(prev_0) {
  if (!prev_0.replBridgeEnabled) {
    return prev_0;
  }
  return {
    ...prev_0,
    replBridgeEnabled: false
  };
}
function _temp11(current) {
  if (current.remoteControlAtStartup === false) {
    return current;
  }
  return {
    ...current,
    remoteControlAtStartup: false
  };
}
function _temp10(prev) {
  return !prev;
}
function _temp1() {}
function _temp0(s_8) {
  return s_8.verbose;
}
function _temp9(s_7) {
  return s_7.replBridgeSessionId;
}
function _temp8(s_6) {
  return s_6.replBridgeEnvironmentId;
}
function _temp7(s_5) {
  return s_5.replBridgeExplicit;
}
function _temp6(s_4) {
  return s_4.replBridgeError;
}
function _temp5(s_3) {
  return s_3.replBridgeSessionUrl;
}
function _temp4(s_2) {
  return s_2.replBridgeConnectUrl;
}
function _temp3(s_1) {
  return s_1.replBridgeReconnecting;
}
function _temp2(s_0) {
  return s_0.replBridgeSessionActive;
}
function _temp(s) {
  return s.replBridgeConnected;
}
