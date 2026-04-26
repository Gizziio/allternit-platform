/**
 * Gizzi Workspace State Store
 *
 * Enhanced state management with workspace/agent context integration
 * Extends AppStateStore with agent workspace capabilities
 */
import { AppStateStore } from './AppStateStore';
import type { AssistantMessage } from '../types/message';
import type { ContextPack, WorkspaceSession } from '../workspace/types';
import type { FileSystem } from '../workspace/loader';
export interface WorkspaceEnhancedState {
    session: WorkspaceSession | null;
    contextPack: ContextPack | null;
    isAgentMode: boolean;
}
export declare class WorkspaceStateStore extends AppStateStore {
    private workspaceState;
    private fs;
    private basePath;
    private taskScheduler;
    private workspaceWatcher;
    constructor();
    setFileSystem(fs: FileSystem, basePath: string): void;
    activateAgentMode(agentId: string, agentName: string): Promise<boolean>;
    sendMessageWithContext(content: string, options?: {
        skipContext?: boolean;
        onThinking?: (thinking: string) => void;
        onResponse?: (response: AssistantMessage) => void;
    }): Promise<void>;
    getContextPack(): ContextPack | null;
    getSystemPrompt(): string;
    isAgentMode(): boolean;
    requiresPermission(action: string): boolean;
    getTrustTiers(): {
        tier1: import("../workspace/types").TrustTier;
        tier2: import("../workspace/types").TrustTier;
        tier3: import("../workspace/types").TrustTier;
    } | null;
    refreshContext(): Promise<void>;
    resetAgentMode(): void;
}
export declare function getWorkspaceStore(): WorkspaceStateStore;
export declare function setWorkspaceStore(store: WorkspaceStateStore | null): void;
