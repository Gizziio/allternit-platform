/**
 * CapsuleFrame Component
 * 
 * Hardened iframe container for interactive capsules (MCP Apps).
 * Provides sandboxed execution environment with postMessage bridge.
 * 
 * Security features:
 * - sandbox="allow-scripts" (no forms, popups, etc.)
 * - referrerpolicy="no-referrer"
 * - Origin validation on all postMessage
 * - CSP enforcement
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import styles from './CapsuleFrame.module.css';

export interface ToolUISurface {
  html: string;
  css?: string;
  js?: string;
  props?: Record<string, unknown>;
  permissions: CapsulePermission[];
}

export interface CapsulePermission {
  permission_type: string;
  resource: string;
  actions?: string[];
  conditions?: Record<string, unknown>;
}

export interface CapsuleEvent {
  type: string;
  payload?: unknown;
  timestamp?: number;
}

export interface CapsuleFrameProps {
  /** Unique capsule identifier */
  capsuleId: string;
  /** UI surface definition from tool */
  surface: ToolUISurface;
  /** Called when capsule emits an event */
  onEvent?: (event: CapsuleEvent) => void;
  /** Called when capsule requests tool invocation */
  onToolInvoke?: (tool: string, params: unknown) => void;
  /** Optional CSS class */
  className?: string;
  /** Loading state override */
  loading?: boolean;
  /** Error state override */
  error?: string | null;
}

type FrameState = 'loading' | 'ready' | 'error';

