import type { ReactNode } from 'react';
import React from 'react';
import type { Color, Styles, TextStyles } from '../styles';
type BaseProps = {
  /**
   * Change text color. Accepts a raw color value (rgb, hex, ansi).
   */
  readonly color?: Color;

  /**
   * Same as `color`, but for background.
   */
  readonly backgroundColor?: Color;

  /**
   * Make the text italic.
   */
  readonly italic?: boolean;

  /**
   * Make the text underlined.
   */
  readonly underline?: boolean;

  /**
   * Make the text crossed with a line.
   */
  readonly strikethrough?: boolean;

  /**
   * Inverse background and foreground colors.
   */
  readonly inverse?: boolean;

  /**
   * This property tells Ink to wrap or truncate text if its width is larger than container.
   * If `wrap` is passed (by default), Ink will wrap text and split it into multiple lines.
   * If `truncate-*` is passed, Ink will truncate text instead, which will result in one line of text with the rest cut off.
   */
  readonly wrap?: Styles['textWrap'];
  readonly children?: ReactNode;
};

/**
 * Bold and dim are mutually exclusive in terminals.
 * This type ensures you can use one or the other, but not both.
 */
type WeightProps = {
  bold?: never;
  dim?: never;
} | {
  bold: boolean;
  dim?: never;
} | {
  dim: boolean;
  bold?: never;
};
export type Props = BaseProps & WeightProps;
const memoizedStylesForWrap: Record<NonNullable<Styles['textWrap']>, Styles> = {
  wrap: {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    textWrap: 'wrap'
  },
  'wrap-trim': {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    textWrap: 'wrap-trim'
  },
  end: {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    textWrap: 'end'
  },
  middle: {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    textWrap: 'middle'
  },
  'truncate-end': {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    textWrap: 'truncate-end'
  },
  truncate: {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    textWrap: 'truncate'
  },
  'truncate-middle': {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    textWrap: 'truncate-middle'
  },
  'truncate-start': {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    textWrap: 'truncate-start'
  }
} as const;

/**
 * This component can display text, and change its style to make it colorful, bold, underline, italic or strikethrough.
 */
export default function Text(t0) {
  const {
    color,
    backgroundColor,
    bold,
    dim,
    italic: t1,
    underline: t2,
    strikethrough: t3,
    inverse: t4,
    wrap: t5,
    children
  } = t0;
  const italic = t1 === undefined ? false : t1;
  const underline = t2 === undefined ? false : t2;
  const strikethrough = t3 === undefined ? false : t3;
  const inverse = t4 === undefined ? false : t4;
  const wrap = t5 === undefined ? "wrap" : t5;
  if (children === undefined || children === null) {
    return null;
  }
  const t6 = color && {
      color
    };

  const t7 = backgroundColor && {
      backgroundColor
    };

  const t8 = dim && {
      dim
    };

  const t9 = bold && {
      bold
    };

  const t10 = italic && {
      italic
    };

  const t11 = underline && {
      underline
    };

  const t12 = strikethrough && {
      strikethrough
    };

  const t13 = inverse && {
      inverse
    };

  const t14 = {
      ...t6,
      ...t7,
      ...t8,
      ...t9,
      ...t10,
      ...t11,
      ...t12,
      ...t13
    };

  const textStyles = t14;
  const t15 = memoizedStylesForWrap[wrap];
  const t16 = <ink-text style={t15} textStyles={textStyles}>{children}</ink-text>;

  return t16;
}
