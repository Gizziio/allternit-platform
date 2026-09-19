import { useEffect, useRef } from 'react';
import { useNotifications } from '../../../../../context/notifications';
import { getModelDeprecationWarning } from './../../utils/model/deprecation.ts';
import { getIsRemoteMode } from '../../bootstrap/state';
export function useDeprecationWarningNotification(model) {
  const {
    addNotification
  } = useNotifications();
  const lastWarningRef = useRef(null);
  const t0 = () => {
      if (getIsRemoteMode()) {
        return;
      }
      const deprecationWarning = getModelDeprecationWarning(model);
      if (deprecationWarning && deprecationWarning !== lastWarningRef.current) {
        lastWarningRef.current = deprecationWarning;
        addNotification({
          key: "model-deprecation-warning",
          text: deprecationWarning,
          color: "warning",
          priority: "high"
        });
      }
      if (!deprecationWarning) {
        lastWarningRef.current = null;
      }
    };
  const t1 = [model, addNotification];

  useEffect(t0, t1);
}
