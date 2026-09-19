import * as React from 'react';
import { pathToFileURL } from 'url';
import Link from '../ink/components/Link';
import { supportsHyperlinks } from '../ink/supports-hyperlinks';
import { Text } from '../ink';
import { getStoredImagePath } from '../utils/imageStore';
import type { Theme } from '../utils/theme';
type Props = {
  imageId: number;
  backgroundColor?: keyof Theme;
  isSelected?: boolean;
};

/**
 * Renders an image reference like [Image #1] as a clickable link.
 * When clicked, opens the stored image file in the default viewer.
 *
 * Falls back to styled text if:
 * - Terminal doesn't support hyperlinks
 * - Image file is not found in the store
 */
export function ClickableImageRef({
    imageId,
    backgroundColor,
    isSelected: t1
}: Props) {
  const isSelected = t1 === undefined ? false : t1;
  const imagePath = getStoredImagePath(imageId);
  const displayText = `[Image #${imageId}]`;
  if (imagePath && supportsHyperlinks()) {
    const fileUrl = pathToFileURL(imagePath).href;
    const t2 = <Text backgroundColor={backgroundColor} inverse={isSelected}>{displayText}</Text>;
    const t3 = <Text backgroundColor={backgroundColor} inverse={isSelected} bold={isSelected}>{displayText}</Text>;

    const t4 = <Link url={fileUrl} fallback={t2}>{t3}</Link>;

    return t4;
  }
  const t2 = <Text backgroundColor={backgroundColor} inverse={isSelected}>{displayText}</Text>;

  return t2;
}
