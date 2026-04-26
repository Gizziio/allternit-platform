/**
 * allternit Super-Agent OS - Export Utilities
 * 
 * Export programs to various formats:
 * - ResearchDoc: PDF, Markdown, HTML
 * - DataGrid: CSV, Excel, JSON
 * - Presentation: PPTX, PDF
 */

import type {
  ResearchDocState,
  DataGridState,
  PresentationState,
  ResearchDocSection,
} from '../types/programs';

// ============================================================================
// ResearchDoc Exports
// ============================================================================

export interface ExportOptions {
  filename?: string;
  includeCitations?: boolean;
  includeTOC?: boolean;
}

/**
 * Export ResearchDoc to Markdown
 */
export function exportToMarkdown(
  state: ResearchDocState,
  options: ExportOptions = {}
): string {
  const { includeCitations = true, includeTOC = true } = options;
  
  let markdown = '';
  
  // Title
  markdown += `# ${state.topic}\n\n`;
  
  // Table of Contents
  if (includeTOC && state.tableOfContents.length > 0) {
    markdown += `## Table of Contents\n\n`;
    state.tableOfContents.forEach(item => {
      const indent = '  '.repeat(item.level - 1);
      markdown += `${indent}- [${item.title}](#${item.id})\n`;
    });
    markdown += '\n---\n\n';
  }
  
  // Sections
  state.sections.forEach(section => {
    switch (section.type) {
      case 'hero':
        markdown += `# ${section.content}\n\n`;
        if (section.metadata?.subtitle) {
          markdown += `> ${section.metadata.subtitle}\n\n`;
        }
        break;
        
      case 'heading':
        const level = (section.metadata?.level as number) || 2;
        const hashes = '#'.repeat(level);
        markdown += `${hashes} ${section.content}\n\n`;
        break;
        
      case 'paragraph':
        // Process citations [1], [2] → markdown links
        let content = section.content;
        content = content.replace(/\[(\d+)\]/g, (match, num) => {
          const citation = state.citations.find(c => c.number === parseInt(num));
          if (citation) {
            return `[${match}](${citation.url})`;
          }
          return match;
        });
        markdown += `${content}\n\n`;
        break;
        
      case 'columns':
        const columns = section.metadata?.columns as string[] || [];
        columns.forEach((col, i) => {
          markdown += `**Column ${i + 1}:** ${col}\n\n`;
        });
        break;
        
      case 'evidence':
        const evidenceId = section.metadata?.evidenceId as string;
        const evidence = state.evidence.find(e => e.id === evidenceId);
        if (evidence) {
          markdown += `![${evidence.caption}](${evidence.src})\n`;
          markdown += `*${evidence.caption}*\n\n`;
        }
        break;
        
      case 'divider':
        markdown += `---\n\n`;
        break;
    }
  });
  
  // Citations
  if (includeCitations && state.citations.length > 0) {
    markdown += `## References\n\n`;
    state.citations.forEach(citation => {
      markdown += `[${citation.number}] ${citation.source}. `;
      markdown += `[Link](${citation.url})\n\n`;
      markdown += `> ${citation.snippet}\n\n`;
    });
  }
  
  return markdown;
}

/**
 * Export ResearchDoc to HTML
 */
