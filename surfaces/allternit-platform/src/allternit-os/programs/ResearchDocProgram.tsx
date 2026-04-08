/**
 * A2rchitect Super-Agent OS - Research Doc Program
 * 
 * Renders deep research documents with:
 * - Multi-column wiki-style layout
 * - Sticky table of contents
 * - Citations and popovers
 * - Inline evidence (screenshots, charts)
 * - Real-time streaming support
 */

import * as React from 'react';
const { useState, useRef, useEffect, useCallback } = React;
import { useSidecarStore } from '../stores/useSidecarStore';
import { 
  downloadMarkdown, 
  downloadHTML, 
  exportToPDF 
} from '../utils/ExportUtilities';
import type { 
  A2rProgram, 
  ResearchDocState, 
  ResearchDocSection, 
  ResearchDocCitation,
  ResearchDocEvidence 
} from '../types/programs';

interface ResearchDocProgramProps {
  program: A2rProgram;
}

// ============================================================================
// Section Renderer
// ============================================================================

const SectionRenderer: React.FC<{ 
  section: ResearchDocSection;
  citations: ResearchDocCitation[];
  evidence: ResearchDocEvidence[];
  isStreaming?: boolean;
}> = ({ section, citations, evidence, isStreaming }): React.ReactElement | null => {
  switch (section.type) {
    case 'hero':
      return (
        <div className="relative py-12 px-8 mb-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
            {section.content}
          </h1>
          {section.metadata?.subtitle ? (
            <p className="text-lg text-gray-600 dark:text-gray-300">
              {String(section.metadata.subtitle)}
            </p>
          ) : null}
        </div>
      );

    case 'heading':
      const level = (section.metadata?.level as number) ?? 2;
      const HeadingTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
      const sizeClasses = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-xs'];
      
      return (
        <HeadingTag 
          id={section.id}
          className={`
            ${sizeClasses[level - 1]} 
            font-semibold text-gray-900 dark:text-white 
            mt-8 mb-4 scroll-mt-20
          `}
        >
          {section.content}
        </HeadingTag>
      );

    case 'paragraph':
      const textWithCitations = section.content.split(/(\[\d+\])/g).map((part, i) => {
        const match = part.match(/\[(\d+)\]/);
        if (match) {
          const citationNum = parseInt(match[1], 10);
          const citation = citations.find(c => c.number === citationNum);
          return (
            <CitationPopover key={i} citation={citation} number={citationNum} />
          );
        }
        return <span key={i}>{part}</span>;
      });

      return (
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
          {textWithCitations}
          {isStreaming && <span className="animate-pulse">▊</span>}
        </p>
      );

    case 'columns':
      const columns = (section.metadata?.columns as string[]) ?? [];
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
          {columns.map((col, i) => (
            <div key={i} className="prose dark:prose-invert prose-sm">
              {col}
            </div>
          ))}
        </div>
      );

    case 'evidence':
      const evidenceId = section.metadata?.evidenceId as string;
      const ev = evidence.find(e => e.id === evidenceId);
      if (!ev) return null;
      return <EvidenceCard evidence={ev} />;

    case 'divider':
      return <hr className="my-8 border-gray-200 dark:border-gray-700" />;

    default:
      return null;
  }
};

// ============================================================================
// Citation Popover Component
// ============================================================================

const CitationPopover: React.FC<{ 
  citation?: ResearchDocCitation; 
  number: number;
}> = ({ citation, number }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <span ref={popoverRef} className="relative inline-block">
      <sup
        className="
          cursor-pointer text-blue-600 dark:text-blue-400 
          hover:text-blue-800 dark:hover:text-blue-300
          font-medium
        "
        onClick={() => setIsOpen(!isOpen)}
      >
        [{number}]
      </sup>
      
      {isOpen && citation && (
        <div className="
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          w-72 p-3 
          bg-white dark:bg-gray-800 
          rounded-lg shadow-xl 
          border border-gray-200 dark:border-gray-700
          z-50
        ">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Source {number}
          </div>
          <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {citation.source}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-2 line-clamp-3">
            "{citation.snippet}"
          </p>
          <a
            href={citation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Visit source →
          </a>
          
          <div className="
            absolute top-full left-1/2 -translate-x-1/2
            border-4 border-transparent border-t-white dark:border-t-gray-800
          " />
        </div>
      )}
    </span>
  );
};

