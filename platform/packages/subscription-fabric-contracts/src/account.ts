// §S3 — Account; SessionHealth union per HARDENING.md
import { z } from "zod";
import { providerIdSchema } from "./capability";

export const sessionHealthSchema = z.enum([
  "ready",
  "degraded",
  "auth_required",
  "challenge_presented",
  "account_restricted",
  "ui_drift",
  "provider_down",
  "profile_locked",
]);
export type SessionHealth = z.infer<typeof sessionHealthSchema>;

export const accountSchema = z.object({
  account_id: z.string(),
  provider: providerIdSchema,
  label: z.string(),
  plan: z.string().nullable(),
  plan_observed_at: z.string().nullable(),
  profile_ref: z.string(),
  session_health: sessionHealthSchema,
  enabled: z.boolean(),
});
export type Account = z.infer<typeof accountSchema>;
