'use client';

import React, { useState } from 'react';
import { Volume2, FileText, Presentation, HelpCircle, History, Search, Loader2, RefreshCw } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';

interface ToolsPanelProps {
  notebookId: string;
  onGeneratePodcast: () => Promise<{ audio_url: string; duration: number }>;
  onTransform: (type: 'summary' | 'briefing' | 'faq' | 'timeline') => Promise<{ content: string }>;
  onSearchSources: (query: string) => Promise<{ results: any[] }>;
  canvasCourseId?: string;
  canvasToken?: string;
  canvasDomain?: string;
  onCanvasSync?: (courseId: string, token: string, domain: string) => Promise<any>;
}

export function ToolsPanel({
  onGeneratePodcast,
  onTransform,
  onSearchSources,
  canvasCourseId,
  canvasToken,
  canvasDomain,
  onCanvasSync,
}: ToolsPanelProps) {
  const [podcastUrl, setPodcastUrl] = useState<string | null>(null);
  const [podcastLoading, setPodcastLoading] = useState(false);
  const [transformLoading, setTransformLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [userNotes, setUserNotes] = useState('');
  const [canvasSyncLoading, setCanvasSyncLoading] = useState(false);

  const handlePodcast = async () => {
    setPodcastLoading(true);
    try {
      const result = await onGeneratePodcast();
      setPodcastUrl(result.audio_url);
    } catch (e) {
      console.error('Podcast generation failed:', e);
    } finally {
      setPodcastLoading(false);
    }
  };

  const handleTransform = async (type: 'summary' | 'briefing' | 'faq' | 'timeline') => {
    setTransformLoading(type);
    try {
      await onTransform(type);
    } catch (e) {
      console.error('Transform failed:', e);
    } finally {
      setTransformLoading(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const result = await onSearchSources(searchQuery);
      setSearchResults(result.results);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleCanvasSync = async () => {
    if (!canvasCourseId || !canvasToken || !onCanvasSync) return;
    setCanvasSyncLoading(true);
    try {
      await onCanvasSync(canvasCourseId, canvasToken, canvasDomain || 'https://canvas.instructure.com');
    } catch (e) {
      console.error('Canvas sync failed:', e);
    } finally {
      setCanvasSyncLoading(false);
    }
  };

  return (
    <div
      className="research-panel"
      style={{ width: 240, minWidth: 180, borderLeftWidth: 1 }}
    >
      {/* Header */}
      <div className="research-panel-header">Tools</div>

      <div className="flex-1 overflow-y-auto px-3 py-2.5 flex flex-col gap-3">
        {/* Podcast */}
        <div className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--bg-tertiary, #18181b)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Volume2 size={14} color="#a78bfa" />
            <span className="text-xs font-medium text-[var(--text-primary,#e5e5e5)]">Audio Overview</span>
          </div>
          {podcastUrl ? (
            <AudioPlayer src={podcastUrl} title="Generated Podcast" />
          ) : (
            <button
              onClick={handlePodcast}
              disabled={podcastLoading}
              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer"
              style={{
                backgroundColor: 'rgba(167, 139, 250, 0.1)',
                border: '1px solid rgba(167, 139, 250, 0.2)',
                color: '#a78bfa',
              }}
            >
              {podcastLoading && <Loader2 size={12} className="animate-spin" />}
              {podcastLoading ? 'Generating...' : 'Generate Podcast'}
            </button>
          )}
        </div>

        {/* Transformations */}
        <div className="flex flex-col gap-1">
          {([
            { id: 'summary' as const, icon: FileText, label: 'Summary' },
            { id: 'briefing' as const, icon: Presentation, label: 'Briefing Doc' },
            { id: 'faq' as const, icon: HelpCircle, label: 'FAQ' },
            { id: 'timeline' as const, icon: History, label: 'Timeline' },
          ]).map(item => (
            <button
              key={item.id}
              onClick={() => handleTransform(item.id)}
              disabled={transformLoading === item.id}
              className="research-btn-secondary justify-start text-left"
            >
              {transformLoading === item.id ? (
                <Loader2 size={12} className="animate-spin text-purple-400" />
              ) : (
                <item.icon size={12} />
              )}
              {item.label}
            </button>
          ))}
        </div>

        {/* Canvas Sync */}
        {canvasCourseId && canvasToken && onCanvasSync && (
          <div className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--bg-tertiary, #18181b)' }}>
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw size={14} color="#34d399" />
              <span className="text-xs font-medium text-[var(--text-primary,#e5e5e5)]">Canvas</span>
            </div>
            <button
              onClick={handleCanvasSync}
              disabled={canvasSyncLoading}
              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer"
              style={{
                backgroundColor: 'rgba(52, 211, 153, 0.1)',
                border: '1px solid rgba(52, 211, 153, 0.2)',
                color: 'var(--status-success)',
              }}
            >
              {canvasSyncLoading && <Loader2 size={12} className="animate-spin" />}
              {canvasSyncLoading ? 'Syncing...' : 'Sync from Canvas'}
            </button>
          </div>
        )}

        {/* Source Search */}
        <div className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--bg-tertiary, #18181b)' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Search size={12} color="var(--text-muted, #a1a1aa)" />
            <span className="text-[11px] font-medium text-[var(--text-muted,#a1a1aa)]">Search Sources</span>
          </div>
          <div className="flex gap-1">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Ask sources..."
              className="research-input"
            />
            <button
              onClick={handleSearch}
              disabled={searchLoading}
              className="research-btn-secondary px-2 py-1"
            >
              {searchLoading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {searchResults.map((r, i) => (
                <div key={i} className="text-[10px] text-[var(--text-muted,#a1a1aa)] px-1.5 py-1 rounded"
                  style={{ backgroundColor: 'var(--bg-secondary, #111113)' }}
                >
                  {r.excerpt?.slice(0, 80)}...
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Notes */}
        <div className="flex-1 flex flex-col min-h-[100px]">
          <span className="text-[11px] font-medium text-[var(--text-muted,#a1a1aa)] mb-1.5">My Notes</span>
          <textarea
            value={userNotes}
            onChange={e => setUserNotes(e.target.value)}
            placeholder="Jot down insights..."
            className="flex-1 p-2 rounded-md text-xs resize-none leading-relaxed outline-none"
            style={{
              backgroundColor: 'var(--bg-tertiary, #18181b)',
              border: '1px solid var(--border-subtle, #27272a)',
              color: 'var(--text-primary, #e5e5e5)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
