import figures from 'figures';
import React, { useCallback, useState } from 'react';
import { Dialog } from '../../components/design-system/Dialog';
import { stringWidth } from '../../ink/stringWidth';
// eslint-disable-next-line custom-rules/prefer-use-keybindings -- raw text input for config dialog
import { Box, Text, useInput } from '../../ink';
import { useKeybinding, useKeybindings } from '../../keybindings/useKeybinding';
import { isEnvTruthy } from '../../utils/envUtils';
import type { PluginOptionSchema, PluginOptionValues } from '../../utils/plugins/pluginOptionsStorage';

/**
 * Build the onSave payload from collected string inputs.
 *
 * Sensitive fields are never prepopulated in the text buffer (security), so
 * by the time the user reaches the last field every sensitive field they
 * stepped through contains '' in collected. To avoid silently wiping saved
 * secrets on reconfigure: if a sensitive field is '' AND initialValues has
 * a value for it, OMIT the key entirely. savePluginOptions only writes keys
 * it receives, so omitting = keep existing.
 *
 * Exported for unit testing.
 */
export function buildFinalValues(fields: string[], collected: Record<string, string>, configSchema: PluginOptionSchema, initialValues: PluginOptionValues | undefined): PluginOptionValues {
  const finalValues: PluginOptionValues = {};
  for (const fieldKey of fields) {
    const schema = configSchema[fieldKey];
    const value = collected[fieldKey] ?? '';
    if (schema?.sensitive === true && value === '' && initialValues?.[fieldKey] !== undefined) {
      continue;
    }
    if (schema?.type === 'number') {
      // Number('') returns 0, not NaN — omit blank number inputs so
      // validateUserConfig's required check actually catches them.
      if (value.trim() === '') continue;
      const num = Number(value);
      finalValues[fieldKey] = Number.isNaN(num) ? value : num;
    } else if (schema?.type === 'boolean') {
      finalValues[fieldKey] = isEnvTruthy(value);
    } else {
      finalValues[fieldKey] = value;
    }
  }
  return finalValues;
}
type Props = {
  title: string;
  subtitle: string;
  configSchema: PluginOptionSchema;
  /** Pre-fill fields when reconfiguring. Sensitive fields are not prepopulated. */
  initialValues?: PluginOptionValues;
  onSave: (config: PluginOptionValues) => void;
  onCancel: () => void;
};
export function PluginOptionsDialog({
    title,
    subtitle,
    configSchema,
    initialValues,
    onSave,
    onCancel
}: Props) {
  const t1 = Object.keys(configSchema);

  const fields = t1;
  const t2 = key => {
      if (configSchema[key]?.sensitive === true) {
        return "";
      }
      const v = initialValues?.[key];
      return v === undefined ? "" : String(v);
    };

  const initialFor = t2;
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const t3 = {};

  const [values, setValues] = useState(t3);
  const t4 = () => fields[0] ? initialFor(fields[0]) : "";

  const [currentInput, setCurrentInput] = useState(t4);
  const currentField = fields[currentFieldIndex];
  const fieldSchema = currentField ? configSchema[currentField] : null;
  const t5 = {
      context: "Settings"
    };

  useKeybinding("confirm:no", onCancel, t5);
  const t6 = () => {
      if (currentFieldIndex < fields.length - 1 && currentField) {
        setValues(prev => ({
          ...prev,
          [currentField]: currentInput
        }));
        setCurrentFieldIndex(_temp);
        const nextKey = fields[currentFieldIndex + 1];
        setCurrentInput(nextKey ? initialFor(nextKey) : "");
      }
    };

  const handleNextField = t6;
  const t7 = () => {
      if (!currentField) {
        return;
      }
      const newValues = {
        ...values,
        [currentField]: currentInput
      };
      if (currentFieldIndex === fields.length - 1) {
        onSave(buildFinalValues(fields, newValues, configSchema, initialValues));
      } else {
        setValues(newValues);
        setCurrentFieldIndex(_temp2);
        const nextKey_0 = fields[currentFieldIndex + 1];
        setCurrentInput(nextKey_0 ? initialFor(nextKey_0) : "");
      }
    };

  const handleConfirm = t7;
  const t8 = {
      "confirm:nextField": handleNextField,
      "confirm:yes": handleConfirm
    };

  const t9 = {
      context: "Confirmation"
    };

  useKeybindings(t8, t9);
  const t10 = (char, key_0) => {
      if (key_0.backspace || key_0.delete) {
        setCurrentInput(_temp3);
        return;
      }
      if (char && !key_0.ctrl && !key_0.meta && !key_0.tab && !key_0.return) {
        setCurrentInput(prev_3 => prev_3 + char);
      }
    };

  useInput(t10);
  if (!fieldSchema || !currentField) {
    return null;
  }
  const isSensitive = fieldSchema.sensitive === true;
  const isRequired = fieldSchema.required === true;
  const t11 = isSensitive ? "*".repeat(stringWidth(currentInput)) : currentInput;

  const displayValue = t11;
  const t12 = fieldSchema.title || currentField;
  const t13 = isRequired && <Text color="error"> *</Text>;

  const t14 = <Text bold={true}>{t12}{t13}</Text>;

  const t15 = fieldSchema.description && <Text dimColor={true}>{fieldSchema.description}</Text>;

  const t16 = <Text>{figures.pointerSmall} </Text>;

  const t17 = <Text>{displayValue}</Text>;

  const t18 = <Text>█</Text>;

  const t19 = <Box marginTop={1}>{t16}{t17}{t18}</Box>;

  const t20 = <Box flexDirection="column">{t14}{t15}{t19}</Box>;

  const t21 = currentFieldIndex + 1;
  const t22 = <Text dimColor={true}>Field {t21} of {fields.length}</Text>;

  const t23 = currentFieldIndex < fields.length - 1 && <Text dimColor={true}>Tab: Next field · Enter: Save and continue</Text>;

  const t24 = currentFieldIndex === fields.length - 1 && <Text dimColor={true}>Enter: Save configuration</Text>;

  const t25 = <Box flexDirection="column">{t22}{t23}{t24}</Box>;

  const t26 = <Dialog title={title} subtitle={subtitle} onCancel={onCancel} isCancelActive={false}>{t20}{t25}</Dialog>;

  return t26;
}
function _temp3(prev_2) {
  return prev_2.slice(0, -1);
}
function _temp2(prev_1) {
  return prev_1 + 1;
}
function _temp(prev_0) {
  return prev_0 + 1;
}
