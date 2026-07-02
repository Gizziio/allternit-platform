"use client";

import React from 'react';

export function ChatErrorFallback({ error }: { error?: Error }): React.ReactNode {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2 text-[var(--text-primary)]">
          Chat Error
        </h2>
        <p className="text-[var(--text-secondary)] mb-4">
          There was a problem loading the chat interface.
        </p>
        {error && (
          <pre className="text-[12px] text-left bg-red-400/10 text-[var(--text-primary)] p-3 rounded-md max-w-[500px] max-h-[200px] overflow-auto mb-4 font-mono">
            {error.message}
            {'\n'}
            {error.stack}
          </pre>
        )}
        <button type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-[var(--accent-chat)] text-[var(--shell-control-active-fg)] rounded-md border-none cursor-pointer hover:opacity-90 transition-opacity"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

export function OpenClawErrorFallback({ error }: { error?: Error }): React.ReactNode {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center max-w-[740px]">
        <h2 className="text-xl font-semibold mb-2 text-[var(--text-primary)]">
          OpenClaw UI Error
        </h2>
        <p className="text-[var(--text-secondary)] mb-4">
          The OpenClaw control surface crashed during render.
        </p>
        {error && (
          <pre className="text-[12px] text-left bg-red-400/10 text-[var(--text-primary)] p-3 rounded-md max-h-[260px] overflow-auto mb-4 font-mono">
            {error.message}
            {'\n'}
            {error.stack}
          </pre>
        )}
        <button type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-[var(--accent-chat)] text-[var(--shell-control-active-fg)] rounded-md border-none cursor-pointer hover:opacity-90 transition-opacity"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

export function ErrorFallbackWrapper({ 
  viewName, 
  error, 
  reset 
}: { 
  viewName: string; 
  error?: Error; 
  reset?: () => void; 
}): React.ReactNode {
  return (
    <div className="flex flex-col items-center justify-center h-full p-10 text-center bg-[var(--shell-frame-bg)]">
      <div className="size-16 rounded-full bg-red-400/10 flex items-center justify-center mb-6">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--status-error)" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
        {viewName} Error
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-[400px]">
        Something went wrong loading this view. {error?.message && `(${error.message})`}
      </p>
      <div className="flex gap-3">
        {reset && (
          <button type="button"
            onClick={reset}
            className="px-5 py-2.5 rounded-lg border-none bg-[var(--accent-primary)] text-[var(--shell-frame-bg)] text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        )}
        <button type="button"
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--text-primary)] text-sm cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

export function ElementsView(): React.ReactNode {
  return (
    <div className="flex h-full items-center justify-center p-8 bg-[var(--bg-primary)]">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2 text-[var(--text-primary)]">
          Elements
        </h2>
        <p className="text-[var(--text-secondary)]">
          Component library and design system elements.
        </p>
      </div>
    </div>
  );
}
