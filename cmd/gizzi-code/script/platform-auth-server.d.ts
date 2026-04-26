/**
 * Allternit Platform Auth Server — Clerk.com edition
 *
 * Serves:
 *   GET  /.well-known/gizzi   → tells gizzi-code how to auth (method: "browser")
 *   GET  /terminal/clerk      → Clerk sign-in UI; posts session token to callback_url
 *   GET  /api/auth/session    → verify Clerk JWT via Clerk backend API
 *
 * Run:
 *   bun run platform:auth
 *
 * Then in another terminal:
 *   bun run dev connect login http://localhost:3000
 */
export {};
//# sourceMappingURL=platform-auth-server.d.ts.map