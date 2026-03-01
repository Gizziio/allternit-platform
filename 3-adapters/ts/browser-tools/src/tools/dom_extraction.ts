/**
 * DOM Extraction Tools
 * 
 * Extract structured content from web pages:
 * - Text content
 * - Links
 * - Images
 * - Forms
 * - Tables
 * - Interactive elements
 */

import type { Page, Locator } from 'playwright';
import type {
  DOMElement,
  ExtractedContent,
  LinkInfo,
  ImageInfo,
  FormInfo,
  FormField,
  TableInfo,
  ToolResult,
} from '../types/index.js';
import { sessionRegistry } from '../playwright/driver.js';

// ============================================================================
// Main Extraction Function
// ============================================================================

export interface ExtractContentOptions {
  includeHidden?: boolean;
  maxLength?: number;
  includeSelectors?: boolean;
}

/**
 * Extract all content from the current page
 */
export async function extractContent(
  sessionId: string,
  options: ExtractContentOptions = {}
): Promise<ToolResult<ExtractedContent>> {
  const startTime = Date.now();
  
  try {
    const active = sessionRegistry.get(sessionId);
    if (!active) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const { page } = active;

    const [text, links, images, forms, tables] = await Promise.all([
      extractText(page, options),
      extractLinks(page, options),
      extractImages(page, options),
      extractForms(page, options),
      extractTables(page, options),
    ]);

    const result: ExtractedContent = {
      text: options.maxLength ? text.substring(0, options.maxLength) : text,
      links,
      images,
      forms,
      tables,
    };

    return {
      success: true,
      data: result,
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'EXTRACTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  }
}

// ============================================================================
// Text Extraction
// ============================================================================

async function extractText(
  page: Page,
  options: ExtractContentOptions
): Promise<string> {
  return page.evaluate((includeHidden) => {
    const getText = (node: Node): string => {
      // Skip hidden elements
      if (!includeHidden && node instanceof Element) {
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return '';
        }
      }

      // Get text from text nodes
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent?.trim() || '';
      }

      // Recursively get text from child nodes
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        
        // Skip script and style tags
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)) {
          return '';
        }

        // Handle special elements
        if (element.tagName === 'BR') return '\n';
        if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI'].includes(element.tagName)) {
          const children = Array.from(node.childNodes).map(getText).join('');
          return children + '\n';
        }

        const children = Array.from(node.childNodes).map(getText).join('');
        return children;
      }

      return '';
    };

    return getText(document.body).replace(/\n+/g, '\n').trim();
  }, options.includeHidden || false);
}

// ============================================================================
// Link Extraction
// ============================================================================

async function extractLinks(
  page: Page,
  options: ExtractContentOptions
): Promise<LinkInfo[]> {
  return page.evaluate((includeHidden, includeSelectors) => {
    const links: LinkInfo[] = [];
    const anchorElements = document.querySelectorAll('a[href]');

    anchorElements.forEach((el, index) => {
      // Skip hidden links
      if (!includeHidden) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return;
        }
      }

      const href = el.getAttribute('href');
      if (!href || href.startsWith('javascript:') || href.startsWith('#')) {
        return;
      }

      links.push({
        text: el.textContent?.trim() || '',
        href: el.getAttribute('href') || '',
        selector: includeSelectors ? generateSelector(el, index) : '',
      });
    });

    return links;
  }, options.includeHidden || false, options.includeSelectors || false);
}

// ============================================================================
// Image Extraction
// ============================================================================

async function extractImages(
  page: Page,
  options: ExtractContentOptions
): Promise<ImageInfo[]> {
  return page.evaluate((includeHidden, includeSelectors) => {
    const images: ImageInfo[] = [];
    const imgElements = document.querySelectorAll('img');

    imgElements.forEach((el, index) => {
      // Skip hidden images
      if (!includeHidden) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return;
        }
      }

      const src = el.getAttribute('src');
      if (!src) return;

      images.push({
        src: src,
        alt: el.getAttribute('alt') || undefined,
        dimensions: el.naturalWidth && el.naturalHeight ? {
          width: el.naturalWidth,
          height: el.naturalHeight,
        } : undefined,
        selector: includeSelectors ? generateSelector(el, index) : '',
      });
    });

    return images;
  }, options.includeHidden || false, options.includeSelectors || false);
}

