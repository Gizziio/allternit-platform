import React, { type Ref, useCallback, useEffect, useRef, useState } from 'react';
import type { Except } from 'type-fest';
import type { DOMElement } from '../dom';
import type { ClickEvent } from '../events/click-event';
import type { FocusEvent } from '../events/focus-event';
import type { KeyboardEvent } from '../events/keyboard-event';
import type { Styles } from '../styles';
import Box from './Box';
type ButtonState = {
  focused: boolean;
  hovered: boolean;
  active: boolean;
};
export type Props = Except<Styles, 'textWrap'> & {
  ref?: Ref<DOMElement>;
  /**
   * Called when the button is activated via Enter, Space, or click.
   */
  onAction: () => void;
  /**
   * Tab order index. Defaults to 0 (in tab order).
   * Set to -1 for programmatically focusable only.
   */
  tabIndex?: number;
  /**
   * Focus this button when it mounts.
   */
  autoFocus?: boolean;
  /**
   * Render prop receiving the interactive state. Use this to
   * style children based on focus/hover/active — Button itself
   * is intentionally unstyled.
   *
   * If not provided, children render as-is (no state-dependent styling).
   */
  children: ((state: ButtonState) => React.ReactNode) | React.ReactNode;
};
function Button(t0) {
  let autoFocus;
  let children;
  let onAction;
  let ref;
  let style;
  let t1;
  ({
    onAction,
    tabIndex: t1,
    autoFocus,
    children,
    ref,
    ...style
  } = t0);
  

  const tabIndex = t1 === undefined ? 0 : t1;
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const activeTimer = useRef(null);
  const t2 = () => () => {
      if (activeTimer.current) {
        clearTimeout(activeTimer.current);
      }
    };
  const t3 = [];

  useEffect(t2, t3);
  const t4 = e => {
      if (e.key === "return" || e.key === " ") {
        e.preventDefault();
        setIsActive(true);
        onAction();
        if (activeTimer.current) {
          clearTimeout(activeTimer.current);
        }
        activeTimer.current = setTimeout(_temp, 100, setIsActive);
      }
    };

  const handleKeyDown = t4;
  const t5 = _e => {
      onAction();
    };

  const handleClick = t5;
  const t6 = _e_0 => setIsFocused(true);

  const handleFocus = t6;
  const t7 = _e_1 => setIsFocused(false);

  const handleBlur = t7;
  const t8 = () => setIsHovered(true);

  const handleMouseEnter = t8;
  const t9 = () => setIsHovered(false);

  const handleMouseLeave = t9;
  const state = {
      focused: isFocused,
      hovered: isHovered,
      active: isActive
    };
  const t10 = typeof children === "function" ? children(state) : children;

  const content = t10;
  const t11 = <Box ref={ref} tabIndex={tabIndex} autoFocus={autoFocus} onKeyDown={handleKeyDown} onClick={handleClick} onFocus={handleFocus} onBlur={handleBlur} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} {...style}>{content}</Box>;

  return t11;
}
function _temp(setter) {
  return setter(false);
}
export default Button;
export type { ButtonState };
