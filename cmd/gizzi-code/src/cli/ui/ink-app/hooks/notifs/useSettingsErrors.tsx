import { useCallback, useEffect, useState } from 'react';
import { useNotifications } from '../../../../../context/notifications';
import { getIsRemoteMode } from '../../bootstrap/state';
import { getSettingsWithAllErrors } from '../../utils/settings/allErrors';
import type { ValidationError } from '../../utils/settings/validation';
import { useSettingsChange } from '../useSettingsChange';
const SETTINGS_ERRORS_NOTIFICATION_KEY = 'settings-errors';
export function useSettingsErrors() {
  const {
    addNotification,
    removeNotification
  } = useNotifications();
  const [errors_0, setErrors] = useState(_temp);
  const t0 = () => {
      const {
        errors: errors_1
      } = getSettingsWithAllErrors();
      setErrors(errors_1);
    };

  const handleSettingsChange = t0;
  useSettingsChange(handleSettingsChange);
  const t1 = () => {
      if (getIsRemoteMode()) {
        return;
      }
      if (errors_0.length > 0) {
        const message = `Found ${errors_0.length} settings ${errors_0.length === 1 ? "issue" : "issues"} · /doctor for details`;
        addNotification({
          key: SETTINGS_ERRORS_NOTIFICATION_KEY,
          text: message,
          color: "warning",
          priority: "high",
          timeoutMs: 60000
        });
      } else {
        removeNotification(SETTINGS_ERRORS_NOTIFICATION_KEY);
      }
    };
  const t2 = [errors_0, addNotification, removeNotification];

  useEffect(t1, t2);
  return errors_0;
}
function _temp() {
  const {
    errors
  } = getSettingsWithAllErrors();
  return errors;
}
