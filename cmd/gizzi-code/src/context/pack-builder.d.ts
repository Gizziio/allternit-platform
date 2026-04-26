/**
 * Gizzi Context Pack Builder
 *
 * Builds structured context packs from workspace files
 * Production-quality implementation matching Allternit platform
 */
import type { ContextPack, ScheduledTask, WorkspaceFile } from '../workspace/types';
export declare function classifyFile(filePath: string): WorkspaceFile['type'];
export declare function parseSoulMd(content: string): {
    trustTiers: ContextPack['trustTiers'];
    identity: Partial<ContextPack['identity']>;
};
export declare function parseHeartbeatMd(content: string): ScheduledTask[];
export declare function buildSystemPrompt(pack: ContextPack): string;
export interface BuildContextPackOptions {
    sessionId: string;
    agentId: string;
    agentName: string;
    files: Map<string, string>;
}
export declare function buildContextPack(options: BuildContextPackOptions): ContextPack;
export declare function getStartupTasks(pack: ContextPack): ScheduledTask[];
export declare function requiresPermission(pack: ContextPack, action: string): boolean;
export declare function shouldRefreshContext(pack: ContextPack): boolean;
