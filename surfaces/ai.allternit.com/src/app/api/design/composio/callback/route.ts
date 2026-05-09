import { NextResponse } from 'next/server';
import { listConnections } from '@/lib/design/composio-client';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const appName = searchParams.get('state') ?? searchParams.get('app') ?? 'unknown';
  const error = searchParams.get('error');

  if (error) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    return NextResponse.redirect(`${appUrl}/?composio_error=${encodeURIComponent(error)}`);
  }

  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'COMPOSIO_API_KEY not configured' }, { status: 503 });
  }

  try {
    // Verify the connection landed by listing accounts — Composio handles the exchange
    await listConnections(apiKey);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    return NextResponse.redirect(`${appUrl}/?composio_connected=${encodeURIComponent(appName)}`);
  } catch (e) {
    return NextResponse.json({ error: 'Composio callback failed', details: String(e) }, { status: 502 });
  }
}
