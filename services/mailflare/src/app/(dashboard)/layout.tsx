"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ComposeProvider } from "@/components/compose/compose-context";
import { FloatingComposer } from "@/components/compose/floating-composer";
import { MailSearchInput } from "@/components/mail-search/mail-search-input";
import { MailSearchProvider } from "@/components/mail-search/mail-search-context";
import { MailboxProvider } from "@/components/mailbox-provider";
import { MailboxSelector } from "@/components/mailbox-selector";
import { DashboardNav } from "@/components/dashboard-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard requireMailbox>
      <MailboxProvider>
        <ComposeProvider>
          <MailSearchProvider>
            <div className="grid h-[100dvh] grid-cols-[256px_minmax(0,1fr)] overflow-hidden bg-[#f6f8fc]">
              <aside className="min-h-0 overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-gutter:stable]">
                <DashboardNav />
              </aside>
              <div className="flex min-h-0 min-w-0 flex-col">
                <header className="flex h-16 w-full shrink-0 items-center gap-4 pr-4 text-sm">
                  <MailSearchInput />
                  <Link
                    href="/settings"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-200"
                  >
                    <HelpCircle className="h-5 w-5" />
                  </Link>
                  <MailboxSelector />
                </header>
                <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-tl-3xl bg-white [scrollbar-gutter:stable]">
                  {children}
                </main>
              </div>
              <FloatingComposer />
            </div>
          </MailSearchProvider>
        </ComposeProvider>
      </MailboxProvider>
    </AuthGuard>
  );
}