export function exportToHTML(
  state: ResearchDocState,
  options: ExportOptions = {}
): string {
  const { includeCitations = true, includeTOC = true } = options;
  
  const markdown = exportToMarkdown(state, { ...options, includeCitations, includeTOC });
  
  // Simple markdown to HTML conversion
  let html = markdown
    // Headers
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    // Bold/Italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    // Blockquotes
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    // Lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    // Horizontal rule
    .replace(/---/g, '<hr />');
  
  // Wrap in HTML document
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${state.topic}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #333; }
    h1, h2, h3, h4 { color: #111; margin-top: 2rem; }
    h1 { font-size: 2rem; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; }
    a { color: #0066cc; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 1rem; color: #666; }
    img { max-width: 100%; height: auto; }
    hr { border: none; border-top: 1px solid #eee; margin: 2rem 0; }
  </style>
</head>
<body>
  <p>${html}</p>
</body>
</html>`;
}

/**
 * Export ResearchDoc to PDF (using browser print to PDF)
 */
export function exportToPDF(
  state: ResearchDocState,
  options: ExportOptions = {}
): void {
  const html = exportToHTML(state, options);
  
  // Open in new window for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('Failed to open print window');
    return;
  }
  
  printWindow.document.write(html);
  printWindow.document.close();
  
  // Add print styles
  const style = printWindow.document.createElement('style');
  style.textContent = `
    @media print {
      body { font-size: 12pt; }
      h1 { page-break-before: always; }
      h1:first-of-type { page-break-before: auto; }
      img { page-break-inside: avoid; }
    }
  `;
  printWindow.document.head.appendChild(style);
  
  // Trigger print dialog
  setTimeout(() => {
    printWindow.print();
    // printWindow.close(); // Don't close immediately to allow saving as PDF
  }, 500);
}

/**
 * Download Markdown file
 */
export function downloadMarkdown(
  state: ResearchDocState,
  filename?: string
): void {
  const markdown = exportToMarkdown(state);
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${sanitizeFilename(state.topic)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download HTML file
 */
export function downloadHTML(
  state: ResearchDocState,
  filename?: string
): void {
  const html = exportToHTML(state);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${sanitizeFilename(state.topic)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// DataGrid Exports
// ============================================================================

export interface DataGridExportOptions {
  filename?: string;
  includeHeaders?: boolean;
}

/**
 * Export DataGrid to CSV
 */
export function exportToCSV(
  state: DataGridState,
  options: DataGridExportOptions = {}
): string {
  const { includeHeaders = true } = options;
  
  let csv = '';
  
  // Headers
  if (includeHeaders) {
    const headers = state.columns.map(col => `"${col.header}"`).join(',');
    csv += headers + '\n';
  }
  
  // Rows
  state.rows.forEach(row => {
    const values = state.columns.map(col => {
      const value = row.cells[col.id];
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      // Escape quotes and wrap in quotes if contains comma
      if (stringValue.includes(',') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
    csv += values + '\n';
  });
  
  return csv;
}

/**
 * Export DataGrid to JSON
 */
export function exportToJSON(
  state: DataGridState,
  options: DataGridExportOptions = {}
): string {
  const data = {
    title: state.title,
    columns: state.columns.map(col => ({
      id: col.id,
      header: col.header,
      type: col.type,
    })),
    rows: state.rows.map(row => ({
      id: row.id,
      cells: row.cells,
      metadata: row.metadata,
    })),
    exportedAt: new Date().toISOString(),
  };
  
  return JSON.stringify(data, null, 2);
}

/**
 * Export DataGrid to Excel-compatible HTML
 */
export function exportToExcelHTML(
  state: DataGridState,
  options: DataGridExportOptions = {}
): string {
  let html = `<table border="1">\n`;
  
  // Headers
  html += `  <tr>\n`;
  state.columns.forEach(col => {
    html += `    <th>${col.header}</th>\n`;
  });
  html += `  </tr>\n`;
  
  // Rows
  state.rows.forEach(row => {
    html += `  <tr>\n`;
    state.columns.forEach(col => {
      const value = row.cells[col.id];
      html += `    <td>${value !== undefined && value !== null ? value : ''}</td>\n`;
    });
    html += `  </tr>\n`;
  });
  
  html += `</table>`;
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${state.title}</title>
</head>
<body>
  ${html}
</body>
</html>`;
}

/**
 * Download CSV file
 */
export function downloadCSV(
  state: DataGridState,
  filename?: string
): void {
  const csv = exportToCSV(state);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${sanitizeFilename(state.title)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download JSON file
 */
export function downloadJSON(
  state: DataGridState,
  filename?: string
): void {
  const json = exportToJSON(state);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${sanitizeFilename(state.title)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download Excel file (HTML format)
 */
export function downloadExcel(
  state: DataGridState,
  filename?: string
): void {
  const html = exportToExcelHTML(state);
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${sanitizeFilename(state.title)}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Presentation Exports
// ============================================================================

/**
 * Export Presentation to Markdown (outline format)
 */
export function exportPresentationToMarkdown(
  state: PresentationState
): string {
  let markdown = `# ${state.title}\n\n`;
  
  state.slides.forEach((slide, index) => {
    markdown += `## Slide ${index + 1}\n\n`;
    markdown += `**Type:** ${slide.type}\n\n`;
    markdown += `${slide.content}\n\n`;
    
    if (slide.notes) {
      markdown += `> **Notes:** ${slide.notes}\n\n`;
    }
    
    markdown += `---\n\n`;
  });
  
  return markdown;
}

/**
 * Export Presentation to PDF (print view)
 */
export function exportPresentationToPDF(state: PresentationState): void {
  const slides = state.slides.map((slide, index) => {
    return `
      <div class="slide" style="page-break-after: always; padding: 40px;">
        <div style="font-size: 12px; color: #999; margin-bottom: 20px;">Slide ${index + 1}</div>
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 20px;">${slide.content}</div>
        ${slide.notes ? `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;"><strong>Notes:</strong> ${slide.notes}</div>` : ''}
      </div>
    `;
  }).join('');
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${state.title}</title>
  <style>
    @page { size: 297mm 210mm; margin: 0; }
    @media print { .slide { page-break-after: always; height: 100vh; box-sizing: border-box; } }
    body { font-family: system-ui, sans-serif; margin: 0; }
  </style>
</head>
<body>${slides}</body>
</html>`;
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}

// ============================================================================
// Utilities
// ============================================================================

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9\s-]/gi, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 50);
}

// ============================================================================
// React Hooks
// ============================================================================

import { useCallback } from 'react';
import { useSidecarStore } from '../stores/useSidecarStore';

export function useExport(programId: string) {
  const store = useSidecarStore();
  
  const program = store.programs[programId];
  
  const exportDocument = useCallback((format: 'markdown' | 'html' | 'pdf') => {
    if (!program || program.type !== 'research-doc') return;
    
    const state = program.state as ResearchDocState;
    
    switch (format) {
      case 'markdown':
        downloadMarkdown(state);
        break;
      case 'html':
        downloadHTML(state);
        break;
      case 'pdf':
        exportToPDF(state);
        break;
    }
  }, [program]);
  
  const exportDataGrid = useCallback((format: 'csv' | 'json' | 'excel') => {
    if (!program || program.type !== 'data-grid') return;
    
    const state = program.state as DataGridState;
    
    switch (format) {
      case 'csv':
        downloadCSV(state);
        break;
      case 'json':
        downloadJSON(state);
        break;
      case 'excel':
        downloadExcel(state);
        break;
    }
  }, [program]);
  
  const exportPresentation = useCallback((format: 'markdown' | 'pdf') => {
    if (!program || program.type !== 'presentation') return;
    
    const state = program.state as PresentationState;
    
    switch (format) {
      case 'markdown':
        const md = exportPresentationToMarkdown(state);
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sanitizeFilename(state.title)}.md`;
        a.click();
        URL.revokeObjectURL(url);
        break;
      case 'pdf':
        exportPresentationToPDF(state);
        break;
    }
  }, [program]);
  
  return {
    exportDocument,
    exportDataGrid,
    exportPresentation,
  };
}
