import React from "react";
import { Link, useLocation } from "react-router-dom";
import { AllternitWordmark } from "@/components/AllternitWordmark";
import { SignInModalButton } from "@/components/SignInModalButton";
import { usePlatformAuth } from "@/lib/platform-auth-client";
import { useTheme } from "@/lib/theme";

const NAV_LINKS = [
  { to: "/models", label: "Models" },
  { to: "/billing", label: "Plans" },
];

export function PublicHeader() {
  const auth = usePlatformAuth();
  const location = useLocation();
  const { resolved } = useTheme();
  const isDark = resolved === "dark";

  const redirectUrl = location.pathname + location.search;

  return (
    <header className="w-full border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <AllternitWordmark variant={isDark ? "light" : "dark"} height={28} />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {auth.isLoaded && auth.isSignedIn ? (
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-solid border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-3 py-1.5 text-[13px] font-medium text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/20"
            >
              Console
            </Link>
          ) : (
            <>
              <SignInModalButton
                redirectUrl={redirectUrl}
                className="text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Sign in
              </SignInModalButton>
              <SignInModalButton
                mode="sign-up"
                redirectUrl={redirectUrl}
                className="inline-flex items-center rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 text-[13px] font-medium text-[#FDF8F3] transition-colors hover:brightness-110"
              >
                Sign up
              </SignInModalButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
