import React, { useEffect, useRef } from 'react';
import { BLACK_CIRCLE, BULLET_OPERATOR } from '../constants/figures';
import { Box, Text } from '../ink';
import type { SkillUpdate } from '../utils/hooks/skillImprovement';
import { normalizeFullWidthDigits } from '../utils/stringUtils';
import { isValidResponseInput } from './FeedbackSurvey/FeedbackSurveyView';
import type { FeedbackSurveyResponse } from './FeedbackSurvey/utils';
type Props = {
  isOpen: boolean;
  skillName: string;
  updates: SkillUpdate[];
  handleSelect: (selected: FeedbackSurveyResponse) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
};
export function SkillImprovementSurvey({
    isOpen,
    skillName,
    updates,
    handleSelect,
    inputValue,
    setInputValue
}: Props) {
  if (!isOpen) {
    return null;
  }
  if (inputValue && !isValidResponseInput(inputValue)) {
    return null;
  }
  const t1 = <SkillImprovementSurveyView skillName={skillName} updates={updates} onSelect={handleSelect} inputValue={inputValue} setInputValue={setInputValue} />;

  return t1;
}
type ViewProps = {
  skillName: string;
  updates: SkillUpdate[];
  onSelect: (option: FeedbackSurveyResponse) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
};

// Only 1 (apply) and 0 (dismiss) are valid for this survey
const VALID_INPUTS = ['0', '1'] as const;
function isValidInput(input: string): boolean {
  return (VALID_INPUTS as readonly string[]).includes(input);
}
function SkillImprovementSurveyView(t0) {
  const {
    skillName,
    updates,
    onSelect,
    inputValue,
    setInputValue
  } = t0;
  const initialInputValue = useRef(inputValue);
  const t1 = () => {
      if (inputValue !== initialInputValue.current) {
        const lastChar = normalizeFullWidthDigits(inputValue.slice(-1));
        if (isValidInput(lastChar)) {
          setInputValue(inputValue.slice(0, -1));
          onSelect(lastChar === "1" ? "good" : "dismissed");
        }
      }
    };
  const t2 = [inputValue, onSelect, setInputValue];

  useEffect(t1, t2);
  const t3 = <Text color="ansi:cyan">{BLACK_CIRCLE} </Text>;

  const t4 = <Box>{t3}<Text bold={true}>Skill improvement suggested for "{skillName}"</Text></Box>;

  const t5 = updates.map(_temp);

  const t6 = <Box flexDirection="column" marginLeft={2}>{t5}</Box>;

  const t7 = <Box width={12}><Text><Text color="ansi:cyan">1</Text>: Apply</Text></Box>;

  const t8 = <Box marginLeft={2} marginTop={1}>{t7}<Box width={14}><Text><Text color="ansi:cyan">0</Text>: Dismiss</Text></Box></Box>;

  const t9 = <Box flexDirection="column" marginTop={1}>{t4}{t6}{t8}</Box>;

  return t9;
}
function _temp(u, i) {
  return <Text key={i} dimColor={true}>{BULLET_OPERATOR} {u.change}</Text>;
}
