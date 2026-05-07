/**
 * Allternit AI Chat Proxy
 * Routes chat requests to the Allternit AI backend.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLTERNIT_AI_URL = process.env.ALLTERNIT_AI_URL || 'http://localhost:8080';
const ALLTERNIT_AI_KEY = process.env.ALLTERNIT_AI_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const upstream = await fetch(`${ALLTERNIT_AI_URL}/api/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ALLTERNIT_AI_KEY ? { Authorization: `Bearer ${ALLTERNIT_AI_KEY}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55_000),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return NextResponse.json({ error: text }, { status: upstream.status });
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI proxy failed' },
      { status: 500 }
    );
  }
}
