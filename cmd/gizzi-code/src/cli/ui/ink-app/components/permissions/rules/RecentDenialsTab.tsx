import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
// eslint-disable-next-line custom-rules/prefer-use-keybindings -- 'r' is a view-specific key, not a global keybinding
import { Box, Text, useInput } from '../../../ink';
import { type AutoModeDenial, getAutoModeDenials } from '../../../utils/autoModeDenials';
import { Select } from '../../CustomSelect/select';
import { StatusIcon } from '../../design-system/StatusIcon';
import { useTabHeaderFocus } from '../../design-system/Tabs';
type Props = {
  onHeaderFocusChange?: (focused: boolean) => void;
  /** Called when approved/retry state changes so parent can act on exit */
  onStateChange: (state: {
    approved: Set<number>;
    retry: Set<number>;
    denials: readonly AutoModeDenial[];
  }) => void;
};
export function RecentDenialsTab({
    onHeaderFocusChange,
    onStateChange
}: Props) {
  const {
    headerFocused,
    focusHeader
  } = useTabHeaderFocus();
  const t1 = () => {
      onHeaderFocusChange?.(headerFocused);
    };
  const t2 = [headerFocused, onHeaderFocusChange];

  useEffect(t1, t2);
  const [denials] = useState(_temp);
  const [approved, setApproved] = useState(_temp2);
  const [retry, setRetry] = useState(_temp3);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const t3 = () => {
      onStateChange({
        approved,
        retry,
        denials
      });
    };
  const t4 = [approved, retry, denials, onStateChange];

  useEffect(t3, t4);
  const t5 = value => {
      const idx = Number(value);
      setApproved(prev => {
        const next = new Set(prev);
        if (next.has(idx)) {
          next.delete(idx);
        } else {
          next.add(idx);
        }
        return next;
      });
    };

  const handleSelect = t5;
  const t6 = value_0 => {
      setFocusedIdx(Number(value_0));
    };

  const handleFocus = t6;
  const t7 = (input, _key) => {
      if (input === "r") {
        setRetry(prev_0 => {
          const next_0 = new Set(prev_0);
          if (next_0.has(focusedIdx)) {
            next_0.delete(focusedIdx);
          } else {
            next_0.add(focusedIdx);
          }
          return next_0;
        });
        setApproved(prev_1 => {
          if (prev_1.has(focusedIdx)) {
            return prev_1;
          }
          const next_1 = new Set(prev_1);
          next_1.add(focusedIdx);
          return next_1;
        });
      }
    };

  const t8 = denials.length > 0;
  const t9 = {
      isActive: t8
    };

  useInput(t7, t9);
  if (denials.length === 0) {
    const t10 = <Text dimColor={true}>No recent denials. Commands denied by the auto mode classifier will appear here.</Text>;

    return t10;
  }
  const t11 = (d, idx_0) => {
        const isApproved = approved.has(idx_0);
        const suffix = retry.has(idx_0) ? " (retry)" : "";
        return {
          label: <Text><StatusIcon status={isApproved ? "success" : "error"} withSpace={true} />{d.display}<Text dimColor={true}>{suffix}</Text></Text>,
          value: String(idx_0)
        };
      };

  const t10 = denials.map(t11);

  const options = t10;
  const t11_2 = <Text>Commands recently denied by the auto mode classifier.</Text>;

  const t12 = Math.min(10, options.length);
  const t13 = <Box flexDirection="column">{t11_2}<Box marginTop={1}><Select options={options} onChange={handleSelect} onFocus={handleFocus} visibleOptionCount={t12} isDisabled={headerFocused} onUpFromFirstItem={focusHeader} /></Box></Box>;

  return t13;
}
function _temp3(): Set<number> {
  return new Set();
}
function _temp2(): Set<number> {
  return new Set();
}
function _temp() {
  return getAutoModeDenials();
}
