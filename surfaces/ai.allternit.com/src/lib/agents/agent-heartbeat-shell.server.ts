export async function runDependencyCheck(): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    const { execSync } = await import('child_process');
    const cwd = process.cwd();

    let outdatedJson: Record<string, { current: string; wanted: string; latest: string }> = {};
    try {
      const raw = execSync('npm outdated --json 2>/dev/null || true', { cwd, timeout: 10000, encoding: 'utf-8' });
      if (raw.trim()) outdatedJson = JSON.parse(raw);
    } catch {
      // npm outdated exits non-zero when there are outdated packages.
    }

    const entries = Object.entries(outdatedJson);
    if (entries.length === 0) {
      return { success: true, output: 'Dependency check: All packages up to date.' };
    }

    const lines = entries.map(([pkg, info]) =>
      `  ${pkg}: ${info.current} -> ${info.latest} (wanted: ${info.wanted})`,
    );
    return {
      success: true,
      output: `Dependency check: ${entries.length} package(s) outdated:\n${lines.join('\n')}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Dependency check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function runPRSummary(): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    const { execSync } = await import('child_process');
    const cwd = process.cwd();

    try {
      const raw = execSync('gh pr list --json number,title,state,author --limit 10 2>/dev/null', {
        cwd,
        timeout: 8000,
        encoding: 'utf-8',
      });
      const prs = JSON.parse(raw) as Array<{ number: number; title: string; state: string; author: { login: string } }>;
      if (prs.length === 0) {
        return { success: true, output: 'PR Summary: No open PRs.' };
      }
      const lines = prs.map((pr) => `  #${pr.number} [${pr.state}] ${pr.title} (${pr.author.login})`);
      return { success: true, output: `PR Summary (${prs.length} open):\n${lines.join('\n')}` };
    } catch {
      // gh not available — fall back to git branch info.
    }

    const branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', {
      cwd,
      timeout: 3000,
      encoding: 'utf-8',
    }).trim();
    const log = execSync('git log --oneline -5 2>/dev/null', { cwd, timeout: 3000, encoding: 'utf-8' }).trim();
    return {
      success: true,
      output: `PR Summary: gh CLI not available. Current branch: ${branch}\nRecent commits:\n${log}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `PR summary failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function runDocumentationSync(): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    const { statSync, readdirSync } = await import('fs');
    const { join } = await import('path');
    const cwd = process.cwd();

    const docTargets = ['README.md', 'CHANGELOG.md', 'docs', 'CONTRIBUTING.md'];
    const lines: string[] = [];

    for (const target of docTargets) {
      const full = join(cwd, target);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          const files = readdirSync(full).filter((file) => file.endsWith('.md'));
          lines.push(`  ${target}/: ${files.length} markdown file(s)`);
        } else {
          const ageMs = Date.now() - stat.mtimeMs;
          const ageDays = Math.floor(ageMs / 86400000);
          lines.push(`  ${target}: present, last modified ${ageDays}d ago`);
        }
      } catch {
        lines.push(`  ${target}: missing`);
      }
    }

    return {
      success: true,
      output: `Documentation sync:\n${lines.join('\n')}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Documentation sync failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function runToolVerification(): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    const { execSync } = await import('child_process');

    const tools = ['node', 'bun', 'npm', 'git', 'cargo', 'gh', 'docker'];
    const results: Array<{ name: string; available: boolean; version?: string }> = [];

    for (const tool of tools) {
      try {
        const version = execSync(`${tool} --version 2>/dev/null`, { timeout: 3000, encoding: 'utf-8' })
          .split('\n')[0]
          .trim();
        results.push({ name: tool, available: true, version });
      } catch {
        results.push({ name: tool, available: false });
      }
    }

    const available = results.filter((result) => result.available);
    const missing = results.filter((result) => !result.available);

    const lines = [
      `Available (${available.length}): ${available.map((result) => `${result.name} (${result.version})`).join(', ')}`,
      ...(missing.length > 0 ? [`Missing (${missing.length}): ${missing.map((result) => result.name).join(', ')}`] : []),
    ];

    return {
      success: missing.length === 0,
      output: `Tool verification:\n  ${lines.join('\n  ')}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Tool verification failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