// ============================================================================
// Evidence Card Component
// ============================================================================

const EvidenceCard: React.FC<{ evidence: ResearchDocEvidence }> = ({ evidence }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <figure className="my-6">
      <div 
        className={`
          relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700
          bg-gray-50 dark:bg-gray-800
          ${isExpanded ? 'fixed inset-4 z-50 bg-black/90 flex items-center justify-center' : ''}
        `}
        onClick={() => isExpanded && setIsExpanded(false)}
      >
        {evidence.type === 'screenshot' ? (
          <img
            src={evidence.src}
            alt={evidence.caption}
            className={`
              w-full object-contain
              ${isExpanded ? 'max-h-full cursor-zoom-out' : 'max-h-64 cursor-zoom-in'}
            `}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          />
        ) : evidence.type === 'chart' ? (
          <img
            src={evidence.src}
            alt={evidence.caption}
            className="w-full max-h-64 object-contain"
          />
        ) : evidence.type === 'code' ? (
          <pre className="p-4 overflow-x-auto text-sm">
            <code className="text-gray-800 dark:text-gray-200">{evidence.src}</code>
          </pre>
        ) : (
          <blockquote className="p-4 italic text-gray-700 dark:text-gray-300">
            "{evidence.src}"
          </blockquote>
        )}

        {evidence.sourceUrl && (
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
            <a
              href={evidence.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/90 hover:text-white flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {new URL(evidence.sourceUrl).hostname}
              {evidence.timestamp && (
                <span className="ml-1 opacity-75">
                  • {new Date(evidence.timestamp).toLocaleDateString()}
                </span>
              )}
            </a>
          </div>
        )}
      </div>
      
      <figcaption className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-center">
        {evidence.caption}
      </figcaption>
    </figure>
  );
};

// ============================================================================
// Table of Contents Component
// ============================================================================

