/**
 * Artifact export pipelines — ported from nexu-io/open-design.
 *
 * Provides client-side export of sandboxed HTML artifacts to:
 *   - HTML (standalone file download)
 *   - PDF (browser print to PDF)
 *   - ZIP (HTML + metadata bundle via JSZip)
 *   - PPTX (real deck export via pptxgenjs, extracting slides from HTML)
 *
 * All exports run in the browser; no server round-trip required.
 */

import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { exportMp4FromIframe, downloadMp4 } from './hyperframes-export';

export type ExportFormat = 'html' | 'pdf' | 'zip' | 'pptx' | 'mp4';

export interface ArtifactExportInput {
  html: string;
  title: string;
  identifier: string;
}

export interface SlideData {
  title?: string;
  body?: string;
  notes?: string;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9\-_]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'artifact';
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Extract slide text from common deck HTML patterns. */
export function extractSlidesFromHtml(html: string): SlideData[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const slides: SlideData[] = [];

  // Pattern 1: elements with class "slide"
  const slideEls = doc.querySelectorAll('.slide');
  if (slideEls.length > 0) {
    slideEls.forEach((el) => {
      const h1 = el.querySelector('h1');
      const title = h1?.textContent?.trim() ?? '';
      const body = Array.from(el.querySelectorAll('p, li, h2, h3'))
        .map((n) => n.textContent?.trim())
        .filter(Boolean)
        .join('\n');
      slides.push({ title, body });
    });
    return slides;
  }

  // Pattern 2: <deck-stage> children
  const stage = doc.querySelector('deck-stage');
  if (stage) {
    Array.from(stage.children).forEach((el) => {
      const title = el.querySelector('h1, h2')?.textContent?.trim() ?? '';
      const body = Array.from(el.querySelectorAll('p, li'))
        .map((n) => n.textContent?.trim())
        .filter(Boolean)
        .join('\n');
      slides.push({ title, body });
    });
    if (slides.length > 0) return slides;
  }

  // Pattern 3: fallback — treat the whole body as one slide
  const title = doc.querySelector('h1')?.textContent?.trim() ?? '';
  const body = Array.from(doc.querySelectorAll('p, li'))
    .map((n) => n.textContent?.trim())
    .filter(Boolean)
    .join('\n');
  slides.push({ title, body });
  return slides;
}

export function exportHtml({ html, title }: ArtifactExportInput) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerDownload(blob, `${sanitizeFilename(title)}.html`);
}

export function exportPdf({ title }: ArtifactExportInput) {
  // Open print dialog; user selects Save as PDF. The artifact preview iframe
  // should have a print-friendly stylesheet.
  window.print();
}

export async function exportZip({ html, title, identifier }: ArtifactExportInput) {
  const zip = new JSZip();
  zip.file('index.html', html);
  zip.file('manifest.json', JSON.stringify({
    name: title,
    identifier,
    exportedAt: new Date().toISOString(),
    format: 'open-design-artifact',
  }, null, 2));
  const blob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(blob, `${sanitizeFilename(title)}.zip`);
}

export async function exportPptx({ html, title }: ArtifactExportInput) {
  const slides = extractSlidesFromHtml(html);
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Allternit Design';
  pptx.title = title;
  pptx.subject = title;

  for (const slide of slides) {
    const s = pptx.addSlide();
    if (slide.title) {
      s.addText(slide.title, { x: 0.5, y: 0.5, w: '90%', h: 1, fontSize: 32, bold: true, color: '111111' });
    }
    if (slide.body) {
      s.addText(slide.body, { x: 0.5, y: slide.title ? 1.6 : 0.5, w: '90%', h: 4.5, fontSize: 18, color: '444444' });
    }
    if (slide.notes) {
      s.addNotes(slide.notes);
    }
  }

  await pptx.writeFile({ fileName: `${sanitizeFilename(title)}.pptx` });
}

export async function exportMp4(input: ArtifactExportInput & { iframe: HTMLIFrameElement }) {
  const blob = await exportMp4FromIframe({ iframe: input.iframe, durationMs: 3000, fps: 30 });
  downloadMp4(blob, `${sanitizeFilename(input.title)}.mp4`);
}

export async function exportArtifact(format: ExportFormat, input: ArtifactExportInput) {
  switch (format) {
    case 'html':
      exportHtml(input);
      return;
    case 'pdf':
      exportPdf(input);
      return;
    case 'zip':
      await exportZip(input);
      return;
    case 'pptx':
      await exportPptx(input);
      return;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

