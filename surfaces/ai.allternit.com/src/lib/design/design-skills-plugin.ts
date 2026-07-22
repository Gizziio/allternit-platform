/**
 * Vite dev-server plugin for daemon-side Allternit Design skill discovery.
 *
 * In development this mounts `/api/design/skills/discover` and scans the
 * canonical skill directories:
 *   - ~/.claude/skills/
 *   - <cwd>/.claude/skills/
 *   - <cwd>/skills/
 *
 * In production the Vite proxy forwards `/api/*` to the Allternit backend,
 * so this plugin is dev-only. The backend should implement the same contract.
 */

import type { Plugin } from 'vite';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { parseSkillMarkdown } from './skill-registry';
import type { DiscoverSkillsResponse } from './skills-api';

interface ScannedSkill {
  id: string;
  name: string;
  path: string;
  source: string;
  manifest: Record<string, unknown>;
}

async function directoryExists(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function scanSkillDirectory(
  root: string,
  sourceLabel: string,
): Promise<ScannedSkill[]> {
  const skills: ScannedSkill[] = [];
  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    return skills;
  }

  for (const entry of entries) {
    const skillDir = path.join(root, entry);
    const skillMd = path.join(skillDir, 'SKILL.md');
    try {
      const stat = await fs.stat(skillMd);
      if (!stat.isFile()) continue;
      const raw = await fs.readFile(skillMd, 'utf-8');
      const record = parseSkillMarkdown(entry, raw, []);
      skills.push({
        id: record.id,
        name: record.name,
        path: skillDir,
        source: sourceLabel,
        manifest: {
          description: record.description,
          mode: record.mode,
          scenario: record.scenario,
          triggers: record.triggers,
          inputs: record.inputs,
          parameters: record.parameters,
          outputs: record.outputs,
          craft: record.craft,
          designSystem: record.designSystem,
          examplePrompt: record.examplePrompt,
        },
      });
    } catch {
      // Skip unreadable or malformed skill folders.
    }
  }

  return skills;
}

async function discoverSkills(cwd: string): Promise<DiscoverSkillsResponse> {
  const scannedPaths: string[] = [];
  const all: ScannedSkill[] = [];

  const homeSkills = path.join(os.homedir(), '.claude', 'skills');
  const projectSkills = path.join(cwd, 'skills');
  const projectClaudeSkills = path.join(cwd, '.claude', 'skills');

  for (const [dir, source] of [
    [homeSkills, 'home-claude'] as const,
    [projectClaudeSkills, 'project-claude'] as const,
    [projectSkills, 'project'] as const,
  ]) {
    if (await directoryExists(dir)) {
      scannedPaths.push(dir);
      const found = await scanSkillDirectory(dir, source);
      all.push(...found);
    }
  }

  return {
    skills: all,
    scanned_paths: scannedPaths,
    total: all.length,
  };
}

export function designSkillsPlugin(): Plugin {
  return {
    name: 'allternit-design-skills',
    configureServer(server) {
      server.middlewares.use('/api/design/skills/discover', (req, res, next) => {
        if (req.method !== 'GET') return next();

        const url = new URL(req.url || '/', 'http://localhost');
        const cwd = url.searchParams.get('cwd') || process.cwd();

        discoverSkills(cwd)
          .then((payload) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(payload));
          })
          .catch((err) => {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: String(err) }));
          });
      });
    },
  };
}
