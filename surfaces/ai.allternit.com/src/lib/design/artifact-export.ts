/**
 * Artifact export pipelines — ported from nexu-io/open-design.
 *
 * Provides client-side export of sandboxed HTML artifacts to:
 *   - HTML (standalone file download)
 *   - PDF (browser print to PDF)
 *   - ZIP (HTML + metadata bundle via JSZip)
 *   - PPTX (fallback: agent-driven slide JSON; placeholder scaffold here)
 *
 * All exports run in the browser; no server round-trip required.
 */

import JSZip from 'jszip';

export type ExportFormat = 'html' | 'pdf' | 'zip' | 'pptx';

export interface ArtifactExportInput {
  html: string;
  title: string;
  identifier: string;
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

export async function exportPptx({ html, title, identifier }: ArtifactExportInput) {
  // LTS: agent-driven PPTX export via pptxgenjs when slides.json is available.
  // For now, scaffold a ZIP with HTML + a slides.json stub the agent can fill.
  const zip = new JSZip();
  zip.file('index.html', html);
  zip.file('slides.json', JSON.stringify({
    title,
    identifier,
    slides: [{ title: 'Slide 1', notes: 'Replace with agent-generated slide data.' }],
  }, null, 2));
  const blob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(blob, `${sanitizeFilename(title)}-pptx-scaffold.zip`);
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
