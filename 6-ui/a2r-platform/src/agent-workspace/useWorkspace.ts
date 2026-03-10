/**
 * React Hook for Agent Workspace
 * 
 * Provides reactive access to workspace operations with automatic
 * backend selection and error handling.
 * 
 * @example
 * ```tsx
 * function WorkspacePage() {
 *   const { 
 *     workspace, 
 *     backend, 
 *     loading, 
 *     error,
 *     tasks,
 *     refreshTasks 
 *   } = useWorkspace('/path/to/workspace');
 *   
 *   if (loading) return <Loading />;
 *   if (error) return <Error message={error.message} />;
 *   
 *   return (
 *     <div>
 *       <BackendBadge backend={backend} />
 *       <TaskList tasks={tasks} />
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  createWorkspace, 
  Backend, 
  WorkspaceAPI, 
  WorkspaceInfo,
  Task,
  MemoryEntry,
  Skill,
  Identity,
  PolicyRule,
} from './index';

export interface UseWorkspaceOptions {
  /** Auto-connect on mount */
  autoConnect?: boolean;
  /** Prefer HTTP backend over WASM */
  preferHttp?: boolean;
  /** Specific server URL (skips discovery) */
  serverUrl?: string;
  /** Auth credentials */
  auth?: { username: string; password: string };
}

export interface UseWorkspaceReturn {
  /** Workspace API instance */
  workspace: WorkspaceAPI | null;
  /** 
   * Workspace API with nested structure for compatibility.
   * Includes `api.workspace.getMetadata()` method.
   */
  api: WorkspaceAPI & {
    workspace: {
      getMetadata: () => Promise<{
        workspace_id: string;
        workspace_version: string;
        agent_name: string;
        created_at: string;
        layers: {
          cognitive: boolean;
          identity: boolean;
          governance: boolean;
          skills: boolean;
          business: boolean;
        };
      }>;
    };
  } | null;
  /** Backend type being used */
  backend: Backend | null;
  /** Workspace info */
  info: WorkspaceInfo | null;
  /** Loading state */
  loading: boolean;
  /** Error if any */
  error: Error | null;
  /** Whether connected to backend */
  isConnected: boolean;
  
  // Data caches
  tasks: Task[];
  memory: MemoryEntry[];
  skills: Skill[];
  identity: Identity | null;
  policyRules: PolicyRule[];
  
  // Actions
  refreshInfo: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshMemory: () => Promise<void>;
  refreshSkills: () => Promise<void>;
  refreshIdentity: () => Promise<void>;
  refreshAll: () => Promise<void>;
  
  // Mutations
  createTask: (input: { title: string; description?: string; priority?: 'low' | 'medium' | 'high' }) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  createMemory: (input: { type: 'note' | 'event' | 'observation' | 'decision'; content: string; tags?: string[] }) => Promise<void>;
  searchMemory: (query: string) => Promise<MemoryEntry[]>;
  installSkill: (id: string) => Promise<void>;
  uninstallSkill: (id: string) => Promise<void>;
  updateIdentity: (updates: Partial<Identity>) => Promise<void>;
  
  // Connection
  reconnect: () => Promise<boolean>;
}

