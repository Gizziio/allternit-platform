import { toString as qrToString } from 'qrcode';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Pane } from '../../components/design-system/Pane';
import { Box, Text } from '../../ink';
import { useKeybinding } from '../../keybindings/useKeybinding';
import { useAppState } from '../../state/AppState';
import type { LocalJSXCommandCall } from '../../types/command';
import { logForDebugging } from '../../utils/debug';
type Props = {
  onDone: () => void;
};
function SessionInfo({
    onDone
}: Props) {
  const remoteSessionUrl = useAppState(_temp);
  const [qrCode, setQrCode] = useState("");
  const t1 = () => {
      if (!remoteSessionUrl) {
        return;
      }
      const url = remoteSessionUrl;
      const generateQRCode = async function generateQRCode() {
        const qr = await qrToString(url, {
          type: "utf8",
          errorCorrectionLevel: "L"
        });
        setQrCode(qr);
      };
      generateQRCode().catch(_temp2);
    };
  const t2 = [remoteSessionUrl];

  useEffect(t1, t2);
  const t3 = {
      context: "Confirmation"
    };

  useKeybinding("confirm:no", onDone, t3);
  if (!remoteSessionUrl) {
    const t4 = <Pane><Text color="warning">Not in remote mode. Start with `claude --remote` to use this command.</Text><Text dimColor={true}>(press esc to close)</Text></Pane>;

    return t4;
  }
  let T0;
  let t4;
  let t5;
  const lines = qrCode.split("\n").filter(_temp3);
  const isLoading = lines.length === 0;
  T0 = Pane;

    t4 = <Box marginBottom={1}><Text bold={true}>Remote session</Text></Box>;
  
  t5 = isLoading ? <Text dimColor={true}>Generating QR code…</Text> : lines.map(_temp4);
  

  const t6 = <Text dimColor={true}>Open in browser: </Text>;

  const t7 = <Box marginTop={1}>{t6}<Text color="ide">{remoteSessionUrl}</Text></Box>;

  const t8 = <Box marginTop={1}><Text dimColor={true}>(press esc to close)</Text></Box>;

  const t9 = <T0>{t4}{t5}{t7}{t8}</T0>;

  return t9;
}
function _temp4(line_0, i) {
  return <Text key={i}>{line_0}</Text>;
}
function _temp3(line) {
  return line.length > 0;
}
function _temp2(e) {
  logForDebugging("QR code generation failed", e);
}
function _temp(s) {
  return s.remoteSessionUrl;
}
export const call: LocalJSXCommandCall = async onDone => {
  return <SessionInfo onDone={onDone} />;
};
