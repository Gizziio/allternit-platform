/**
 * Gizzi Workspace Loader
 *
 * Loads agent workspace files and integrates with Gizzi state
 */
import type { WorkspaceSession, ContextPack } from './types';
import { getStartupTasks } from '../context/pack-builder';
export interface FileSystem {
    readFile(path: string): Promise<string>;
    listDirectory(path: string): Promise<{
        name: string;
        type: 'file' | 'directory';
    }[]>;
    exists(path: string): Promise<boolean>;
}
export interface LoadWorkspaceOptions {
    agentId: string;
    agentName: string;
    sessionId: string;
    fs: FileSystem;
    basePath: string;
}
export interface LoadedWorkspace {
    files: Map<string, string>;
    contextPack: ContextPack;
    startupTasks: ReturnType<typeof getStartupTasks>;
}
export declare function loadWorkspace(options: LoadWorkspaceOptions): Promise<LoadedWorkspace | null>;
export declare function executeStartupTasks(tasks: LoadedWorkspace['startupTasks'], sendMessage: (content: string) => void): Promise<void>;
export declare function enhanceSessionWithWorkspace(session: WorkspaceSession, workspace: LoadedWorkspace): WorkspaceSession;
