import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isPublic = createRouteMatcher([
  "/",
  "/shell(.*)",
  "/.well-known/gizzi",
  "/terminal/clerk",
  "/sign-in(.*)",
  "/sign-up(.*)",
])

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect()
})

export default function middleware(...args: Parameters<typeof clerkHandler>) {
  if (process.env.A2R_PLATFORM_DISABLE_CLERK === "1") {
    return NextResponse.next()
  }
  return clerkHandler(...args)
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
}
