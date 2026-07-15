"use client";

import React, { useCallback, useRef, useState } from "react";
import { useToast } from '@/hooks/use-toast';
import { useSidecarStore } from '../stores/useSidecarStore';
import type { AllternitProgram, ResearchDocEvidence, ResearchDocCitation, ResearchDocState } from '../types/programs';
import { ProgramErrorBoundary } from '../components/ProgramErrorBoundary';

// Modularized Citation Manager components
import { browserScreenshotService } from './citation-manager/BrowserScreenshotService';
import { AnnotationCanvas } from './citation-manager/AnnotationCanvas';
import type { BrowserScreenshotOptions, ScreenshotResult, Annotation, AnnotatedScreenshot } from './citation-manager/citation-manager.types';

// Icons
import {
  Camera,
  Link as LinkIcon,
  Trash,
  CheckCircle,
  Warning,
  Plus,
  X,
  NotePencil,
  Eye,
  ArrowsClockwise,
} from '@phosphor-icons/react';

interface BrowserScreenshotCitationsProps {
  program: AllternitProgram;
}

export const BrowserScreenshotCitations: React.FC<BrowserScreenshotCitationsProps> = ({ program }) => {
  const { addToast } = useToast();
  const { updateProgramState } = useSidecarStore();
  const state = program.state as ResearchDocState;
  
  const [url, setUrl] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentScreenshot, setCurrentScreenshot] = useState<AnnotatedScreenshot | null>(null);
  const [showCitationList, setShowCitationList] = useState(true);

  const citations = state?.citations || [];
  const evidence = state?.evidence || [];

  const handleCapture = useCallback(async () => {
    if (!url.trim()) return;
    setIsCapturing(true);
    try {
      const result = await browserScreenshotService.capture({ url: url.trim(), fullPage: false });
      setCurrentScreenshot({ ...result, annotations: [] });
      addToast({ title: 'Screenshot captured', type: 'success' });
    } catch (err: any) {
      addToast({ title: 'Capture failed', description: err.message, type: 'error' });
    } finally {
      setIsCapturing(false);
    }
  }, [url, addToast]);

  const handleAddAnnotation = (anno: Annotation) => {
    if (!currentScreenshot) return;
    setCurrentScreenshot({
      ...currentScreenshot,
      annotations: [...currentScreenshot.annotations, anno],
    });
  };

  const handleRemoveAnnotation = (id: string) => {
    if (!currentScreenshot) return;
    setCurrentScreenshot({
      ...currentScreenshot,
      annotations: currentScreenshot.annotations.filter(a => a.id !== id),
    });
  };

  const handleSaveCitation = useCallback(() => {
    if (!currentScreenshot) return;

    const newEvidence: ResearchDocEvidence = {
      id: `ev-${Date.now()}`,
      type: 'screenshot',
      src: currentScreenshot.screenshot,
      caption: currentScreenshot.title || 'Browser Screenshot',
      sourceUrl: currentScreenshot.url,
      timestamp: currentScreenshot.timestamp,
    };

    const newCitation: ResearchDocCitation = {
      id: `cit-${Date.now()}`,
      number: citations.length + 1,
      source: currentScreenshot.title || new URL(currentScreenshot.url).hostname,
      url: currentScreenshot.url,
      timestamp: currentScreenshot.timestamp,
      snippet: currentScreenshot.annotations[0]?.text || 'Visual evidence from webpage',
    };

    updateProgramState<ResearchDocState>(program.id, (prev) => ({
      ...prev,
      evidence: [...(prev.evidence || []), newEvidence],
      citations: [...(prev.citations || []), newCitation],
    }));

    setCurrentScreenshot(null);
    setUrl('');
    addToast({ title: 'Citation saved to document', type: 'success' });
  }, [currentScreenshot, citations.length, program.id, updateProgramState, addToast]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔖</span>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Citation Manager</h2>
        </div>
        <button type="button"
          onClick={() => setShowCitationList(!showCitationList)}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
        >
          {showCitationList ? <X size={20} /> : <Eye size={20} />}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Workspace */}
        <div className="flex-1 flex flex-col overflow-y-auto p-6">
          <ProgramErrorBoundary programName="Citation Manager">
            {!currentScreenshot ? (
              <div className="max-w-xl mx-auto w-full space-y-8 py-12">
                <div className="text-center">
                  <div className="size-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Camera size={32} weight="duotone" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Capture Visual Evidence</h3>
                  <p className="text-zinc-500">Enter a URL to capture a verified screenshot and add it as a citation.</p>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input aria-label="Input" type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com/article"
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                  <button type="button"
                    onClick={handleCapture}
                    disabled={!url.trim() || isCapturing}
                    className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg"
                  >
                    {isCapturing ? (
                      <>
                        <ArrowsClockwise size={18} className="animate-spin" />
                        Capturing...
                      </>
                    ) : (
                      <>
                        <Camera size={18} />
                        Capture
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 text-center">
                    <CheckCircle size={24} className="mx-auto mb-2 text-green-500" />
                    <div className="text-sm font-medium">Verified Source</div>
                    <p className="text-xs text-zinc-500 mt-1">Automatic provenance and archival</p>
                  </div>
                  <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 text-center">
                    <NotePencil size={24} className="mx-auto mb-2 text-yellow-500" />
                    <div className="text-sm font-medium">Visual Annotations</div>
                    <p className="text-xs text-zinc-500 mt-1">Highlight key evidence on the page</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
                {/* Editor Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{currentScreenshot.title || 'New Screenshot'}</h3>
                    <p className="text-xs text-zinc-500 truncate max-w-md">{currentScreenshot.url}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={() => setCurrentScreenshot(null)}
                      className="px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                      Discard
                    </button>
                    <button type="button"
                      onClick={handleSaveCitation}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-all shadow-md"
                    >
                      Save Citation
                    </button>
                  </div>
                </div>

                {/* Canvas */}
                <div className="flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-inner p-4">
                  <div className="max-w-3xl mx-auto shadow-2xl">
                    <AnnotationCanvas
                      screenshot={currentScreenshot.screenshot}
                      annotations={currentScreenshot.annotations}
                      onAddAnnotation={handleAddAnnotation}
                      onRemoveAnnotation={handleRemoveAnnotation}
                    />
                  </div>
                </div>

                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-center gap-3">
                  <div className="size-8 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center shrink-0">
                    <NotePencil size={18} />
                  </div>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Tip:</strong> Click and drag on the screenshot to add highlights or notes to specific areas of the page.
                  </p>
                </div>
              </div>
            )}
          </ProgramErrorBoundary>
        </div>

        {/* Side Panel: Existing Citations */}
        {showCitationList && (
          <aside className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 font-bold text-sm uppercase tracking-wider text-zinc-500 flex justify-between">
              Citations ({citations.length})
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {citations.length === 0 ? (
                <div className="text-center py-12 text-zinc-400">
                  <LinkIcon size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-xs">No citations added yet.</p>
                </div>
              ) : (
                citations.map((cit) => (
                  <div 
                    key={cit.id}
                    className="p-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                        [{cit.number}]
                      </span>
                      <button type="button"
                        className="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        onClick={() => {
                          updateProgramState<ResearchDocState>(program.id, (prev) => ({
                            ...prev,
                            citations: prev.citations.filter(c => c.id !== cit.id),
                          }));
                        }}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate mb-1">
                      {cit.source}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 italic">
                      "{cit.snippet}"
                    </p>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default BrowserScreenshotCitations;
