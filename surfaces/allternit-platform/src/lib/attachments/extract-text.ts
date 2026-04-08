/**
 * Text extraction from various file types
 * Supports PDF, DOCX, TXT, and other text-based formats
 */

import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('attachments:extract-text');

export interface ExtractedText {
  text: string;
  metadata?: {
    pageCount?: number;
    title?: string;
    author?: string;
  };
}

/**
 * Extract text from PDF using pdf.js
 */
export async function extractTextFromPDF(file: File): Promise<ExtractedText> {
  try {
    // Dynamic import to avoid loading pdf.js unless needed
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set worker source (webpack/vite should handle this)
    if (typeof window !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    const numPages = pdf.numPages;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }

    log.info({ pages: numPages, filename: file.name }, 'PDF text extracted');

    return {
      text: fullText.trim(),
      metadata: {
        pageCount: numPages,
      },
    };
  } catch (error) {
    log.error({ error, filename: file.name }, 'Failed to extract PDF text');
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Extract text from DOCX using mammoth.js
 */
export async function extractTextFromDOCX(file: File): Promise<ExtractedText> {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    log.info({ filename: file.name }, 'DOCX text extracted');

    return {
      text: result.value.trim(),
      metadata: {
        title: file.name.replace('.docx', ''),
      },
    };
  } catch (error) {
    log.error({ error, filename: file.name }, 'Failed to extract DOCX text');
    throw new Error('Failed to extract text from DOCX');
  }
}

/**
 * Extract text from TXT or MD files
 */
export async function extractTextFromTextFile(file: File): Promise<ExtractedText> {
  try {
    const text = await file.text();
    
    return {
      text: text.trim(),
      metadata: {
        title: file.name,
      },
    };
  } catch (error) {
    log.error({ error, filename: file.name }, 'Failed to read text file');
    throw new Error('Failed to read text file');
  }
}

/**
 * Detect file type and extract text accordingly
 */
export async function extractTextFromFile(file: File): Promise<ExtractedText | null> {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  // PDF files
  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return extractTextFromPDF(file);
  }

  // Word documents
  if (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    return extractTextFromDOCX(file);
  }

  // Text files
  if (
    type.startsWith('text/') ||
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.markdown') ||
    name.endsWith('.json') ||
    name.endsWith('.csv')
  ) {
    return extractTextFromTextFile(file);
  }

  // Unsupported file type for text extraction
  log.warn({ type, filename: file.name }, 'File type not supported for text extraction');
  return null;
}

/**
 * Check if a file type supports text extraction
 */
export function supportsTextExtraction(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  return (
    type === 'application/pdf' ||
    name.endsWith('.pdf') ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx') ||
    type.startsWith('text/') ||
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.markdown') ||
    name.endsWith('.json') ||
    name.endsWith('.csv')
  );
}

/**
 * Get a preview/truncated version of text
 */
export function getTextPreview(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Get icon name based on file type
 */
export function getFileIcon(file: File): string {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.docx') || name.endsWith('.doc')) return 'word';
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'excel';
  if (name.endsWith('.pptx') || name.endsWith('.ppt')) return 'powerpoint';
  if (type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) return 'text';
  if (name.endsWith('.json') || name.endsWith('.csv')) return 'code';
  
  return 'file';
}
