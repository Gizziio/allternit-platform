import { NextResponse } from "next/server"

const privateMetadataByUserId = new Map<string, Record<string, unknown>>()

export async function auth() {
  return {
    userId: "local-user",
    sessionId: null,
    orgId: null,
  } as const
}

export async function clerkClient() {
  return {
    users: {
      async getUser(userId: string) {
        return {
          id: userId,
          privateMetadata: privateMetadataByUserId.get(userId) || {},
        }
      },
      async updateUserMetadata(userId: string, input: { privateMetadata?: Record<string, unknown> }) {
        const nextMetadata = input.privateMetadata || {}
        privateMetadataByUserId.set(userId, nextMetadata)
        return {
          privateMetadata: nextMetadata,
        }
      },
    },
  }
}

export function createRouteMatcher(_patterns: string[]) {
  return () => true
}

export function clerkMiddleware(
  handler?: (auth: { protect: () => Promise<void> }, req: Request) => Promise<void> | void,
) {
  return async (req: Request) => {
    await handler?.(
      {
        protect: async () => {},
      },
      req,
    )

    return NextResponse.next()
  }
}
