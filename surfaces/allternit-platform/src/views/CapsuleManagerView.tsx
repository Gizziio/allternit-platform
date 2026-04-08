/**
 * CapsuleManagerView
 *
 * View for managing MCP Interactive Capsules.
 * Wraps the shell CapsuleManager with platform styling.
 */

'use client';

import React, { useState, useCallback } from 'react';
import type { InteractiveCapsule, CapsuleEvent } from '@allternit/mcp-apps-adapter';
import { GlassSurface } from '@/design/GlassSurface';
import { ErrorBoundary } from '@/components/error-boundary';

// TODO: Import from @allternit/shell-ui once package is added to dependencies
// import { CapsuleManager as ShellCapsuleManager } from '../../../7-apps/shell/web/src/components/CapsuleManager';
// import { CapsuleRenderer as ShellCapsuleRenderer } from '../../../7-apps/shell/web/src/components/CapsuleRenderer';

// Stub components until shell-ui package is available
interface CapsuleManagerProps {
  onViewCapsule?: (capsule: InteractiveCapsule) => void;
  defaultToolId?: string;
  agentId?: string;
}

function ShellCapsuleManager({ onViewCapsule, defaultToolId }: CapsuleManagerProps) {
  return (
    <div className="p-4 text-center">
      <p className="text-[var(--text-secondary)]">Capsule Manager</p>
      <p className="text-sm text-[var(--text-tertiary)] mt-2">
        Tool ID: {defaultToolId}
      </p>
      <button
        onClick={() => {
          // Stub: create a dummy capsule for testing
          const dummyCapsule: InteractiveCapsule = {
            id: 'stub-capsule-001',
            type: 'test',
            state: 'active',
            toolId: defaultToolId || 'test-tool',
            surface: {
              html: '<div>Test Capsule</div>',
              css: '',
              js: '',
              permissions: [],
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          onViewCapsule?.(dummyCapsule);
        }}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Open Test Capsule
      </button>
    </div>
  );
}

interface CapsuleRendererProps {
  capsule: InteractiveCapsule;
  onClose?: () => void;
  onEvent?: (event: CapsuleEvent) => void;
  onToolInvoke?: (toolName: string, params: unknown) => Promise<unknown>;
  defaultSize?: { width: number; height: number };
  showLogs?: boolean;
}

function ShellCapsuleRenderer({
  capsule,
  onClose,
  onEvent,
  onToolInvoke,
}: CapsuleRendererProps) {
  const handleTestEvent = () => {
    const event: CapsuleEvent = {
      id: 'event-001',
      capsuleId: capsule.id,
      direction: 'to_ui',
      type: 'test',
      payload: { message: 'Test event' },
      timestamp: new Date().toISOString(),
      source: 'user',
    };
    onEvent?.(event);
  };

  const handleTestTool = async () => {
    await onToolInvoke?.('test-tool', { test: true });
  };

  return (
    <div className="p-4">
      <div className="border border-[var(--border-subtle)] rounded p-4">
        <h3 className="font-semibold mb-2">Capsule: {capsule.id}</h3>
        <p className="text-sm text-[var(--text-secondary)]">Type: {capsule.type}</p>
        <p className="text-sm text-[var(--text-secondary)]">State: {capsule.state}</p>
        <p className="text-sm text-[var(--text-secondary)]">Tool: {capsule.toolId}</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleTestEvent}
            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
          >
            Test Event
          </button>
          <button
            onClick={handleTestTool}
            className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
          >
            Test Tool
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface CapsuleManagerViewProps {
  context?: {
    viewId?: string;
    viewType?: string;
    title?: string;
  };
}

export function CapsuleManagerView({ context }: CapsuleManagerViewProps) {
  const [viewingCapsule, setViewingCapsule] = useState<InteractiveCapsule | null>(null);

  const handleViewCapsule = useCallback((capsule: InteractiveCapsule) => {
    setViewingCapsule(capsule);
  }, []);

  const handleCloseCapsule = useCallback(() => {
    setViewingCapsule(null);
  }, []);

  if (viewingCapsule) {
    return (
      <GlassSurface className="h-full w-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-lg font-semibold">Capsule: {viewingCapsule.id}</h2>
          <button
            onClick={handleCloseCapsule}
            className="p-2 rounded-lg hover:bg-[var(--rail-hover)] transition-colors"
          >
            <span className="text-sm">← Back to Manager</span>
          </button>
        </div>
        <div className="flex-1 p-4 overflow-auto">
          <ErrorBoundary fallback={<div>Failed to load capsule</div>}>
            <ShellCapsuleRenderer
              capsule={viewingCapsule}
              onClose={handleCloseCapsule}
              onEvent={(event: CapsuleEvent) => console.log('[CapsuleManagerView] Event:', event)}
              onToolInvoke={async (toolName: string, params: unknown) => {
                console.log('[CapsuleManagerView] Tool invoked:', toolName, params);
                return { success: true };
              }}
              defaultSize={{ width: 800, height: 600 }}
              showLogs
            />
          </ErrorBoundary>
        </div>
      </GlassSurface>
    );
  }

  return (
    <GlassSurface className="h-full w-full flex flex-col">
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <h2 className="text-lg font-semibold">MCP Capsule Manager</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          Manage interactive capsules for agent tools
        </p>
        {context?.viewId && (
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            View ID: {context.viewId}
          </p>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <ErrorBoundary fallback={<div>Failed to load capsule manager</div>}>
          <ShellCapsuleManager
            onViewCapsule={handleViewCapsule}
            defaultToolId="test-tool"
          />
        </ErrorBoundary>
      </div>
    </GlassSurface>
  );
}

export default CapsuleManagerView;
