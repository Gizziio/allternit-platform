#!/usr/bin/env bun
import { createAllternit } from "@allternit/sdk";
export declare function getLatestRelease(skip?: string): Promise<string>;
type Commit = {
    hash: string;
    author: string | null;
    message: string;
    areas: Set<string>;
};
export declare function getCommits(from: string, to: string): Promise<Commit[]>;
export declare function generateChangelog(commits: Commit[], allternit: Awaited<ReturnType<typeof createAllternit>>): Promise<string[]>;
export declare function getContributors(from: string, to: string): Promise<Map<string, Set<string>>>;
export declare function buildNotes(from: string, to: string): Promise<string[]>;
export {};
//# sourceMappingURL=changelog.d.ts.map