import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ error: 'Notion integration token required' }, { status: 401 });
  }

  try {
    const res = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page_size: 20,
        sort: { timestamp: 'last_edited_time', direction: 'descending' },
      }),
    });

    if (!res.ok) throw new Error(`Notion API error: ${res.status}`);
    const data = await res.json();

    const pages = data.results?.map((p: any) => ({
      id: p.id,
      title:
        p.properties?.title?.title?.[0]?.plain_text ||
        p.properties?.Name?.title?.[0]?.plain_text ||
        'Untitled',
      url: p.url,
      lastEdited: p.last_edited_time,
    })) || [];

    return NextResponse.json({ pages });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Notion API error' },
      { status: 502 }
    );
  }
}
