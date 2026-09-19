// @ts-nocheck
// TODO(types): compiler-artifact decompile kept nocheck — WORKFLOWS string-vs-Workflow id drift (TS2322), latent, not a conversion regression.
import React, { useCallback, useState } from 'react';
import type { Workflow } from '../commands/install-github-app/types';
import type { ExitState } from '../hooks/useExitOnCtrlCDWithKeybindings';
import { Box, Link, Text } from '../ink';
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint';
import { SelectMulti } from './CustomSelect/SelectMulti';
import { Byline } from './design-system/Byline';
import { Dialog } from './design-system/Dialog';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint';
type WorkflowOption = {
  value: Workflow;
  label: string;
};
type Props = {
  onSubmit: (selectedWorkflows: Workflow[]) => void;
  defaultSelections: Workflow[];
};
const WORKFLOWS: WorkflowOption[] = [{
  value: 'claude' as const,
  label: '@Gizzi Code — tag @gizzi in issues and PR comments'
}, {
  value: 'claude-review' as const,
  label: 'Gizzi Code Review — automated code review on new PRs'
}];
function renderInputGuide(exitState: ExitState): React.ReactNode {
  if (exitState.pending) {
    return <Text>Press {exitState.keyName} again to exit</Text>;
  }
  return <Byline>
      <KeyboardShortcutHint shortcut="↑↓" action="navigate" />
      <KeyboardShortcutHint shortcut="Space" action="toggle" />
      <KeyboardShortcutHint shortcut="Enter" action="confirm" />
      <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" />
    </Byline>;
}
export function WorkflowMultiselectDialog({
    onSubmit,
    defaultSelections
}: Props) {
  const [showError, setShowError] = useState(false);
  const t1 = selectedValues => {
      if (selectedValues.length === 0) {
        setShowError(true);
        return;
      }
      setShowError(false);
      onSubmit(selectedValues);
    };

  const handleSubmit = t1;
  const t2 = () => {
      setShowError(false);
    };

  const handleChange = t2;
  const t3 = () => {
      setShowError(true);
    };

  const handleCancel = t3;
  const t4 = <Box><Text dimColor={true}>Workflow setup docs:{" "}<Link url="https://docs.gizziio.com">https://docs.gizziio.com</Link></Text></Box>;

  const t5 = WORKFLOWS.map(_temp);

  const t6 = <SelectMulti options={t5} defaultValue={defaultSelections} onSubmit={handleSubmit} onChange={handleChange} onCancel={handleCancel} hideIndexes={true} />;

  const t7 = showError && <Box><Text color="error">You must select at least one workflow to continue</Text></Box>;

  const t8 = <Dialog title="Select GitHub workflows to install" subtitle="We'll create a workflow file in your repository for each one you select." onCancel={handleCancel} inputGuide={renderInputGuide}>{t4}{t6}{t7}</Dialog>;

  return t8;
}
function _temp(workflow) {
  return {
    label: workflow.label,
    value: workflow.value
  };
}
