import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { app } = await req.json();
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'COMPOSIO_API_KEY not configured. Add it to your environment to enable work tool connections.' },
      { status: 503 }
    );
  }

  // TODO: call Composio SDK to get OAuth URL
  // const { composio } = await import('@composio/core');
  // const authUrl = await composio.getOAuthUrl(app, apiKey);
  // return NextResponse.json({ authUrl });

  // Stub: return a placeholder URL until Composio is wired
  return NextResponse.json({ authUrl: `/api/design/composio/oauth-callback?app=${app}` });
}