// ============================================================================
// Form Extraction
// ============================================================================

async function extractForms(
  page: Page,
  options: ExtractContentOptions
): Promise<FormInfo[]> {
  return page.evaluate((includeHidden, includeSelectors) => {
    const forms: FormInfo[] = [];
    const formElements = document.querySelectorAll('form');

    formElements.forEach((form, formIndex) => {
      // Skip hidden forms
      if (!includeHidden) {
        const style = window.getComputedStyle(form);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return;
        }
      }

      const fields: FormField[] = [];
      const inputElements = form.querySelectorAll('input, textarea, select');

      inputElements.forEach((input, inputIndex) => {
        // Skip hidden inputs
        if (!includeHidden) {
          const inputStyle = window.getComputedStyle(input);
          if (inputStyle.display === 'none' || inputStyle.visibility === 'hidden') {
            return;
          }
        }

        const inputType = input.getAttribute('type') || 'text';
        if (inputType === 'submit' || inputType === 'button') return;

        const label = findLabel(input);

        fields.push({
          name: input.getAttribute('name') || '',
          type: inputType,
          label: label,
          value: (input as HTMLInputElement).value || undefined,
          required: input.hasAttribute('required'),
          selector: includeSelectors ? generateSelector(input, inputIndex, formIndex) : '',
        });
      });

      if (fields.length > 0) {
        forms.push({
          id: form.getAttribute('id') || undefined,
          action: form.getAttribute('action') || undefined,
          method: form.getAttribute('method') || undefined,
          fields,
          selector: includeSelectors ? generateSelector(form, formIndex) : '',
        });
      }
    });

    return forms;
  }, options.includeHidden || false, options.includeSelectors || false);
}

function findLabel(input: Element): string | undefined {
  // Check for explicit label
  const id = input.getAttribute('id');
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) return label.textContent?.trim();
  }

  // Check for wrapping label
  const parentLabel = input.closest('label');
  if (parentLabel) {
    // Get text content excluding the input itself
    const clone = parentLabel.cloneNode(true) as Element;
    const inputs = clone.querySelectorAll('input, textarea, select');
    inputs.forEach(el => el.remove());
    return clone.textContent?.trim();
  }

  // Check for aria-label
  return input.getAttribute('aria-label') || undefined;
}

// ============================================================================
// Table Extraction
// ============================================================================

async function extractTables(
  page: Page,
  options: ExtractContentOptions
): Promise<TableInfo[]> {
  return page.evaluate((includeHidden, includeSelectors) => {
    const tables: TableInfo[] = [];
    const tableElements = document.querySelectorAll('table');

    tableElements.forEach((table, tableIndex) => {
      // Skip hidden tables
      if (!includeHidden) {
        const style = window.getComputedStyle(table);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return;
        }
      }

      // Extract headers
      const headers: string[] = [];
      const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
      if (headerRow) {
        const thElements = headerRow.querySelectorAll('th, td');
        thElements.forEach(th => {
          headers.push(th.textContent?.trim() || '');
        });
      }

      // Extract rows
      const rows: string[][] = [];
      const rowElements = table.querySelectorAll('tbody tr, tr');
      
      // Skip header row if already processed
      const startIndex = headers.length > 0 && rowElements[0] === headerRow ? 1 : 0;
      
      for (let i = startIndex; i < rowElements.length; i++) {
        const row = rowElements[i];
        const cells: string[] = [];
        const cellElements = row.querySelectorAll('td, th');
        
        cellElements.forEach(cell => {
          cells.push(cell.textContent?.trim() || '');
        });

        if (cells.length > 0) {
          rows.push(cells);
        }
      }

      if (headers.length > 0 || rows.length > 0) {
        tables.push({
          headers,
          rows,
          selector: includeSelectors ? generateSelector(table, tableIndex) : '',
        });
      }
    });

    return tables;
  }, options.includeHidden || false, options.includeSelectors || false);
}

