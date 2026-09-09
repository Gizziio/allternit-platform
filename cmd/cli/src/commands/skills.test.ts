import assert from 'node:assert/strict';
import test from 'node:test';
import { Command } from 'commander';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createSkillsCommand } from './skills.js';
import {
  findSkillsLock,
  loadSkillsLock,
  verifyLockedSkill,
} from './skills-lock.js';

function buildProgram(): Command {
  const program = new Command();
  program.exitOverride();
  function enableExitOverride(command: Command): void {
    command.exitOverride();
    for (const sub of command.commands) enableExitOverride(sub);
  }
  const command = createSkillsCommand();
  enableExitOverride(command);
  program.addCommand(command);
  return program;
}

async function withSilencedConsole(fn: () => Promise<void>): Promise<void> {
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = () => {};
  console.warn = () => {};
  try {
    await fn();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

async function makeWorkspace(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'allternit-skills-test-'));
  await fs.mkdir(path.join(root, 'layer4-skills', 'demo-skill'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'layer4-skills', 'demo-skill', 'SKILL.md'),
    '---\nname: demo-skill\nversion: 1.0.0\ndescription: A demo skill\n---\n\nDo demo things.\n',
  );
  await fs.writeFile(
    path.join(root, 'workspace.json'),
    JSON.stringify({
      name: 'test-workspace',
      version: '1.0.0',
      layers: { skills: 'layer4-skills' },
      skills: [],
    }),
  );
  return root;
}

test('skills install copies skill from layer4-skills into the agent-facing skills directory', async () => {
  const root = await makeWorkspace();
  try {
    await withSilencedConsole(async () => {
      await buildProgram().parseAsync(['node', 'allternit', 'skills', 'install', 'demo-skill', '-p', root]);
    });

    const installed = await fs.readFile(path.join(root, 'skills', 'demo-skill', 'SKILL.md'), 'utf-8');
    assert.match(installed, /demo-skill/);

    const config = JSON.parse(await fs.readFile(path.join(root, 'workspace.json'), 'utf-8'));
    assert.deepEqual(config.skills, ['demo-skill']);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('skills install reports an error when the skill is not in the workspace skill source', async () => {
  const root = await makeWorkspace();
  try {
    await withSilencedConsole(async () => {
      await buildProgram().parseAsync(['node', 'allternit', 'skills', 'install', 'nope', '-p', root]);
    });

    await assert.rejects(fs.access(path.join(root, 'skills', 'nope', 'SKILL.md')));
    const config = JSON.parse(await fs.readFile(path.join(root, 'workspace.json'), 'utf-8'));
    assert.deepEqual(config.skills, []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('skills uninstall removes the installed skill and updates the workspace registry', async () => {
  const root = await makeWorkspace();
  try {
    await withSilencedConsole(async () => {
      await buildProgram().parseAsync(['node', 'allternit', 'skills', 'install', 'demo-skill', '-p', root]);
      await buildProgram().parseAsync(['node', 'allternit', 'skills', 'uninstall', 'demo-skill', '-p', root]);
    });

    await assert.rejects(fs.access(path.join(root, 'skills', 'demo-skill', 'SKILL.md')));

    const config = JSON.parse(await fs.readFile(path.join(root, 'workspace.json'), 'utf-8'));
    assert.deepEqual(config.skills, []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('skills uninstall of a non-installed skill is a no-op', async () => {
  const root = await makeWorkspace();
  try {
    await withSilencedConsole(async () => {
      await buildProgram().parseAsync(['node', 'allternit', 'skills', 'uninstall', 'demo-skill', '-p', root]);
    });

    const config = JSON.parse(await fs.readFile(path.join(root, 'workspace.json'), 'utf-8'));
    assert.deepEqual(config.skills, []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('skills-lock: verifies ok, mismatch, and missing against a lockfile', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'allternit-lock-test-'));
  try {
    const skillPath = 'skills/core/demo/SKILL.md';
    const content = '# Demo\n';
    await fs.mkdir(path.dirname(path.join(root, skillPath)), { recursive: true });
    await fs.writeFile(path.join(root, skillPath), content);

    const goodHash = crypto.createHash('sha256').update(content).digest('hex');
    const locked = { source: 'demo/skills', sourceType: 'github', skillPath, computedHash: goodHash };

    assert.equal(await verifyLockedSkill(root, locked), 'ok');
    assert.equal(await verifyLockedSkill(root, { ...locked, computedHash: '0'.repeat(64) }), 'mismatch');
    assert.equal(
      await verifyLockedSkill(root, { ...locked, skillPath: 'skills/core/gone/SKILL.md' }),
      'missing',
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('skills-lock: findSkillsLock walks up from nested directories; loadSkillsLock returns null when absent', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'allternit-lock-find-test-'));
  try {
    await fs.writeFile(
      path.join(root, 'skills-lock.json'),
      JSON.stringify({ version: 1, skills: {} }),
    );
    const nested = path.join(root, 'some', 'deep', 'dir');
    await fs.mkdir(nested, { recursive: true });

    const found = await findSkillsLock(nested);
    assert.ok(found);
    assert.equal(found.dir, root);
    assert.equal(found.lock.version, 1);

    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'allternit-lock-none-'));
    try {
      assert.equal(await loadSkillsLock(path.join(outside, 'skills-lock.json')), null);
      assert.equal(await findSkillsLock(outside), null);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
