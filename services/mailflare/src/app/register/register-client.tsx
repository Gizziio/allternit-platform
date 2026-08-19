"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MailPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileField } from "@/components/auth/turnstile";
import {
  getSetupStatus,
  submitPrimaryDomain,
  submitRegistration,
} from "./utils";

export function RegisterClient() {
  const router = useRouter();
  const [hasAdminAccount, setHasAdminAccount] = useState<boolean | null>(null);
  const [hasPrimaryDomain, setHasPrimaryDomain] = useState<boolean | null>(
    null,
  );
  const [primaryDomain, setPrimaryDomain] = useState<string | null>(null);
  const [setupDomain, setSetupDomain] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [turnstileReset, setTurnstileReset] = useState(0);

  useEffect(() => {
    void getSetupStatus()
      .then((data) => {
        setHasAdminAccount(data.hasAdminAccount);
        setHasPrimaryDomain(data.hasPrimaryDomain);
        setPrimaryDomain(data.primaryDomain?.hostname ?? null);
      })
      .catch(() => {
        setHasAdminAccount(true);
        setHasPrimaryDomain(true);
      });
  }, []);

  async function onDomainSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { ok, data } = await submitPrimaryDomain(
      new FormData(e.currentTarget),
    );
    setLoading(false);
    if (!ok || !data.domain) {
      setError(
        typeof data.error === "string" ? data.error : "Domain setup failed",
      );
      return;
    }
    setSetupDomain(data.domain.hostname);
    setStep(2);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const domain = setupDomain ?? primaryDomain;
    if (!domain) {
      setLoading(false);
      setError("Domain setup is not complete");
      return;
    }

    const { ok, data } = await submitRegistration(form, { firstRun: true, domain });
    setLoading(false);
    if (!ok) {
      setError(
        typeof data.error === "string" ? data.error : "Registration failed",
      );
      setTurnstileReset((value) => value + 1);
      return;
    }
    router.push(data.redirect ?? "/inbox");
  }

  const accountDomain = setupDomain ?? primaryDomain;
  const showDomainStep = hasPrimaryDomain === false && step === 1;

  if (hasAdminAccount === true) {
    return (
      <AuthShell
        icon={MailPlus}
        title="Account registration is closed"
        footer={
          <Link
            href="/login"
            className="inline-flex items-center gap-2 hover:underline"
          >
            Sign in instead
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            This installation already has an account for {primaryDomain ?? "this workspace"}.
          </p>
          <Button
            type="button"
            className="h-11 w-full rounded-full px-6 active:scale-[0.98]"
            onClick={() => router.push("/login")}
          >
            Go to login
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      icon={MailPlus}
      title={showDomainStep ? "Add your domain" : "Create your mailbox"}
      // description={
      // 	showDomainStep
      // 		? "Connect the primary Cloudflare zone first so routing records can be created before the first mailbox."
      // 		: `Choose a mailbox username on ${accountDomain ?? "the primary domain"} and add a recovery email.`
      // }
      steps={
        hasAdminAccount === false && hasPrimaryDomain === false
          ? [
              { label: "Domain", active: step === 1 },
              { label: "Account", active: step === 2 },
            ]
          : undefined
      }
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-2 hover:underline"
        >
          Sign in instead
          <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      {showDomainStep ? (
        <form onSubmit={onDomainSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="domain">Primary domain</Label>
            <Input
              id="domain"
              name="domain"
              placeholder="example.com"
              autoComplete="url"
              required
            />
            <p className="text-xs leading-5 text-neutral-500">
              The domain must already be a Cloudflare zone on this account.
            </p>
          </div>
          {error && (
            <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="h-11 w-full rounded-full px-6 active:scale-[0.98]"
            disabled={loading}
          >
            {loading ? "Adding domain..." : "Continue"}
          </Button>
        </form>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 relative">
              <Input
                id="username"
                name="username"
                placeholder="you"
                autoComplete="username"
                required
								className="pr-34"
              />
              <span className="max-w-36 truncate text-sm font-medium text-neutral-500 absolute top-2.5 right-5">
                @{accountDomain ?? "domain"}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resetEmail">Recovery email</Label>
            <Input
              id="resetEmail"
              name="resetEmail"
              type="email"
              placeholder="you@gmail.com"
              required
            />
            {/* <p className="text-xs leading-5 text-neutral-500">Used later for password reset.</p> */}
          </div>

          {error && (
            <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <TurnstileField resetSignal={turnstileReset} />
          <Button
            type="submit"
            className="h-11 w-full rounded-full px-6 active:scale-[0.98] mt-8"
            disabled={loading || hasAdminAccount === null || hasPrimaryDomain === null}
          >
            {loading ? "Creating..." : "Create account"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
