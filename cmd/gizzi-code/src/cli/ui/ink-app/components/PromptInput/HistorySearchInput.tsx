import * as React from 'react';
import { stringWidth } from '../../ink/stringWidth';
import { Box, Text } from '../../ink';
import TextInput from '../TextInput';
type Props = {
  value: string;
  onChange: (value: string) => void;
  historyFailedMatch: boolean;
};
function HistorySearchInput({
    value,
    onChange,
    historyFailedMatch
}: Props) {
  const t1 = historyFailedMatch ? "no matching prompt:" : "search prompts:";
  const t2 = <Text dimColor={true}>{t1}</Text>;

  const t3 = stringWidth(value) + 1;
  const t4 = <TextInput value={value} onChange={onChange} cursorOffset={value.length} onChangeCursorOffset={_temp} columns={t3} focus={true} showCursor={true} multiline={false} dimColor={true} />;

  const t5 = <Box gap={1}>{t2}{t4}</Box>;

  return t5;
}
function _temp() {}
export default HistorySearchInput;
