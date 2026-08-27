import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { Request, Response } from 'express';

/**
 * Serve a binary file with HTTP Range support so embedded `<video>`/`<audio>`
 * can seek: browsers (Safari especially) request `Range: bytes=…` and need a
 * 206 partial response, otherwise the scrubber and playback break. Streams the
 * file instead of buffering it — vault media can be hundreds of MB.
 */
export async function sendFileWithRange(
  req: Request,
  res: Response,
  absPath: string,
  mime: string,
  extraHeaders: Record<string, string> = {},
): Promise<void> {
  const { size } = await stat(absPath);
  res.setHeader('Content-Type', mime);
  res.setHeader('Accept-Ranges', 'bytes');
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);

  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : 0;
    const end = Math.min(m[2] ? Number(m[2]) : size - 1, size - 1);
    if (!Number.isFinite(start) || start > end || start >= size) {
      res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
      return;
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', String(end - start + 1));
    createReadStream(absPath, { start, end }).pipe(res);
    return;
  }
  res.setHeader('Content-Length', String(size));
  createReadStream(absPath).pipe(res);
}
