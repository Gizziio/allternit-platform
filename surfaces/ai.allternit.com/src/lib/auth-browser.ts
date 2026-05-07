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

type DesktopSession = {
  id?: string;
  userId: string;
  email?: string;
  userEmail?: string;
  name?: string;
  image?: string;
  expiresAt?: Date | number | string;
  accessToken?: string;
};

// Browser-safe session getter
export async function getSession(): Promise<Session | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const desktopSession = await window.allternit?.auth?.getSession?.();
    if (!desktopSession) {
      return null;
    }

    const session = desktopSession as DesktopSession;
    return {
      id: session.id ?? session.userId,
      userId: session.userId,
      email: session.email ?? session.userEmail,
      name: session.name,
      image: session.image,
      expiresAt: session.expiresAt ? new Date(session.expiresAt) : undefined,
    };
  } catch {
    return null;
  }
}
