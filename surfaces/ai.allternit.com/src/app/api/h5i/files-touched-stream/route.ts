import { NextRequest } from 'next/server';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

function getGitStatus(workspacePath: string) {
  try {
    const modifiedFiles = execSync('git status --short', {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 10000,
    })
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.slice(3).trim())
      .filter(Boolean);

    let recentCommits: Array<{ hash: string; message: string; files: string[] }> = [];
    try {
      const logOutput = execSync(
        'git log --oneline -5 --name-only --format="COMMIT:%H|%s"',
        { cwd: workspacePath, encoding: 'utf-8', timeout: 10000 },
      );

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

    return { modifiedFiles, recentCommits };
  } catch {
    return { modifiedFiles: [] as string[], recentCommits: [] as { hash: string; message: string; files: string[] }[] };
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const workspacePath = url.searchParams.get('workspacePath');

  if (!workspacePath) {
    return new Response(JSON.stringify({ error: 'workspacePath is required' }), { status: 400 });
  }

  if (!existsSync(workspacePath)) {
    return new Response(JSON.stringify({ error: 'Workspace path does not exist' }), { status: 400 });
  }

  const encoder = new TextEncoder();
  let lastData = '';

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Client disconnected
        }
      };

      send({ type: 'connected' });

      // Check immediately and send current state
      const initial = getGitStatus(workspacePath);
      lastData = JSON.stringify(initial);
      send({ type: 'update', ...initial });

      // Poll server-side and push diffs
      const interval = setInterval(() => {
        const current = getGitStatus(workspacePath);
        const currentData = JSON.stringify(current);
        if (currentData !== lastData) {
          lastData = currentData;
          send({ type: 'update', ...current });
        }
      }, 3000);

      // Keepalive
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(':keepalive\n\n'));
        } catch {
          clearInterval(keepAlive);
          clearInterval(interval);
        }
      }, 30000);

      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
