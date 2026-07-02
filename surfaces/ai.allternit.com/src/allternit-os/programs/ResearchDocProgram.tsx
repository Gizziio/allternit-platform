"use client";

import * as React from 'react';
const { useState, useRef, useEffect } = React;
import { useSidecarStore } from '../stores/useSidecarStore';
import type { 
  AllternitProgram, 
  ResearchDocState 
} from '../types/programs';

// Modular components
import { ProgramErrorBoundary } from '../components/ProgramErrorBoundary';
import { SectionRenderer } from './research-doc/SectionRenderer';
import { TableOfContents } from './research-doc/TableOfContents';
import { ProgressIndicator } from './research-doc/ProgressIndicator';
import { ExportMenu } from './research-doc/ExportMenu';

interface ResearchDocProgramProps {
  program: AllternitProgram;
}

// ============================================================================
// Citation Manager Button
// ============================================================================

const CitationManagerButton: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  return (
    <button type="button"
      onClick={onOpen}
      className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
      title="Citation Manager"
    >
      <svg className="size-5 " fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>
  );
};

export const ResearchDocProgram: React.FC<ResearchDocProgramProps> = ({ program }) => {
  const store = useSidecarStore();
  const state = program.state as ResearchDocState;
  const [showCitationManager, setShowCitationManager] = useState(false);
  const [activeTocId, setActiveTocId] = useState<string>();
  const contentRef = useRef<HTMLDivElement>(null);
  
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
    <div className="h-full flex bg-white dark:bg-zinc-900 relative">
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
              <span className="size-2  bg-blue-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">Researching</span>
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {liveAgentText.split('<launch_utility')[0].trim().slice(0, 400)}<span className="animate-pulse">▊</span>
            </p>
          </div>
        )}

        <article className="max-w-2xl mx-auto">
          <ProgramErrorBoundary programName="Research Engine">
            {sections.map((section) => (
              <SectionRenderer
                key={section.id}
                section={section}
                citations={citations}
                evidence={evidence}
                isStreaming={isProgramStreaming && section.id === streamingSectionId}
              />
            ))}
          </ProgramErrorBoundary>
          
          {/* Live streaming buffer display */}
          {isProgramStreaming && streamingBuffer && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="size-2  bg-blue-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase">Streaming</span>
              </div>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {streamingBuffer}
                <span className="animate-pulse">▊</span>
              </p>
            </div>
          )}
        </article>

        {citations.length > 0 && (
          <footer className="max-w-2xl mx-auto mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">
              References
            </h3>
            <ol className="space-y-3">
              {citations.map((citation) => (
                <li key={citation.id} className="text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">[{citation.number}]</span>{' '}
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {citation.source}
                  </a>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400 text-xs">
                    {citation.snippet}
                  </p>
                </li>
              ))}
            </ol>
          </footer>
        )}

        {sections.length === 0 && !isGenerating && (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
            <span className="text-4xl mb-3">📝</span>
            <p className="text-sm">Research document will appear here</p>
          </div>
        )}
      </div>

      {toc.length > 0 && (
        <aside className="hidden lg:block w-64 p-4 border-l border-zinc-200 dark:border-zinc-700 overflow-y-auto">
          <TableOfContents toc={toc} activeId={activeTocId} />
        </aside>
      )}

      {/* Toolbar */}
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <CitationManagerButton
          onOpen={() => setShowCitationManager(true)}
        />
        <ExportMenu state={state} />
      </div>

      {showCitationManager && (
        <div className="absolute inset-y-0 right-0 w-80 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700 flex flex-col shadow-xl z-20">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Citations ({citations.length})</h3>
            <button type="button"
              onClick={() => setShowCitationManager(false)}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {citations.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">No citations yet</p>
            ) : citations.map((c) => (
              <div key={c.id} className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-mono text-zinc-400 mt-0.5">[{c.number}]</span>
                  <div className="min-w-0 flex-1">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block"
                    >
                      {c.source}
                    </a>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-3">{c.snippet}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchDocProgram;
