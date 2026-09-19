import '../global.d.ts';
import React, { type PropsWithChildren, type Ref } from 'react';
import type { Except } from 'type-fest';
import type { DOMElement } from '../dom';
import type { ClickEvent } from '../events/click-event';
import type { FocusEvent } from '../events/focus-event';
import type { KeyboardEvent } from '../events/keyboard-event';
import type { Styles } from '../styles';
import * as warn from '../warn';
export type Props = Except<Styles, 'textWrap'> & {
  ref?: Ref<DOMElement>;
  /**
   * Tab order index. Nodes with `tabIndex >= 0` participate in
   * Tab/Shift+Tab cycling; `-1` means programmatically focusable only.
   */
  tabIndex?: number;
  /**
   * Focus this element when it mounts. Like the HTML `autofocus`
   * attribute — the FocusManager calls `focus(node)` during the
   * reconciler's `commitMount` phase.
   */
  autoFocus?: boolean;
  /**
   * Fired on left-button click (press + release without drag). Only works
   * inside `<AlternateScreen>` where mouse tracking is enabled — no-op
   * otherwise. The event bubbles from the deepest hit Box up through
   * ancestors; call `event.stopImmediatePropagation()` to stop bubbling.
   */
  onClick?: (event: ClickEvent) => void;
  onFocus?: (event: FocusEvent) => void;
  onFocusCapture?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onBlurCapture?: (event: FocusEvent) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyDownCapture?: (event: KeyboardEvent) => void;
  /**
   * Fired when the mouse moves into this Box's rendered rect. Like DOM
   * `mouseenter`, does NOT bubble — moving between children does not
   * re-fire on the parent. Only works inside `<AlternateScreen>` where
   * mode-1003 mouse tracking is enabled.
   */
  onMouseEnter?: () => void;
  /** Fired when the mouse moves out of this Box's rendered rect. */
  onMouseLeave?: () => void;
};

/**
 * `<Box>` is an essential Ink component to build your layout. It's like `<div style="display: flex">` in the browser.
 */
function Box(t0) {
  const {
      children: t1,
      flexWrap: t2,
      flexDirection: t3,
      flexGrow: t4,
      flexShrink: t5,
      ref: t6,
      tabIndex: t7,
      autoFocus: t8,
      onClick: t9,
      onFocus: t10,
      onFocusCapture: t11,
      onBlur: t12,
      onBlurCapture: t13,
      onMouseEnter: t14,
      onMouseLeave: t15,
      onKeyDown: t16,
      onKeyDownCapture: t17,
      ...t18
    } = t0;
  const children = t1;
  const ref = t6;
  const tabIndex = t7;
  const autoFocus = t8;
  const onClick = t9;
  const onFocus = t10;
  const onFocusCapture = t11;
  const onBlur = t12;
  const onBlurCapture = t13;
  const onMouseEnter = t14;
  const onMouseLeave = t15;
  const onKeyDown = t16;
  const onKeyDownCapture = t17;
  const style = t18;
  const flexWrap = t2 === undefined ? "nowrap" : t2;
  const flexDirection = t3 === undefined ? "row" : t3;
  const flexGrow = t4 === undefined ? 0 : t4;
  const flexShrink = t5 === undefined ? 1 : t5;
  warn.ifNotInteger(style.margin, "margin");
  warn.ifNotInteger(style.marginX, "marginX");
  warn.ifNotInteger(style.marginY, "marginY");
  warn.ifNotInteger(style.marginTop, "marginTop");
  warn.ifNotInteger(style.marginBottom, "marginBottom");
  warn.ifNotInteger(style.marginLeft, "marginLeft");
  warn.ifNotInteger(style.marginRight, "marginRight");
  warn.ifNotInteger(style.padding, "padding");
  warn.ifNotInteger(style.paddingX, "paddingX");
  warn.ifNotInteger(style.paddingY, "paddingY");
  warn.ifNotInteger(style.paddingTop, "paddingTop");
  warn.ifNotInteger(style.paddingBottom, "paddingBottom");
  warn.ifNotInteger(style.paddingLeft, "paddingLeft");
  warn.ifNotInteger(style.paddingRight, "paddingRight");
  warn.ifNotInteger(style.gap, "gap");
  warn.ifNotInteger(style.columnGap, "columnGap");
  warn.ifNotInteger(style.rowGap, "rowGap");

  const t1_2 = style.overflowX ?? style.overflow ?? "visible";
  const t2_2 = style.overflowY ?? style.overflow ?? "visible";
  const t3_2 = {
      flexWrap,
      flexDirection,
      flexGrow,
      flexShrink,
      ...style,
      overflowX: t1_2,
      overflowY: t2_2
    };

  const t4_2 = <ink-box ref={ref} tabIndex={tabIndex} autoFocus={autoFocus} onClick={onClick} onFocus={onFocus} onFocusCapture={onFocusCapture} onBlur={onBlur} onBlurCapture={onBlurCapture} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onKeyDown={onKeyDown} onKeyDownCapture={onKeyDownCapture} style={t3_2}>{children}</ink-box>;

  return t4_2;
}
export default Box;
