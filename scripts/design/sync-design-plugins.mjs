#!/usr/bin/env node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const CACHE_ROOT = path.join(REPO_ROOT, '.cache', 'design-plugin-sources');
const DEFAULT_OUTPUT_ROOT = path.join(os.homedir(), '.allternit', 'plugins');
const UI_SKILLS_DIRECTORY_URL = 'https://www.ui-skills.com/skills/';

const PLUGINS = [
  {
    id: 'frontend',
    name: 'Frontend',
    description: 'Interface design, audits, accessibility, and implementation polish.',
    summary: 'Imported UI skills packaged as one installable frontend capability bundle.',
    tags: ['design', 'frontend', 'ui', 'ui-skills'],
    skills: [
      {
        id: 'frontend-design',
        source: 'anthropics/skills',
        repoUrl: 'https://github.com/anthropics/skills.git',
        sourceSubpath: 'skills/frontend-design',
      },
      {
        id: 'baseline-ui',
        source: 'ibelick/ui-skills',
        repoUrl: 'https://github.com/ibelick/ui-skills.git',
        sourceSubpath: 'skills/baseline-ui',
      },
      {
        id: 'fixing-accessibility',
        source: 'ibelick/ui-skills',
        repoUrl: 'https://github.com/ibelick/ui-skills.git',
        sourceSubpath: 'skills/fixing-accessibility',
      },
      {
        id: 'fixing-metadata',
        source: 'ibelick/ui-skills',
        repoUrl: 'https://github.com/ibelick/ui-skills.git',
        sourceSubpath: 'skills/fixing-metadata',
      },
      {
        id: 'ui-ux-pro-max',
        source: 'nextlevelbuilder/ui-ux-pro-max-skill',
        repoUrl: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git',
        sourceSubpath: '.claude/skills/ui-ux-pro-max',
      },
      {
        id: 'design',
        source: 'nextlevelbuilder/ui-ux-pro-max-skill',
        repoUrl: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git',
        sourceSubpath: '.claude/skills/design',
      },
      {
        id: 'impeccable',
        source: 'pbakaus/impeccable',
        repoUrl: 'https://github.com/pbakaus/impeccable.git',
        sourceSubpath: 'plugin/skills/impeccable',
      },
    ],
  },
  {
    id: 'brand',
    name: 'Brand',
    description: 'Identity systems, assets, themes, generative visuals, and campaign direction.',
    summary: 'Imported brand and visual-system skills packaged as one installable asset bundle.',
    tags: ['design', 'brand', 'assets', 'ui-skills'],
    skills: [
      {
        id: 'canvas-design',
        source: 'anthropics/skills',
        repoUrl: 'https://github.com/anthropics/skills.git',
        sourceSubpath: 'skills/canvas-design',
      },
      {
        id: 'brand-guidelines',
        source: 'anthropics/skills',
        repoUrl: 'https://github.com/anthropics/skills.git',
        sourceSubpath: 'skills/brand-guidelines',
      },
      {
        id: 'theme-factory',
        source: 'anthropics/skills',
        repoUrl: 'https://github.com/anthropics/skills.git',
        sourceSubpath: 'skills/theme-factory',
      },
      {
        id: 'algorithmic-art',
        source: 'anthropics/skills',
        repoUrl: 'https://github.com/anthropics/skills.git',
        sourceSubpath: 'skills/algorithmic-art',
      },
      {
        id: 'brand',
        source: 'nextlevelbuilder/ui-ux-pro-max-skill',
        repoUrl: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git',
        sourceSubpath: '.claude/skills/brand',
      },
      {
        id: 'banner-design',
        source: 'nextlevelbuilder/ui-ux-pro-max-skill',
        repoUrl: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git',
        sourceSubpath: '.claude/skills/banner-design',
      },
    ],
  },
  {
    id: 'motion',
    name: 'Motion',
    description: 'Motion performance, presentations, animated media, and sequence-oriented design work.',
    summary: 'Imported motion and media skills packaged as one installable animation bundle.',
    tags: ['design', 'motion', 'media', 'ui-skills'],
    skills: [
      {
        id: 'fixing-motion-performance',
        source: 'ibelick/ui-skills',
        repoUrl: 'https://github.com/ibelick/ui-skills.git',
        sourceSubpath: 'skills/fixing-motion-performance',
      },
      {
        id: 'slides',
        source: 'nextlevelbuilder/ui-ux-pro-max-skill',
        repoUrl: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git',
        sourceSubpath: '.claude/skills/slides',
      },
      {
        id: 'pptx',
        source: 'anthropics/skills',
        repoUrl: 'https://github.com/anthropics/skills.git',
        sourceSubpath: 'skills/pptx',
      },
      {
        id: 'slack-gif-creator',
        source: 'anthropics/skills',
        repoUrl: 'https://github.com/anthropics/skills.git',
        sourceSubpath: 'skills/slack-gif-creator',
      },
    ],
  },
];

