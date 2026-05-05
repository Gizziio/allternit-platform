'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Bug,
  Play,
  Square,
  Trash,
  CaretDown,
  CaretRight,
} from '@phosphor-icons/react';
import { GlassSurface } from '@/design/GlassSurface';

interface DebugVariable {
  name: string;
  value: string;
  type: 'object' | 'primitive';
  children?: DebugVariable[];
}

interface ConsoleLogEntry {
  id: string;
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'LOG';
  message: string;
}

interface Breakpoint {
  id: string;
  file: string;
  line: number;
  enabled: boolean;
}

type FilterLevel = 'All Levels' | 'Error' | 'Warning' | 'Info';

const VariableTreeNode: React.FC<{
  variable: DebugVariable;
  level: number;
}> = ({ variable, level }) => {
  const [isExpanded, setIsExpanded] = useState(level === 0);

  const hasChildren = variable.children && variable.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 px-2 hover:bg-opacity-50 cursor-pointer"
        style={{
          paddingLeft: `${level * 16 + 8}px`,
          fontFamily: "'Allternit Mono', 'SFMono-Regular', ui-monospace, monospace",
          fontSize: '12px',
        }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {hasChildren && (
          <div style={{ width: '16px' }}>
            {isExpanded ? (
              <CaretDown size={14} />
            ) : (
              <CaretRight size={14} />
            )}
          </div>
        )}
        {!hasChildren && <div style={{ width: '16px' }} />}
        <span style={{ color: `var(--accent-primary)` }}>{variable.name}</span>
        <span style={{ color: `var(--text-tertiary)` }}>: </span>
        <span style={{ color: `var(--text-secondary)` }}>{variable.value}</span>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {(variable.children ?? []).map((child, idx) => (
            <VariableTreeNode
              key={idx}
              variable={child}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export function DebugView() {
  const [filterLevel, setFilterLevel] = useState<FilterLevel>('All Levels');
  const [consoleInput, setConsoleInput] = useState('');
  const consoleOutputRef = useRef<HTMLDivElement>(null);
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [logs, setLogs] = useState<ConsoleLogEntry[]>([]);

  const handleClearConsole = () => {
    setLogs([]);
  };

  const handleToggleBreakpoint = (id: string) => {
    setBreakpoints(
      breakpoints.map((bp) =>
        bp.id === id ? { ...bp, enabled: !bp.enabled } : bp
      )
    );
  };

  const getLogLevelColor = (level: ConsoleLogEntry['level']) => {
    switch (level) {
      case 'ERROR':
        return 'var(--status-error)';
      case 'WARN':
        return 'var(--status-warning)';
      case 'INFO':
        return 'var(--status-info)';
      case 'LOG':
      default:
        return `var(--text-secondary)`;
    }
  };

  const getLogLevelBgColor = (level: ConsoleLogEntry['level']) => {
    switch (level) {
      case 'ERROR':
        return 'rgba(239, 68, 68, 0.1)';
      case 'WARN':
        return 'rgba(245, 158, 11, 0.1)';
      case 'INFO':
        return 'rgba(59, 130, 246, 0.1)';
      case 'LOG':
      default:
        return 'transparent';
    }
  };

  const filteredLogs =
    filterLevel === 'All Levels'
      ? logs
      : logs.filter((log) => {
          switch (filterLevel) {
            case 'Error':
              return log.level === 'ERROR';
            case 'Warning':
              return log.level === 'WARN';
            case 'Info':
              return log.level === 'INFO';
            default:
              return true;
          }
        });

  useEffect(() => {
    if (consoleOutputRef.current) {
      consoleOutputRef.current.scrollTop = consoleOutputRef.current.scrollHeight;
    }
  }, [filteredLogs]);

  return (
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: `var(--bg-primary)`,
        color: `var(--text-primary)`,
      }}
    >
      {/* Header */}
      <GlassSurface className="flex-shrink-0 border-b"
        style={{
          borderColor: `var(--border-subtle)`,
        }}
      >
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-2">
            <Bug size={20} style={{ color: `var(--accent-primary)` }} />
            <h1 className="text-lg font-semibold">Debug Console</h1>
          </div>
          <p
            className="text-sm"
            style={{
              color: `var(--text-secondary)`,
            }}
          >
            Runtime inspection and diagnostics
          </p>
        </div>
      </GlassSurface>

      {/* Toolbar */}
      <div
        className="flex-shrink-0 px-6 py-3 border-b flex items-center gap-3"
        style={{
          backgroundColor: `var(--bg-secondary)`,
          borderColor: `var(--border-subtle)`,
        }}
      >
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all hover:opacity-80"
          style={{
            backgroundColor: `var(--accent-primary)`,
            color: '#000',
            fontSize: '12px',
            fontWeight: '500',
          }}
        >
          <Play size={14} />
          Play
        </button>
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all hover:opacity-80"
          style={{
            backgroundColor: `var(--bg-primary)`,
            border: `1px solid var(--border-subtle)`,
            color: `var(--text-primary)`,
            fontSize: '12px',
            fontWeight: '500',
          }}
        >
          <Square size={14} />
          Stop
        </button>
        <button
          onClick={handleClearConsole}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all hover:opacity-80"
          style={{
            backgroundColor: `var(--bg-primary)`,
            border: `1px solid var(--border-subtle)`,
            color: `var(--text-primary)`,
            fontSize: '12px',
            fontWeight: '500',
          }}
        >
          <Trash size={14} />
          Clear
        </button>

        {/* Filter Dropdown Spacer */}
        <div className="flex-1" />

        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value as FilterLevel)}
          className="px-3 py-1.5 rounded-md text-xs"
          style={{
            backgroundColor: `var(--bg-primary)`,
            border: `1px solid var(--border-subtle)`,
            color: `var(--text-primary)`,
            fontWeight: '500',
            fontFamily: "'Allternit Mono', 'SFMono-Regular', ui-monospace, monospace",
          }}
        >
          <option>All Levels</option>
          <option>Error</option>
          <option>Warning</option>
          <option>Info</option>
        </select>
      </div>

      {/* Main Content - 3 Panel Layout */}
      <div className="flex-1 flex gap-1 overflow-hidden p-1" style={{
        backgroundColor: `var(--bg-primary)`,
      }}>
        {/* LEFT PANEL: Variables (35%) */}
        <GlassSurface
          className="flex flex-col"
          style={{
            width: '35%',
            borderRadius: '6px',
            overflow: 'hidden',
            border: `1px solid var(--border-subtle)`,
          }}
        >
          <div
            className="flex-shrink-0 px-4 py-2 border-b"
            style={{
              backgroundColor: `var(--bg-secondary)`,
              borderColor: `var(--border-subtle)`,
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            Variables
          </div>
          <div
            className="flex-1 overflow-y-auto"
            style={{
              backgroundColor: `var(--bg-primary)`,
              fontFamily: "'Allternit Mono', 'SFMono-Regular', ui-monospace, monospace",
              fontSize: '12px',
            }}
          >
            {([] as DebugVariable[]).map((variable, idx) => (
              <VariableTreeNode key={idx} variable={variable} level={0} />
            ))}
          </div>
        </GlassSurface>

        {/* RIGHT PANELS: Console Output & Breakpoints (65%) */}
        <div className="flex flex-col" style={{ width: '65%', gap: '4px' }}>
          {/* RIGHT TOP: Console Output */}
          <GlassSurface
            className="flex flex-col flex-1"
            style={{
              borderRadius: '6px',
              overflow: 'hidden',
              border: `1px solid var(--border-subtle)`,
            }}
          >
            <div
              className="flex-shrink-0 px-4 py-2 border-b"
              style={{
                backgroundColor: `var(--bg-secondary)`,
                borderColor: `var(--border-subtle)`,
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              Console Output
            </div>
            <div
              ref={consoleOutputRef}
              className="flex-1 overflow-y-auto"
              style={{
                backgroundColor: `var(--bg-primary)`,
                fontFamily: "'Allternit Mono', 'SFMono-Regular', ui-monospace, monospace",
                fontSize: '12px',
                lineHeight: '1.5',
              }}
            >
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="px-4 py-2 border-b"
                  style={{
                    backgroundColor: getLogLevelBgColor(log.level),
                    borderColor: `var(--border-subtle)`,
                  }}
                >
                  <div className="flex gap-3 items-start">
                    <span
                      style={{
                        color: `var(--text-tertiary)`,
                        minWidth: '80px',
                      }}
                    >
                      {log.timestamp}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0"
                      style={{
                        backgroundColor: getLogLevelColor(log.level),
                        color: '#fff',
                        minWidth: 'fit-content',
                      }}
                    >
                      {log.level}
                    </span>
                    <span
                      style={{
                        color: `var(--text-primary)`,
                        wordBreak: 'break-word',
                      }}
                    >
                      {log.message}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </GlassSurface>

          {/* RIGHT BOTTOM: Breakpoints */}
          <GlassSurface
            className="flex flex-col flex-shrink-0"
            style={{
              height: '140px',
              borderRadius: '6px',
              overflow: 'hidden',
              border: `1px solid var(--border-subtle)`,
            }}
          >
            <div
              className="flex-shrink-0 px-4 py-2 border-b"
              style={{
                backgroundColor: `var(--bg-secondary)`,
                borderColor: `var(--border-subtle)`,
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              Breakpoints
            </div>
            <div
              className="flex-1 overflow-y-auto"
              style={{
                backgroundColor: `var(--bg-primary)`,
                fontFamily: "'Allternit Mono', 'SFMono-Regular', ui-monospace, monospace",
                fontSize: '11px',
              }}
            >
              {breakpoints.map((bp) => (
                <div
                  key={bp.id}
                  className="px-4 py-2 border-b flex items-center justify-between gap-2 hover:bg-opacity-50"
                  style={{
                    backgroundColor: bp.enabled ? 'transparent' : 'rgba(100, 100, 100, 0.1)',
                    borderColor: `var(--border-subtle)`,
                  }}
                >
                  <span style={{ color: `var(--text-primary)` }}>
                    {bp.file}:{bp.line}
                  </span>
                  <button
                    onClick={() => handleToggleBreakpoint(bp.id)}
                    className="w-4 h-4 rounded flex-shrink-0 transition-all"
                    style={{
                      backgroundColor: bp.enabled
                        ? `var(--accent-primary)`
                        : `var(--bg-secondary)`,
                      border: `1px solid var(--border-subtle)`,
                    }}
                  />
                </div>
              ))}
            </div>
          </GlassSurface>
        </div>
      </div>

      {/* Console Input */}
      <div
        className="flex-shrink-0 px-4 py-3 border-t flex items-center gap-3"
        style={{
          backgroundColor: `var(--bg-secondary)`,
          borderColor: `var(--border-subtle)`,
          fontFamily: "'Allternit Mono', 'SFMono-Regular', ui-monospace, monospace",
        }}
      >
        <span
          style={{
            color: `var(--accent-primary)`,
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          &gt;
        </span>
        <input
          type="text"
          value={consoleInput}
          onChange={(e) => setConsoleInput(e.target.value)}
          placeholder="Enter debug command..."
          className="flex-1 bg-transparent outline-none"
          style={{
            color: `var(--text-primary)`,
            fontSize: '12px',
            fontFamily: "'Allternit Mono', 'SFMono-Regular', ui-monospace, monospace",
          }}
        />
      </div>
    </div>
  );
}

export default DebugView;
