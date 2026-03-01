/**
 * PDF Generation via Playwright
 */

import { connectViaCDP } from './launcher.js';

export interface PDFOptions {
  cdpUrl: string;
  targetId: string;
}

export interface PDFResult {
  path: string;
  buffer: Buffer;
}

export async function pdfViaPlaywright(options: PDFOptions): Promise<PDFResult> {
  const { browser, context } = await connectViaCDP(options.cdpUrl);
  
  try {
    const page = context.pages().find(p => p.url() === options.targetId) || context.pages()[0];
    if (!page) throw new Error('Page not found');
    
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    });
    
    const path = `/tmp/page-${Date.now()}.pdf`;
    const { writeFile } = await import('fs/promises');
    await writeFile(path, buffer);
    
    return { path, buffer };
  } finally {
    await browser.close();
  }
}
