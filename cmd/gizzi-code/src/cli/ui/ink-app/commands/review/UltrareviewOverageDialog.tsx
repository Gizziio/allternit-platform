import React, { useCallback, useRef, useState } from 'react';
import { Select } from '../../components/CustomSelect/select';
import { Dialog } from '../../components/design-system/Dialog';
import { Box, Text } from '../../ink';
type Props = {
  onProceed: (signal: AbortSignal) => Promise<void>;
  onCancel: () => void;
};
export function UltrareviewOverageDialog({
    onProceed,
    onCancel
}: Props) {
  const [isLaunching, setIsLaunching] = useState(false);
  const t1 = new AbortController();

  const abortControllerRef = useRef(t1);
  const t2 = value => {
      if (value === "proceed") {
        setIsLaunching(true);
        onProceed(abortControllerRef.current.signal).catch(() => setIsLaunching(false));
      } else {
        onCancel();
      }
    };

  const handleSelect = t2;
  const t3 = () => {
      abortControllerRef.current.abort();
      onCancel();
    };

  const handleCancel = t3;
  const t4 = [{
      label: "Proceed with Extra Usage billing",
      value: "proceed"
    }, {
      label: "Cancel",
      value: "cancel"
    }];

  const options = t4;
  const t5 = <Text>Your free ultrareviews for this organization are used. Further reviews bill as Extra Usage (pay-per-use).</Text>;

  const t6 = <Box flexDirection="column" gap={1}>{t5}{isLaunching ? <Text color="background">Launching…</Text> : <Select options={options} onChange={handleSelect} onCancel={handleCancel} />}</Box>;

  const t7 = <Dialog title="Ultrareview billing" onCancel={handleCancel} color="background">{t6}</Dialog>;

  return t7;
}