export const CapsuleFrame: React.FC<CapsuleFrameProps> = ({
  capsuleId,
  surface,
  onEvent,
  onToolInvoke,
  className = '',
  loading: externalLoading,
  error: externalError,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [frameState, setFrameState] = useState<FrameState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInjected, setIsInjected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate capsule HTML with injected API
  const generateCapsuleHTML = useCallback((): string => {
    const { html, css, js, props } = surface;
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline';">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #333;
      background: white;
    }
    ${css || ''}
  </style>
</head>
<body>
  <div id="root">${html}</div>
  <script>
    // Allternit Capsule Runtime API
    (function() {
      'use strict';
      
      const capsuleId = ${JSON.stringify(capsuleId)};
      const permissions = ${JSON.stringify(surface.permissions)};
      const props = ${JSON.stringify(props || {})};
      
      // Validate parent origin
      const ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:5177', 'http://localhost:5173'];
      
      function validateOrigin(origin) {
        return ALLOWED_ORIGINS.includes(origin) || origin.startsWith('file://');
      }
      
      // Message queue for buffering before parent ready
      const messageQueue = [];
      let parentReady = false;
      
      // Send message to parent with validation
      function sendToParent(type, payload) {
        const message = {
          type,
          payload,
          capsuleId,
          timestamp: Date.now()
        };
        
        if (parentReady) {
          window.parent.postMessage(message, '*');
        } else {
          messageQueue.push(message);
        }
      }
      
      // Flush queued messages
      function flushQueue() {
        while (messageQueue.length > 0) {
          const msg = messageQueue.shift();
          window.parent.postMessage(msg, '*');
        }
      }
      
      // Public API exposed to capsule
      window.allternit = {
        version: '1.0.0',
        capsuleId: capsuleId,
        
        // Check if tool is permitted
        hasPermission: function(permissionType, resource) {
          return permissions.some(p => 
            p.permission_type === permissionType && 
            (p.resource === '*' || p.resource === resource)
          );
        },
        
        // Invoke a tool through parent
        invokeTool: async function(tool, params) {
          if (!this.hasPermission('invoke_tools', tool)) {
            throw new Error(\`Tool '\${tool}' not permitted\`);
          }
          
          return new Promise((resolve, reject) => {
            const requestId = Math.random().toString(36).substr(2, 9);
            
            function handleResponse(event) {
              if (event.source !== window.parent) return;
              const data = event.data;
              if (data && data.requestId === requestId) {
                window.removeEventListener('message', handleResponse);
                if (data.error) {
                  reject(new Error(data.error));
                } else {
                  resolve(data.result);
                }
              }
            }
            
            window.addEventListener('message', handleResponse);
            sendToParent('tool:invoke', { tool, params, requestId });
            
            // Timeout after 30 seconds
            setTimeout(() => {
              window.removeEventListener('message', handleResponse);
              reject(new Error('Tool invocation timeout'));
            }, 30000);
          });
        },
        
        // Emit event to parent
        emitEvent: function(eventType, payload) {
          sendToParent('ui:event', { eventType, payload });
        },
        
        // Subscribe to events from parent
        subscribe: function(eventType, callback) {
          function handler(event) {
            if (event.source !== window.parent) return;
            const data = event.data;
            if (data && data.type === 'tool:event' && data.payload?.eventType === eventType) {
              callback(data.payload.data);
            }
          }
          window.addEventListener('message', handler);
          
          // Return unsubscribe function
          return function() {
            window.removeEventListener('message', handler);
          };
        },
        
        // Get current state/props
        getProps: function() {
          return { ...props };
        },
        
        // Log to parent console
        log: function(...args) {
          sendToParent('ui:log', { args });
        }
      };
      
      // Handle messages from parent
      window.addEventListener('message', function(event) {
        if (!validateOrigin(event.origin)) {
          console.warn('[Allternit Capsule] Rejected message from invalid origin:', event.origin);
          return;
        }
        
        const data = event.data;
        if (!data) return;
        
        // Handle parent ready signal
        if (data.type === 'parent:ready') {
          parentReady = true;
          flushQueue();
          return;
        }
        
        // Handle tool data push
        if (data.type === 'tool:data') {
          // Dispatch custom event for capsule to listen
          const customEvent = new CustomEvent('allternit:data', { 
            detail: data.payload 
          });
          window.dispatchEvent(customEvent);
        }
        
        // Handle prop updates
        if (data.type === 'props:update') {
          Object.assign(props, data.payload);
          const customEvent = new CustomEvent('allternit:props', { 
            detail: props 
          });
          window.dispatchEvent(customEvent);
        }
      });
      
      // Signal ready to parent
      sendToParent('capsule:ready', { capsuleId });
      
    })();
  </script>
  ${js ? `<script>${js}</script>` : ''}
</body>
</html>`;
  }, [capsuleId, surface]);

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin
      const allowedOrigins = ['http://localhost:3000', 'http://localhost:5177', 'http://localhost:5173', 'null', 'file://'];
      if (!allowedOrigins.includes(event.origin) && !event.origin.startsWith('file://')) {
        return;
      }

      // Only accept messages from our iframe
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const data = event.data;
      if (!data || data.capsuleId !== capsuleId) return;

      switch (data.type) {
        case 'capsule:ready':
          setFrameState('ready');
          setIsInjected(true);
          // Signal parent ready
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'parent:ready' },
            '*'
          );
          break;

        case 'ui:event':
          onEvent?.({
            type: data.payload?.eventType || 'unknown',
            payload: data.payload,
            timestamp: data.timestamp,
          });
          break;

        case 'tool:invoke':
          onToolInvoke?.(data.payload?.tool, data.payload?.params);
          break;

        case 'ui:log':
          console.log(`[Capsule ${capsuleId}]`, ...data.payload?.args);
          break;

        default:
          // Forward other events
          onEvent?.({
            type: data.type,
            payload: data.payload,
            timestamp: data.timestamp,
          });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [capsuleId, onEvent, onToolInvoke]);

  // Handle iframe load errors
  const handleError = useCallback(() => {
    setFrameState('error');
    setErrorMessage('Failed to load capsule');
  }, []);

  // Push data to capsule
  const pushData = useCallback((data: unknown) => {
    if (iframeRef.current?.contentWindow && isInjected) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'tool:data', payload: data },
        '*'
      );
    }
  }, [isInjected]);

  // Update props in capsule
  const updateProps = useCallback((newProps: Record<string, unknown>) => {
    if (iframeRef.current?.contentWindow && isInjected) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'props:update', payload: newProps },
        '*'
      );
    }
  }, [isInjected]);

  const isLoading = externalLoading || frameState === 'loading';
  const hasError = externalError || errorMessage;

  return (
    <div 
      ref={containerRef}
      className={`${styles.capsuleFrame} ${className}`}
      data-state={frameState}
      data-capsule-id={capsuleId}
    >
      {isLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <span className={styles.loadingText}>Loading capsule...</span>
        </div>
      )}

      {hasError && (
        <div className={styles.errorOverlay}>
          <div className={styles.errorIcon}>⚠️</div>
          <span className={styles.errorText}>{hasError}</span>
        </div>
      )}

      <iframe
        ref={iframeRef}
        className={styles.iframe}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        srcDoc={generateCapsuleHTML()}
        onError={handleError}
        title={`Capsule ${capsuleId}`}
      />
    </div>
  );
};

export default CapsuleFrame;
