import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { token, since } = await req.json();
  if (!token) {
    return NextResponse.json({ error: 'GitHub token required' }, { status: 401 });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  };

  try {
    // Get authenticated user
    const userRes = await fetch('https://api.github.com/user', { headers });
    if (!userRes.ok) throw new Error(`GitHub auth failed: ${userRes.status}`);
    const user = await userRes.json();

    // Get recent events
    const sinceParam = since ? `&since=${since}` : '';
    const eventsRes = await fetch(
      `https://api.github.com/users/${user.login}/events?per_page=20${sinceParam}`,
      { headers }
    );
    if (!eventsRes.ok) throw new Error(`GitHub events failed: ${eventsRes.status}`);
    const events = await eventsRes.json();

    const activities = events.map((e: any) => ({
      type: e.type === 'PushEvent' ? 'commit' : e.type === 'PullRequestEvent' ? 'pr' : 'issue',
      title: e.payload?.pull_request?.title || e.payload?.issue?.title || e.repo?.name || 'Unknown',
      url: e.payload?.pull_request?.html_url || e.payload?.issue?.html_url || `https://github.com/${e.repo?.name}`,
      repo: e.repo?.name || 'unknown',
      author: e.actor?.login || 'unknown',
      date: e.created_at,
      state: e.payload?.pull_request?.state || e.payload?.issue?.state,
    })).slice(0, 10);

    return NextResponse.json({ activities });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'GitHub API error' },
      { status: 502 }
    );
  }
}
