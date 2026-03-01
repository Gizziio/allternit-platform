/**
 * CapsuleRenderer Component
 * 
 * ShellUI component for rendering an interactive capsule
 * Uses CapsuleFrame from @a2r/platform with shell-ui specific styling
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  AppWindow,
  X,
  CornersOut,
  CornersIn,
  ArrowsClockwise,
  Terminal,
  Pulse,
  WarningCircle,
} from '@phosphor-icons/react';
import type {
  InteractiveCapsule,
  CapsuleEvent,
  ToolUISurface,
} from '@a2r/mcp-apps-adapter';
import { capsuleService } from '../services/capsuleService';

interface CapsuleRendererProps {
  /** Capsule to render */
  capsule: InteractiveCapsule;
  /** Called when user wants to close */
  onClose?: () => void;
  /** Called when capsule emits an event */
  onEvent?: (event: CapsuleEvent) => void;
  /** Called when capsule invokes a tool */
  onToolInvoke?: (toolName: string, params: unknown) => Promise<unknown>;
  /** Initial size */
  defaultSize?: { width: number; height: number };
  /** Whether to show event logs */
  showLogs?: boolean;
}

export function CapsuleRenderer({
  capsule,
  onClose,
  onEvent,
  onToolInvoke,
  defaultSize = { width: 600, height: 400 },
  showLogs = true,
}: CapsuleRendererProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [eventLogs, setEventLogs] = useState<CapsuleEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logsVisible, setLogsVisible] = useState(showLogs);

  // Subscribe to capsule events
  useEffect(() => {
    setIsLoading(true);
    setEventLogs([]);
    setError(null);

    const unsubscribe = capsuleService.subscribeToEvents(capsule.id, (event: CapsuleEvent) => {
      setEventLogs((prev: CapsuleEvent[]) => [...prev, event]);
      onEvent?.(event);
    });

    // Simulate loading completion
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [capsule.id, onEvent]);

  // Handle capsule frame events
  const handleFrameEvent = useCallback(
    (event: CapsuleEvent) => {
      setEventLogs((prev: CapsuleEvent[]) => [...prev, event]);
      onEvent?.(event);
    },
    [onEvent]
  );

  // Handle tool invocation
  const handleToolInvoke = useCallback(
    async (toolName: string, params: unknown) => {
      console.log(`[CapsuleRenderer] Tool invoked: ${toolName}`, params);
      
      // Log the invocation
      const invokeEvent: CapsuleEvent = {
        id: `local-${Date.now()}`,
        capsuleId: capsule.id,
        direction: 'to_tool',
        type: 'tool:invoke',
        payload: { toolName, params },
        timestamp: new Date().toISOString(),
        source: 'capsule',
      };
      setEventLogs((prev: CapsuleEvent[]) => [...prev, invokeEvent]);

      try {
        // Call custom handler or default service
        const result = onToolInvoke
          ? await onToolInvoke(toolName, params)
          : { success: true, toolName, params };

        // Log the result
        const resultEvent: CapsuleEvent = {
          id: `local-${Date.now()}-result`,
          capsuleId: capsule.id,
          direction: 'to_ui',
          type: 'tool:result',
          payload: result,
          timestamp: new Date().toISOString(),
          source: 'tool',
        };
        setEventLogs((prev: CapsuleEvent[]) => [...prev, resultEvent]);

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Tool invocation failed';
        setError(errorMsg);
        throw err;
      }
    },
    [capsule.id, onToolInvoke]
  );

  // Generate sandboxed HTML content for iframe
  const generateSandboxedContent = (surface: ToolUISurface): string => {
    const { html, css, js, props } = surface;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    script-src 'unsafe-inline' 'unsafe-eval';
    style-src 'unsafe-inline';
    connect-src 'none';
    img-src 'none';
    font-src 'none';
    media-src 'none';
    object-src 'none';
    frame-src 'none';
    worker-src 'none';
    form-action 'none';
    base-uri 'none';
  ">
  <title>Capsule: ${capsule.type}</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.5;
      color: #333;
      background: transparent;
      overflow: auto;
    }
    
    ${css || ''}
  </style>
</head>
<body>
  <div id="root">${html}</div>
  
  <script>
    (function() {
      const capsuleId = '${capsule.id}';
      const surfaceProps = ${JSON.stringify(props || {})};
      let state = surfaceProps.initialState || {};
      const listeners = new Set();
      
      // Notify parent that capsule is ready
      window.parent.postMessage({
        type: 'CAPSULE_READY',
        capsuleId,
        timestamp: Date.now(),
      }, '*');
      
      // Expose a2r API
      window.a2r = {
        invokeTool: function(toolName, params) {
          return new Promise((resolve, reject) => {
            const requestId = Math.random().toString(36).substring(7);
            
            const handler = (event) => {
              if (event.data?.requestId === requestId) {
                window.removeEventListener('message', handler);
                if (event.data.type === 'TOOL_RESULT') {
                  resolve(event.data.result);
                } else {
                  reject(new Error(event.data.error || 'Tool invocation failed'));
                }
              }
            };
            
            window.addEventListener('message', handler);
            window.parent.postMessage({
              type: 'INVOKE_TOOL',
              capsuleId,
              requestId,
              toolName,
              params,
            }, '*');
            
            setTimeout(() => {
              window.removeEventListener('message', handler);
              reject(new Error('Tool invocation timeout'));
            }, 30000);
          });
        },
        
        emitEvent: function(eventType, payload) {
          window.parent.postMessage({
            type: 'CAPSULE_EVENT',
            capsuleId,
            event: {
              type: eventType,
              payload,
              timestamp: Date.now(),
            },
          }, '*');
        },
        
        subscribe: function(callback) {
          listeners.add(callback);
          return () => listeners.delete(callback);
        },
        
        getState: function() {
          return { ...state };
        },
        
        updateState: function(newState) {
          state = { ...state, ...newState };
          listeners.forEach(cb => cb(state));
        }
      };
      
      // Listen for messages from parent
      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg || msg.capsuleId !== capsuleId) return;
        
        if (msg.type === 'STATE_UPDATE' && window.a2r) {
          window.a2r.updateState(msg.state);
        }
      });
      
      // Execute capsule script
      try {
        ${js || ''}
      } catch (err) {
        console.error('Capsule script error:', err);
        window.parent.postMessage({
          type: 'CAPSULE_ERROR',
          capsuleId,
          error: err.message,
        }, '*');
      }
    })();
  </script>
