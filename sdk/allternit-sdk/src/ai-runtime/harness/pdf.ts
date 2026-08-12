/**
 * Minimal PDF text extraction fallback for base64-encoded PDFs.
 *
 * This module intentionally avoids external dependencies (e.g. `pdf-parse`)
 * and uses lightweight regex/text extraction over the decoded bytes. It is
 * sufficient for parity-phase harness flattening of PDF content blocks to
 * text for providers that do not natively accept PDFs.
 */

function base64ToBytes(data: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(data, 'base64'));
  }
  if (typeof atob === 'function') {
    return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  }
  throw new Error('No base64 decoder available in this environment');
}

function bytesToLatin1(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join('');
}

function unescapePdfString(s: string): string {
  return s
    .replace(/\\\\/g, '\\')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

/**
 * Extract readable text from a base64-encoded PDF.
 *
 * This is a best-effort fallback: it scans for parenthesized literal strings
 * and hex-encoded strings commonly found in uncompressed PDF content streams.
 * Compressed streams and complex encodings will not be decoded.
 */
export function extractPdfText(base64Data: string): string {
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(base64Data);
  } catch {
    return '[PDF: could not decode base64 data]';
  }

  const raw = bytesToLatin1(bytes);
  const fragments: string[] = [];

  // Parenthesized literal strings (e.g. (Hello world) Tj).
  const parenRe = /\(([^)]{2,})\)/g;
  let match: RegExpExecArray | null;
  while ((match = parenRe.exec(raw)) !== null) {
    const text = unescapePdfString(match[1]).trim();
    if (text) fragments.push(text);
  }

  // Hex-encoded strings that decode to readable ASCII/UTF-16.
  const hexRe = /<([0-9A-Fa-f\s]{4,})>/g;
  while ((match = hexRe.exec(raw)) !== null) {
    const hex = match[1].replace(/\s/g, '');
    try {
      const decoded = hex
        .match(/.{1,2}/g)
        ?.map((h) => String.fromCharCode(parseInt(h, 16)))
        .join('');
      if (decoded && /[A-Za-z0-9\s]{2,}/.test(decoded)) {
        fragments.push(decoded);
      }
    } catch {
      // Ignore undecodable hex strings.
    }
  }

  // Deduplicate adjacent repeated fragments and join.
  const deduped = fragments.filter((v, i, a) => i === 0 || v !== a[i - 1]);
  return deduped.join('\n').trim();
}

/**
 * Reference to an image embedded in a PDF.
 *
 * The fallback extractor does not perform deep object parsing, so it returns
 * an empty list. Providers that do not support PDFs will still receive any
 * extracted text; image references are included as placeholders so callers
 * can decide to surface them.
 */
export interface PdfImageReference {
  type: 'image';
  name: string;
  index: number;
}

/**
 * Return image references found in the PDF.
 *
 * The fallback implementation returns an empty array because it does not
 * parse the full PDF object tree or decode image XObjects.
 */
export function extractPdfImages(_base64Data: string): PdfImageReference[] {
  return [];
}

/**
 * Flatten a PDF content block to a text representation suitable for providers
 * that do not natively support PDF inputs.
 */
export function flattenPdfToText(block: {
  source: 'base64' | 'url' | 'file_id';
  data?: string;
  url?: string;
  fileId?: string;
  title?: string;
}): string {
  const title = block.title || 'PDF document';
  const parts: string[] = [];

  if (block.source === 'base64' && block.data) {
    const text = extractPdfText(block.data);
    const images = extractPdfImages(block.data);
    parts.push(`[${title}]`);
    if (text) {
      parts.push(text);
    } else {
      parts.push('[PDF text could not be extracted]');
    }
    for (const image of images) {
      parts.push(`[image ${image.name}]`);
    }
  } else if (block.source === 'url' && block.url) {
    parts.push(`[${title}: ${block.url}]`);
  } else if (block.source === 'file_id' && block.fileId) {
    parts.push(`[${title}: file_id=${block.fileId}]`);
  } else {
    parts.push(`[${title}]`);
  }

  return parts.join('\n');
}
