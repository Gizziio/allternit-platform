# Steering checkpoint

Goal: Dogfood agent-sessions in production — pair mail node, turn on the web flag, verify the console can talk to the data plane.

Just did:
- Mail agent-daemon now points at api.allternit.com (was dead fly.dev); nginx WS upgrade fixed; relay connected.
- Reassigned live BYO node `contabo-byo-1` to Clerk user `user_3IBvYk8…` (most recent real login).
- Enabling `NEXT_PUBLIC_ALLTERNIT_AGENT_SESSIONS_API=1` in `.env.production` + Pages build env.

Next: commit/push/merge, watch Cloudflare Pages, verify the baked flag and a signed-in session list.

Open questions: if you sign in as a different Clerk user than `user_3IBvYk8…`, you'll still see "pair a device".
