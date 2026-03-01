import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import {
  A2RCommandProvider,
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
  TaskDock,
  useRunnerStore,
} from '@a2r/platform';
import { X, CaretDown, CaretUp, Globe, Microphone, Paperclip, Atom, Robot, EyeSlash, TerminalWindow, AppWindow, Check, Command, Brain, Terminal, Cpu, Gear } from '@phosphor-icons/react';
import { RuntimeSettingsPanel } from './components/RuntimeSettingsPanel';
import { CapsuleManager } from './components/CapsuleManager';
import './index.css';

// Terminal Server API URL
const TERMINAL_SERVER_URL = import.meta.env.VITE_TERMINAL_SERVER_URL || 'http://127.0.0.1:4096';

// Model type from Terminal Server
interface TerminalModel {
  id: string;
  name: string;
  provider: string;
  category: string;
}

interface TerminalProvider {
  id: string;
  name: string;
  models: Record<string, {
    id: string;
    name: string;
    family?: string;
    reasoning?: boolean;
    tool_call?: boolean;
  }>;
}

function FloatingPanel({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="invoke-panel">
      <button
        className="invoke-panel-bar invoke-no-drag"
        onClick={onToggle}
        aria-expanded={open}
      >
        <div className="invoke-panel-title">
          <span>{title}</span>
          {typeof count === 'number' && <span className="invoke-panel-count">{count}</span>}
        </div>
        {open ? <CaretUp size={16} /> : <CaretDown size={16} />}
      </button>
      {open && <div className="invoke-panel-body invoke-no-drag">{children}</div>}
    </div>
  );
}

function TraceList({ entries }: { entries: { id: string; title: string; detail?: string; status?: string; kind?: string }[] }) {
  if (!entries.length) {
    return <div className="invoke-panel-empty">No trace yet.</div>;
  }

  return (
    <div className="invoke-trace-list">
      {entries.map((entry) => (
        <div key={entry.id} className="invoke-trace-row">
          <div className="invoke-trace-meta">
            <span>{entry.kind || 'trace'}</span>
            {entry.status && <span className="invoke-trace-status">{entry.status}</span>}
          </div>
          <div className="invoke-trace-title">{entry.title}</div>
          {entry.detail && <div className="invoke-trace-detail">{entry.detail}</div>}
        </div>
      ))}
    </div>
  );
}

