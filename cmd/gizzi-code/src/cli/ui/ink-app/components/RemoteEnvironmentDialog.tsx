import chalk from '@/shared/util/chalk'
import figures from 'figures';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Text } from '../ink';
import { useKeybinding } from '../keybindings/useKeybinding';
import { toError } from '../utils/errors';
import { logError } from '../utils/log';
import { getSettingSourceName, type SettingSource } from '../utils/settings/constants';
import { updateSettingsForSource } from '../utils/settings/settings';
import { getEnvironmentSelectionInfo } from '../utils/teleport/environmentSelection';
import type { EnvironmentResource } from '../utils/teleport/environments';
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint';
import { Select } from './CustomSelect/select';
import { Byline } from './design-system/Byline';
import { Dialog } from './design-system/Dialog';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint';
import { LoadingState } from './design-system/LoadingState';
const DIALOG_TITLE = 'Select Remote Environment';
const SETUP_HINT = `Configure environments at: https://ai.allternit.com`;
type Props = {
  onDone: (message?: string) => void;
};
type LoadingState = 'loading' | 'updating' | null;
export function RemoteEnvironmentDialog({
    onDone
}: Props) {
  const [loadingState, setLoadingState] = useState("loading");
  const t1 = [];

  const [environments, setEnvironments] = useState(t1);
  const [selectedEnvironment, setSelectedEnvironment] = useState(null);
  const [selectedEnvironmentSource, setSelectedEnvironmentSource] = useState(null);
  const [error, setError] = useState(null);
  const t2 = () => {
      let cancelled = false;
      const fetchInfo = async function fetchInfo() {
        ;
        try {
          const result = await getEnvironmentSelectionInfo();
          if (cancelled) {
            return;
          }
          setEnvironments(result.availableEnvironments);
          setSelectedEnvironment(result.selectedEnvironment);
          setSelectedEnvironmentSource(result.selectedEnvironmentSource);
          setLoadingState(null);
        } catch (t4) {
          const err = t4;
          if (cancelled) {
            return;
          }
          const fetchError = toError(err);
          logError(fetchError);
          setError(fetchError.message);
          setLoadingState(null);
        }
      };
      fetchInfo();
      return () => {
        cancelled = true;
      };
    };
  const t3 = [];

  useEffect(t2, t3);
  const t4 = function handleSelect(value) {
      if (value === "cancel") {
        onDone();
        return;
      }
      setLoadingState("updating");
      const selectedEnv = environments.find(env => env.environment_id === value);
      if (!selectedEnv) {
        onDone("Error: Selected environment not found");
        return;
      }
      updateSettingsForSource("localSettings", {
        remote: {
          defaultEnvironmentId: selectedEnv.environment_id
        }
      });
      onDone(`Set default remote environment to ${chalk.bold(selectedEnv.name)} (${selectedEnv.environment_id})`);
    };

  const handleSelect = t4;
  if (loadingState === "loading") {
    const t5 = <LoadingState message={"Loading environments\u2026"} />;

    const t6 = <Dialog title={DIALOG_TITLE} onCancel={onDone} hideInputGuide={true}>{t5}</Dialog>;

    return t6;
  }
  if (error) {
    const t5 = <Text color="error">Error: {error}</Text>;

    const t6 = <Dialog title={DIALOG_TITLE} onCancel={onDone}>{t5}</Dialog>;

    return t6;
  }
  if (!selectedEnvironment) {
    const t5 = <Text>No remote environments available.</Text>;

    const t6 = <Dialog title={DIALOG_TITLE} subtitle={SETUP_HINT} onCancel={onDone}>{t5}</Dialog>;

    return t6;
  }
  if (environments.length === 1) {
    const t5 = <SingleEnvironmentContent environment={selectedEnvironment} onDone={onDone} />;

    return t5;
  }
  const t5 = <MultipleEnvironmentsContent environments={environments} selectedEnvironment={selectedEnvironment} selectedEnvironmentSource={selectedEnvironmentSource} loadingState={loadingState} onSelect={handleSelect} onCancel={onDone} />;

  return t5;
}
function EnvironmentLabel(t0) {
  const {
    environment
  } = t0;
  const t1 = <Text bold={true}>{environment.name}</Text>;

  const t2 = <Text dimColor={true}>({environment.environment_id})</Text>;

  const t3 = <Text>{figures.tick} Using {t1}{" "}{t2}</Text>;

  return t3;
}
function SingleEnvironmentContent(t0) {
  const {
    environment,
    onDone
  } = t0;
  const t1 = {
      context: "Confirmation"
    };

  useKeybinding("confirm:yes", onDone, t1);
  const t2 = <EnvironmentLabel environment={environment} />;

  const t3 = <Dialog title={DIALOG_TITLE} subtitle={SETUP_HINT} onCancel={onDone}>{t2}</Dialog>;

  return t3;
}
function MultipleEnvironmentsContent(t0) {
  const {
    environments,
    selectedEnvironment,
    selectedEnvironmentSource,
    loadingState,
    onSelect,
    onCancel
  } = t0;
  const t1 = selectedEnvironmentSource && selectedEnvironmentSource !== "localSettings" ? ` (from ${getSettingSourceName(selectedEnvironmentSource)} settings)` : "";

  const sourceSuffix = t1;
  const t2 = <Text bold={true}>{selectedEnvironment.name}</Text>;

  const t3 = <Text>Currently using: {t2}{sourceSuffix}</Text>;

  const subtitle = t3;
  const t4 = <Text dimColor={true}>{SETUP_HINT}</Text>;

  const t5 = loadingState === "updating" ? <LoadingState message={"Updating\u2026"} /> : <Select options={environments.map(_temp)} defaultValue={selectedEnvironment.environment_id} onChange={onSelect} onCancel={() => onSelect("cancel")} layout="compact-vertical" />;

  const t6 = <Text dimColor={true}><Byline><KeyboardShortcutHint shortcut="Enter" action="select" /><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" /></Byline></Text>;

  const t7 = <Dialog title={DIALOG_TITLE} subtitle={subtitle} onCancel={onCancel} hideInputGuide={true}>{t4}{t5}{t6}</Dialog>;

  return t7;
}
function _temp(env) {
  return {
    label: <Text>{env.name} <Text dimColor={true}>({env.environment_id})</Text></Text>,
    value: env.environment_id
  };
}
