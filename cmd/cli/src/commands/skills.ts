import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { loadSkills, installSkill, uninstallSkill, Workspace } from '@allternit/gizziclaw';
import { findSkillsLock, verifyLockedSkill, type LockVerification } from './skills-lock.js';

const LOCK_MARKERS: Record<LockVerification, string> = {
  ok: chalk.green('✓ locked'),
  mismatch: chalk.yellow('⚠ hash mismatch'),
  missing: chalk.red('✗ lockfile source missing'),
};

export function createSkillsCommand(): Command {
  const listCommand = new Command('list')
    .description('List installed skills')
    .option('-p, --path <path>', 'Workspace path')
    .action(async (options: any) => {
      const workspacePath = options.path || process.cwd();
      const skillsDir = `${workspacePath}/layer4-skills`;

      try {
        const skills = await loadSkills(skillsDir);

        const lockEntry = await findSkillsLock(workspacePath);

        console.log(chalk.blue('Installed Skills'));
        console.log(chalk.gray('─────────────────────'));

        if (skills.length === 0) {
          console.log(chalk.yellow('No skills installed'));
        } else {
          for (const skill of skills) {
            const locked = lockEntry?.lock.skills[skill.name];
            const marker = locked
              ? `  ${LOCK_MARKERS[await verifyLockedSkill(lockEntry.dir, locked)]}`
              : '';
            console.log(chalk.green('✓'), chalk.white(skill.name), chalk.gray(`v${skill.version}`) + marker);
            console.log(chalk.gray(`  ${skill.description}`));
          }
        }

        if (lockEntry) {
          const names = new Set(skills.map((s: { name: string }) => s.name));
          const uninstalled = Object.keys(lockEntry.lock.skills).filter((n) => !names.has(n));
          if (uninstalled.length > 0) {
            console.log(chalk.gray('─────────────────────'));
            console.log(chalk.gray(`Locked but not installed here: ${uninstalled.join(', ')}`));
          }
        }
      } catch (error) {
        console.log(chalk.yellow('No skills directory found'));
      }
    });

  const installCommand = new Command('install')
    .argument('<name>', 'Skill name')
    .description('Install a skill from the workspace skill source (layer4-skills) into the agent-facing skills directory')
    .option('-p, --path <path>', 'Workspace path')
    .action(async (name: string, options: any) => {
      const workspacePath = options.path || process.cwd();
      const sourceDir = path.join(workspacePath, 'layer4-skills', name);

      try {
        await fs.access(path.join(sourceDir, 'SKILL.md'));
      } catch {
        console.log(chalk.red('✗'), chalk.red(`Skill not found in workspace skill source: ${name}`));
        console.log(chalk.gray(`  Expected: ${sourceDir}`));
        try {
          const available = (await fs.readdir(path.join(workspacePath, 'layer4-skills'), { withFileTypes: true }))
            .filter((e) => e.isDirectory())
            .map((e) => e.name);
          if (available.length > 0) {
            console.log(chalk.gray(`  Available: ${available.join(', ')}`));
          }
        } catch {
          // no layer4-skills directory to list
        }
        return;
      }

      const alreadyInstalled = await fs
        .access(path.join(workspacePath, 'skills', name, 'SKILL.md'))
        .then(() => true)
        .catch(() => false);

      try {
        await installSkill(workspacePath, sourceDir, name);
        console.log(chalk.green('✓'), alreadyInstalled ? chalk.blue('Updated skill:') : chalk.blue('Installed skill:'), chalk.white(name));
        console.log(chalk.gray(`  Source: ${sourceDir}`));
        console.log(chalk.gray(`  Target: ${path.join(workspacePath, 'skills', name)}`));
      } catch (error) {
        console.log(chalk.red('✗'), chalk.red(`Failed to install skill: ${name}`));
        console.error(error);
        return;
      }

      try {
        const workspace = await Workspace.load(workspacePath);
        await workspace.addSkill(name);
        console.log(chalk.gray('  Workspace registry updated'));
      } catch {
        console.log(chalk.yellow('  ⚠ No workspace.json found — skill installed but not added to workspace registry'));
      }
    });

  const uninstallCommand = new Command('uninstall')
    .argument('<name>', 'Skill name')
    .description('Uninstall a skill from the agent-facing skills directory')
    .option('-p, --path <path>', 'Workspace path')
    .action(async (name: string, options: any) => {
      const workspacePath = options.path || process.cwd();
      const skillDir = path.join(workspacePath, 'skills', name);

      const installed = await fs
        .access(path.join(skillDir, 'SKILL.md'))
        .then(() => true)
        .catch(() => false);

      if (!installed) {
        console.log(chalk.yellow(`Skill '${name}' is not installed in this workspace`));
        console.log(chalk.gray(`  Expected: ${skillDir}`));
        return;
      }

      try {
        await uninstallSkill(workspacePath, name);
        console.log(chalk.green('✓'), chalk.blue('Uninstalled skill:'), chalk.white(name));
        console.log(chalk.gray(`  Removed: ${skillDir}`));
      } catch (error) {
        console.log(chalk.red('✗'), chalk.red(`Failed to uninstall skill: ${name}`));
        console.error(error);
        return;
      }

      try {
        const workspace = await Workspace.load(workspacePath);
        await workspace.removeSkill(name);
        console.log(chalk.gray('  Workspace registry updated'));
      } catch {
        // No workspace.json — nothing to update.
      }
    });

  return new Command('skills')
    .description('Manage skills')
    .addCommand(listCommand)
    .addCommand(installCommand)
    .addCommand(uninstallCommand);
}

export const skillsCommand = createSkillsCommand();
