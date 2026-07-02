"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { ResearchDocState } from '../../types/programs';

const exportDocumentToPDF = async (state: ResearchDocState, onError: (msg: string) => void): Promise<void> => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    onError('Please allow popups to export PDF');
    return;
  }

  const citationsHtml = state.citations.map(c => `
    <li style="margin-bottom: 12px; font-size: 12px;">
      <span style="color: #666;">[${c.number}]</span>
      <a href="${c.url}" style="color: #2563eb; text-decoration: none;">${c.source}</a>
      <p style="margin: 4px 0 0 0; color: #444; font-size: 11px;">${c.snippet}</p>
    </li>
  `).join('');

  const sectionsHtml = state.sections.map(s => {
    switch (s.type) {
      case 'hero':
        return `<h1 style="font-size: 28px; font-weight: bold; margin: 24px 0;">${s.content}</h1>`;
      case 'heading':
        const level = Math.min((s.metadata?.level as number) ?? 2, 6);
        const size = [28, 24, 20, 18, 16, 14][level - 1];
        return `<h${level} style="font-size: ${size}px; font-weight: 600; margin: 20px 0 12px;">${s.content}</h${level}>`;
      case 'paragraph':
        return `<p style="font-size: 14px; line-height: 1.6; margin: 12px 0; color: #333;">${s.content}</p>`;
      case 'divider':
        return '<hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;">';
      default:
        return '';
    }
  }).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${state.topic || 'Research Document'}</title>
      <style>
        @page { margin: 20mm; }
        body {
          font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 210mm;
          margin: 0 auto;
          padding: 20mm;
          color: #1a1a1a;
          line-height: 1.6;
        }
        h1, h2, h3, h4, h5, h6 { color: #111; page-break-after: avoid; }
        p { orphans: 3; widows: 3; }
        a { color: #2563eb; text-decoration: none; }
        .references { margin-top: 40px; border-top: 2px solid #ddd; padding-top: 20px; }
        .references h3 { font-size: 16px; margin-bottom: 16px; }
        .references ol { padding-left: 20px; }
      </style>
    </head>
    <body>
      ${sectionsHtml}
      ${citationsHtml ? `
        <div class="references">
          <h3>References</h3>
          <ol>${citationsHtml}</ol>
        </div>
      ` : ''}
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        };
      </script>
    </body>
    </html>
  `);
  
  printWindow.document.close();
};

export const ExportMenu: React.FC<{ state: ResearchDocState }> = ({ state }) => {
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handlePDFExport = async () => {
    setIsExporting(true);
    try {
      await exportDocumentToPDF(state, (msg) => addToast({ title: msg, type: 'error' }));
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const handleMarkdownExport = () => {
    let md = `# ${state.topic || 'Research Document'}\n\n`;
    
    state.sections.forEach(s => {
      switch (s.type) {
        case 'hero':
          md += `# ${s.content}\n\n`;
          break;
        case 'heading':
          const level = Math.min((s.metadata?.level as number) ?? 2, 6);
          md += `${'#'.repeat(level)} ${s.content}\n\n`;
          break;
        case 'paragraph':
          md += `${s.content}\n\n`;
          break;
        case 'divider':
          md += `---\n\n`;
          break;
      }
    });
    
    if (state.citations.length > 0) {
      md += `## References\n\n`;
      state.citations.forEach(c => {
        md += `[${c.number}] ${c.source} - ${c.url}\n`;
        md += `> ${c.snippet}\n\n`;
      });
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.topic || 'document').replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  const handleHTMLExport = () => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${state.topic || 'Research Document'}</title>
  <style>
    body { font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
    h1 { font-size: 2em; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    h2 { font-size: 1.5em; margin-top: 30px; }
    a { color: #2563eb; }
    .citation { color: #666; font-size: 0.9em; }
    .references { margin-top: 40px; border-top: 2px solid #eee; padding-top: 20px; }
  </style>
</head>
<body>
  ${state.sections.map(s => {
    switch (s.type) {
      case 'hero': return `<h1>${s.content}</h1>`;
      case 'heading': return `<h${(s.metadata?.level as number) ?? 2}>${s.content}</h${(s.metadata?.level as number) ?? 2}>`;
      case 'paragraph': return `<p>${s.content}</p>`;
      case 'divider': return '<hr>';
      default: return '';
    }
  }).join('')}
  
  ${state.citations.length > 0 ? `
    <div class="references">
      <h2>References</h2>
      <ol>
        ${state.citations.map(c => `
          <li>
            <a href="${c.url}">${c.source}</a>
            <p class="citation">${c.snippet}</p>
          </li>
        `).join('')}
      </ol>
    </div>
  ` : ''}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.topic || 'document').replace(/\s+/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} className="relative">
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 disabled:opacity-50"
        title="Export"
      >
        {isExporting ? (
          <span className="size-5  block border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="size-5 " fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 z-50">
          <button type="button"
            onClick={handleMarkdownExport}
            className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 first:rounded-t-lg flex items-center gap-2"
          >
            <span>📄</span> Download Markdown
          </button>
          <button type="button"
            onClick={handleHTMLExport}
            className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 flex items-center gap-2"
          >
            <span>🌐</span> Download HTML
          </button>
          <button type="button"
            onClick={handlePDFExport}
            disabled={isExporting}
            className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 last:rounded-b-lg flex items-center gap-2 disabled:opacity-50"
          >
            <span>📑</span> Print / Save PDF
          </button>
        </div>
      )}
    </div>
  );
};
