import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';
import { execSync } from 'child_process';

const AGENT_CLI_COMMANDS = [
  { name: 'claude', flag: '--version', alias: 'Claude Code' },
  { name: 'codex', flag: '--version', alias: 'OpenAI Codex' },
  { name: 'openclaw', flag: '--version', alias: 'OpenClaw' },
  { name: 'opencode', flag: '--version', alias: 'OpenCode' },
  { name: 'hermes', flag: '--version', alias: 'Hermes' },
  { name: 'gemini', flag: '--version', alias: 'Gemini CLI' },
  { name: 'pi', flag: '--version', alias: 'Pi CLI' },
  { name: 'cursor-agent', flag: '--version', alias: 'Cursor Agent' },
];

function scanPath(): Array<{ name: string; version: string; path: string }> {
  const found: Array<{ name: string; version: string; path: string }> = [];

  for (const cli of AGENT_CLI_COMMANDS) {
    try {
      const path = execSync(`which ${cli.name}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (path) {
        let version = 'unknown';
        try {
          version = execSync(`${cli.name} ${cli.flag}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().split('\n')[0];
        } catch {
          // version check failed, keep unknown
        }
        found.push({ name: cli.alias, version, path });
      }
    } catch {
      // not found on PATH
    }
  }

  return found;
}

export async function GET() {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clis = scanPath();
  return NextResponse.json({ clis, scannedAt: new Date().toISOString() });
}

export async function POST(request: NextRequest) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name : 'Local Runtime';
  const host = typeof body.host === 'string' ? body.host : 'localhost';
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : null;
  const clis = Array.isArray(body.agentClis) ? body.agentClis : scanPath();

  const runtime = await prisma.agentRuntime.create({
    data: {
      name,
      host,
      agentClis: JSON.stringify(clis),
      status: 'online',
      lastHeartbeat: new Date(),
      workspaceId,
    },
  });

  return NextResponse.json({ runtime }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  await prisma.agentRuntime.deleteMany({ where: { id } });
  return NextResponse.json({ success: true });
}
