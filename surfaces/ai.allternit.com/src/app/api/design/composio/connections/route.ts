import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'COMPOSIO_API_KEY not configured. Add it to your environment to enable work tool connections.' },
      { status: 503 }
    );
  }

  // TODO: proxy to Composio API using COMPOSIO_API_KEY
  // For now return empty until Composio SDK is integrated
  return NextResponse.json([]);
}
