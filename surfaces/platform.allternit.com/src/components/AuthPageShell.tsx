import React from "react";
import { AllternitWordmark } from "@/components/AllternitWordmark";

interface AuthPageShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

const NAV_LINKS = [
  { label: "Docs", href: "https://docs.allternit.com" },
  { label: "API Reference", href: "https://api.allternit.com" },
  { label: "Pricing", href: "https://allternit.com/pricing" },
  { label: "Contact sales", href: "mailto:sales@allternit.com" },
];

export function AuthPageShell({ title, subtitle, children }: AuthPageShellProps) {
  return (
    <div className="auth-page min-h-screen flex flex-col bg-[#FAF9F7] text-[#1A1916]">
      {/* Subtle dot pattern background */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(26,25,22,0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <header className="w-full border-b border-[#E8E6E1] bg-[#FAF9F7]/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <a
            href="https://allternit.com"
            className="flex items-center gap-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            <AllternitWordmark variant="dark" height={28} />
            <span className="text-[15px] font-semibold tracking-tight text-[#1A1916]">
              Console
            </span>
          </a>
          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-medium text-[#5E5C56] transition-colors hover:text-[#1A1916]"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 text-center">
            <h1 className="text-[32px] font-semibold tracking-tight text-[#1A1916] sm:text-[38px]">
              {title}
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-[#5E5C56]">
              {subtitle}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E8E6E1] bg-white p-6 shadow-[0_8px_32px_rgba(26,25,22,0.08)] sm:p-8">
            {children}
          </div>

          <p className="mt-6 text-center text-[12px] leading-relaxed text-[#8C887E]">
            By continuing, you agree to Allternit&apos;s{" "}
            <a
              href="https://allternit.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-[#1A1916]"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="https://allternit.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-[#1A1916]"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </main>

      <footer className="border-t border-[#E8E6E1] bg-[#FAF9F7] py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 text-[12px] text-[#8C887E] sm:flex-row">
          <span>© {new Date().getFullYear()} Allternit. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <a
              href="https://allternit.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-[#1A1916]"
            >
              Terms
            </a>
            <a
              href="https://allternit.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-[#1A1916]"
            >
              Privacy
            </a>
            <a
              href="https://status.allternit.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-[#1A1916]"
            >
              Status
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
