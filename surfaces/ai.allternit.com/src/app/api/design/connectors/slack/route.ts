import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ error: 'Slack bot token required' }, { status: 401 });
  }

  try {
    // List conversations
    const convRes = await fetch(
      'https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=10',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const convData = await convRes.json();
    if (!convData.ok) throw new Error(`Slack API error: ${convData.error}`);

    const channels = convData.channels?.slice(0, 3) || [];
    const messages: any[] = [];

    for (const ch of channels) {
      const msgRes = await fetch(
        `https://slack.com/api/conversations.history?channel=${ch.id}&limit=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const msgData = await msgRes.json();
      if (msgData.messages) {
        messages.push(
          ...msgData.messages.map((m: any) => ({
            channel: ch.name,
            text: m.text,
            timestamp: new Date(parseFloat(m.ts) * 1000).toISOString(),
            user: m.user,
          }))
        );
      }
    }

    return NextResponse.json({ messages: messages.slice(0, 10) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Slack API error' },
      { status: 502 }
    );
  }
}
