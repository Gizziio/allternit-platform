/**
 * Allternit Advisor Skill
 *
 * A built-in skill that reads repository context (AGENTS.md, README,
 * package.json, file structure) and produces actionable guidance for
 * agent sessions.  Registered automatically when an Advisor-compatible
 * SKILL.md is discovered or can be invoked directly.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
// ─── Repo context reader ─────────────────────────────────────────────────────
const CONTEXT_FILES = [
    'AGENTS.md',
    'README.md',
    'README',
    'CLAUDE.md',
    '.cursorrules',
    'package.json',
    'Cargo.toml',
    'pyproject.toml',
    'go.mod',
    'Makefile',
    'Dockerfile',
];
const IGNORED_DIRS = new Set([
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    'target',
    '__pycache__',
    '.venv',
    'venv',
]);
/**
 * Reads the repository context from a given directory, collecting guidance
 * files, project metadata, and a shallow directory tree.
 */
export async function readRepoContext(repoRoot) {
    const files = [];
    let agentGuidance = '';
    let projectMetadata = {};
    for (const name of CONTEXT_FILES) {
        const filePath = join(repoRoot, name);
        try {
            const content = await readFile(filePath, 'utf8');
            const info = await stat(filePath);
            files.push({ path: name, content, size: info.size });
            if (name === 'AGENTS.md') {
                agentGuidance = content;
            }
            if (name === 'package.json') {
                try {
                    projectMetadata = JSON.parse(content);
                }
                catch {
                    // Non-JSON package.json — skip
                }
            }
            if (name === 'Cargo.toml') {
                projectMetadata.cargo_toml = content.slice(0, 4000);
            }
        }
        catch {
            // File does not exist — skip
        }
    }
    let topLevelDirs = [];
    try {
        const entries = await readdir(repoRoot, { withFileTypes: true });
        topLevelDirs = entries
            .filter((e) => e.isDirectory() && !IGNORED_DIRS.has(e.name))
            .map((e) => e.name)
            .sort();
    }
    catch {
        // Cannot read root — leave empty
    }
    return { root: repoRoot, files, agentGuidance, projectMetadata, topLevelDirs };
}
/**
 * Creates the Allternit Advisor tool definition.
 *
 * The advisor reads repo context and produces a structured guidance block
 * that can be injected into the agent's system prompt or returned as a
 * tool call result.
 */
export function createAdvisorTool(options = {}) {
    return {
        name: 'allternit_advisor',
        description: 'Reads the current repository context (AGENTS.md, README, project config, file tree) and returns structured guidance including project conventions, active tasks, and suggested next actions.',
        input_schema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Optional natural-language question about the project. When omitted, the advisor returns a full context summary.',
                },
                focus: {
                    type: 'string',
                    enum: ['overview', 'conventions', 'tasks', 'structure', 'dependencies'],
                    description: 'Narrow the advisory to a specific aspect of the project.',
                },
            },
            required: [],
        },
        metadata: { category: 'skills', isDestructive: false },
        execute: async (args) => {
            const repoRoot = options.repoRoot ?? process.cwd();
            const ctx = await readRepoContext(repoRoot);
            return buildAdvisoryResponse(ctx, args.query, args.focus);
        },
    };
}
function buildAdvisoryResponse(ctx, query, focus) {
    const guidanceLines = [];
    if (ctx.agentGuidance) {
        // Extract the first ~2000 chars of AGENTS.md as primary guidance
        guidanceLines.push(ctx.agentGuidance.slice(0, 2000));
    }
    const projectName = ctx.projectMetadata.name ??
        ctx.projectMetadata.package?.name ??
        'Unknown project';
    const description = ctx.projectMetadata.description ?? '';
    const overview = {
        project: projectName,
        description,
        root: ctx.root,
        topLevelDirs: ctx.topLevelDirs,
        contextFiles: ctx.files.map((f) => ({ path: f.path, size: f.size })),
    };
    let conventions = '';
    if (ctx.agentGuidance) {
        // Extract sections that look like conventions / rules
        const lines = ctx.agentGuidance.split('\n');
        const convLines = [];
        let inSection = false;
        for (const line of lines) {
            if (/^#+\s*(convention|style|rule|pattern)/i.test(line)) {
                inSection = true;
            }
            else if (/^#+\s/i.test(line)) {
                inSection = false;
            }
            if (inSection)
                convLines.push(line);
        }
        conventions = convLines.join('\n').slice(0, 1500);
    }
    const response = {
        overview,
        guidance: guidanceLines.join('\n').slice(0, 3000),
    };
    if (!focus || focus === 'overview') {
        response.overview = overview;
    }
    if (!focus || focus === 'conventions') {
        response.conventions = conventions || 'No explicit convention sections found in AGENTS.md.';
    }
    if (!focus || focus === 'structure') {
        response.structure = { topLevelDirs: ctx.topLevelDirs };
    }
    if (!focus || focus === 'dependencies') {
        response.dependencies = extractDependencies(ctx.projectMetadata);
    }
    if (query) {
        response.query = query;
        response.answer =
            `Based on the repository context for "${projectName}":\n\n` +
                response.guidance;
    }
    return response;
}
function extractDependencies(metadata) {
    const deps = {};
    if (metadata.dependencies)
        deps.runtime = metadata.dependencies;
    if (metadata.devDependencies)
        deps.development = metadata.devDependencies;
    if (metadata.peerDependencies)
        deps.peer = metadata.peerDependencies;
    // Cargo-style
    if (metadata.cargo_toml) {
        deps.cargo = 'See Cargo.toml for Rust dependencies';
    }
    return deps;
}
/**
 * Loads the advisor as a skill manifest compatible with the skill registry.
 */
export function advisorSkillManifest() {
    return {
        name: 'allternit-advisor',
        version: '1.0.0',
        description: 'Reads repository context and provides structured project guidance, conventions, and task awareness to agent sessions.',
        tools: ['allternit_advisor'],
        entrypoint: 'sdk/allternit-sdk/src/ai-runtime/skills/advisor.ts',
    };
}