export function useWorkspace(
  path: string | null,
  options: UseWorkspaceOptions = {}
): UseWorkspaceReturn {
  const { 
    autoConnect = true, 
    preferHttp = true,
    serverUrl,
    auth,
  } = options;

  const [workspace, setWorkspace] = useState<WorkspaceAPI | null>(null);
  const [backend, setBackend] = useState<Backend | null>(null);
  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Data caches
  const [tasks, setTasks] = useState<Task[]>([]);
  const [memory, setMemory] = useState<MemoryEntry[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [policyRules, setPolicyRules] = useState<PolicyRule[]>([]);

  // Initialize workspace
  useEffect(() => {
    if (!path || !autoConnect) {
      setWorkspace(null);
      setBackend(null);
      return;
    }

    let cancelled = false;

    async function init() {
      if (!path) return; // Double check for TS
      setLoading(true);
      setError(null);

      try {
        const ws = await createWorkspace(path, {
          preferHttp,
          serverUrl,
          auth,
        });

        if (cancelled) return;

        setWorkspace(ws);
        setBackend(ws.backend);
        setIsConnected(ws.isConnected());

        // Load initial data
        const [wsInfo, wsTasks, wsSkills, wsIdentity, wsPolicy] = await Promise.all([
          ws.getInfo().catch((err) => {
            console.error("[useWorkspace] Failed to get workspace info:", err);
            return null;
          }),
          ws.listTasks().catch((err) => {
            console.error("[useWorkspace] Failed to list tasks:", err);
            return [];
          }),
          ws.listSkills().catch((err) => {
            console.error("[useWorkspace] Failed to list skills:", err);
            return [];
          }),
          ws.getIdentity().catch((err) => {
            console.error("[useWorkspace] Failed to get identity:", err);
            return null;
          }),
          ws.listPolicyRules().catch((err) => {
            console.error("[useWorkspace] Failed to list policy rules:", err);
            return [];
          }),
        ]);

        if (cancelled) return;

        setInfo(wsInfo);
        setTasks(wsTasks);
        setSkills(wsSkills);
        setIdentity(wsIdentity);
        setPolicyRules(wsPolicy);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [path, autoConnect, preferHttp, serverUrl, auth?.username, auth?.password]);

  // Refresh actions
  const refreshInfo = useCallback(async () => {
    if (!workspace) return;
    const wsInfo = await workspace.getInfo();
    setInfo(wsInfo);
  }, [workspace]);

  const refreshTasks = useCallback(async () => {
    if (!workspace) return;
    const wsTasks = await workspace.listTasks();
    setTasks(wsTasks);
  }, [workspace]);

  const refreshMemory = useCallback(async () => {
    if (!workspace) return;
    const wsMemory = await workspace.listMemoryEntries();
    setMemory(wsMemory);
  }, [workspace]);

  const refreshSkills = useCallback(async () => {
    if (!workspace) return;
    const wsSkills = await workspace.listSkills();
    setSkills(wsSkills);
  }, [workspace]);

  const refreshIdentity = useCallback(async () => {
    if (!workspace) return;
    const wsIdentity = await workspace.getIdentity();
    setIdentity(wsIdentity);
  }, [workspace]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshInfo(),
      refreshTasks(),
      refreshMemory(),
      refreshSkills(),
      refreshIdentity(),
    ]);
  }, [refreshInfo, refreshTasks, refreshMemory, refreshSkills, refreshIdentity]);

  // Mutations
  const createTask = useCallback(async (input: { title: string; description?: string; priority?: 'low' | 'medium' | 'high' }) => {
    if (!workspace) throw new Error('Workspace not initialized');
    const task = await workspace.createTask({
      title: input.title,
      description: input.description,
      priority: input.priority,
    });
    await refreshTasks();
    return task;
  }, [workspace, refreshTasks]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    if (!workspace) throw new Error('Workspace not initialized');
    await workspace.updateTask(id, updates);
    await refreshTasks();
  }, [workspace, refreshTasks]);

  const deleteTask = useCallback(async (id: string) => {
    if (!workspace) throw new Error('Workspace not initialized');
    await workspace.deleteTask(id);
    await refreshTasks();
  }, [workspace, refreshTasks]);

  const createMemory = useCallback(async (input: { type: 'note' | 'event' | 'observation' | 'decision'; content: string; tags?: string[] }) => {
    if (!workspace) throw new Error('Workspace not initialized');
    await workspace.createMemoryEntry({
      type: input.type,
      content: input.content,
      tags: input.tags,
    });
    await refreshMemory();
  }, [workspace, refreshMemory]);

  const searchMemory = useCallback(async (query: string) => {
    if (!workspace) throw new Error('Workspace not initialized');
    return workspace.searchMemory(query);
  }, [workspace]);

  const installSkill = useCallback(async (id: string) => {
    if (!workspace) throw new Error('Workspace not initialized');
    await workspace.installSkill(id);
    await refreshSkills();
  }, [workspace, refreshSkills]);

  const uninstallSkill = useCallback(async (id: string) => {
    if (!workspace) throw new Error('Workspace not initialized');
    await workspace.uninstallSkill(id);
    await refreshSkills();
  }, [workspace, refreshSkills]);

  const updateIdentity = useCallback(async (updates: Partial<Identity>) => {
    if (!workspace) throw new Error('Workspace not initialized');
    await workspace.updateIdentity(updates);
    await refreshIdentity();
  }, [workspace, refreshIdentity]);

  const reconnect = useCallback(async () => {
    if (!workspace) return false;
    const connected = await workspace.reconnect();
    setIsConnected(connected);
    if (connected) {
      await refreshAll();
    }
    return connected;
  }, [workspace, refreshAll]);

  // Construct API object with nested workspace.getMetadata() for compatibility
  const api = useMemo(() => {
    if (!workspace) return null;
    
    // Create getMetadata function that returns workspace metadata
    const getMetadata = async () => {
      // Try to get metadata from WASM instance if available
      const wasmInstance = (workspace as any).getWasmInstance?.();
      if (wasmInstance) {
        const meta = wasmInstance.getMetadata();
        return {
          workspace_id: meta.workspace_id || workspace.path,
          workspace_version: meta.workspace_version || '0.1.0',
          agent_name: meta.agent_name || 'Agent',
          created_at: meta.created_at || new Date().toISOString(),
          layers: {
            cognitive: meta.layers?.cognitive ?? true,
            identity: meta.layers?.identity ?? true,
            governance: meta.layers?.governance ?? true,
            skills: meta.layers?.skills ?? true,
            business: meta.layers?.business ?? false,
          },
        };
      }
      
      // Fallback for HTTP backend - construct from available info
      return {
        workspace_id: info?.id || workspace.path,
        workspace_version: info?.version || '0.1.0',
        agent_name: identity?.name || 'Agent',
        created_at: new Date().toISOString(),
        layers: {
          cognitive: true,
          identity: true,
          governance: true,
          skills: true,
          business: false,
        },
      };
    };
    
    return {
      ...workspace,
      workspace: {
        getMetadata,
      },
    };
  }, [workspace, info, identity]);

  return {
    workspace,
    api,
    backend,
    info,
    loading,
    error,
    isConnected,
    
    tasks,
    memory,
    skills,
    identity,
    policyRules,
    
    refreshInfo,
    refreshTasks,
    refreshMemory,
    refreshSkills,
    refreshIdentity,
    refreshAll,
    
    createTask,
    updateTask,
    deleteTask,
    createMemory,
    searchMemory,
    installSkill,
    uninstallSkill,
    updateIdentity,
    
    reconnect,
  };
}

export default useWorkspace;
