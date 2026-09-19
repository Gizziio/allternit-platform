import figures from 'figures';
import React, { useMemo } from 'react';
import { useTerminalSize } from '../../../hooks/useTerminalSize';
import { stringWidth } from '../../../ink/stringWidth';
import { Box, Text } from '../../../ink';
import type { Question } from '../../../tools/AskUserQuestionTool/AskUserQuestionTool';
import { truncateToWidth } from '../../../utils/format';
type Props = {
  questions: Question[];
  currentQuestionIndex: number;
  answers: Record<string, string>;
  hideSubmitTab?: boolean;
};
export function QuestionNavigationBar({
    questions,
    currentQuestionIndex,
    answers,
    hideSubmitTab: t1
}: Props) {
  const hideSubmitTab = t1 === undefined ? false : t1;
  const {
    columns
  } = useTerminalSize();
  const t2 = (() => {
    const submitText = hideSubmitTab ? "" : ` ${figures.tick} Submit `;
    const fixedWidth = stringWidth("\u2190 ") + stringWidth(" \u2192") + stringWidth(submitText);
    const availableForTabs = columns - fixedWidth;
    if (availableForTabs <= 0) {
      return questions.map((q, index) => {
        const header = q?.header || `Q${index + 1}`;
        return index === currentQuestionIndex ? header.slice(0, 3) : "";
      });
    }
    const tabHeaders = questions.map(_temp);
    const idealWidths = tabHeaders.map(_temp2);
    const totalIdealWidth = idealWidths.reduce(_temp3, 0);
    if (totalIdealWidth <= availableForTabs) {
      return tabHeaders;
    }
    const currentHeader = tabHeaders[currentQuestionIndex] || "";
    const currentIdealWidth = 4 + stringWidth(currentHeader);
    const currentTabWidth = Math.min(currentIdealWidth, availableForTabs / 2);
    const remainingWidth = availableForTabs - currentTabWidth;
    const otherTabCount = questions.length - 1;
    const widthPerOtherTab = Math.max(6, Math.floor(remainingWidth / Math.max(otherTabCount, 1)));
    return tabHeaders.map((header_1, index_1) => {
      if (index_1 === currentQuestionIndex) {
        const maxTextWidth = currentTabWidth - 2 - 2;
        return truncateToWidth(header_1, maxTextWidth);
      } else {
        const maxTextWidth_0 = widthPerOtherTab - 2 - 2;
        return truncateToWidth(header_1, maxTextWidth_0);
      }
    });
  })();
  const tabDisplayTexts = t2;
  const hideArrows = questions.length === 1 && hideSubmitTab;
  const t3 = !hideArrows && <Text color={currentQuestionIndex === 0 ? "inactive" : undefined}>←{" "}</Text>;

  const t5 = (q_1, index_2) => {
        const isSelected = index_2 === currentQuestionIndex;
        const isAnswered = q_1?.question && !!answers[q_1.question];
        const checkbox = isAnswered ? figures.checkboxOn : figures.checkboxOff;
        const displayText = tabDisplayTexts[index_2] || q_1?.header || `Q${index_2 + 1}`;
        return <Box key={q_1?.question || `question-${index_2}`}>{isSelected ? <Text backgroundColor="permission" color="inverseText">{" "}{checkbox} {displayText}{" "}</Text> : <Text>{" "}{checkbox} {displayText}{" "}</Text>}</Box>;
      };

  const t4 = questions.map(t5);

  const t5_2 = !hideSubmitTab && <Box key="submit">{currentQuestionIndex === questions.length ? <Text backgroundColor="permission" color="inverseText">{" "}{figures.tick} Submit{" "}</Text> : <Text> {figures.tick} Submit </Text>}</Box>;

  const t6 = !hideArrows && <Text color={currentQuestionIndex === questions.length ? "inactive" : undefined}>{" "}→</Text>;

  const t7 = <Box flexDirection="row" marginBottom={1}>{t3}{t4}{t5_2}{t6}</Box>;

  return t7;
}
function _temp3(sum, w) {
  return sum + w;
}
function _temp2(header_0) {
  return 4 + stringWidth(header_0);
}
function _temp(q_0, index_0) {
  return q_0?.header || `Q${index_0 + 1}`;
}
