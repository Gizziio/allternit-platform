import { readFile } from 'node:fs/promises';
const DEFAULT_MAX_TEXT_LENGTH = 100_000;
const DEFAULT_THUMBNAIL_SCALE = 0.5;
const DEFAULT_MAX_THUMBNAIL_PAGES = 5;
/** Heading detection thresholds (in PDF text units, roughly points). */
const HEADING_SIZE_H1 = 20;
const HEADING_SIZE_H2 = 16;
const HEADING_SIZE_H3 = 14;
/**
 * Loads the pdfjs-dist legacy build lazily so the module is only required when
 * the tool is actually used. The legacy build is the Node.js-compatible entry
 * point for pdfjs-dist v5.
 */
async function loadPdfJs() {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    return pdfjs;
}
export class PdfTool {
    options;
    fetchImpl;
    constructor(options = {}) {
        this.options = options;
        this.fetchImpl = options.fetch ?? globalThis.fetch;
    }
    definition() {
        return {
            name: 'pdf_process',
            description: 'Process a PDF document from a base64 string, URL, or file path. ' +
                'Returns extracted markdown text, document structure (headings), and optional base64 page thumbnails.',
            input_schema: {
                type: 'object',
                properties: {
                    source: {
                        type: 'object',
                        description: 'PDF source: base64 data, URL, or file path',
                        properties: {
                            type: {
                                type: 'string',
                                enum: ['base64', 'url', 'path'],
                                description: 'Source type',
                            },
                            data: { type: 'string', description: 'Base64-encoded PDF bytes' },
                            url: { type: 'string', description: 'HTTP(S) URL to fetch' },
                            path: { type: 'string', description: 'Absolute or relative file path' },
                        },
                        required: ['type'],
                    },
                    thumbnails: {
                        type: 'boolean',
                        description: 'Whether to include base64 PNG page thumbnails',
                    },
                },
                required: ['source'],
            },
            metadata: { category: 'document' },
            execute: async (args) => this.execute(args),
        };
    }
    async execute(args) {
        const source = args.source;
        if (!source || typeof source !== 'object' || !source.type) {
            throw new Error('pdf_process requires a source object with a type');
        }
        const data = await this.resolveSource(source);
        if (!data || data.length === 0) {
            throw new Error('PDF data is empty');
        }
        const pdfjs = await loadPdfJs();
        const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
        try {
            return await this.processDocument(doc, !!args.thumbnails);
        }
        finally {
            doc.destroy();
        }
    }
    async resolveSource(source) {
        switch (source.type) {
            case 'base64': {
                const data = source.data?.trim();
                if (!data)
                    throw new Error('base64 source requires data');
                return new Uint8Array(Buffer.from(data, 'base64'));
            }
            case 'url': {
                const url = source.url?.trim();
                if (!url)
                    throw new Error('url source requires url');
                return this.fetchUrl(url);
            }
            case 'path': {
                const path = source.path?.trim();
                if (!path)
                    throw new Error('path source requires path');
                return readFile(path);
            }
            default:
                throw new Error(`Unsupported pdf_process source type: ${source.type}`);
        }
    }
    async fetchUrl(url) {
        const response = await this.fetchImpl(url, {
            headers: { accept: 'application/pdf' },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch PDF from ${url}: HTTP ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
    }
    async processDocument(doc, includeThumbnails) {
        const pageCount = doc.numPages;
        const maxTextLength = this.options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH;
        const maxThumbnails = this.options.maxThumbnailPages ?? DEFAULT_MAX_THUMBNAIL_PAGES;
        const scale = this.options.thumbnailScale ?? DEFAULT_THUMBNAIL_SCALE;
        const headings = [];
        const tables = [];
        const thumbnails = [];
        const markdownParts = [];
        let totalLength = 0;
        let truncated = false;
        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
            const page = await doc.getPage(pageNumber);
            try {
                const textContent = await page.getTextContent();
                const items = textContent.items.filter((item) => 'str' in item);
                // Build page markdown while detecting headings from font heights.
                const pageLines = [];
                let currentLine = '';
                let lastY = null;
                for (const item of items) {
                    const y = 'transform' in item && Array.isArray(item.transform) ? item.transform[5] : null;
                    if (lastY !== null && y !== null && Math.abs(y - lastY) > 0.5) {
                        if (currentLine.trim())
                            pageLines.push(currentLine.trim());
                        currentLine = '';
                    }
                    currentLine += item.str;
                    if (item.hasEOL) {
                        if (currentLine.trim())
                            pageLines.push(currentLine.trim());
                        currentLine = '';
                    }
                    lastY = y;
                    this.detectHeading(item, pageNumber, headings);
                }
                if (currentLine.trim())
                    pageLines.push(currentLine.trim());
                const pageMarkdown = `## Page ${pageNumber}\n\n${pageLines.join('\n\n')}`;
                if (totalLength + pageMarkdown.length > maxTextLength) {
                    const remaining = maxTextLength - totalLength;
                    markdownParts.push(pageMarkdown.slice(0, remaining));
                    markdownParts.push('\n\n...(truncated)');
                    truncated = true;
                    break;
                }
                markdownParts.push(pageMarkdown);
                totalLength += pageMarkdown.length;
                if (includeThumbnails && pageNumber <= maxThumbnails) {
                    const thumbnail = await this.renderThumbnail(page, scale);
                    if (thumbnail)
                        thumbnails.push(thumbnail);
                }
            }
            finally {
                page.cleanup();
            }
        }
        return {
            markdown: markdownParts.join('\n\n').trim(),
            pages: pageCount,
            ...(includeThumbnails ? { thumbnails } : {}),
            structure: {
                headings: headings.slice(0, 100),
                tables,
            },
        };
    }
    detectHeading(item, page, headings) {
        const height = item.height ?? 0;
        if (height >= HEADING_SIZE_H3) {
            const level = height >= HEADING_SIZE_H1 ? 1 : height >= HEADING_SIZE_H2 ? 2 : 3;
            const text = item.str.trim();
            if (text) {
                headings.push({ level, text, page });
            }
        }
    }
    async renderThumbnail(page, scale) {
        try {
            const { createCanvas } = await import('@napi-rs/canvas');
            const viewport = page.getViewport({ scale });
            const canvas = createCanvas(viewport.width, viewport.height);
            const context = canvas.getContext('2d');
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, viewport.width, viewport.height);
            await page.render({ canvasContext: context, viewport, canvas: canvas }).promise;
            return canvas.toDataURL('image/png');
        }
        catch {
            return undefined;
        }
    }
}
