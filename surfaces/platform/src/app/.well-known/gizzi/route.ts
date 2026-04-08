/**
 * GET /.well-known/gizzi
 *
 * Platform discovery document read by Gizzi Code and Gizzi Browser
 * during the terminal/clerk auth flow (terminal-clerk-auth.ts in the runtime).
 *
 * Required field:
 *   auth.env  — the key under which the Clerk session token is stored
 *               in the local auth.json file and set as a process env var.
 *               Must be a non-empty string or the claim step fails.
 *
 * Optional field:
 *   config    — org-level Gizzi config merged as the lowest-precedence layer.
 */

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    {
      auth: {
        env: 'ALLTERNIT_TOKEN',
      },
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
}