function repoCacheDir(repoUrl) {
  const parsed = new URL(repoUrl);
  const slug = parsed.pathname.replace(/^\//, '').replace(/\.git$/, '').replace(/\//g, '__');
  return path.join(CACHE_ROOT, slug);
}

async function runGit(args, cwd) {
  await execFile('git', args, cwd ? { cwd } : undefined);
}

async function ensureRepo(repoUrl) {
  const cacheDir = repoCacheDir(repoUrl);
  await fs.mkdir(CACHE_ROOT, { recursive: true });

  try {
    await fs.access(cacheDir);
    await runGit(['fetch', '--depth', '1', 'origin'], cacheDir);
    try {
      await runGit(['checkout', 'main'], cacheDir);
      await runGit(['reset', '--hard', 'origin/main'], cacheDir);
    } catch {
      await runGit(['checkout', 'master'], cacheDir);
      await runGit(['reset', '--hard', 'origin/master'], cacheDir);
    }
    return cacheDir;
  } catch {
    await runGit(['clone', '--depth', '1', repoUrl, cacheDir]);
    return cacheDir;
  }
}

async function removeDir(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

async function copyDir(sourceDir, targetDir) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  await fs.mkdir(targetDir, { recursive: true });

  for (const entry of entries) {
    if (entry.name === '.git') continue;
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDir(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

async function readJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function buildPluginManifest(plugin) {
  return {
    $schema: 'https://schemas.allternit.dev/plugin.json',
    id: plugin.id,
    name: plugin.name,
    description: plugin.description,
    version: '1.0.0',
    author: 'Allternit',
    category: 'design',
    enabled: true,
    source: 'local-bundle',
    sourceUrl: UI_SKILLS_DIRECTORY_URL,
    tags: plugin.tags,
    bundledSkillIds: plugin.skills.map((skill) => skill.id),
    designPlugin: {
      id: plugin.id,
      summary: plugin.summary,
      syncedAt: new Date().toISOString(),
    },
  };
}

async function syncPlugin(plugin, outputRoot) {
  const pluginDir = path.join(outputRoot, plugin.id);
  const skillsDir = path.join(pluginDir, 'skills');
  await fs.mkdir(skillsDir, { recursive: true });

  const importedSkills = [];

  for (const skill of plugin.skills) {
    const repoDir = await ensureRepo(skill.repoUrl);
    const sourceDir = path.join(repoDir, skill.sourceSubpath);
    const targetDir = path.join(skillsDir, skill.id);
    await removeDir(targetDir);
    await copyDir(sourceDir, targetDir);

    const configPath = path.join(targetDir, 'config.json');
    const existingConfig = await readJson(configPath);
    const mergedConfig = {
      ...existingConfig,
      name: existingConfig.name || skill.id,
      pluginId: plugin.id,
      pluginName: plugin.name,
      source: skill.source,
      sourceUrl: skill.repoUrl.replace(/\.git$/, ''),
      importedFrom: skill.sourceSubpath,
      syncedAt: new Date().toISOString(),
      enabled: existingConfig.enabled ?? true,
      tags: Array.isArray(existingConfig.tags) ? existingConfig.tags : [plugin.id, 'design-plugin'],
    };
    await writeJson(configPath, mergedConfig);

    importedSkills.push({
      id: skill.id,
      source: skill.source,
      repoUrl: skill.repoUrl.replace(/\.git$/, ''),
      sourceSubpath: skill.sourceSubpath,
      installedPath: targetDir,
    });
  }

  const manifest = buildPluginManifest(plugin);
  await writeJson(path.join(pluginDir, '.claude-plugin', 'plugin.json'), manifest);
  await writeJson(path.join(pluginDir, 'plugin.json'), manifest);
  await writeJson(path.join(pluginDir, '.claude-plugin', 'install-source.json'), {
    syncedAt: new Date().toISOString(),
    source: UI_SKILLS_DIRECTORY_URL,
    importedSkills,
  });
  await writeJson(path.join(pluginDir, 'bundle.manifest.json'), {
    pluginId: plugin.id,
    pluginName: plugin.name,
    importedSkills,
  });

  await fs.writeFile(
    path.join(pluginDir, 'README.md'),
    `# ${plugin.name}\n\n${plugin.description}\n\nBundled skills:\n${importedSkills
      .map((skill) => `- ${skill.id} — ${skill.source} (${skill.sourceSubpath})`)
      .join('\n')}\n`,
    'utf8',
  );

  return {
    pluginId: plugin.id,
    pluginName: plugin.name,
    pluginDir,
    importedSkills,
  };
}

async function main() {
  const outputRoot = process.argv[2]
    ? path.resolve(process.argv[2])
    : DEFAULT_OUTPUT_ROOT;

  await fs.mkdir(outputRoot, { recursive: true });

  const results = [];
  for (const plugin of PLUGINS) {
    const result = await syncPlugin(plugin, outputRoot);
    results.push(result);
  }

  const summary = {
    syncedAt: new Date().toISOString(),
    outputRoot,
    plugins: results,
  };

  await writeJson(path.join(REPO_ROOT, 'docs', 'design', 'design-plugin-runtime-bundles.json'), summary);

  console.log(`Synced ${results.length} design plugins into ${outputRoot}`);
  for (const result of results) {
    console.log(`- ${result.pluginName}: ${result.importedSkills.length} skills`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
