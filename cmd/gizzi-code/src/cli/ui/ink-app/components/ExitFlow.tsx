import sample from 'lodash-es/sample';
import React from 'react';
import { gracefulShutdown } from '../utils/gracefulShutdown';
import { WorktreeExitDialog } from './WorktreeExitDialog';
const GOODBYE_MESSAGES = ['Goodbye!', 'See ya!', 'Bye!', 'Catch you later!'];
function getRandomGoodbyeMessage(): string {
  return sample(GOODBYE_MESSAGES) ?? 'Goodbye!';
}
type Props = {
  onDone: (message?: string) => void;
  onCancel?: () => void;
  showWorktree: boolean;
};
export function ExitFlow({
    showWorktree,
    onDone,
    onCancel
}: Props) {
  const t1 = async function onExit(resultMessage) {
      onDone(resultMessage ?? getRandomGoodbyeMessage());
      await gracefulShutdown(0, "prompt_input_exit");
    };

  const onExit = t1;
  if (showWorktree) {
    const t2 = <WorktreeExitDialog onDone={onExit} onCancel={onCancel} />;

    return t2;
  }
  return null;
}
