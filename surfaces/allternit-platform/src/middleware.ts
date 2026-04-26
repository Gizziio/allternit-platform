import { NextResponse, type NextRequest } from "next/server"

const PUBLIC_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/\.well-known\/gizzi$/,
  /^\/clerk_(?:.*)?$/,
  /^\/terminal\/clerk(?:\/.*)?$/,
  /^\/sign-in(?:\/.*)?$/,
  /^\/sign-up(?:\/.*)?$/,
  /^\/oauth(?:\/.*)?$/,
  /^\/api\/oauth\/authorize$/,
  /^\/api\/oauth\/token$/,
  /^\/api\/oauth\/userinfo$/,
  /^\/api\/oauth\/revoke$/,
  /^\/api\/status$/,
  /^\/terms(?:\/.*)?$/,
  /^\/privacy(?:\/.*)?$/,
  /^\/status(?:\/.*)?$/,
  /^\/api\/v1\/runtime\/backend\/manual$/,
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname))
}

function isDesktopAuthenticated(request: NextRequest): boolean {
  return Boolean(request.headers.get("x-allternit-desktop-access-token"))
}

function isClerkExplicitlyDisabled(): boolean {
  return (
    process.env.ALLTERNIT_PLATFORM_DISABLE_CLERK === "1" ||
    process.env.NEXT_PUBLIC_ALLTERNIT_PLATFORM_DISABLE_CLERK === "1"
  )
}

function hasClerkServerKeys(): boolean {
  return Boolean(
    process.env.CLERK_SECRET_KEY ||
    process.env.CLERK_API_KEY ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  )
}

export default async function middleware(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  if (isDesktopAuthenticated(request) || isClerkExplicitlyDisabled()) {
    return NextResponse.next()
  }

  // Preserve intended Clerk behavior when configured, but avoid boot-time
  // crashes in local desktop/runtime environments where the server keys are
  // intentionally absent and desktop auth should handle the session layer.
  if (!hasClerkServerKeys()) {
    return NextResponse.next()
  }

  const clerkModule = await import("@clerk/nextjs/server")
  const clerkHandler = clerkModule.clerkMiddleware(async (auth, req) => {
    await auth.protect()
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (clerkHandler as any)(request)
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
}
