/**
 * Host-agnostic, client-side PDF signing utilities.
 *
 * No external services, no API keys, no Docker. Renders PDF pages with
 * pdfjs-dist and stamps signature PNGs onto the document with pdf-lib,
 * entirely inside the browser.
 */

import * as pdfjs from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

let workerInitialized = false;

export function initPdfWorker(): void {
  if (workerInitialized || typeof window === 'undefined') return;
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).href;
  workerInitialized = true;
}

export async function loadPdfDocument(file: File): Promise<pdfjs.PDFDocumentProxy> {
  initPdfWorker();
  const bytes = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({ data: bytes }).promise;
}

export async function renderPageToCanvas(
  doc: pdfjs.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 1.4,
): Promise<{ viewport: pdfjs.PageViewport }> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to acquire canvas context');

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return { viewport };
}

export interface Signer {
  id: string;
  name: string;
  email: string;
  color: string;
  signaturePng?: Uint8Array;
}

export interface SignatureField {
  id: string;
  signerId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function buildSignedPdf(
  originalBytes: Uint8Array,
  signers: Signer[],
  fields: SignatureField[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes);

  for (const field of fields) {
    const signer = signers.find((s) => s.id === field.signerId);
    if (!signer?.signaturePng) continue;

    const pageIndex = Math.max(0, field.page - 1);
    if (pageIndex >= pdfDoc.getPageCount()) continue;

    const page = pdfDoc.getPage(pageIndex);
    const image = await pdfDoc.embedPng(signer.signaturePng);

    page.drawImage(image, {
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
    });
  }

  return pdfDoc.save();
}

export async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to serialize signature canvas'));
        return;
      }
      const buffer = await blob.arrayBuffer();
      resolve(new Uint8Array(buffer));
    }, 'image/png');
  });
}

/**
 * Convert PNG bytes to a base64 data URL for immediate preview.
 */
export function pngBytesToDataUrl(pngBytes: Uint8Array): string {
  let binary = '';
  const len = pngBytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(pngBytes[i]);
  }
  return `data:image/png;base64,${window.btoa(binary)}`;
}
