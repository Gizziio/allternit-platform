import { NextResponse } from 'next/server';
import { publications as seedPublications } from '@/data/research-content';
import type { Publication } from '@/types/publication';

export const runtime = 'nodejs';

const fs = require('fs');
const path = require('path');

function loadPipelinePublications(): Publication[] {
  const DATA_FILE = path.resolve(process.cwd(), 'src/data/discovery-pipeline.json');
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

export async function GET() {
  const pipelinePubs = loadPipelinePublications();

  // Merge seed + pipeline, deduplicate by id
  const byId = new Map<string, Publication>();
  for (const p of seedPublications) {
    byId.set(p.id, p);
  }
  for (const p of pipelinePubs) {
    byId.set(p.id, p);
  }

  const feed = Array.from(byId.values())
    .filter(p => p.status === 'published')
    .sort(
      (a, b) =>
        new Date(b.publishedAt ?? b.createdAt).getTime() -
        new Date(a.publishedAt ?? a.createdAt).getTime(),
    )
    .slice(0, 20);

  return NextResponse.json(feed);
}