const TableOfContents: React.FC<{
  toc: { id: string; title: string; level: number }[];
  activeId?: string;
}> = ({ toc, activeId }) => {
  return (
    <nav className="sticky top-4">
      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        Contents
      </h4>
      <ul className="space-y-1">
        {toc.map((item) => (
          <li key={item.id} style={{ paddingLeft: `${(item.level - 1) * 12}px` }}>
            <a
              href={`#${item.id}`}
              className={`
                block text-sm py-1 px-2 rounded
                transition-colors duration-150
                ${activeId === item.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                }
              `}
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

// ============================================================================
// Progress Indicator
// ============================================================================

const ProgressIndicator: React.FC<{ 
  progress: { currentStep: string; percentComplete: number };
}> = ({ progress }) => {
  return (
    <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-6">
      <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {progress.currentStep}
        </div>
        <div className="mt-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress.percentComplete}%` }}
          />
        </div>
      </div>
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {progress.percentComplete}%
      </span>
    </div>
  );
};

// ============================================================================
// Main Research Doc Program Component
// ============================================================================

// ============================================================================
// Real PDF Export Function
// ============================================================================

const exportDocumentToPDF = async (state: ResearchDocState): Promise<void> => {
  // Create a clean HTML document for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export PDF');
    return;
  }

  // Generate clean HTML content
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
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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

// ============================================================================
// Export Menu Component
// ============================================================================

const ExportMenu: React.FC<{ state: ResearchDocState }> = ({ state }) => {
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
      await exportDocumentToPDF(state);
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
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
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
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 disabled:opacity-50"
        title="Export"
      >
        {isExporting ? (
          <span className="w-5 h-5 block border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
          <button
            onClick={handleMarkdownExport}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-lg flex items-center gap-2"
          >
            <span>📄</span> Download Markdown
          </button>
          <button
            onClick={handleHTMLExport}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <span>🌐</span> Download HTML
          </button>
          <button
            onClick={handlePDFExport}
            disabled={isExporting}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 last:rounded-b-lg flex items-center gap-2 disabled:opacity-50"
          >
            <span>📑</span> Print / Save PDF
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Citation Manager Button
// ============================================================================

interface CitationManagerButtonProps {
  programId: string;
  onOpen: () => void;
}

const CitationManagerButton: React.FC<CitationManagerButtonProps> = ({ onOpen, programId }) => {
  return (
    <button
      onClick={onOpen}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
      title="Citation Manager"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>
  );
};

export const ResearchDocProgram: React.FC<ResearchDocProgramProps> = ({ program }) => {
  const store = useSidecarStore();
  const state = program.state as ResearchDocState;
  const [activeTocId, setActiveTocId] = useState<string>();
  const [showCitationManager, setShowCitationManager] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [streamBuffer, setStreamBuffer] = useState('');
  
  // Check if this program is currently streaming
  const isProgramStreaming = store.activeStreams[program.id] || false;

  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return;
      
      const sections = contentRef.current.querySelectorAll('[id]');
      const scrollPos = contentRef.current.scrollTop + 100;

      sections.forEach((section) => {
        const top = (section as HTMLElement).offsetTop;
        const height = (section as HTMLElement).offsetHeight;
        const id = section.getAttribute('id');

        if (scrollPos >= top && scrollPos < top + height && id) {
          setActiveTocId(id);
        }
      });
    };

    const content = contentRef.current;
    if (content) {
      content.addEventListener('scroll', handleScroll);
      return () => content.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const sections = state?.sections ?? [];
  const citations = state?.citations ?? [];
  const evidence = state?.evidence ?? [];
  const toc = state?.tableOfContents ?? [];
  const isGenerating = state?.isGenerating ?? false;
  const progress = state?.generationProgress;
  const liveAgentText = useSidecarStore(s => s.liveAgentTexts[program.sourceThreadId] ?? '');

  // Real-time streaming detection
  const streamingSectionId = state?.streamingContent?.currentSectionId;
  const streamingBuffer = state?.streamingContent?.buffer || '';

  return (
    <div className="h-full flex bg-white dark:bg-gray-900">
      <div 
        ref={contentRef}
        className="flex-1 overflow-y-auto p-6 scroll-smooth"
      >
        {isGenerating && progress && (
          <ProgressIndicator progress={progress} />
        )}
        {isGenerating && !progress && sections.length === 0 && liveAgentText && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">Researching</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {liveAgentText.split('<launch_utility')[0].trim().slice(0, 400)}<span className="animate-pulse">▊</span>
            </p>
          </div>
        )}

        <article className="max-w-2xl mx-auto">
          {sections.map((section) => (
            <SectionRenderer
              key={section.id}
              section={section}
              citations={citations}
              evidence={evidence}
              isStreaming={isProgramStreaming && section.id === streamingSectionId}
            />
          ))}
          
          {/* Live streaming buffer display */}
          {isProgramStreaming && streamingBuffer && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase">Streaming</span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {streamingBuffer}
                <span className="animate-pulse">▊</span>
              </p>
            </div>
          )}
        </article>

        {citations.length > 0 && (
          <footer className="max-w-2xl mx-auto mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              References
            </h3>
            <ol className="space-y-3">
              {citations.map((citation) => (
                <li key={citation.id} className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">[{citation.number}]</span>{' '}
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {citation.source}
                  </a>
                  <p className="mt-1 text-gray-600 dark:text-gray-400 text-xs">
                    {citation.snippet}
                  </p>
                </li>
              ))}
            </ol>
          </footer>
        )}

        {sections.length === 0 && !isGenerating && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <span className="text-4xl mb-3">📝</span>
            <p className="text-sm">Research document will appear here</p>
          </div>
        )}
      </div>

      {toc.length > 0 && (
        <aside className="hidden lg:block w-64 p-4 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
          <TableOfContents toc={toc} activeId={activeTocId} />
        </aside>
      )}

      {/* Toolbar */}
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <CitationManagerButton 
          programId={program.id} 
          onOpen={() => setShowCitationManager(true)} 
        />
        <ExportMenu state={state} />
      </div>
    </div>
  );
};

export default ResearchDocProgram;
