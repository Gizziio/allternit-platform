/**
 * Minimal PDF text extraction fallback for base64-encoded PDFs.
 *
 * This module intentionally avoids external dependencies (e.g. `pdf-parse`)
 * and uses lightweight regex/text extraction over the decoded bytes. It is
 * sufficient for parity-phase harness flattening of PDF content blocks to
 * text for providers that do not natively accept PDFs.
 */
/**
 * Extract readable text from a base64-encoded PDF.
 *
 * This is a best-effort fallback: it scans for parenthesized literal strings
 * and hex-encoded strings commonly found in uncompressed PDF content streams.
 * Compressed streams and complex encodings will not be decoded.
 */
export declare function extractPdfText(base64Data: string): string;
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
export declare function extractPdfImages(_base64Data: string): PdfImageReference[];
/**
 * Flatten a PDF content block to a text representation suitable for providers
 * that do not natively support PDF inputs.
 */
export declare function flattenPdfToText(block: {
    source: 'base64' | 'url' | 'file_id';
    data?: string;
    url?: string;
    fileId?: string;
    title?: string;
}): string;
