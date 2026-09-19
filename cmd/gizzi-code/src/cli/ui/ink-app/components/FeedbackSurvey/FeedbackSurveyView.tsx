import React from 'react';
import { Box, Text } from '../../ink';
import { useDebouncedDigitInput } from './useDebouncedDigitInput';
import type { FeedbackSurveyResponse } from './utils';
type Props = {
  onSelect: (option: FeedbackSurveyResponse) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  message?: string;
};
const RESPONSE_INPUTS = ['0', '1', '2', '3'] as const;
type ResponseInput = (typeof RESPONSE_INPUTS)[number];
const inputToResponse: Record<ResponseInput, FeedbackSurveyResponse> = {
  '0': 'dismissed',
  '1': 'bad',
  '2': 'fine',
  '3': 'good'
} as const;
export const isValidResponseInput = (input: string): input is ResponseInput => (RESPONSE_INPUTS as readonly string[]).includes(input);
const DEFAULT_MESSAGE = 'How is Gizzi doing this session? (optional)';
export function FeedbackSurveyView({
    onSelect,
    inputValue,
    setInputValue,
    message: t1
}: Props) {
  const message = t1 === undefined ? DEFAULT_MESSAGE : t1;
  const t2 = digit => onSelect(inputToResponse[digit]);

  const t3 = {
      inputValue,
      setInputValue,
      isValidDigit: isValidResponseInput,
      onDigit: t2
    };

  useDebouncedDigitInput(t3);
  const t4 = <Text color="ansi:cyan">● </Text>;

  const t5 = <Box>{t4}<Text bold={true}>{message}</Text></Box>;

  const t6 = <Box width={10}><Text><Text color="ansi:cyan">1</Text>: Bad</Text></Box>;

  const t7 = <Box width={10}><Text><Text color="ansi:cyan">2</Text>: Fine</Text></Box>;

  const t8 = <Box width={10}><Text><Text color="ansi:cyan">3</Text>: Good</Text></Box>;

  const t9 = <Box marginLeft={2}>{t6}{t7}{t8}<Box><Text><Text color="ansi:cyan">0</Text>: Dismiss</Text></Box></Box>;

  const t10 = <Box flexDirection="column" marginTop={1}>{t5}{t9}</Box>;

  return t10;
}