</body>
</html>`;
  };

  // Handle iframe messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.capsuleId !== capsule.id) return;

      switch (msg.type) {
        case 'CAPSULE_READY':
          setIsLoading(false);
          break;
        case 'CAPSULE_EVENT':
          if (msg.event) {
            handleFrameEvent(msg.event as CapsuleEvent);
          }
          break;
        case 'INVOKE_TOOL':
          if (msg.toolName) {
            handleToolInvoke(msg.toolName, msg.params).then((result: any) => {
              // Send result back to iframe
              const iframe = document.querySelector(
                `iframe[data-capsule-id="${capsule.id}"]`
              ) as HTMLIFrameElement;
              if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage(
                  {
                    type: 'TOOL_RESULT',
                    requestId: msg.requestId,
                    result,
                  },
                  '*'
                );
              }
            }).catch((err: any) => {
              const iframe = document.querySelector(
                `iframe[data-capsule-id="${capsule.id}"]`
              ) as HTMLIFrameElement;
              if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage(
                  {
                    type: 'TOOL_ERROR',
                    requestId: msg.requestId,
                    error: err instanceof Error ? err.message : 'Unknown error',
                  },
                  '*'
                );
              }
            });
          }
          break;
        case 'CAPSULE_ERROR':
          setError(msg.error || 'Unknown capsule error');
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [capsule.id, handleFrameEvent, handleToolInvoke]);

  const size = isExpanded
    ? { width: '100%', height: '100%' }
    : { width: defaultSize.width, height: defaultSize.height };

  return (
    <div
      className={`capsule-renderer ${isExpanded ? 'expanded' : ''}`}
      style={size as React.CSSProperties}
    >
      {/* Header */}
      <div className="capsule-renderer-header">
        <div className="flex items-center gap-2">
          <AppWindow size={18} weight="fill" className="text-blue-500" />
          <span className="font-medium">{capsule.type}</span>
          <span className="capsule-id">{capsule.id.slice(0, 8)}...</span>
        </div>
        <div className="flex items-center gap-1">
          {showLogs && (
            <button
              onClick={() => setLogsVisible(!logsVisible)}
              className={`icon-button ${logsVisible ? 'active' : ''}`}
              title="Toggle Logs"
            >
              <Terminal size={16} />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="icon-button"
            title={isExpanded ? 'Minimize' : 'Maximize'}
          >
            {isExpanded ? <CornersIn size={16} /> : <CornersOut size={16} />}
          </button>
          <button onClick={onClose} className="icon-button" title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="capsule-renderer-content">
        {/* Iframe */}
        <div className="capsule-iframe-container">
          {isLoading && (
            <div className="loading-overlay">
              <ArrowsClockwise size={24} className="animate-spin text-blue-500" />
              <span>Loading capsule...</span>
            </div>
          )}
          
          {error && (
            <div className="error-overlay">
              <WarningCircle size={32} className="text-red-500" />
              <span>{error}</span>
            </div>
          )}
          
          <iframe
            data-capsule-id={capsule.id}
            srcDoc={generateSandboxedContent(capsule.surface)}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            className="capsule-iframe"
            title={`Capsule: ${capsule.type}`}
          />
        </div>

        {/* Event Logs */}
        {logsVisible && (
          <div className="capsule-logs">
            <div className="capsule-logs-header">
              <div className="flex items-center gap-2">
                <Pulse size={14} />
                <span className="text-sm font-medium">Events</span>
                <span className="log-count">{eventLogs.length}</span>
              </div>
              <button
                onClick={() => setEventLogs([])}
                className="text-button"
              >
                Clear
              </button>
            </div>
            <div className="capsule-logs-content">
              {eventLogs.length === 0 ? (
                <div className="empty-logs">No events...</div>
              ) : (
                eventLogs.slice(-50).map((event: CapsuleEvent, index: number) => (
                  <div key={`${event.id}-${index}`} className="log-item">
                    <div className="log-header">
                      <span className="log-type">{event.type}</span>
                      <span className="log-source">{event.source}</span>
                    </div>
                    <pre className="log-payload">
                      {JSON.stringify(event.payload, null, 2).slice(0, 200)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .capsule-renderer {
          display: flex;
          flex-direction: column;
          background: white;
          border-radius: 12px;
          border: 1px solid var(--border-subtle, #e5e7eb);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .capsule-renderer.expanded {
          position: fixed;
          inset: 0;
          z-index: 1000;
          border-radius: 0;
        }
        
        .capsule-renderer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--bg-secondary, #f9fafb);
          border-bottom: 1px solid var(--border-subtle, #e5e7eb);
        }
        
        .capsule-id {
          font-size: 12px;
          color: var(--text-tertiary, #9ca3af);
          font-family: monospace;
        }
        
        .icon-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--text-secondary, #6b7280);
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .icon-button:hover {
          background: var(--bg-primary, #f3f4f6);
          color: var(--text-primary, #111827);
        }
        
        .icon-button.active {
          background: #dbeafe;
          color: #007acc;
        }
        
        .capsule-renderer-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        
        .capsule-iframe-container {
          flex: 1;
          position: relative;
          min-width: 0;
        }
        
        .capsule-iframe {
          width: 100%;
          height: 100%;
          border: none;
          display: block;
        }
        
        .loading-overlay,
        .error-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.95);
          z-index: 10;
        }
        
        .error-overlay {
          color: #dc2626;
        }
        
        .capsule-logs {
          width: 280px;
          border-left: 1px solid var(--border-subtle, #e5e7eb);
          display: flex;
          flex-direction: column;
          background: var(--bg-secondary, #f9fafb);
        }
        
        .capsule-logs-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-bottom: 1px solid var(--border-subtle, #e5e7eb);
        }
        
        .log-count {
          background: var(--bg-primary, #f3f4f6);
          color: var(--text-secondary, #6b7280);
          padding: 2px 6px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
        }
        
        .text-button {
          padding: 4px 8px;
          border: none;
          background: transparent;
          color: var(--text-secondary, #6b7280);
          font-size: 11px;
          cursor: pointer;
        }
        
        .text-button:hover {
          color: var(--text-primary, #111827);
        }
        
        .capsule-logs-content {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .empty-logs {
          padding: 24px;
          text-align: center;
          color: var(--text-tertiary, #9ca3af);
          font-size: 12px;
        }
        
        .log-item {
          padding: 8px;
          background: white;
          border-radius: 6px;
          border: 1px solid var(--border-subtle, #e5e7eb);
          font-size: 11px;
        }
        
        .log-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        
        .log-type {
          font-weight: 600;
          color: var(--text-primary, #111827);
        }
        
        .log-source {
          font-size: 10px;
          color: var(--text-tertiary, #9ca3af);
          background: var(--bg-secondary, #f9fafb);
          padding: 1px 4px;
          border-radius: 3px;
        }
        
        .log-payload {
          font-family: monospace;
          font-size: 10px;
          color: var(--text-secondary, #6b7280);
          white-space: pre-wrap;
          word-break: break-all;
          margin: 0;
          max-height: 60px;
          overflow: hidden;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

export default CapsuleRenderer;
