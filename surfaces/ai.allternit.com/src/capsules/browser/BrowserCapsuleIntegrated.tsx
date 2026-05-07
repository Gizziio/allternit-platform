/**
 * Integrated Browser Capsule
 * 
 * This version connects to the actual Browser Control Server backend.
 * It replaces the static webview with real browser automation.
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  Globe,
  SquaresFour,
  Terminal,
  Play,
  Square,
  Camera,
  FileText,
} from '@phosphor-icons/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GlassCard } from '../../design/GlassCard';
import { A2UIRenderer } from '../a2ui/A2UIRenderer';
import {
  useBrowserAutomation,
  browserClient,
} from '../../integration/browser-client';
import type { A2UIPayload } from './browser.types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ═════════════════════════════════════════════════════════════════════════════
// WebView Component with Browser Automation
// ═════════════════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════════════════
// Browser Control Panel
// ═════════════════════════════════════════════════════════════════════════════

function BrowserControlPanel() {
  const { 
    status, 
    isRunning, 
    start, 
    stop, 
    tabs, 
    openTab, 
    closeTab, 
    takeSnapshot,
    snapshot 
  } = useBrowserAutomation();

  const [url, setUrl] = useState('https://google.com');

  return (
    <GlassCard className="p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-400" />
          Browser Automation
        </h3>
        <div className="flex items-center gap-2">
          {status ? (
            <span className={cn(
              "text-xs px-2 py-1 rounded-full",
              isRunning ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
            )}>
              {isRunning ? 'Running' : 'Stopped'}
            </span>
          ) : (
            <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400">
              Disconnected
            </span>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-2 mb-4">
        {!isRunning ? (
          <button
            onClick={start}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 text-green-400
                       hover:bg-green-500/30 transition-colors"
          >
            <Play size={16} />
            Start Browser
          </button>
        ) : (
          <button
            onClick={stop}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400
                       hover:bg-red-500/30 transition-colors"
          >
            <Square size={16} />
            Stop Browser
          </button>
        )}
        
        <button
          onClick={() => takeSnapshot()}
          disabled={!isRunning}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--glass-bg-elevated)]
                     hover:bg-[var(--glass-bg-hover)] transition-colors disabled:opacity-50"
        >
          <Camera size={16} />
          Snapshot
        </button>

        <button
          onClick={async () => {
            const result = await browserClient.savePDF();
            console.log('PDF saved:', result.path);
          }}
          disabled={!isRunning}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--glass-bg-elevated)]
                     hover:bg-[var(--glass-bg-hover)] transition-colors disabled:opacity-50"
        >
          <FileText size={16} />
          PDF
        </button>
      </div>

      {/* Tab List */}
      {isRunning && tabs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-tertiary)] uppercase">Open Tabs</p>
          {tabs.map((tab) => (
            <div 
              key={tab.targetId}
              className="flex items-center justify-between p-2 rounded-lg bg-[var(--glass-bg-hover)]"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{tab.title}</p>
                <p className="text-xs text-[var(--text-tertiary)] truncate">{tab.url}</p>
              </div>
              <button
                onClick={() => closeTab(tab.targetId)}
                className="p-1.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors"
              >
                <Square size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New Tab Input */}
      {isRunning && (
        <div className="flex items-center gap-2 mt-4">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter URL..."
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]
                       text-sm focus:outline-none focus:border-[var(--accent-chat)]"
          />
          <button
            onClick={() => openTab(url)}
            className="px-4 py-2 rounded-lg bg-[var(--accent-chat)] text-white hover:opacity-90"
          >
            Open
          </button>
        </div>
      )}

      {/* Snapshot Preview */}
      {snapshot && (
        <div className="mt-4 p-3 rounded-lg bg-[var(--glass-bg-hover)] max-h-64 overflow-auto">
          <p className="text-xs text-[var(--text-tertiary)] mb-2">Latest Snapshot</p>
          <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
            {snapshot.snapshot.substring(0, 500)}...
          </pre>
        </div>
      )}
    </GlassCard>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Canvas Host Panel
// ═════════════════════════════════════════════════════════════════════════════

function CanvasHostPanel() {
  const [iframeUrl, setIframeUrl] = useState('http://127.0.0.1:8080');

  return (
    <GlassCard className="p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <SquaresFour className="w-5 h-5 text-purple-400" />
          Canvas Host
        </h3>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs text-[var(--text-tertiary)] mb-2">Canvas URL</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={iframeUrl}
              onChange={(e) => setIframeUrl(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]
                         text-sm focus:outline-none focus:border-[var(--accent-chat)]"
            />
          </div>
        </div>

        <div className="h-64 rounded-lg border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-secondary)]">
          <iframe
            src={iframeUrl}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              // Push A2UI payload to canvas
              console.log('Push A2UI to canvas');
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400
                       hover:bg-purple-500/30 transition-colors"
          >
            <SquaresFour size={16} />
            Push A2UI
          </button>
          <button
            onClick={() => {
              // Present canvas
              console.log('Present canvas');
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--glass-bg-elevated)]
                       hover:bg-[var(--glass-bg-hover)] transition-colors"
          >
            <Play size={16} />
            Present
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// A2UI Panel
// ═════════════════════════════════════════════════════════════════════════════

const sampleA2UIPayload: A2UIPayload = {
  version: '1.0.0',
  surfaces: [
    {
      id: 'main',
      name: 'Demo',
      root: {
        type: 'Container',
        props: {
          direction: 'column',
          gap: 16,
          padding: 24,
          children: [
            {
              type: 'Card',
              props: {
                title: '✨ A2UI Integrated',
                subtitle: 'Connected to Backend',
                children: [
                  {
                    type: 'Text',
                    props: {
                      content: 'This A2UI is rendered by the React frontend and can communicate with the browser automation backend.',
                    },
                  },
                ],
              },
            },
            {
              type: 'Stack',
              props: {
                direction: 'horizontal',
                gap: 8,
                children: [
                  { type: 'Button', props: { label: 'Take Snapshot', variant: 'primary' } },
                  { type: 'Button', props: { label: 'Start Browser', variant: 'secondary' } },
                ],
              },
            },
            {
              type: 'Alert',
              props: {
                variant: 'info',
                title: 'Architecture',
                message: 'UI → Browser Client → Kernel API → Browser Server → Playwright/CDP',
              },
            },
          ],
        },
      },
    },
  ],
};

function A2UIPanel() {
  const [, setDataModel] = useState({});

  const handleAction = useCallback((actionId: string, payload?: Record<string, unknown>) => {
    console.log('[A2UI] Action:', actionId, payload);
    
    // Route actions to browser automation
    switch (actionId) {
      case 'Take Snapshot':
        browserClient.getSnapshot({ format: 'ai' });
        break;
      case 'Start Browser':
        browserClient.startBrowser();
        break;
    }
  }, []);

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <SquaresFour className="w-5 h-5 text-purple-400" />
          A2UI Renderer
        </h3>
      </div>
      
      <div className="h-96 overflow-auto">
        <A2UIRenderer
          payload={sampleA2UIPayload}
          onAction={handleAction}
          onDataModelChange={setDataModel}
        />
      </div>
    </GlassCard>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Main Integrated Component
// ═════════════════════════════════════════════════════════════════════════════

export function BrowserCapsuleIntegrated() {
  const [activeTab, setActiveTab] = useState<'browser' | 'canvas' | 'a2ui'>('browser');

  return (
    <div className="h-full flex flex-col p-4">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveTab('browser')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
            activeTab === 'browser' 
              ? 'bg-blue-500/20 text-blue-400' 
              : 'bg-[var(--glass-bg-elevated)] hover:bg-[var(--glass-bg-hover)]'
          )}
        >
          <Globe size={16} />
          Browser
        </button>
        <button
          onClick={() => setActiveTab('canvas')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
            activeTab === 'canvas' 
              ? 'bg-purple-500/20 text-purple-400' 
              : 'bg-[var(--glass-bg-elevated)] hover:bg-[var(--glass-bg-hover)]'
          )}
        >
          <SquaresFour size={16} />
          Canvas
        </button>
        <button
          onClick={() => setActiveTab('a2ui')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
            activeTab === 'a2ui' 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-[var(--glass-bg-elevated)] hover:bg-[var(--glass-bg-hover)]'
          )}
        >
          <Terminal size={16} />
          A2UI
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'browser' && <BrowserControlPanel />}
        {activeTab === 'canvas' && <CanvasHostPanel />}
        {activeTab === 'a2ui' && <A2UIPanel />}
      </div>

      {/* Status Bar */}
      <div className="mt-4 p-3 rounded-lg bg-[var(--glass-bg-elevated)] border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
          <div className="flex items-center gap-4">
            <span>Browser API: http://127.0.0.1:9222</span>
            <span>Canvas Host: http://127.0.0.1:8080</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Connected
          </div>
        </div>
      </div>
    </div>
  );
}

export default BrowserCapsuleIntegrated;
