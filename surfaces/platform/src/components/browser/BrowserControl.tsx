/**
 * Browser Control Component - Example using useTool hook
 * 
 * Demonstrates deterministic browser automation via agent-browser tool
 */

import React, { useState } from 'react';
import { useToolWithRetryAndTimeout } from '@/hooks/useTool';

interface BrowserControlProps {
  /** Initial URL to display */
  initialUrl?: string;
  /** Enable session persistence */
  persistentSession?: boolean;
  /** Session ID for persistent sessions */
  sessionId?: string;
}

export function BrowserControl({
  initialUrl = 'https://example.com',
  persistentSession = false,
  sessionId,
}: BrowserControlProps) {
  const [url, setUrl] = useState(initialUrl);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<any>(null);

  // Use tool with retry (3 attempts) and timeout (30s)
  const {
    execute,
    isLoading,
    error,
    lastResult,
    cancel,
    reset,
  } = useToolWithRetryAndTimeout('agent-browser.automation', 3, 30000);

  /**
   * Navigate to URL
   */
  const handleNavigate = async () => {
    const result = await execute({
      action: 'open',
      url,
      session_id: persistentSession ? sessionId : undefined,
    });

    if (result.success) {
      console.log('Navigation successful');
      // Optionally get snapshot after navigation
      await handleSnapshot();
    }
  };

  /**
   * Get page snapshot with element refs
   */
  const handleSnapshot = async () => {
    const result = await execute({
      action: 'snapshot',
    });

    if (result.success) {
      setSnapshot(result.snapshot);
    }
  };

  /**
   * Click element by selector
   */
  const handleClick = async (selector: string) => {
    const result = await execute({
      action: 'click',
      selector,
    });

    if (result.success) {
      console.log(`Clicked: ${selector}`);
    }
  };

  /**
   * Take screenshot
   */
  const handleScreenshot = async () => {
    const result = await execute({
      action: 'screenshot',
      path: `/tmp/browser-${Date.now()}.png`,
    });

    if (result.success && result.screenshot) {
      setScreenshot(result.screenshot);
    }
  };

  /**
   * Extract text from element
   */
  const handleExtractText = async (selector: string) => {
    const result = await execute({
      action: 'get_text',
      selector,
    });

    if (result.success) {
      console.log(`Text from ${selector}:`, result.data);
      return result.data;
    }
  };

  return (
    <div className="browser-control">
      {/* URL Input */}
      <div className="browser-url-bar">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter URL"
          disabled={isLoading}
          className="browser-url-input"
        />
        <button
          onClick={handleNavigate}
          disabled={isLoading}
          className="browser-navigate-btn"
        >
          {isLoading ? 'Loading...' : 'Navigate'}
        </button>
        {isLoading && (
          <button onClick={cancel} className="browser-cancel-btn">
            Cancel
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="browser-error">
          <strong>Error:</strong> {error}
          <button onClick={reset}>Dismiss</button>
        </div>
      )}

      {/* Last Result Display */}
      {lastResult && lastResult.success && (
        <div className="browser-result">
          <div className="result-info">
            <span>✓ Success</span>
            {lastResult.execution_time_ms && (
              <span>({lastResult.execution_time_ms}ms)</span>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="browser-actions">
        <button
          onClick={handleSnapshot}
          disabled={isLoading}
          className="browser-action-btn"
        >
          📋 Get Snapshot
        </button>
        <button
          onClick={handleScreenshot}
          disabled={isLoading}
          className="browser-action-btn"
        >
          📸 Screenshot
        </button>
      </div>

      {/* Snapshot Display */}
      {snapshot && (
        <div className="browser-snapshot">
          <h3>Page Elements</h3>
          <ul className="element-list">
            {snapshot.elements?.map((el: any, idx: number) => (
              <li
                key={idx}
                className="element-item"
                onClick={() => handleClick(el.ref)}
              >
                <span className="element-ref">{el.ref}</span>
                <span className="element-role">{el.role}</span>
                {el.text && <span className="element-text">{el.text}</span>}
                {el.label && <span className="element-label">{el.label}</span>}
              </li>
            ))}
          </ul>
          <p className="element-hint">Click an element to interact</p>
        </div>
      )}

      {/* Screenshot Display */}
      {screenshot && (
        <div className="browser-screenshot">
          <h3>Screenshot</h3>
          <img
            src={`data:image/png;base64,${screenshot}`}
            alt="Page screenshot"
            className="screenshot-image"
          />
          <button onClick={() => setScreenshot(null)}>Close</button>
        </div>
      )}

      {/* Styles */}
      {/* @ts-ignore - styled-jsx attribute */}
      <style jsx>{`
        .browser-control {
          padding: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: white;
        }

        .browser-url-bar {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .browser-url-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 14px;
        }

        .browser-navigate-btn,
        .browser-cancel-btn,
        .browser-action-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          background: #3b82f6;
          color: white;
          cursor: pointer;
          font-size: 14px;
        }

        .browser-navigate-btn:hover,
        .browser-cancel-btn:hover,
        .browser-action-btn:hover {
          background: #2563eb;
        }

        .browser-cancel-btn {
          background: #ef4444;
        }

        .browser-cancel-btn:hover {
          background: #dc2626;
        }

        .browser-error {
          padding: 12px;
          background: #fee2e2;
          border: 1px solid #fecaca;
          border-radius: 4px;
          color: #991b1b;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .browser-result {
          padding: 12px;
          background: #dcfce7;
          border: 1px solid #bbf7d0;
          border-radius: 4px;
          color: #166534;
          margin-bottom: 16px;
        }

        .result-info {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .browser-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .browser-snapshot {
          margin-top: 16px;
          padding: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          background: #f9fafb;
        }

        .element-list {
          list-style: none;
          padding: 0;
          margin: 8px 0;
        }

        .element-item {
          padding: 8px;
          margin: 4px 0;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .element-item:hover {
          background: #f3f4f6;
          border-color: #3b82f6;
        }

        .element-ref {
          font-weight: bold;
          color: #3b82f6;
          background: #eff6ff;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 12px;
        }

        .element-role {
          color: #6b7280;
          font-size: 12px;
        }

        .element-text {
          color: #1f2937;
          font-size: 12px;
        }

        .element-label {
          color: #059669;
          font-size: 12px;
        }

        .element-hint {
          color: #6b7280;
          font-size: 12px;
          margin-top: 8px;
        }

        .browser-screenshot {
          margin-top: 16px;
          text-align: center;
        }

        .screenshot-image {
          max-width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          margin: 8px 0;
        }
      `}</style>
    </div>
  );
}

export default BrowserControl;