// ============================================================================
// Element Finding
// ============================================================================

export interface FindElementOptions {
  selector?: string;
  text?: string;
  tag?: string;
  attribute?: { name: string; value: string };
  nth?: number;
}

/**
 * Find an element on the page
 */
export async function findElement(
  sessionId: string,
  options: FindElementOptions
): Promise<ToolResult<DOMElement | null>> {
  const startTime = Date.now();
  
  try {
    const active = sessionRegistry.get(sessionId);
    if (!active) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const { page } = active;
    let locator: Locator;

    // Build locator based on options
    if (options.selector) {
      locator = page.locator(options.selector).nth(options.nth || 0);
    } else if (options.text) {
      locator = page.getByText(options.text).nth(options.nth || 0);
    } else if (options.tag && options.attribute) {
      locator = page.locator(`${options.tag}[${options.attribute.name}="${options.attribute.value}"]`).nth(options.nth || 0);
    } else if (options.tag) {
      locator = page.locator(options.tag).nth(options.nth || 0);
    } else {
      throw new Error('No search criteria provided');
    }

    // Check if element exists
    const count = await locator.count();
    if (count === 0) {
      return {
        success: true,
        data: null,
        metadata: {
          duration: Date.now() - startTime,
          timestamp: new Date(),
          sessionId,
        },
      };
    }

    // Extract element info
    const element = await locator.evaluate((el) => ({
      id: el.id || '',
      tag: el.tagName.toLowerCase(),
      text: el.textContent?.substring(0, 200) || '',
      attributes: Array.from(el.attributes).reduce((acc, attr) => {
        acc[attr.name] = attr.value;
        return acc;
      }, {} as Record<string, string>),
      bounds: el.getBoundingClientRect().toJSON(),
      isVisible: el.checkVisibility(),
      isInteractive: isInteractiveElement(el),
      selector: generateSelector(el, 0),
    }));

    return {
      success: true,
      data: element,
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'FIND_ELEMENT_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  }
}

function isInteractiveElement(el: Element): boolean {
  const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
  const hasClickHandler = (el as any).onclick !== null;
  const hasRole = el.getAttribute('role') === 'button';
  const isClickable = el.getAttribute('onclick') !== null;
  
  return interactiveTags.includes(el.tagName) || hasClickHandler || hasRole || isClickable;
}

// ============================================================================
// Utility: Generate Selector
// ============================================================================

function generateSelector(el: Element, index: number, parentIndex?: number): string {
  const tag = el.tagName.toLowerCase();
  
  // Use ID if available
  if (el.id) {
    return `#${el.id}`;
  }

  // Use unique attributes
  const dataTestId = el.getAttribute('data-testid');
  if (dataTestId) {
    return `[data-testid="${dataTestId}"]`;
  }

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) {
    return `${tag}[aria-label="${ariaLabel}"]`;
  }

  // Use class if unique enough
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.split(' ').filter(c => c.length > 3);
    if (classes.length > 0) {
      return `${tag}.${classes.join('.')}`;
    }
  }

  // Use name attribute for form elements
  const name = el.getAttribute('name');
  if (name) {
    return `${tag}[name="${name}"]`;
  }

  // Fallback to nth-of-type
  if (parentIndex !== undefined) {
    return `form:nth-of-type(${parentIndex + 1}) ${tag}:nth-of-type(${index + 1})`;
  }
  return `${tag}:nth-of-type(${index + 1})`;
}

// ============================================================================
// Export
// ============================================================================

export const domExtractionTools = {
  extractContent,
  findElement,
};

export default domExtractionTools;
