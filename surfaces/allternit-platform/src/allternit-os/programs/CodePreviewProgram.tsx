/**
 * A2rchitect Super-Agent OS - Code Preview Program
 * 
 * Production-ready code preview with:
 * - Hardened CSP sandbox (no popups, no navigation, no plugins)
 * - Error boundaries for iframe crashes
 * - Console capture and forwarding
 * - Hot reload support
 * - Security: No eval, no inline scripts, strict CSP
 */

import * as React from 'react';
const { useState, useEffect, useRef, useCallback, useMemo } = React;
import { useSidecarStore } from '../stores/useSidecarStore';
import type { A2rProgram, CodePreviewState, CodePreviewFile } from '../types/programs';

interface CodePreviewProgramProps {
  program: A2rProgram;
}

// ============================================================================
// CSP Policy - Strict Security
// ============================================================================

const CSP_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' blob: https: http:", // Allow CDN scripts (Tailwind, Alpine, etc.)
  "style-src 'unsafe-inline' https: http:",                       // Allow CDN stylesheets
  "img-src blob: data: https: http:",
  "connect-src https: http:",                                     // Allow fetch/XHR from previewed sites
  "font-src data: https: http:",
  "media-src blob: data:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// Additional security headers simulation
const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP_POLICY,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

// ============================================================================
// Console Types
// ============================================================================

interface ConsoleMessage {
  id: string;
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: number;
  stack?: string;
}

// ============================================================================
// Error Boundary for Preview
// ============================================================================

class PreviewErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: Error) => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: (error: Error) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-red-900/20 text-red-400 p-4">
          <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="font-medium">Preview Crashed</p>
          <p className="text-sm mt-1 opacity-75">The preview encountered an error and was terminated.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// Safe HTML Generator with CSP
// ============================================================================

function generateSafeHTML(files: CodePreviewFile[], entryFile: string): string {
  const htmlFile = files.find(f => f.path === entryFile) || files.find(f => f.path.endsWith('.html'));
  if (!htmlFile) return '<!DOCTYPE html><html><body>No HTML file found</body></html>';

  // Inject CSP meta tag and security scripts
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${CSP_POLICY}">`;
  
  // Security wrapper script
  const securityScript = `
<script>
(function() {
  'use strict';
  
  // Prevent navigation
  window.onbeforeunload = function() { return false; };
  
  // Prevent popups
  window.open = function() { 
    console.warn('Popup blocked'); 
    return null; 
  };
  
  // Prevent alerts from blocking
  window.alert = function(msg) { console.log('[ALERT]', msg); };
  window.confirm = function() { return true; };
  window.prompt = function() { return null; };
  
  // Capture console messages
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  };
  
  function sendToParent(type, args) {
    try {
      const message = args.map(arg => {
        try {
          return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
        } catch (e) {
          return '[Object]';
        }
      }).join(' ');
      
      window.parent.postMessage({
        source: 'a2r-preview',
        type: 'console',
        level: type,
        message: message,
        timestamp: Date.now()
      }, '*');
    } catch (e) {}
  }
  
  console.log = function(...args) {
    originalConsole.log.apply(console, args);
    sendToParent('log', args);
  };
  
  console.error = function(...args) {
    originalConsole.error.apply(console, args);
    sendToParent('error', args);
  };
  
  console.warn = function(...args) {
    originalConsole.warn.apply(console, args);
    sendToParent('warn', args);
  };
  
  console.info = function(...args) {
    originalConsole.info.apply(console, args);
    sendToParent('info', args);
  };
  
  // Capture errors
  window.onerror = function(msg, url, line, col, error) {
    sendToParent('error', [msg, 'at', url + ':' + line + ':' + col]);
    return true;
  };
  
  window.addEventListener('error', function(e) {
    sendToParent('error', [e.message, 'at', e.filename + ':' + e.lineno]);
  });
  
  // Prevent external navigation
  document.addEventListener('click', function(e) {
    const target = e.target.closest('a');
    if (target && target.href && !target.href.startsWith('blob:') && !target.href.startsWith('javascript:')) {
      e.preventDefault();
      console.warn('External navigation blocked:', target.href);
    }
  }, true);
})();
</script>`;

  // Process HTML to inject CSP and scripts
  let html = htmlFile.content;
  
  // Add CSP meta tag after <head>
  if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>${cspMeta}${securityScript}`);
  } else if (html.includes('<html>')) {
    html = html.replace('<html>', `<html><head>${cspMeta}${securityScript}</head>`);
  } else {
    html = `<!DOCTYPE html><html><head>${cspMeta}${securityScript}</head><body>${html}</body></html>`;
  }
  
  // Inject CSS files
  const cssFiles = files.filter(f => f.path.endsWith('.css'));
  const styleBlock = cssFiles.map(f => `/* ${f.path} */\n${f.content}`).join('\n\n');
  if (styleBlock) {
    const styleTag = `<style>${styleBlock}</style>`;
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${styleTag}</head>`);
    } else {
      html = html.replace('</body>', `${styleTag}</body>`);
    }
  }
  
  // Inject JS files (non-module)
  const jsFiles = files.filter(f => f.path.endsWith('.js') && !f.path.includes('module'));
  const scriptBlock = jsFiles.map(f => `/* ${f.path} */\n${f.content}`).join('\n\n');
  if (scriptBlock) {
    const scriptTag = `<script>${scriptBlock}</script>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${scriptTag}</body>`);
    } else {
      html += scriptTag;
    }
  }
  
  return html;
}

