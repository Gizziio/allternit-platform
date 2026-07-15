"use client";

import React, { useEffect, useRef, useState } from "react";
import type { 
  ResearchDocSection, 
  ResearchDocCitation, 
  ResearchDocEvidence 
} from '../../types/programs';
// ============================================================================
// Citation Popover Component
// ============================================================================

export const CitationPopover: React.FC<{ 
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
          bg-white dark:bg-zinc-800 
          rounded-lg shadow-xl 
          border border-zinc-200 dark:border-zinc-700
          z-50
        ">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            Source {number}
          </div>
          <div className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
            {citation.source}
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-300 mb-2 line-clamp-3">
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
            border-4 border-transparent border-t-white dark:border-t-zinc-800
          " />
        </div>
      )}
    </span>
  );
};

// ============================================================================
// Evidence Card Component
// ============================================================================

export const EvidenceCard: React.FC<{ evidence: ResearchDocEvidence }> = ({ evidence }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <figure className="my-6">
      <div 
        className={`
          relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700
          ${isExpanded ? '' : 'max-h-96'}
          transition-all duration-300
        `}
      >
        {evidence.type === 'screenshot' ? (
          <img
            src={evidence.src}
            alt={evidence.caption}
            className="w-full object-cover"
          />
        ) : evidence.type === 'code' ? (
          <pre className="p-4 bg-zinc-900 text-zinc-100 overflow-auto">
            <code>{evidence.src}</code>
          </pre>
        ) : (
          <div className="p-8 bg-zinc-50 dark:bg-zinc-900 text-center">
             {/* Fallback for charts/other types */}
             <div className="text-lg font-medium">{evidence.type.toUpperCase()}</div>
             <p className="text-sm opacity-60">Visual evidence attachment</p>
          </div>
        )}
        
        {!isExpanded && (
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white dark:from-zinc-900 to-transparent flex items-end justify-center pb-4">
            <button type="button"
              onClick={() => setIsExpanded(true)}
              className="text-xs font-semibold px-4 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full shadow-lg"
            >
              Expand Evidence
            </button>
          </div>
        )}
      </div>
      <figcaption className="mt-3 text-xs text-zinc-500 text-center italic">
        Fig. {evidence.id.slice(0, 4)} — {evidence.caption}
      </figcaption>
    </figure>
  );
};

// ============================================================================
// Section Renderer
// ============================================================================

export const SectionRenderer: React.FC<{ 
  section: ResearchDocSection;
  citations: ResearchDocCitation[];
  evidence: ResearchDocEvidence[];
  isStreaming?: boolean;
}> = ({ section, citations, evidence, isStreaming }): React.ReactElement | null => {
  switch (section.type) {
    case 'hero':
      return (
        <div className="relative py-12 px-8 mb-8 bg-gradient-to-br from-blue-50 to-blue-50 dark:from-blue-950/30 dark:to-blue-950/30 rounded-2xl">
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-4 leading-tight">
            {section.content}
          </h1>
          {section.metadata?.subtitle ? (
            <p className="text-lg text-zinc-600 dark:text-zinc-300">
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
            font-semibold text-zinc-900 dark:text-white 
            mt-8 mb-4 scroll-mt-20
          `}
        >
          {section.content}
        </HeadingTag>
      );

    case 'paragraph':
      const textWithCitations = section.content.split(/(\[\d+\])/g).map((part, partIdx) => {
        const match = part.match(/\[(\d+)\]/);
        if (match) {
          const citationNum = parseInt(match[1], 10);
          const citation = citations.find(c => c.number === citationNum);
          return (
            <CitationPopover key={`cite-${citationNum}-${partIdx}`} citation={citation} number={citationNum} />
          );
        }
        return <span key={`text-${part.length}-${part.slice(0, 10)}-${partIdx}`}>{part}</span>;
      });

      return (
        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
          {textWithCitations}
          {isStreaming && <span className="animate-pulse">▊</span>}
        </p>
      );

    case 'columns':
      const columns = (section.metadata?.columns as string[]) ?? [];
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
          {columns.map((col, idx) => (
            <div key={`${section.id}-col-${idx}`} className="prose dark:prose-invert prose-sm">
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
      return <hr className="my-8 border-zinc-200 dark:border-zinc-700" />;

    default:
      return null;
  }
};
