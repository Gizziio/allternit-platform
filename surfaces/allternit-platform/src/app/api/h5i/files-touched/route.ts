import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as { workspacePath?: string };
    const { workspacePath } = body;

    if (!workspacePath) {
      return NextResponse.json(
        { error: 'workspacePath is required' },
        { status: 400 }
      );
    }

    if (!existsSync(workspacePath)) {
      return NextResponse.json(
        { error: `Workspace path does not exist: ${workspacePath}` },
        { status: 404 }
      );
    }

    // Get modified files from git status
    let files: string[] = [];
    try {
      const output = execSync('git status --short', {
        cwd: workspacePath,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      files = output
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => line.slice(3).trim()) // Remove XY prefix
        .filter(Boolean);
    } catch {
      // Not a git repo or git not available
      files = [];
    }

    // Also get recently committed files (last 5 commits)
    let recentCommits: Array<{ hash: string; message: string; files: string[] }> = [];
    try {
      const logOutput = execSync('git log --oneline -5 --name-only --format="COMMIT:%H|%s"', {
        cwd: workspacePath,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['ignore', 'pipe', 'ignore'],
      });

      let currentCommit: { hash: string; message: string; files: string[] } | null = null;
      for (const line of logOutput.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('COMMIT:')) {
          if (currentCommit) recentCommits.push(currentCommit);
          const parts = trimmed.slice(7).split('|');
          currentCommit = { hash: parts[0] || '', message: parts[1] || '', files: [] };
        } else if (trimmed && currentCommit) {
          currentCommit.files.push(trimmed);
        }
      }
      if (currentCommit) recentCommits.push(currentCommit);
    } catch {
      // Ignore git log errors
    }

    return NextResponse.json({
      modifiedFiles: files,
      recentCommits,
      workspacePath,
    });
  } catch (error) {
    console.error('[h5i files-touched API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
