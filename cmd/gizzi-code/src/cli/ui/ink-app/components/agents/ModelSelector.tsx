import * as React from 'react';
import { Box, Text } from '../../ink';
import { getAgentModelOptions } from '../../utils/model/agent';
import { Select } from '../CustomSelect/select';
interface ModelSelectorProps {
  initialModel?: string;
  onComplete: (model?: string) => void;
  onCancel?: () => void;
}
export function ModelSelector({
    initialModel,
    onComplete,
    onCancel
}: ModelSelectorProps) {
  let t1;
  bb0: {
    const base = getAgentModelOptions();
    if (initialModel && !base.some(o => o.value === initialModel)) {
      t1 = [{
        value: initialModel,
        label: initialModel,
        description: "Current model (custom ID)"
      }, ...base];
      break bb0;
    }
    t1 = base;
  }
  

  const modelOptions = t1;
  const defaultModel = initialModel ?? "sonnet";
  const t2 = <Box marginBottom={1}><Text dimColor={true}>Model determines the agent's reasoning capabilities and speed.</Text></Box>;

  const t3 = () => onCancel ? onCancel() : onComplete(undefined);

  const t4 = <Box flexDirection="column">{t2}<Select options={modelOptions} defaultValue={defaultModel} onChange={onComplete} onCancel={t3} /></Box>;

  return t4;
}