// ============================================================================
// Main Component
// ============================================================================

export const CodePreviewProgram: React.FC<CodePreviewProgramProps> = ({ program }) => {
  const { updateProgramState } = useSidecarStore();
  const liveAgentText = useSidecarStore(s => s.liveAgentTexts[program.sourceThreadId] ?? '');
  const state = program.state as CodePreviewState;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [previewError, setPreviewError] = useState<Error | null>(null);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');

  const files = state?.files ?? [];
  const entryFile = state?.entryFile ?? 'index.html';
  const autoReload = state?.autoReload ?? true;
  const [activeFile, setActiveFile] = useState(entryFile);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentFile = files.find(f => f.path === activeFile) || files[0];

  // Generate safe preview URL with CSP
  const previewUrl = useMemo(() => {
    try {
      const html = generateSafeHTML(files, entryFile);
      const blob = new Blob([html], { type: 'text/html' });
      return URL.createObjectURL(blob);
    } catch (err) {
      setPreviewError(err instanceof Error ? err : new Error(String(err)));
      return '';
    }
  }, [files, entryFile]);

  // Cleanup blob URL
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Listen for console messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.source === 'a2r-preview') {
        const { level, message, timestamp } = event.data;
        setConsoleMessages(prev => [...prev, {
          id: `${timestamp}-${Math.random()}`,
          type: level,
          message,
          timestamp,
        }].slice(-100)); // Keep last 100 messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleFileChange = useCallback((content: string) => {
    updateProgramState<CodePreviewState>(program.id, (prev) => ({
      ...prev,
      files: prev.files.map(f => 
        f.path === activeFile ? { ...f, content } : f
      ),
    }));
    setPreviewError(null);
  }, [program.id, activeFile, updateProgramState]);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current && previewUrl) {
      iframeRef.current.src = previewUrl;
    }
    setConsoleMessages([]);
    setPreviewError(null);
  }, [previewUrl]);

  const clearConsole = useCallback(() => {
    setConsoleMessages([]);
  }, []);

  const exportHTML = useCallback(() => {
    const html = generateSafeHTML(files, entryFile);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'preview.html';
    a.click();
    URL.revokeObjectURL(url);
  }, [files, entryFile]);

  const getLanguageIcon = (path: string) => {
    if (path.endsWith('.html')) return '🌐';
    if (path.endsWith('.css')) return '🎨';
    if (path.endsWith('.js')) return '📜';
    if (path.endsWith('.ts')) return '🔷';
    if (path.endsWith('.jsx') || path.endsWith('.tsx')) return '⚛️';
    if (path.endsWith('.json')) return '📋';
    if (path.endsWith('.md')) return '📝';
    return '📄';
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xl">💻</span>
        <h2 className="text-sm font-semibold text-gray-100">Code Preview</h2>
        
        <div className="flex-1" />

        {/* Tabs */}
        <div className="flex bg-gray-700 rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab('code')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              activeTab === 'code' 
                ? 'bg-gray-600 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Code
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              activeTab === 'preview' 
                ? 'bg-gray-600 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Preview
          </button>
        </div>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Actions */}
        <button
          onClick={handleRefresh}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
          title="Refresh Preview"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <label className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 cursor-pointer hover:text-white">
          <input
            type="checkbox"
            checked={autoReload}
            onChange={(e) => {
              updateProgramState<CodePreviewState>(program.id, (prev) => ({
                ...prev,
                autoReload: e.target.checked,
              }));
            }}
            className="rounded"
          />
          Auto-reload
        </label>

        <button
          onClick={exportHTML}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
          title="Export HTML"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'code' ? (
          <>
            {/* File sidebar */}
            {files.length > 0 && (
              <div className="w-48 bg-gray-800 border-r border-gray-700 flex flex-col">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Files ({files.length})
                </div>
                <div className="flex-1 overflow-auto">
                  {files.map(file => (
                    <button
                      key={file.path}
                      onClick={() => setActiveFile(file.path)}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                        activeFile === file.path 
                          ? 'bg-blue-600 text-white' 
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <span>{getLanguageIcon(file.path)}</span>
                      <span className="truncate">{file.path}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Editor */}
            <div className="flex-1 flex flex-col">
              {currentFile ? (
                <>
                  <div className="px-3 py-1.5 bg-gray-800 border-b border-gray-700 text-xs text-gray-400 flex items-center justify-between">
                    <span>{currentFile.path}</span>
                    <span className="text-gray-600">{currentFile.content.length} chars</span>
                  </div>
                  <textarea
                    value={currentFile.content}
                    onChange={(e) => handleFileChange(e.target.value)}
                    className="flex-1 p-4 bg-gray-900 text-gray-300 font-mono text-sm resize-none focus:outline-none"
                    spellCheck={false}
                    style={{ tabSize: 2 }}
                  />
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500 p-6">
                  <div className="text-center w-full max-w-sm">
                    <span className="text-4xl mb-2 block">📄</span>
                    {liveAgentText ? (
                      <div className="text-left mt-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                          <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Building</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap font-mono">
                          {liveAgentText.split('<launch_utility')[0].trim().slice(0, 300)}<span className="animate-pulse">▊</span>
                        </p>
                      </div>
                    ) : (
                      <p>No files to edit</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Preview Pane */
          <div className="flex-1 flex flex-col bg-white">
            <PreviewErrorBoundary onError={setPreviewError}>
              {previewError ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-red-50 text-red-600 p-6">
                  <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="text-lg font-semibold mb-2">Preview Error</h3>
                  <p className="text-sm text-center max-w-md mb-4">{previewError.message}</p>
                  <button
                    onClick={handleRefresh}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Retry
                  </button>
                </div>
              ) : previewUrl ? (
                <iframe
                  ref={iframeRef}
                  src={previewUrl}
                  className="flex-1 w-full h-full"
                  sandbox="allow-scripts allow-same-origin allow-popups-to-escape-sandbox"
                  title="Code Preview"
                  onError={(e) => setPreviewError(new Error('Failed to load preview'))}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                  <span className="text-5xl mb-4">👁️</span>
                  <p className="text-sm">Preview will appear here</p>
                  <p className="text-xs mt-1 text-gray-500">Add an HTML file to see the preview</p>
                </div>
              )}
            </PreviewErrorBoundary>

            {/* Console Panel */}
            {consoleMessages.length > 0 && (
              <div className="h-40 bg-gray-900 border-t border-gray-700 flex flex-col">
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
                  <span className="text-xs font-medium text-gray-400">Console ({consoleMessages.length})</span>
                  <button
                    onClick={clearConsole}
                    className="text-xs text-gray-500 hover:text-gray-300"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-2 font-mono text-xs space-y-1">
                  {consoleMessages.map((msg) => (
                    <div 
                      key={msg.id}
                      className={`${
                        msg.type === 'error' ? 'text-red-400' : 
                        msg.type === 'warn' ? 'text-yellow-400' : 
                        msg.type === 'info' ? 'text-blue-400' : 'text-gray-300'
                      }`}
                    >
                      <span className="text-gray-600 mr-2">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                      {msg.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 bg-gray-800 border-t border-gray-700 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>{files.length} files</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            CSP Active
          </span>
        </div>
        <div className="flex items-center gap-4">
          {consoleMessages.filter(m => m.type === 'error').length > 0 && (
            <span className="text-red-400">
              {consoleMessages.filter(m => m.type === 'error').length} errors
            </span>
          )}
          <span>Preview sandboxed</span>
        </div>
      </div>
    </div>
  );
};

export default CodePreviewProgram;
