'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { BookOpen, Plus, ChevronDown, Send, Loader2, WifiOff } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { SourcePanel } from './components/SourcePanel';
import { ChatWorkspace } from './components/ChatWorkspace';
import { ToolsPanel } from './components/ToolsPanel';
import { ResearchErrorBoundary } from './components/ErrorBoundary';
import { notebookApi, type Notebook, type Source, type ChatMessage, type Citation } from './hooks/useNotebookApi';

export function ResearchTab() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [highlightedSourceId, setHighlightedSourceId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showToolsOnMobile, setShowToolsOnMobile] = useState(false);

  const activeNotebook = notebooks.find(n => n.id === activeNotebookId);

  // Detect mobile/tablet viewport
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Lazy-start research backend via desktop shell
  useEffect(() => {
    const startBackend = async () => {
      // @ts-ignore — Electron preload bridge
      if (window.allternit?.research?.start) {
        try {
          // @ts-ignore
          await window.allternit.research.start();
        } catch {
          // Backend may already be running
        }
      }
      notebookApi.health()
        .then(() => setApiAvailable(true))
        .catch(() => setApiAvailable(false));
    };
    startBackend();
  }, []);

  // Listen for external notebook open requests
  useEffect(() => {
    const handler = (e: CustomEvent<{ notebookId: string }>) => {
      setActiveNotebookId(e.detail.notebookId);
    };
    window.addEventListener('allternit:research-open-notebook' as any, handler);
    return () => window.removeEventListener('allternit:research-open-notebook' as any, handler);
  }, []);

  // Load notebooks on mount
  useEffect(() => {
    if (!apiAvailable) return;
    notebookApi.listNotebooks()
      .then(data => {
        setNotebooks(data);
        if (data.length > 0 && !activeNotebookId) {
          setActiveNotebookId(data[0].id);
        }
      })
      .catch(console.error);
  }, [apiAvailable]);

  // Load sources when notebook changes
  useEffect(() => {
    if (!activeNotebookId || !apiAvailable) return;
    notebookApi.listSources(activeNotebookId)
      .then(data => setSources(data))
      .catch(console.error);
  }, [activeNotebookId, apiAvailable]);

  // Load messages when notebook changes
  useEffect(() => {
    if (!activeNotebookId || !apiAvailable) return;
    notebookApi.listMessages(activeNotebookId)
      .then(data => {
        const mapped: ChatMessage[] = data.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          citations: m.citations,
          timestamp: m.created_at || m.timestamp,
        }));
        setMessages(mapped);
      })
      .catch(console.error);
  }, [activeNotebookId, apiAvailable]);

  const handleCreateNotebook = useCallback(async () => {
    const title = prompt('Name your research notebook:');
    if (!title) return;
    try {
      const notebook = await notebookApi.createNotebook(title);
      setNotebooks(prev => [...prev, notebook]);
      setActiveNotebookId(notebook.id);
      setMessages([]);
    } catch (e) {
      console.error('Failed to create notebook:', e);
    }
  }, []);

  const handleAddSource = useCallback(async (source: Partial<Source>) => {
    if (!activeNotebookId) return;
    setIsUploading(true);
    try {
      const newSource = await notebookApi.addSource(activeNotebookId, source);
      setSources(prev => [...prev, newSource]);
    } catch (e) {
      console.error('Failed to add source:', e);
    } finally {
      setIsUploading(false);
    }
  }, [activeNotebookId]);

  const handleRemoveSource = useCallback(async (sourceId: string) => {
    if (!activeNotebookId) return;
    try {
      await notebookApi.removeSource(activeNotebookId, sourceId);
      setSources(prev => prev.filter(s => s.id !== sourceId));
    } catch (e) {
      console.error('Failed to remove source:', e);
    }
  }, [activeNotebookId]);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || !activeNotebookId || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    let assistantContent = '';
    let assistantCitations: Citation[] = [];

    try {
      await notebookApi.sendMessage(activeNotebookId, userMessage.content, (chunk) => {
        if (chunk.done) {
          setMessages(prev => {
            const filtered = prev.filter(m => !(m.role === 'assistant' && m.content === ''));
            return [...filtered, {
              role: 'assistant',
              content: assistantContent,
              citations: assistantCitations,
              timestamp: new Date().toISOString(),
            }];
          });
          setIsLoading(false);
          return;
        }

        if (chunk.text) {
          assistantContent += chunk.text;
          setMessages(prev => {
            const others = prev.filter(m => !(m.role === 'assistant' && m.content === assistantContent.slice(0, -chunk.text!.length)));
            const existingIdx = others.findIndex(m => m.role === 'assistant' && m.content.startsWith(assistantContent.slice(0, assistantContent.length - 1)));
            if (existingIdx >= 0) {
              const next = [...others];
              next[existingIdx] = { ...next[existingIdx], content: assistantContent };
              return next;
            }
            return [...others, {
              role: 'assistant',
              content: assistantContent,
              timestamp: new Date().toISOString(),
            }];
          });
        }

        if (chunk.citation) {
          assistantCitations.push(chunk.citation);
        }
      });
    } catch (e) {
      console.error('Chat failed:', e);
      setIsLoading(false);
    }
  }, [inputValue, activeNotebookId, isLoading]);

  const handleGeneratePodcast = useCallback(async () => {
    if (!activeNotebookId) throw new Error('No active notebook');
    return notebookApi.generatePodcast(activeNotebookId);
  }, [activeNotebookId]);

  const handleTransform = useCallback(async (type: 'summary' | 'briefing' | 'faq' | 'timeline') => {
    if (!activeNotebookId) throw new Error('No active notebook');
    return notebookApi.transform(activeNotebookId, type);
  }, [activeNotebookId]);

  const handleSearchSources = useCallback(async (query: string) => {
    if (!activeNotebookId) return { results: [] };
    return notebookApi.search(activeNotebookId, query);
  }, [activeNotebookId]);

  // Canvas sync for course-linked notebooks
  const [canvasMeta, setCanvasMeta] = useState<{ courseId: string; canvasUrl: string } | null>(null);
  const [canvasToken, setCanvasToken] = useState('');
  const [canvasDomain, setCanvasDomain] = useState('https://canvas.instructure.com');

  useEffect(() => {
    if (!activeNotebookId) {
      setCanvasMeta(null);
      return;
    }
    try {
      const raw = localStorage.getItem(`notebook-canvas-${activeNotebookId}`);
      if (raw) {
        setCanvasMeta(JSON.parse(raw));
      } else {
        setCanvasMeta(null);
      }
      // Also read canvas token + domain from labs settings
      const labsConfig = JSON.parse(localStorage.getItem('allternit-labs-config') || '{}');
      setCanvasToken(labsConfig.canvasToken || '');
      setCanvasDomain(labsConfig.canvasDomain || 'https://canvas.instructure.com');
    } catch {
      setCanvasMeta(null);
    }
  }, [activeNotebookId]);

  const handleCanvasSync = useCallback(async (courseId: string, token: string, domain: string) => {
    if (!activeNotebookId) return;
    const result = await notebookApi.canvasSync(activeNotebookId, courseId, token, domain);
    // Refresh sources after sync
    const updatedSources = await notebookApi.listSources(activeNotebookId);
    setSources(updatedSources);
    return result;
  }, [activeNotebookId]);

  const handleCitationClick = useCallback((sourceId: string) => {
    setHighlightedSourceId(sourceId);
    setTimeout(() => setHighlightedSourceId(null), 3000);
  }, []);

  // Backend offline state
  if (apiAvailable === false) {
    return (
      <div className="research-empty-state">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <WifiOff size={28} className="text-red-400" />
        </div>
        <div>
          <p className="text-base font-semibold text-[var(--text-primary,#e5e5e5)] mb-1.5">
            Research engine offline
          </p>
          <p className="text-[13px] max-w-sm">
            The research backend is starting up or unavailable. Please wait a moment and try again.
          </p>
        </div>
        <button
          onClick={() => {
            setApiAvailable(null);
            notebookApi.health().then(() => setApiAvailable(true)).catch(() => setApiAvailable(false));
          }}
          className="research-btn-secondary"
        >
          <Loader2 size={14} />
          Retry Connection
        </button>
      </div>
    );
  }

  // Empty state: no notebooks
  if (notebooks.length === 0 && apiAvailable === true) {
    return (
      <div className="research-empty-state">
        <div className="w-14 h-14 rounded-2xl bg-purple-400/10 flex items-center justify-center">
          <BookOpen size={28} className="text-purple-400" />
        </div>
        <div>
          <p className="text-base font-semibold text-[var(--text-primary,#e5e5e5)] mb-1.5">
            Start Your Research
          </p>
          <p className="text-[13px] max-w-sm">
            Create a notebook, add sources, and chat with your documents using AI-powered insights and citations.
          </p>
        </div>
        <button onClick={handleCreateNotebook} className="research-btn-primary">
          <Plus size={18} />
          Create Notebook
        </button>
      </div>
    );
  }

  return (
    <ResearchErrorBoundary>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Notebook Selector Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
          style={{
            borderBottom: '1px solid var(--border-subtle, #27272a)',
            backgroundColor: 'var(--bg-secondary, #111113)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <button className="research-btn-secondary text-[13px] font-medium"
                style={{
                  backgroundColor: 'var(--bg-tertiary, #18181b)',
                  color: 'var(--text-primary, #e5e5e5)',
                }}
              >
                <BookOpen size={14} color="#a78bfa" />
                {activeNotebook?.title || 'Select Notebook'}
                <ChevronDown size={12} color="var(--text-muted, #a1a1aa)" />
              </button>
            </div>
            <button onClick={handleCreateNotebook} className="research-btn-secondary">
              <Plus size={12} />
              New
            </button>
          </div>

          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={() => setShowToolsOnMobile(!showToolsOnMobile)}
                className="research-btn-secondary"
                style={{
                  backgroundColor: showToolsOnMobile ? 'rgba(167, 139, 250, 0.15)' : undefined,
                }}
              >
                Tools
              </button>
            )}
            <span className="text-[11px] text-[var(--text-muted,#a1a1aa)]">
              {sources.length} sources • {(activeNotebook?.token_count || 0).toLocaleString()} tokens
            </span>
          </div>
        </div>

        {/* 3-Pane Workspace */}
        {isMobile ? (
          /* Mobile layout: stacked */
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex flex-col flex-1 overflow-hidden">
              <ChatWorkspace
                messages={messages}
                isLoading={isLoading}
                onCitationClick={handleCitationClick}
              />
              <div className="research-composer">
                <button className="bg-transparent border-none p-1 text-[var(--text-muted,#a1a1aa)] cursor-pointer" title="Add attachment">
                  <Plus size={18} />
                </button>
                <input
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={activeNotebook ? `Ask about ${activeNotebook.title}...` : 'Select a notebook...'}
                  disabled={!activeNotebook || isLoading}
                  className="research-input"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || !activeNotebook || isLoading}
                  className="research-btn-icon"
                  style={{
                    background: inputValue.trim() && activeNotebook
                      ? 'linear-gradient(135deg, #7c3aed, #a78bfa)'
                      : 'var(--bg-tertiary, #18181b)',
                    opacity: inputValue.trim() && activeNotebook ? 1 : 0.5,
                    cursor: inputValue.trim() && activeNotebook ? 'pointer' : 'not-allowed',
                  }}
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
            {showToolsOnMobile && (
              <div className="h-[200px] border-t border-[var(--border-subtle,#27272a)] overflow-auto">
                <ToolsPanel
                  notebookId={activeNotebookId || ''}
                  onGeneratePodcast={handleGeneratePodcast}
                  onTransform={handleTransform}
                  onSearchSources={handleSearchSources}
                  canvasCourseId={canvasMeta?.canvasUrl?.match(/\/courses\/(\d+)/)?.[1]}
                  canvasToken={canvasToken}
                  canvasDomain={canvasDomain}
                  onCanvasSync={handleCanvasSync}
                />
              </div>
            )}
          </div>
        ) : (
          /* Desktop layout: resizable panels */
          <PanelGroup direction="horizontal" className="flex-1">
            <Panel defaultSize={20} minSize={15} maxSize={40}>
              <SourcePanel
                sources={sources}
                onAddSource={handleAddSource}
                onRemoveSource={handleRemoveSource}
                isUploading={isUploading}
                highlightedSourceId={highlightedSourceId}
                notebookId={activeNotebookId || undefined}
                onSearchResultClick={handleCitationClick}
              />
            </Panel>
            <PanelResizeHandle className="w-1 bg-[var(--border-subtle,#27272a)] cursor-col-resize" />
            <Panel defaultSize={55} minSize={30}>
              <div className="flex flex-col h-full overflow-hidden">
                <ChatWorkspace
                  messages={messages}
                  isLoading={isLoading}
                  onCitationClick={handleCitationClick}
                />
                <div className="research-composer">
                  <button className="bg-transparent border-none p-1 text-[var(--text-muted,#a1a1aa)] cursor-pointer" title="Add attachment">
                    <Plus size={18} />
                  </button>
                  <input
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={activeNotebook ? `Ask about ${activeNotebook.title}...` : 'Select a notebook...'}
                    disabled={!activeNotebook || isLoading}
                    className="research-input"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || !activeNotebook || isLoading}
                    className="research-btn-icon"
                    style={{
                      background: inputValue.trim() && activeNotebook
                        ? 'linear-gradient(135deg, #7c3aed, #a78bfa)'
                        : 'var(--bg-tertiary, #18181b)',
                      opacity: inputValue.trim() && activeNotebook ? 1 : 0.5,
                      cursor: inputValue.trim() && activeNotebook ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </Panel>
            <PanelResizeHandle className="w-1 bg-[var(--border-subtle,#27272a)] cursor-col-resize" />
            <Panel defaultSize={25} minSize={15} maxSize={40}>
              <ToolsPanel
                notebookId={activeNotebookId || ''}
                onGeneratePodcast={handleGeneratePodcast}
                onTransform={handleTransform}
                onSearchSources={handleSearchSources}
                canvasCourseId={canvasMeta?.canvasUrl?.match(/\/courses\/(\d+)/)?.[1]}
                canvasToken={canvasToken}
                canvasDomain={canvasDomain}
                onCanvasSync={handleCanvasSync}
              />
            </Panel>
          </PanelGroup>
        )}
      </div>
    </ResearchErrorBoundary>
  );
}
