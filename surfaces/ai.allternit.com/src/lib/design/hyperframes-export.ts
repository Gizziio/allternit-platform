/**
 * HyperFrames / MP4 export scaffolding — ported from nexu-io/open-design.
 *
 * Provides a browser-side MP4 capture pipeline for HTML artifacts. It
 * captures the artifact iframe as a video using a canvas + MediaRecorder.
 *
 * This is scaffolding: full HyperFrames integration (keyframe timelines,
 * WebGL compositing, layer animations) is an LTS daemon-level feature.
 */

export interface HyperFramesExportInput {
  iframe: HTMLIFrameElement;
  durationMs?: number;
  fps?: number;
}

export async function exportMp4FromIframe(input: HyperFramesExportInput): Promise<Blob> {
  const { iframe, durationMs = 3000, fps = 30 } = input;
  const window = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!window || !doc || !doc.documentElement) {
    throw new Error('Iframe content is not accessible.');
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available.');

  const width = iframe.clientWidth;
  const height = iframe.clientHeight;
  canvas.width = width;
  canvas.height = height;

  const stream = canvas.captureStream(fps);
  const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
  const chunks: Blob[] = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  if (!ctx) throw new Error('Canvas 2D context not available.');
  const context = ctx;

  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };
    mediaRecorder.onerror = () => reject(new Error('MediaRecorder error'));

    mediaRecorder.start();

    const startTime = performance.now();
    const interval = 1000 / fps;

    function draw() {
      const elapsed = performance.now() - startTime;
      if (elapsed >= durationMs) {
        mediaRecorder.stop();
        return;
      }
      try {
        context.drawImage(iframe as unknown as CanvasImageSource, 0, 0, width, height);
      } catch {
        // Cross-origin iframes cannot be drawn; stop early.
        mediaRecorder.stop();
        return;
      }
      setTimeout(() => requestAnimationFrame(draw), interval);
    }

    draw();
  });
}

export function downloadMp4(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\.[^.]*$/, '') + '.webm';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
