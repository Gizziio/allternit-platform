/**
 * Artifact thumbnail capture for the use-case gallery.
 *
 * Renders artifact HTML into a small JPEG via an SVG foreignObject — the only
 * dependency-free way to rasterize a document in-app. Works for the skill
 * contract's inline-CSS artifacts; external stylesheets, images, and fonts are
 * not fetched. Any failure returns undefined — thumbnails are best-effort and
 * must never block the save path.
 */

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
}

/** Serialize artifact HTML into an SVG foreignObject document (pure, testable). */
export function buildThumbnailSvg(html: string, width = 640, height = 480): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const styles: string[] = [];
  doc.querySelectorAll('style').forEach((node) => styles.push(node.textContent ?? ''));
  const body = doc.body?.innerHTML ?? '';
  const xhtml = [
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden;position:relative;background:#fff">`,
    `<style>${styles.join('\n')}</style>`,
    body,
    '</div>',
  ].join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    `<foreignObject width="100%" height="100%">${xhtml}</foreignObject>`,
    '</svg>',
  ].join('');
}

/** Render a JPEG dataURL thumbnail; resolves undefined on any failure. */
export async function renderArtifactThumbnail(
  html: string,
  options: ThumbnailOptions = {},
): Promise<string | undefined> {
  const width = options.width ?? 640;
  const height = options.height ?? 480;
  try {
    const svg = buildThumbnailSvg(html, width, height);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('thumbnail image load failed'));
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;
      ctx.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', options.quality ?? 0.72);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return undefined;
  }
}
