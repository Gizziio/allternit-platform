import * as React from 'react';
import { pathToFileURL } from 'url';
import Link from '../../ink/components/Link';
import { supportsHyperlinks } from '../../ink/supports-hyperlinks';
import { Box, Text } from '../../ink';
import { getStoredImagePath } from '../../utils/imageStore';
import { MessageResponse } from '../MessageResponse';
type Props = {
  imageId?: number;
  addMargin?: boolean;
};

/**
 * Renders an image attachment in user messages.
 * Shows as a clickable link if the image is stored and terminal supports hyperlinks.
 * Uses MessageResponse styling to appear connected to the message above,
 * unless addMargin is true (image starts a new user turn without text).
 */
export function UserImageMessage({
    imageId,
    addMargin
}: Props) {
  const label = imageId ? `[Image #${imageId}]` : "[Image]";
  const imagePath = imageId ? getStoredImagePath(imageId) : null;
  const t1 = imagePath && supportsHyperlinks() ? <Link url={pathToFileURL(imagePath).href}><Text>{label}</Text></Link> : <Text>{label}</Text>;

  const content = t1;
  if (addMargin) {
    const t2 = <Box marginTop={1}>{content}</Box>;

    return t2;
  }
  const t2 = <MessageResponse>{content}</MessageResponse>;

  return t2;
}
