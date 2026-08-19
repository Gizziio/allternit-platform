/**
 * Allternit Advisor Skill
 *
 * A built-in skill that reads repository context (AGENTS.md, README,
 * package.json, file structure) and produces actionable guidance for
 * agent sessions.  Registered automatically when an Advisor-compatible
 * SKILL.md is discovered or can be invoked directly.
 */
import type { ToolDefinition } from '../tools/types.js';
interface RepoContext {
    root: string;
    files: RepoFile[];
    agentGuidance: string;
    projectMetadata: Record<string, unknown>;
    topLevelDirs: string[];
}
interface RepoFile {
    path: string;
    content: string;
    size: number;
}
/**
 * Reads the repository context from a given directory, collecting guidance
 * files, project metadata, and a shallow directory tree.
 */
export declare function readRepoContext(repoRoot: string): Promise<RepoContext>;
export interface AdvisorOptions {
    /** Root directory to scan. Defaults to cwd or the agent workspace. */
    repoRoot?: string;
}
/**
 * Creates the Allternit Advisor tool definition.
 *
 * The advisor reads repo context and produces a structured guidance block
 * that can be injected into the agent's system prompt or returned as a
 * tool call result.
 */
export declare function createAdvisorTool(options?: AdvisorOptions): ToolDefinition;
/**
 * Loads the advisor as a skill manifest compatible with the skill registry.
 */
export declare function advisorSkillManifest(): {
    name: string;
    version: string;
    description: string;
    tools: string[];
    entrypoint: string;
};
export {};
