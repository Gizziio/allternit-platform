/**
 * CodeRenderer.tsx
 * 
 * Renders code artifacts with live preview.
 * Split view: code editor + iframe/WebContainer preview.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Code, 
  Play, 
  Download, 
  Share2, 
  Copy, 
  Check,
  Monitor,
  FileCode,
  Maximize2,
  RefreshCw,
  Terminal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ArtifactUIPart } from '@/lib/ai/rust-stream-adapter';
import { cn } from '@/lib/utils';

interface CodeRendererProps {
  artifact: ArtifactUIPart;
  sessionId?: string;
  onMoATaskUpdate?: (tasks: any[]) => void;
}

export function CodeRenderer({
  artifact,
  sessionId,
  onMoATaskUpdate,
}: CodeRendererProps) {
  const [showPreview, setShowPreview] = useState(true);
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState<'split' | 'code' | 'preview'>('split');
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [previewKey, setPreviewKey] = useState(0); // Force iframe refresh
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Extract code and language
  const { code, language, title } = useMemo(() => {
    if (!artifact.content) {
      return {
        code: '// Code will appear here...',
        language: 'javascript',
        title: artifact.title || 'Untitled Code',
      };
    }

    // Detect language from content or artifact metadata
    const content = artifact.content;
    let lang = 'plaintext';
    
    if (content.includes('<!DOCTYPE html') || content.includes('<html')) {
      lang = 'html';
    } else if (content.includes('import React') || content.includes('export default function')) {
      lang = 'jsx';
    } else if (content.includes('function ') || content.includes('const ') || content.includes('=>')) {
      lang = 'javascript';
    } else if (content.includes('import ') && content.includes('from ')) {
      lang = 'typescript';
    } else if (content.includes('def ') || content.includes('import ')) {
      lang = 'python';
    } else if (content.includes('fn ') || content.includes('let mut')) {
      lang = 'rust';
    }

    return {
      code: content,
      language: lang,
      title: artifact.title || 'Untitled Code',
    };
  }, [artifact.content, artifact.title]);

  // Handle copy
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate preview HTML (for HTML/JS code)
  const previewSrc = useMemo(() => {
    if (language === 'html' || language === 'jsx') {
      const htmlContent = code;
      const blob = new Blob([htmlContent], { type: 'text/html' });
      return URL.createObjectURL(blob);
    }
    
    // For JavaScript, wrap in HTML
    if (language === 'javascript') {
      const html = `<!DOCTYPE html>
<html>
<head>
  <style>body { font-family: system-ui; padding: 20px; }</style>
</head>
<body>
  <div id="app"></div>
  <script>
    try {
      ${code}
    } catch (e) {
      document.body.innerHTML = '<pre style="color: red;">' + e.message + '</pre>';
    }
  </script>
</body>
</html>`;
      const blob = new Blob([html], { type: 'text/html' });
      return URL.createObjectURL(blob);
    }
    
    return null;
  }, [code, language]);

  // Run code (for supported languages)
  const handleRun = () => {
    setIsRunning(true);
    setConsoleOutput([]);
    
    // Capture console.log output
    const logs: string[] = [];
    
    if (language === 'javascript' || language === 'jsx') {
      try {
        // Create a safe execution context
        const mockConsole = {
          log: (...args: any[]) => logs.push(args.join(' ')),
          error: (...args: any[]) => logs.push('ERROR: ' + args.join(' ')),
          warn: (...args: any[]) => logs.push('WARN: ' + args.join(' ')),
        };
        
        // Execute in iframe for isolation
        if (iframeRef.current) {
          const iframe = iframeRef.current;
          const iframeDoc = iframe.contentDocument;
          if (iframeDoc) {
            const script = iframeDoc.createElement('script');
            script.textContent = `
              console.log = function(...args) { window.parent.postMessage({type: 'console', level: 'log', args}, '*'); };
              console.error = function(...args) { window.parent.postMessage({type: 'console', level: 'error', args}, '*'); };
              ${code}
            `;
            iframeDoc.body.appendChild(script);
          }
        }
        
        setTimeout(() => {
          setConsoleOutput(logs);
          setIsRunning(false);
        }, 500);
      } catch (e: any) {
        setConsoleOutput([`ERROR: ${e.message}`]);
        setIsRunning(false);
      }
    }
  };

  // Refresh preview
  const handleRefresh = () => {
    setPreviewKey(prev => prev + 1);
  };

  // Listen for console messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'console') {
        const { level, args } = event.data;
        setConsoleOutput(prev => [...prev, `${level.toUpperCase()}: ${args.join(' ')}`]);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Render code with syntax highlighting
  const renderCode = () => {
    const lines = code.split('\n');
    
    return (
      <div className="font-mono text-sm">
        {lines.map((line, index) => (
          <div key={index} className="flex">
            <div className="w-10 flex-shrink-0 text-right pr-3 text-[var(--text-tertiary)] select-none border-r border-[var(--border-subtle)]">
              {index + 1}
            </div>
            <div className="flex-1 pl-3 text-[var(--text-secondary)]">
              {highlightSyntax(line, language)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Improved syntax highlighting
  const highlightSyntax = (line: string, lang: string) => {
    const keywords = ['import', 'export', 'from', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'extends', 'default', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'typeof', 'instanceof', 'switch', 'case', 'break', 'continue'];
    const builtins = ['console', 'document', 'window', 'Promise', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Map', 'Set', 'JSON', 'Math', 'Date', 'RegExp', 'Error'];
    
    let highlighted = line;
    
    // Escape HTML
    highlighted = highlighted
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Keywords
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      highlighted = highlighted.replace(
        regex,
        `<span class="text-[var(--accent-primary)]">${keyword}</span>`
      );
    });

    // Builtins
    builtins.forEach(builtin => {
      const regex = new RegExp(`\\b${builtin}\\b`, 'g');
      highlighted = highlighted.replace(
        regex,
        `<span class="text-blue-400">${builtin}</span>`
      );
    });
    
    // Strings (single, double, template)
    highlighted = highlighted.replace(
      /(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g,
      '<span class="text-green-400">$&</span>'
    );

    // Comments
    highlighted = highlighted.replace(
      /(\/\/.*$)/g,
      '<span class="text-[var(--text-tertiary)] italic">$1</span>'
    );
    
    // Multi-line comments (simple version)
    highlighted = highlighted.replace(
      /(\/\*[\s\S]*?\*\/)/g,
      '<span class="text-[var(--text-tertiary)] italic">$1</span>'
    );

    // Numbers
    highlighted = highlighted.replace(
      /\b\d+(\.\d+)?\b/g,
      '<span class="text-orange-400">$&</span>'
    );
    
    // JSX tags
    if (lang === 'jsx' || lang === 'html') {
      highlighted = highlighted.replace(
        /(&lt;\/?[a-zA-Z][a-zA-Z0-9]*)/g,
        '<span class="text-purple-400">$1</span>'
      );
    }

    return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Toolbar */}
      <div className="h-12 border-b border-[var(--border-subtle)] flex items-center justify-between px-4 bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-3">
          <FileCode className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {title}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-tertiary)] capitalize">
            {language}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewMode('code')}
              className={cn(
                "h-7 text-xs",
                previewMode === 'code' && "text-[var(--accent-primary)]"
              )}
            >
              <Code className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewMode('split')}
              className={cn(
                "h-7 text-xs",
                previewMode === 'split' && "text-[var(--accent-primary)]"
              )}
            >
              <Monitor className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewMode('preview')}
              className={cn(
                "h-7 text-xs",
                previewMode === 'preview' && "text-[var(--accent-primary)]"
              )}
            >
              <Play className="w-4 h-4" />
            </Button>
          </div>
          {(language === 'javascript' || language === 'html') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRun}
              disabled={isRunning}
              className="text-[var(--text-tertiary)] hover:text-green-500"
            >
              {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="text-[var(--text-tertiary)]"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="text-[var(--text-tertiary)]">
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-[var(--text-tertiary)]">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {previewMode === 'code' ? (
          <div className="h-full overflow-auto p-4 bg-[var(--bg-primary)]">
            {renderCode()}
          </div>
        ) : previewMode === 'preview' ? (
          <div className="h-full flex flex-col">
            <div className="flex-1 bg-white">
              {previewSrc ? (
                <iframe
                  key={previewKey}
                  ref={iframeRef}
                  src={previewSrc}
                  className="w-full h-full border-none"
                  sandbox="allow-scripts allow-same-origin"
                  title="Code Preview"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-[var(--text-tertiary)] text-sm">
                  Preview not available for {language}
                </div>
              )}
            </div>
            {/* Console output */}
            {consoleOutput.length > 0 && (
              <div className="h-32 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-auto p-2">
                <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] mb-1">
                  <Terminal className="w-3 h-3" />
                  Console
                </div>
                {consoleOutput.map((log, i) => (
                  <div key={i} className={`text-xs font-mono ${
                    log.includes('ERROR') ? 'text-red-500' :
                    log.includes('WARN') ? 'text-orange-500' :
                    'text-[var(--text-secondary)]'
                  }`}>
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="h-full grid grid-cols-2 gap-px bg-[var(--border-subtle)]">
            {/* Code editor */}
            <div className="overflow-auto bg-[var(--bg-primary)]">
              <div className="p-4 min-h-full">
                {renderCode()}
              </div>
            </div>
            
            {/* Preview */}
            <div className="bg-white flex flex-col">
              <div className="flex-1">
                {previewSrc ? (
                  <iframe
                    key={previewKey}
                    ref={iframeRef}
                    src={previewSrc}
                    className="w-full h-full border-none"
                    sandbox="allow-scripts allow-same-origin"
                    title="Code Preview"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-[var(--text-tertiary)] text-sm">
                    Preview not available for {language}
                  </div>
                )}
              </div>
              {/* Console */}
              {consoleOutput.length > 0 && (
                <div className="h-24 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-auto p-2">
                  {consoleOutput.map((log, i) => (
                    <div key={i} className="text-xs font-mono text-[var(--text-secondary)]">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="h-8 border-t border-[var(--border-subtle)] flex items-center justify-between px-4 text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-4">
          <span>{code.split('\n').length} lines</span>
          <span>{code.length} characters</span>
          <span className="capitalize">{language}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            Ready
          </span>
        </div>
      </div>
    </div>
  );
}
