const clerkDisabled = process.env.ALLTERNIT_PLATFORM_DISABLE_CLERK === "1"

/**
 * Drop-in replacement for Clerk's `auth()` in API routes.
 * When ALLTERNIT_PLATFORM_DISABLE_CLERK=1 (Electron build), returns a
 * local-user stub so API routes work without a Clerk session.
 */
export async function getAuth() {
  if (clerkDisabled) {
    return { userId: "local-user", sessionId: null, orgId: null } as const
  }
  const clerkModule = await import("@clerk/nextjs/server").catch(async () =>
    import("@/stubs/clerk/nextjs-server"),
  )
  return clerkModule.auth()
}
