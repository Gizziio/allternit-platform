import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db/client-sqlite";
import { schema } from "./db/schema-sqlite";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
  ],
  secret: process.env.AUTH_SECRET || "dev-secret-change-in-production",

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  socialProviders: {
    google: process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? { clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }
      : undefined,
    github: process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
      ? { clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET }
      : undefined,
  },

  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
