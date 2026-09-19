import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getAllOutputStyles, OUTPUT_STYLE_CONFIG, type OutputStyleConfig } from '../constants/outputStyles';
import { Box, Text } from '../ink';
import type { OutputStyle } from '../utils/config';
import { getCwd } from '../utils/cwd';
import type { OptionWithDescription } from './CustomSelect/select';
import { Select } from './CustomSelect/select';
import { Dialog } from './design-system/Dialog';
const DEFAULT_OUTPUT_STYLE_LABEL = 'Default';
const DEFAULT_OUTPUT_STYLE_DESCRIPTION = 'Gizzi completes coding tasks efficiently and provides concise responses';
function mapConfigsToOptions(styles: {
  [styleName: string]: OutputStyleConfig | null;
}): OptionWithDescription[] {
  return Object.entries(styles).map(([style, config]) => ({
    label: config?.name ?? DEFAULT_OUTPUT_STYLE_LABEL,
    value: style,
    description: config?.description ?? DEFAULT_OUTPUT_STYLE_DESCRIPTION
  }));
}
export type OutputStylePickerProps = {
  initialStyle: OutputStyle;
  onComplete: (style: OutputStyle) => void;
  onCancel: () => void;
  isStandaloneCommand?: boolean;
};
export function OutputStylePicker({
    initialStyle,
    onComplete,
    onCancel,
    isStandaloneCommand
}: OutputStylePickerProps) {
  const t1 = [];

  const [styleOptions, setStyleOptions] = useState(t1);
  const [isLoading, setIsLoading] = useState(true);
  const t2 = () => {
      getAllOutputStyles(getCwd()).then(allStyles => {
        const options = mapConfigsToOptions(allStyles);
        setStyleOptions(options);
        setIsLoading(false);
      }).catch(() => {
        const builtInOptions = mapConfigsToOptions(OUTPUT_STYLE_CONFIG);
        setStyleOptions(builtInOptions);
        setIsLoading(false);
      });
    };
  const t3 = [];

  useEffect(t2, t3);
  const t4 = style => {
      const outputStyle = style as OutputStyle;
      onComplete(outputStyle);
    };

  const handleStyleSelect = t4;
  const t5 = !isStandaloneCommand;
  const t6 = !isStandaloneCommand;
  const t7 = <Box marginTop={1}><Text dimColor={true}>This changes how Gizzi Code communicates with you</Text></Box>;

  const t8 = <Box flexDirection="column" gap={1}>{t7}{isLoading ? <Text dimColor={true}>Loading output styles…</Text> : <Select options={styleOptions} onChange={handleStyleSelect} visibleOptionCount={10} defaultValue={initialStyle} />}</Box>;

  const t9 = <Dialog title="Preferred output style" onCancel={onCancel} hideInputGuide={t5} hideBorder={t6}>{t8}</Dialog>;

  return t9;
}
