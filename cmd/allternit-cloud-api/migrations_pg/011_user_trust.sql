-- 011_user_trust.sql
--
-- Email-verification trust cache for the free inference allowance. The Clerk
-- session JWT carries no email-verified flag, so the first time a
-- free-allowance user (no user_credits row) hits the inference pre-check,
-- services::user_trust fetches
-- `GET {CLERK_API_BASE}/v1/users/{clerk_user_id}` with CLERK_SECRET_KEY and
-- records the result here. Within TRUST_CACHE_TTL of checked_at the cached
-- value is used without re-calling Clerk; unverified users are denied the
-- free allowance (403). Failures talking to Clerk fail CLOSED (deny) and are
-- never cached. The whole check is bypassed when
-- ALLTERNIT_SKIP_EMAIL_VERIFICATION=1 (local dev/tests only).

CREATE TABLE IF NOT EXISTS public.user_trust (
    user_id text NOT NULL PRIMARY KEY,
    email_verified boolean NOT NULL DEFAULT FALSE,
    checked_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
