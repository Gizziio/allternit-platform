'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useBrainEventCursor, type BrainEvent } from '../../hooks/brain/useBrainEventCursor';

export interface TerminalOutputPaneProps {
  sessionId: string;
  maxLines?: number;
  showLineNumbers?: boolean;
  autoScroll?: boolean;
  onClear?: () => void;
}

interface TerminalLine {
  id: number;
  content: string;
  stream: 'stdout' | 'stderr' | 'unknown';
  timestamp: number;
}

const STREAM_LABELS = {
  stdout: '',
  stderr: '[stderr]',
  unknown: '',
};

const FILE_EXTENSIONS: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  h: 'c',
  hpp: 'cpp',
  css: 'css',
  html: 'html',
  xml: 'xml',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  sh: 'bash',
  bash: 'bash',
  sql: 'sql',
};

function detectLanguage(content: string): string {
  const firstLine = content.split('\n')[0];
  const shebangMatch = firstLine.match(/^#!(?:\/usr\/bin\/)?(?:env\s+)?(\w+)/);
  if (shebangMatch) {
    const lang = shebangMatch[1].toLowerCase();
    if (lang === 'node') return 'javascript';
    if (lang === 'python3' || lang === 'python') return 'python';
    return lang;
  }

  const extensionMatch = content.match(/\.([a-zA-Z0-9]+)$/m);
  if (extensionMatch) {
    const ext = extensionMatch[1].toLowerCase();
    return FILE_EXTENSIONS[ext] || ext;
  }

  return '';
}

function highlightSyntax(content: string, language: string): string {
  if (!language || !content) return content;

  const patterns: Record<string, [RegExp, string, string][]> = {
    typescript: [
      [/\/\/.*$/gm, 'text-comment', ''],
      [/\/\*[\s\S]*?\*\//g, 'text-comment', ''],
      [/\b(const|let|var|function|class|interface|type|import|export|default|async|await|if|else|for|while|return|new|try|catch|throw|extends|implements)\b/g, 'text-keyword', ''],
      [/\b(true|false|null|undefined|NaN|Infinity)\b/g, 'text-boolean', ''],
      [/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g, 'text-string', ''],
      [/\b\d+\.?\d*\b/g, 'text-number', ''],
    ],
    javascript: [
      [/\/\/.*$/gm, 'text-comment', ''],
      [/\/\*[\s\S]*?\*\//g, 'text-comment', ''],
      [/\b(const|let|var|function|class|import|export|default|async|await|if|else|for|while|return|new|try|catch|throw|extends)\b/g, 'text-keyword', ''],
      [/\b(true|false|null|undefined)\b/g, 'text-boolean', ''],
      [/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g, 'text-string', ''],
      [/\b\d+\.?\d*\b/g, 'text-number', ''],
    ],
    python: [
      [/#.*$/gm, 'text-comment', ''],
      [/\b(def|class|import|from|as|if|elif|else|for|while|return|try|except|finally|raise|with|lambda|yield|pass|break|continue|and|or|not|in|is)\b/g, 'text-keyword', ''],
      [/\b(True|False|None)\b/g, 'text-boolean', ''],
      [/('''|""")(?:(?!\1)[^\\]|\\.)*\1/g, 'text-string', ''],
      [/(['"])(?:(?!\1)[^\\]|\\.)*\1/g, 'text-string', ''],
      [/\b\d+\.?\d*\b/g, 'text-number', ''],
    ],
    rust: [
      [/\/\/.*$/gm, 'text-comment', ''],
      [/\/\*[\s\S]*?\*\//g, 'text-comment', ''],
      [/\b(fn|let|mut|const|struct|enum|impl|trait|impl|pub|mod|use|super|self|if|else|match|for|while|loop|break|continue|return|where|async|await|dyn|static|ref|as)\b/g, 'text-keyword', ''],
      [/\b(true|false|Self|self)\b/g, 'text-boolean', ''],
      [/(['"])(?:(?!\1)[^\\]|\\.)*\1/g, 'text-string', ''],
      [/[r#](['"])(?:(?!\1)[^#]|##)*\1/g, 'text-string', ''],
      [/\b\d+\.?\d*\b/g, 'text-number', ''],
    ],
    bash: [
      [/#.*$/gm, 'text-comment', ''],
      [/\b(if|then|else|elif|fi|for|while|until|do|done|case|esac|function|local|export|readonly|unset|shift|exit|return|break|continue)\b/g, 'text-keyword', ''],
      [/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g, 'text-string', ''],
      [/\$\{[^}]+\}|\$\w+/g, 'text-variable', ''],
    ],
  };

  const langPatterns = patterns[language];
  if (!langPatterns) return content;

  let result = content;
  for (const [regex, className] of langPatterns) {
    result = result.replace(regex, (match) => `<span class="${className}">${match}</span>`);
  }
  return result;
}

function parseTerminalContent(rawEvents: BrainEvent[]): TerminalLine[] {
  const lines: TerminalLine[] = [];
  let lineId = 0;

  for (const event of rawEvents) {
    if (event.type === 'terminal.delta') {
      const payload = event.payload as { data: string; stream?: string };
      const content = payload.data || '';
      const stream = (payload.stream as 'stdout' | 'stderr' | 'unknown') || 'unknown';

      const contentLines = content.split('\n');
      for (const line of contentLines) {
        if (line || stream === 'stderr') {
          lines.push({
            id: lineId++,
            content: line,
            stream,
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  return lines;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const TerminalOutputPane: React.FC<TerminalOutputPaneProps> = ({
  sessionId,
  maxLines = 1000,
  showLineNumbers = true,
  autoScroll: initialAutoScroll = true,
  onClear,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(initialAutoScroll);
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const lineIdRef = useRef(0);
  const linesRef = useRef<TerminalLine[]>([]);
  const [displayLines, setDisplayLines] = useState<TerminalLine[]>([]);
  const [language, setLanguage] = useState('');

  const { newEvents, reset: resetCursor } = useBrainEventCursor('terminal-output');

  const processNewEvents = useCallback((events: BrainEvent[]) => {
    if (events.length === 0) return;

    const newLines = parseTerminalContent(events);

    if (newLines.length > 0) {
      linesRef.current = [...linesRef.current, ...newLines].slice(-maxLines);
      setDisplayLines([...linesRef.current]);

      const allContent = linesRef.current.map(l => l.content).join('\n');
      setLanguage(detectLanguage(allContent));
    }
  }, [maxLines]);

  useEffect(() => {
    processNewEvents(newEvents);
  }, [newEvents, processNewEvents]);

  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [displayLines, autoScroll]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          handleCopy();
        } else if (e.key === 'l' || e.key === 'L') {
          e.preventDefault();
          handleClear();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCopy = useCallback(() => {
    const text = displayLines.map(l => l.content).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [displayLines]);

  const handleClear = useCallback(() => {
    linesRef.current = [];
    setDisplayLines([]);
    lineIdRef.current = 0;
    resetCursor();
    onClear?.();
  }, [onClear, resetCursor]);

  const handleDownload = useCallback(() => {
    const text = displayLines.map(l => l.content).join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminal-${sessionId}-${timestamp}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [displayLines, sessionId]);

  const filteredLines = useMemo(() => {
    if (!searchQuery) return displayLines;
    const query = searchQuery.toLowerCase();
    return displayLines.filter(l => l.content.toLowerCase().includes(query));
  }, [displayLines, searchQuery]);

  const visibleLines = useMemo(() => {
    if (displayLines.length <= 500) return filteredLines;
    return filteredLines.slice(-500);
  }, [filteredLines, displayLines.length]);

  const totalLines = displayLines.length;
  const lineNumberWidth = Math.max(4, totalLines.toString().length);

  return (
    <div className="terminal-output-pane">
      <div className="terminal-output-header">
        <div className="terminal-output-title">
          <span className="terminal-icon">&#x1F5A7;&#xFE0F;</span>
          <span>Terminal Output</span>
          <span className="terminal-session-id">{sessionId.slice(0, 8)}...</span>
        </div>
        <div className="terminal-output-controls">
          <input
            type="text"
            className="terminal-search-input"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            className="terminal-btn terminal-btn-copy"
            onClick={handleCopy}
            title="Copy to clipboard (Ctrl+C)"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            className="terminal-btn terminal-btn-download"
            onClick={handleDownload}
            title="Download as .log"
          >
            Download
          </button>
          <button
            className="terminal-btn terminal-btn-clear"
            onClick={handleClear}
            title="Clear output (Ctrl+L)"
          >
            Clear
          </button>
        </div>
      </div>

      <div
        className="terminal-output-content"
        ref={outputRef}
        data-auto-scroll={autoScroll}
      >
        <div className="terminal-lines">
          {visibleLines.map((line) => {
            const globalIndex = displayLines.indexOf(line);
            return (
              <div key={line.id} className={`terminal-line line-stream-${line.stream}`}>
                {showLineNumbers && (
                  <span
                    className="terminal-line-number"
                    style={{ width: `${lineNumberWidth}ch` }}
                  >
                    {globalIndex + 1}
                  </span>
                )}
                <span className="terminal-line-content">
                  {STREAM_LABELS[line.stream]}
                  <span
                    className={`terminal-line-text ${language ? 'syntax-highlighted' : ''}`}
                    dangerouslySetInnerHTML={{
                      __html: language ? highlightSyntax(line.content, language) : line.content,
                    }}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="terminal-output-footer">
        <div className="terminal-footer-left">
          <span className="terminal-line-count">{totalLines} lines</span>
          {searchQuery && (
            <span className="terminal-filtered-count">
              ({filteredLines.length} matching)
            </span>
          )}
          {displayLines.length > 500 && (
            <span className="terminal-virtual-notice">
              (showing last 500 of {displayLines.length})
            </span>
          )}
        </div>
        <div className="terminal-footer-right">
          <button
            className={`terminal-toggle-btn ${autoScroll ? 'active' : ''}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll paused'}
          >
            {autoScroll ? 'Auto-scroll: ON' : 'Auto-scroll: OFF'}
          </button>
          <button
            className="terminal-toggle-btn"
            onClick={() => setAutoScroll(true)}
            title="Scroll to bottom"
          >
            &#x2304; Bottom
          </button>
        </div>
      </div>

      <style>{`
        .terminal-output-pane {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0d1117;
          border-radius: 8px;
          overflow: hidden;
          font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Consolas', monospace;
          font-size: 13px;
          line-height: 1.5;
        }

        .terminal-output-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #161b22;
          border-bottom: 1px solid #30363d;
        }

        .terminal-output-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #c9d1d9;
          font-weight: 600;
          font-size: 13px;
        }

        .terminal-icon {
          font-size: 14px;
        }

        .terminal-session-id {
          padding: 2px 6px;
          background: #21262d;
          border-radius: 4px;
          font-size: 11px;
          color: #8b949e;
        }

        .terminal-output-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .terminal-search-input {
          padding: 4px 8px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 4px;
          color: #c9d1d9;
          font-size: 12px;
          width: 150px;
        }

        .terminal-search-input::placeholder {
          color: #484f58;
        }

        .terminal-search-input:focus {
          outline: none;
          border-color: #58a6ff;
        }

        .terminal-btn {
          padding: 4px 10px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .terminal-btn-copy {
          background: #238636;
          color: #fff;
        }

        .terminal-btn-copy:hover {
          background: #2ea043;
        }

        .terminal-btn-download {
          background: #1f6feb;
          color: #fff;
        }

        .terminal-btn-download:hover {
          background: #388bfd;
        }

        .terminal-btn-clear {
          background: #da3633;
          color: #fff;
        }

        .terminal-btn-clear:hover {
          background: #f85149;
        }

        .terminal-output-content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 8px 0;
          scrollbar-width: thin;
          scrollbar-color: #30363d #0d1117;
        }

        .terminal-output-content::-webkit-scrollbar {
          width: 8px;
        }

        .terminal-output-content::-webkit-scrollbar-track {
          background: #0d1117;
        }

        .terminal-output-content::-webkit-scrollbar-thumb {
          background: #30363d;
          border-radius: 4px;
        }

        .terminal-output-content::-webkit-scrollbar-thumb:hover {
          background: #484f58;
        }

        .terminal-lines {
          padding: 0 12px;
        }

        .terminal-line {
          display: flex;
          align-items: flex-start;
          min-height: 1.5em;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .terminal-line-number {
          flex-shrink: 0;
          padding-right: 12px;
          text-align: right;
          color: #484f58;
          user-select: none;
          opacity: 0.7;
        }

        .terminal-line-content {
          display: flex;
          gap: 8px;
          color: #c9d1d9;
        }

        .line-stream-stderr .terminal-line-content {
          color: #f85149;
        }

        .terminal-line-text {
          flex: 1;
        }

        .terminal-line-text.syntax-highlighted .text-comment {
          color: #8b949e;
          font-style: italic;
        }

        .terminal-line-text.syntax-highlighted .text-keyword {
          color: #ff7b72;
          font-weight: 600;
        }

        .terminal-line-text.syntax-highlighted .text-boolean {
          color: #79c0ff;
        }

        .terminal-line-text.syntax-highlighted .text-string {
          color: #a5d6ff;
        }

        .terminal-line-text.syntax-highlighted .text-number {
          color: #79c0ff;
        }

        .terminal-line-text.syntax-highlighted .text-variable {
          color: #ffa657;
        }

        .terminal-output-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 12px;
          background: #161b22;
          border-top: 1px solid #30363d;
          font-size: 11px;
          color: #8b949e;
        }

        .terminal-footer-left {
          display: flex;
          gap: 12px;
        }

        .terminal-footer-right {
          display: flex;
          gap: 8px;
        }

        .terminal-toggle-btn {
          padding: 3px 8px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 4px;
          color: #8b949e;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .terminal-toggle-btn:hover {
          background: #30363d;
          color: #c9d1d9;
        }

        .terminal-toggle-btn.active {
          background: #238636;
          border-color: #238636;
          color: #fff;
        }

        .terminal-line-count,
        .terminal-filtered-count,
        .terminal-virtual-notice {
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
};

export default TerminalOutputPane;
