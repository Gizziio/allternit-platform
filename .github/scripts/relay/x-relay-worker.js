// allternit-x-relay — Cloudflare Worker that proxies X's public embed/syndication
// timeline endpoint and returns slim JSON. GitHub Actions' datacenter IPs are
// rate-limited (HTTP 429) at syndication.twitter.com; Cloudflare edge egress
// IPs are not, so the discovery pipeline calls this relay instead.
//
// GET /?user=<handle>&token=<RELAY_TOKEN>
// → { "tweets": [{ id, text, created_at, likes, rts, user, permalink }] }

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') return new Response('ok');

    if (env.RELAY_TOKEN && url.searchParams.get('token') !== env.RELAY_TOKEN) {
      return new Response('forbidden', { status: 403 });
    }

    const user = url.searchParams.get('user');
    if (!user || !/^[A-Za-z0-9_]{1,20}$/.test(user)) {
      return Response.json({ error: 'missing or invalid user param' }, { status: 400 });
    }

    const upstream = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${user}?dnt=true`;
    let res;
    try {
      res = await fetch(upstream, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
      });
    } catch (err) {
      return Response.json({ error: `upstream fetch failed: ${err.message}` }, { status: 502 });
    }
    if (!res.ok) {
      return Response.json({ error: `upstream HTTP ${res.status}` }, { status: 502 });
    }

    const html = await res.text();
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) {
      return Response.json({ error: 'no __NEXT_DATA__ block (endpoint changed?)' }, { status: 502 });
    }

    let entries = [];
    try {
      const data = JSON.parse(match[1]);
      entries = data?.props?.pageProps?.timeline?.entries ?? [];
    } catch (err) {
      return Response.json({ error: `bad upstream JSON: ${err.message}` }, { status: 502 });
    }

    const tweets = [];
    for (const entry of entries) {
      const t = entry?.content?.tweet;
      if (!t || typeof t.full_text !== 'string' || !t.full_text.trim()) continue;
      tweets.push({
        id: t.id_str ?? t.id,
        text: t.full_text,
        created_at: t.created_at,
        likes: t.favorite_count ?? 0,
        rts: t.retweet_count ?? 0,
        user: t.user?.screen_name ?? user,
        permalink: t.permalink ?? null,
      });
    }

    return Response.json(
      { tweets },
      { headers: { 'cache-control': 'public, max-age=300' } },
    );
  },
};
