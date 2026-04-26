import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/server-auth';

const HEARTBEAT_TTL_MS = 60_000;

interface RuntimeRecord {
  id: string;
  name: string;
  host: string;
  agentClis: string[];
  status: 'online' | 'offline' | 'busy';
  lastHeartbeat: number;
  workspaceId?: string;
  version?: string;
}

const runtimes = new Map<string, RuntimeRecord>();

function pruneStale(): void {
  const now = Date.now();
  for (const [id, r] of runtimes) {
    if (now - r.lastHeartbeat > HEARTBEAT_TTL_MS) {
      runtimes.set(id, { ...r, status: 'offline' });
    }
  }
}

export async function GET(): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  pruneStale();
  return NextResponse.json({ runtimes: Array.from(runtimes.values()) });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === 'string' ? body.id : `rt-${Date.now()}`;
  const name = typeof body.name === 'string' ? body.name : 'unknown';
  const host = typeof body.host === 'string' ? body.host : '';
  if (!host) return NextResponse.json({ error: 'host required' }, { status: 400 });

  const record: RuntimeRecord = {
    id,
    name,
    host,
    agentClis: Array.isArray(body.agentClis) ? (body.agentClis as string[]) : [],
    status: 'online',
    lastHeartbeat: Date.now(),
    workspaceId: typeof body.workspaceId === 'string' ? body.workspaceId : undefined,
    version: typeof body.version === 'string' ? body.version : undefined,
  };

  runtimes.set(id, record);
  return NextResponse.json({ runtime: record }, { status: 201 });
}
