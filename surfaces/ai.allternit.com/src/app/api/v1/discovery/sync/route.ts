import { NextRequest, NextResponse } from 'next/server';
import type { Publication } from '@/types/publication';

/**
 * POST /api/v1/discovery/sync
 * Accepts a new publication from the publication pipeline (GitHub Action)
 * and appends it to the local research-content.ts data file.
 *
 * In production with a real database, this would insert into a DB.
 * For now, we store in a JSON file that the feed endpoint reads.
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.resolve(process.cwd(), 'src/data/discovery-pipeline.json');
const SYNC_TOKEN = process.env.PLATFORM_SYNC_TOKEN || '';

function loadPipelinePublications(): Publication[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

function savePipelinePublications(pubs: Publication[]) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(pubs, null, 2));
}

export async function GET() {
  const pubs = loadPipelinePublications();
  return NextResponse.json({ ok: true, count: pubs.length });
}

export async function POST(req: NextRequest) {
  // Optional token auth
  const authHeader = req.headers.get('authorization');
  if (SYNC_TOKEN && authHeader !== `Bearer ${SYNC_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const publication: Publication = body.publication;

    if (!publication || !publication.id) {
      return NextResponse.json({ error: 'Missing publication' }, { status: 400 });
    }

    const pubs = loadPipelinePublications();

    // Check for duplicate
    const exists = pubs.some(p => p.id === publication.id);
    if (exists) {
      return NextResponse.json({ status: 'already_exists', id: publication.id });
    }

    pubs.push(publication);
    pubs.sort(
      (a, b) =>
        new Date(b.publishedAt ?? b.createdAt).getTime() -
        new Date(a.publishedAt ?? a.createdAt).getTime(),
    );

    // Keep only last 100 to avoid unbounded growth
    const trimmed = pubs.slice(0, 100);
    savePipelinePublications(trimmed);

    return NextResponse.json({ status: 'synced', id: publication.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 },
    );
  }
}
