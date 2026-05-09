import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { app } = await req.json();
  // TODO: call Composio SDK to get OAuth URL
  // const { composio } = await import('@composio/core');
  // const authUrl = await composio.getOAuthUrl(app, process.env.COMPOSIO_API_KEY);
  return NextResponse.json({ authUrl: `/api/design/composio/oauth-callback?app=${app}` });
}