// Fallback models if terminal server is not available
const FALLBACK_MODELS: TerminalModel[] = [
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI", category: "pro" },
  { id: "anthropic/claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", category: "pro" },
  { id: "google/gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "Google", category: "pro" },
];

// Get icon based on category
function getModelIcon(category: string) {
  switch (category) {
    case 'cli': return <Command size={12} weight="bold" />;
    case 'code': return <Terminal size={12} weight="bold" />;
    case 'local': return <Cpu size={12} weight="bold" />;
    case 'reasoning': return <Brain size={12} weight="bold" />;
    default: return <Atom size={12} weight="bold" />;
  }
}

// Group models by category for display
const MODEL_CATEGORIES: Record<string, string> = {
  cli: "CLI Tools",
  pro: "Pro Models",
  fast: "Fast Models",
  reasoning: "Reasoning",
  code: "Code Models",
  balanced: "Balanced",
  vision: "Vision",
  local: "Local (Ollama)",
  direct: "Direct",
};

// Determine model category based on model properties
function getModelCategory(modelId: string, modelData: any): string {
  const id = modelId.toLowerCase();
  if (id.includes('reasoning') || id.includes('thinking') || id.includes('r1')) return 'reasoning';
  if (id.includes('code') || id.includes('coder')) return 'code';
  if (id.includes('mini') || id.includes('flash') || id.includes('haiku')) return 'fast';
  if (id.includes('opus') || id.includes('pro') || id.includes('4o') || id.includes('gpt-5')) return 'pro';
  if (id.includes('ollama') || id.includes('local')) return 'local';
  return 'balanced';
}

function ModelSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [models, setModels] = useState<TerminalModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const selected = models.find((m) => m.id === value) || models[0] || FALLBACK_MODELS[0];

  // Fetch models from Terminal Server
  useEffect(() => {
    async function fetchModels() {
      try {
        setLoading(true);
        const response = await fetch(`${TERMINAL_SERVER_URL}/provider`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Transform Terminal Server provider data to model list
        const transformedModels: TerminalModel[] = [];
        
        if (data.all && Array.isArray(data.all)) {
          data.all.forEach((provider: TerminalProvider) => {
            if (provider.models && typeof provider.models === 'object') {
              Object.entries(provider.models).forEach(([modelId, modelData]: [string, any]) => {
                transformedModels.push({
                  id: `${provider.id}/${modelId}`,
                  name: modelData.name || modelId,
                  provider: provider.name || provider.id,
                  category: getModelCategory(modelId, modelData),
                });
              });
            }
          });
        }
        
        if (transformedModels.length > 0) {
          setModels(transformedModels);
        } else {
          setModels(FALLBACK_MODELS);
        }
      } catch (err) {
        console.error('Failed to fetch models from Terminal Server:', err);
        setError('Using fallback models');
        setModels(FALLBACK_MODELS);
      } finally {
        setLoading(false);
      }
    }
    
    fetchModels();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Group models by category
  const groupedModels = models.reduce((acc, model) => {
    const cat = model.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(model);
    return acc;
  }, {} as Record<string, TerminalModel[]>);

  // Sort categories
  const categoryOrder = ['pro', 'fast', 'reasoning', 'code', 'balanced', 'vision', 'local', 'cli'];
  const sortedCategories = Object.keys(groupedModels).sort((a, b) => {
    const indexA = categoryOrder.indexOf(a);
    const indexB = categoryOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--rail-hover)] transition-colors disabled:opacity-50"
        title={error || `Terminal Server: ${TERMINAL_SERVER_URL}`}
      >
        <span className="flex items-center gap-1">
          {loading ? <Cpu size={12} className="animate-spin" /> : getModelIcon(selected?.category || '')}
          {selected?.name || 'Select Model'}
        </span>
        <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <CaretDown size={12} />
        </span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-72 max-h-96 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-2">
            {loading ? (
              <div className="px-2 py-4 text-xs text-gray-500 text-center">
                <Cpu size={16} className="animate-spin mx-auto mb-2" />
                Loading models from Terminal Server...
              </div>
            ) : (
              <>
                {sortedCategories.map((category) => (
                  <div key={category} className="mb-2">
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                      {MODEL_CATEGORIES[category] || category}
                    </div>
                    {groupedModels[category].map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          onChange(model.id);
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors ${
                          model.id === value
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <span className="text-gray-400">{getModelIcon(model.category || '')}</span>
                        <span className="flex-1 text-left truncate" title={model.id}>
                          {model.name}
                        </span>
                        <span className="text-[9px] text-gray-400">{model.provider}</span>
                        {model.id === value && (
                          <span className="text-blue-500">
                            <Check size={12} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Invoke prompt input using ai-elements
function InvokePromptInput({
  draft,
  setDraft,
  model,
  setModel,
  onSend,
}: {
  draft: string;
  setDraft: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  onSend: () => void;
}) {
  const [useWebSearch, setUseWebSearch] = useState(false);

  const handleSubmit = () => {
    if (draft.trim()) {
      onSend();
    }
  };

  return (
    <PromptInput onSubmit={handleSubmit} className="bg-[var(--glass-bg-thick)] border border-[var(--border-strong)] shadow-lg">
      <PromptInputTextarea
        value={draft}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value)}
        placeholder="Ask anything..."
      />
      <PromptInputFooter>
        <PromptInputTools>
          <PromptInputButton type="button" variant="ghost" size="icon-sm">
            <Paperclip size={18} />
          </PromptInputButton>
          <PromptInputButton type="button" variant="ghost" size="icon-sm">
            <Microphone size={18} />
          </PromptInputButton>
          <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
          <ModelSelector value={model} onChange={setModel} />
          <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
          <PromptInputButton
            type="button"
            variant={useWebSearch ? "default" : "ghost"}
            size="icon-sm"
            onClick={() => setUseWebSearch(!useWebSearch)}
          >
            <Globe size={18} />
          </PromptInputButton>
          <PromptInputButton type="button" variant="ghost" size="icon-sm">
            <Atom size={18} />
          </PromptInputButton>
          <PromptInputButton type="button" variant="ghost" size="icon-sm">
            <Robot size={18} />
          </PromptInputButton>
          <PromptInputButton type="button" variant="ghost" size="icon-sm">
            <EyeSlash size={18} />
          </PromptInputButton>
          <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
          <PromptInputButton type="button" variant="ghost" size="icon-sm">
            <TerminalWindow size={18} />
          </PromptInputButton>
          <PromptInputButton type="button" variant="ghost" size="icon-sm">
            <AppWindow size={18} />
          </PromptInputButton>
        </PromptInputTools>
        <PromptInputSubmit disabled={!draft.trim()} />
      </PromptInputFooter>
    </PromptInput>
  );
}


function InvokeRoot() {
  const { draft, setDraft, submit, activeRun, trace, modelId, setModelId } = useRunnerStore();
  const [expanded, setExpanded] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [capsulesOpen, setCapsulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.setAttribute('data-theme', 'light');
    document.documentElement.style.backgroundColor = 'transparent';
    document.body.style.backgroundColor = 'transparent';
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const footer = footerRef.current;
    if (!root || !footer || typeof ResizeObserver === 'undefined') return;
    const updateMetrics = () => {
      const footerHeight = footer.getBoundingClientRect().height;
      const rootHeight = root.getBoundingClientRect().height;
      root.style.setProperty('--invoke-footer-height', `${footerHeight}px`);
      root.style.setProperty('--invoke-window-height', `${rootHeight}px`);
    };
    updateMetrics();
    const observer = new ResizeObserver(updateMetrics);
    observer.observe(root);
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const outputText = useMemo(() => {
    if (!activeRun) return "Received. I'm starting to work on your request now.";
    return activeRun.output || "Received. I'm starting to work on your request now.";
  }, [activeRun]);

  const setExpandedState = (next: boolean) => {
    setExpanded(next);
    const invokeApi = (window as any).a2Invoke;
    if (invokeApi && typeof invokeApi.setExpanded === 'function') {
      invokeApi.setExpanded(next);
    }
  };

  const handleSend = async () => {
    if (!draft.trim()) return;
    setExpandedState(true);
    await submit();
    setDraft('');
  };

  const handleClose = () => {
    setExpandedState(false);
    setTraceOpen(false);
    setTasksOpen(false);
    const invokeApi = (window as any).a2Invoke;
    if (invokeApi && typeof invokeApi.close === 'function') {
      invokeApi.close();
    }
  };

  const handlePopToApp = () => {
    window.dispatchEvent(new CustomEvent('a2r:invoke:pop', { detail: { runId: activeRun?.id } }));
  };

  const handleNewChat = () => {
    useRunnerStore.setState({ activeRun: undefined, trace: [], draft: '' });
    setExpandedState(false);
    setTraceOpen(false);
    setTasksOpen(false);
  };

  return (
    <A2RCommandProvider options={{ disableDefaultShortcut: true }}>
      <div ref={rootRef} className="invoke-root">
        <div className={`invoke-surface ${expanded ? 'invoke-surface--expanded' : ''}`}>
          <div className="invoke-drag-strip" />

          {expanded && (
            <div className="invoke-output">
              <div className="invoke-output-header invoke-drag">
                <button className="invoke-icon-btn invoke-no-drag" onClick={handleClose} aria-label="Close">
                  <X size={16} />
                </button>
                <div className="invoke-header-title">
                  {activeRun?.prompt ? activeRun.prompt.slice(0, 64) : 'Invocation'}
                </div>
                <div className="invoke-header-actions">
                  <button 
                    className="invoke-icon-btn invoke-no-drag" 
                    onClick={() => setSettingsOpen(true)}
                    aria-label="Settings"
                    title="Runtime Settings"
                  >
                    <Gear size={16} />
                  </button>
                  <button className="invoke-header-btn invoke-no-drag" onClick={handlePopToApp}>
                    Pop to App
                  </button>
                  <button className="invoke-header-btn invoke-no-drag" onClick={handleNewChat}>
                    New Chat
                  </button>
                </div>
              </div>
              <div className="invoke-output-body invoke-no-drag">
                <div className="invoke-output-status">
                  {activeRun
                    ? `Thinking Process · ${((Date.now() - activeRun.startedAt) / 1000).toFixed(2)}s`
                    : 'Thinking Process'}
                </div>
                <pre className="invoke-output-text">{outputText}</pre>
              </div>
            </div>
          )}

          <div ref={footerRef} className={`invoke-footer ${expanded ? 'invoke-footer--expanded' : ''}`}>
            <div className="invoke-input invoke-no-drag">
              <InvokePromptInput
                draft={draft}
                setDraft={setDraft}
                model={modelId}
                setModel={setModelId}
                onSend={handleSend}
              />
            </div>
            <div className="invoke-disclaimer">AI can make mistakes. Please verify important information.</div>
          </div>
        </div>

        {expanded && (
          <div className="invoke-overlay-layer">
            <div className="invoke-panels invoke-no-drag">
              <FloatingPanel
                title="Thought Trace"
                count={trace.length}
                open={traceOpen}
                onToggle={() => setTraceOpen(!traceOpen)}
              >
                <TraceList entries={trace} />
              </FloatingPanel>
              <FloatingPanel title="Task Dock" open={tasksOpen} onToggle={() => setTasksOpen(!tasksOpen)}>
                <div className="invoke-panel-scroll">
                  <TaskDock variant="panel" showActions={false} maxItems={Number.MAX_SAFE_INTEGER} />
                </div>
              </FloatingPanel>
              <FloatingPanel 
                title="Capsules" 
                count={0}
                open={capsulesOpen} 
                onToggle={() => setCapsulesOpen(!capsulesOpen)}
              >
                <div className="invoke-panel-scroll">
                  <CapsuleManager />
                </div>
              </FloatingPanel>
            </div>
          </div>
        )}
      </div>

      {/* Runtime Settings Panel */}
      <RuntimeSettingsPanel 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
      />

      <style>{`
        .invoke-root {
          height: 100%;
          width: 100%;
          padding: 14px;
          box-sizing: border-box;
          background: transparent;
          position: relative;
          --invoke-edge: 14px;
        }
        .invoke-surface {
          height: 100%;
          width: 100%;
          border-radius: 24px;
          background: transparent;
          border: 1px solid transparent;
          box-shadow: none;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          -webkit-app-region: drag;
        }
        .invoke-surface--expanded {
          background: var(--bg-primary);
          border: 1px solid var(--border-subtle);
          box-shadow: 0 22px 60px rgba(0,0,0,0.18);
        }
        .invoke-no-drag { -webkit-app-region: no-drag; }
        .invoke-drag { -webkit-app-region: drag; }
        .invoke-drag-strip {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 16px;
          -webkit-app-region: drag;
          z-index: 2;
        }
        .invoke-output {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 6px 0 0 0;
          min-height: 0;
          animation: invokeOutputIn 0.18s ease;
        }
        .invoke-output-header {
          display: flex;
          align-items: center;
          padding: 10px 16px;
          border-bottom: 1px solid var(--border-subtle);
          gap: 12px;
        }
        .invoke-icon-btn {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: none;
          background: rgba(0,0,0,0.05);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .invoke-header-title {
          flex: 1;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-tertiary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .invoke-header-actions {
          display: flex;
          gap: 8px;
        }
        .invoke-header-btn {
          border: none;
          background: rgba(0,0,0,0.05);
          color: var(--text-primary);
          font-size: 11px;
          font-weight: 600;
          padding: 6px 10px;
          border-radius: 10px;
          cursor: pointer;
        }
        .invoke-output-body {
          flex: 1;
          padding: 16px 18px 130px 18px;
          overflow: auto;
          min-height: 0;
        }
        .invoke-output-status {
          font-size: 12px;
          color: var(--text-tertiary);
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .invoke-output-text {
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-primary);
          white-space: pre-wrap;
          margin: 0;
        }
        .invoke-footer {
          position: relative;
          padding: 16px;
          background: transparent;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .invoke-footer--expanded {
          border-top: 1px solid var(--border-subtle);
          background: var(--bg-primary);
        }
        .invoke-overlay-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 6;
        }
        .invoke-panels {
          position: absolute;
          left: calc(var(--invoke-edge) + 16px);
          right: calc(var(--invoke-edge) + 16px);
          bottom: calc(var(--invoke-edge) + var(--invoke-footer-height, 120px) + 10px);
          display: flex;
          gap: 12px;
          align-items: flex-end;
          pointer-events: none;
        }
        .invoke-panel {
          flex: 1;
          min-width: 0;
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 8px;
          pointer-events: auto;
        }
        .invoke-panel-bar {
          height: 36px;
          border-radius: 14px;
          border: 1px solid var(--border-subtle);
          background: rgba(255,255,255,0.9);
          backdrop-filter: blur(14px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(0,0,0,0.12);
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .invoke-panel-bar:hover {
          box-shadow: 0 14px 28px rgba(0,0,0,0.14);
          transform: translateY(-1px);
        }
        .invoke-panel-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .invoke-panel-count {
          padding: 2px 6px;
          border-radius: 999px;
          background: rgba(0,0,0,0.06);
          font-size: 11px;
          color: var(--text-tertiary);
        }
        .invoke-panel-body {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 44px;
          max-height: calc(var(--invoke-window-height, 520px) - var(--invoke-footer-height, 120px) - var(--invoke-edge) - 90px);
          overflow-y: auto;
          border-radius: 16px;
          border: 1px solid var(--border-subtle);
          background: rgba(255,255,255,0.98);
          backdrop-filter: blur(16px);
          box-shadow: 0 18px 40px rgba(0,0,0,0.14);
          padding: 12px;
          transform-origin: bottom;
          animation: invokePanelPop 0.16s ease;
        }
        .invoke-panel-scroll {
          max-height: 210px;
          overflow-y: auto;
        }
        .invoke-panel-empty {
          font-size: 12px;
          color: var(--text-tertiary);
          padding: 6px 4px;
        }
        .invoke-trace-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .invoke-trace-row {
          background: rgba(255,255,255,0.9);
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 12px;
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .invoke-trace-meta {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: var(--text-tertiary);
          text-transform: uppercase;
        }
        .invoke-trace-status {
          color: var(--text-secondary);
        }
        .invoke-trace-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .invoke-trace-detail {
          font-size: 11px;
          color: var(--text-secondary);
          white-space: pre-wrap;
        }
        .invoke-input {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .invoke-disclaimer {
          text-align: center;
          font-size: 11px;
          color: var(--text-tertiary);
          opacity: 0.6;
        }
        @keyframes invokePanelPop {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes invokeOutputIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </A2RCommandProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InvokeRoot />
  </React.StrictMode>
);
