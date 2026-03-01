/**
 * Browser-safe auth stub
 * 
 * This is a stub implementation for browser environments where
 * better-sqlite3 and Node.js modules are not available.
 */

export interface Session {
  id: string;
  userId: string;
  email?: string;
  name?: string;
  image?: string;
  expiresAt?: Date;
}

export interface User {
  id: string;
  email?: string;
  name?: string;
  image?: string;
}

// Stub auth object for browser
export const auth = {
  handler: async () => new Response(JSON.stringify({ error: "Auth not available in browser" }), { status: 501 }),
  api: {
    signIn: async () => ({ error: "Auth not available in browser" }),
    signUp: async () => ({ error: "Auth not available in browser" }),
    signOut: async () => ({ error: "Auth not available in browser" }),
    getSession: async () => null,
  },
  $Infer: {
    Session: {} as Session,
  },
};

// Browser-safe session getter
export async function getSession(): Promise<Session | null> {
  // In browser, check localStorage for demo/session
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('a2r_session');
    if (stored) {
      try {
        return JSON.parse(stored) as Session;
      } catch {
        return null;
      }
    }
  }
  return null;
}
