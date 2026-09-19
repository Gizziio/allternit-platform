import type { ReactNode } from 'react';
import React from 'react';
import { supportsHyperlinks } from '../supports-hyperlinks';
import Text from './Text';
export type Props = {
  readonly children?: ReactNode;
  readonly url: string;
  readonly fallback?: ReactNode;
};
export default function Link(t0) {
  const {
    children,
    url,
    fallback
  } = t0;
  const content = children ?? url;
  if (supportsHyperlinks()) {
    const t1 = <Text><ink-link href={url}>{content}</ink-link></Text>;

    return t1;
  }
  const t1 = fallback ?? content;
  const t2 = <Text>{t1}</Text>;

  return t2;
}
