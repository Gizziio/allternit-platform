import figures from 'figures';
import React from 'react';
import { Box, Text } from '../../../ink';
import type { Question } from '../../../tools/AskUserQuestionTool/AskUserQuestionTool';
import type { PermissionDecision } from '../../../utils/permissions/PermissionResult';
import { Select } from '../../CustomSelect/index';
import { Divider } from '../../design-system/Divider';
import { PermissionRequestTitle } from '../PermissionRequestTitle';
import { PermissionRuleExplanation } from '../PermissionRuleExplanation';
import { QuestionNavigationBar } from './QuestionNavigationBar';
type Props = {
  questions: Question[];
  currentQuestionIndex: number;
  answers: Record<string, string>;
  allQuestionsAnswered: boolean;
  permissionResult: PermissionDecision;
  minContentHeight?: number;
  onFinalResponse: (value: 'submit' | 'cancel') => void;
};
export function SubmitQuestionsView({
    questions,
    currentQuestionIndex,
    answers,
    allQuestionsAnswered,
    permissionResult,
    minContentHeight,
    onFinalResponse
}: Props) {
  const t1 = <Divider color="inactive" />;

  const t2 = <QuestionNavigationBar questions={questions} currentQuestionIndex={currentQuestionIndex} answers={answers} />;

  const t3 = <PermissionRequestTitle title="Review your answers" color="text" />;

  const t4 = !allQuestionsAnswered && <Box marginBottom={1}><Text color="warning">{figures.warning} You have not answered all questions</Text></Box>;

  const t5 = Object.keys(answers).length > 0 && <Box flexDirection="column" marginBottom={1}>{questions.filter(q => q?.question && answers[q.question]).map(q_0 => {
        const answer = answers[q_0?.question];
        return <Box key={q_0?.question || "answer"} flexDirection="column" marginLeft={1}><Text>{figures.bullet} {q_0?.question || "Question"}</Text><Box marginLeft={2}><Text color="success">{figures.arrowRight} {answer}</Text></Box></Box>;
      })}</Box>;

  const t6 = <PermissionRuleExplanation permissionResult={permissionResult} toolType="tool" />;

  const t7 = <Text color="inactive">Ready to submit your answers?</Text>;

  const t8 = {
      type: "text" as const,
      label: "Submit answers",
      value: "submit"
    };

  const t9 = [t8, {
      type: "text" as const,
      label: "Cancel",
      value: "cancel"
    }];

  const t10 = <Box marginTop={1}><Select options={t9} onChange={value => onFinalResponse(value as 'submit' | 'cancel')} onCancel={() => onFinalResponse("cancel")} /></Box>;

  const t11 = <Box flexDirection="column" marginTop={1} minHeight={minContentHeight}>{t4}{t5}{t6}{t7}{t10}</Box>;

  const t12 = <Box flexDirection="column" marginTop={1}>{t1}<Box flexDirection="column" borderTop={true} borderColor="inactive" paddingTop={0}>{t2}{t3}{t11}</Box></Box>;

  return t12;
}
