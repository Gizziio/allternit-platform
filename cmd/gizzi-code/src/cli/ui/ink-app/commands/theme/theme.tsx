import * as React from 'react';
import type { CommandResultDisplay } from '../../commands';
import { Pane } from '../../components/design-system/Pane';
import { ThemePicker } from '../../components/ThemePicker';
import { useTheme } from '../../ink';
import type { LocalJSXCommandCall } from '../../types/command';
type Props = {
  onDone: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
};
function ThemePickerCommand({
    onDone
}: Props) {
  const [, setTheme] = useTheme();
  const t1 = setting => {
      setTheme(setting);
      onDone(`Theme set to ${setting}`);
    };

  const t2 = () => {
      onDone("Theme picker dismissed", {
        display: "system"
      });
    };

  const t3 = <Pane color="permission"><ThemePicker onThemeSelect={t1} onCancel={t2} skipExitHandling={true} /></Pane>;

  return t3;
}
export const call: LocalJSXCommandCall = async (onDone, _context) => {
  return <ThemePickerCommand onDone={onDone} />;
};
