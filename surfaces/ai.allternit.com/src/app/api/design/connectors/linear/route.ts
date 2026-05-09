import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ error: 'Linear API key required' }, { status: 401 });
  }

  const query = `
    query {
      issues(filter: { state: { type: { in: ["started", "unstarted"] } } }, first: 20) {
        nodes {
          id
          title
          state { name }
          url
          assignee { displayName }
          updatedAt
        }
      }
    }
  `;

  try {
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) throw new Error(`Linear API error: ${res.status}`);
    const data = await res.json();

    const issues = data.data?.issues?.nodes?.map((n: any) => ({
      id: n.id,
      title: n.title,
      state: n.state?.name || 'Unknown',
      url: n.url,
      assignee: n.assignee?.displayName,
      updatedAt: n.updatedAt,
    })) || [];

    return NextResponse.json({ issues });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Linear API error' },
      { status: 502 }
    );
  }
}
