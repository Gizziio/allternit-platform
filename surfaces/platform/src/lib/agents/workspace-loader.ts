/**
 * Workspace Loader - Desktop Integration
 * 
 * Integrates workspace loading into the Desktop app.
 * Auto-loads GIZZI.md at session start for all surfaces.
 */

import type { WorkspaceContext, LoadWorkspaceOptions } from '@gizzi/workspace-loader';
import { loadWorkspaceContext, buildContextPack, buildSystemPrompt } from '@gizzi/workspace-loader';

// ============================================================================
// Desktop API
// ============================================================================

/**
 * Initialize session with workspace context
 */
export async function initializeSessionWithWorkspace(
  sessionId: string,
  workspacePath: string,
  surface: 'chat' | 'cowork' | 'code' | 'browser',
  subdirectory?: string
): Promise<{
  context: WorkspaceContext;
  contextPack: string;
  systemPrompt: string;
}> {
  console.log('[Desktop] Initializing session with workspace:', {
    sessionId,
    workspacePath,
    surface,
    subdirectory,
  });
  
  // Load workspace context
  const context = await loadWorkspaceContext({
    workspacePath,
    subdirectory,
    skipGlobal: false,
    skipWorkspace: false,
  });
  
  // Build context pack
  const contextPack = buildContextPack(context);
  
  // Build system prompt
  const systemPrompt = buildSystemPrompt(contextPack);
  
  // Send to backend (initialize session with context)
  await fetch(`/api/v1/core/sessions/${sessionId}/initialize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      contextPack,
      systemPrompt,
      workspace: {
        hasGizziMd: !!context.gizziMd,
        hasWorkspace: !!context.governance,
        path: workspacePath,
      },
    }),
  });
  
  return { context, contextPack, systemPrompt };
}

/**
 * Refresh workspace context (e.g., after user edits GIZZI.md)
 */
export async function refreshWorkspaceContext(
  sessionId: string,
  workspacePath: string
): Promise<WorkspaceContext> {
  const context = await loadWorkspaceContext({
    workspacePath,
    skipGlobal: false,
    skipWorkspace: false,
  });
  
  // Update session with new context
  await fetch(`/api/v1/core/sessions/${sessionId}/context`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contextPack: buildContextPack(context),
    }),
  });
  
  return context;
}

/**
 * Watch workspace files for changes (auto-refresh)
 */
export function watchWorkspaceFiles(
  workspacePath: string,
  onChange: (context: WorkspaceContext) => void
): () => void {
  // In production, use chokidar or similar
  // const watcher = chokidar.watch([
  //   path.join(workspacePath, 'GIZZI.md'),
  //   path.join(workspacePath, '.gizzi/workspace/**/*'),
  // ]);
  
  // watcher.on('change', async (filePath) => {
  //   console.log('[WorkspaceWatcher] File changed:', filePath);
  //   const context = await loadWorkspaceContext({ workspacePath });
  //   onChange(context);
  // });
  
  // return () => watcher.close();
  
  return () => {};
}
