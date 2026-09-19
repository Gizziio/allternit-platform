import { useEffect } from 'react';
import { useNotifications } from '../../../../../context/notifications';
import { useAppState, useSetAppState } from './../../state/AppState.tsx';
import { type CooldownReason, isFastModeEnabled, onCooldownExpired, onCooldownTriggered, onFastModeOverageRejection, onOrgFastModeChanged } from './../../utils/fastMode.ts';
import { formatDuration } from './../../utils/format.ts';
import { getIsRemoteMode } from '../../bootstrap/state';
const COOLDOWN_STARTED_KEY = 'fast-mode-cooldown-started';
const COOLDOWN_EXPIRED_KEY = 'fast-mode-cooldown-expired';
const ORG_CHANGED_KEY = 'fast-mode-org-changed';
const OVERAGE_REJECTED_KEY = 'fast-mode-overage-rejected';
export function useFastModeNotification() {
  const {
    addNotification
  } = useNotifications();
  const isFastMode = useAppState(_temp);
  const setAppState = useSetAppState();
  const t0 = () => {
      if (getIsRemoteMode()) {
        return;
      }
      if (!isFastModeEnabled()) {
        return;
      }
      return onOrgFastModeChanged(orgEnabled => {
        if (orgEnabled) {
          addNotification({
            key: ORG_CHANGED_KEY,
            color: "fastMode",
            priority: "immediate",
            text: "Fast mode is now available \xB7 /fast to turn on"
          });
        } else {
          if (isFastMode) {
            setAppState(_temp2);
            addNotification({
              key: ORG_CHANGED_KEY,
              color: "warning",
              priority: "immediate",
              text: "Fast mode has been disabled by your organization"
            });
          }
        }
      });
    };
  const t1 = [addNotification, isFastMode, setAppState];

  useEffect(t0, t1);
  const t2 = () => {
      if (getIsRemoteMode()) {
        return;
      }
      if (!isFastModeEnabled()) {
        return;
      }
      return onFastModeOverageRejection(message => {
        setAppState(_temp3);
        addNotification({
          key: OVERAGE_REJECTED_KEY,
          color: "warning",
          priority: "immediate",
          text: message
        });
      });
    };
  const t3 = [addNotification, setAppState];

  useEffect(t2, t3);
  const t4 = () => {
      if (getIsRemoteMode()) {
        return;
      }
      if (!isFastMode) {
        return;
      }
      const unsubTriggered = onCooldownTriggered((resetAt, reason) => {
        const resetIn = formatDuration(resetAt - Date.now(), {
          hideTrailingZeros: true
        });
        const message_0 = getCooldownMessage(reason, resetIn);
        addNotification({
          key: COOLDOWN_STARTED_KEY,
          invalidates: [COOLDOWN_EXPIRED_KEY],
          text: message_0,
          color: "warning",
          priority: "immediate"
        });
      });
      const unsubExpired = onCooldownExpired(() => {
        addNotification({
          key: COOLDOWN_EXPIRED_KEY,
          invalidates: [COOLDOWN_STARTED_KEY],
          color: "fastMode",
          text: "Fast limit reset \xB7 now using fast mode",
          priority: "immediate"
        });
      });
      return () => {
        unsubTriggered();
        unsubExpired();
      };
    };
  const t5 = [addNotification, isFastMode];

  useEffect(t4, t5);
}
function _temp3(prev_0) {
  return {
    ...prev_0,
    fastMode: false
  };
}
function _temp2(prev) {
  return {
    ...prev,
    fastMode: false
  };
}
function _temp(s) {
  return s.fastMode;
}
function getCooldownMessage(reason: CooldownReason, resetIn: string): string {
  switch (reason) {
    case 'overloaded':
      return `Fast mode overloaded and is temporarily unavailable · resets in ${resetIn}`;
    case 'rate_limit':
      return `Fast limit reached and temporarily disabled · resets in ${resetIn}`;
  }
}
