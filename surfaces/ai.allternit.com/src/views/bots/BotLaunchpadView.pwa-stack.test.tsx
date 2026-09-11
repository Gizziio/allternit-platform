import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { FabricSessionThemeProvider } from "@/fabric-session/theme/FabricSessionThemeProvider";
import { PlatformAuthProvider } from "@/lib/platform-auth-client";
import { FetchInterceptorProvider } from "@/lib/FetchInterceptorProvider";
import { CompanyConfigProvider } from "@/providers/company-config-provider";
import { ToastProvider } from "@/components/ui/toast-provider";
import { VoiceProvider } from "@/providers/voice-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GlobalDropzoneProvider } from "@/components/GlobalDropzone";
import { ModeProvider } from "@/providers/mode-provider";
import { BotLaunchpadView } from "@/views/bots/BotLaunchpadView";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function PwaStack({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <FabricSessionThemeProvider>
          <CompanyConfigProvider>
            <PlatformAuthProvider>
              <FetchInterceptorProvider>
                <ToastProvider>
                  <TooltipProvider>
                    <VoiceProvider>
                      <GlobalDropzoneProvider>
                        <ModeProvider defaultMode="chat">{children}</ModeProvider>
                      </GlobalDropzoneProvider>
                    </VoiceProvider>
                  </TooltipProvider>
                </ToastProvider>
              </FetchInterceptorProvider>
            </PlatformAuthProvider>
          </CompanyConfigProvider>
        </FabricSessionThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

describe("BotLaunchpadView under the Fabric Session PWA provider stack", () => {
  it("renders the hub without throwing", async () => {
    const errors: string[] = [];
    const orig = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(String(args[0]));
    };
    try {
      render(
        <PwaStack>
          <BotLaunchpadView />
        </PwaStack>,
      );
    } finally {
      console.error = orig;
    }
    // If a context provider is missing, React throws during render and the
    // test fails above. Give effects a tick, then assert hub chrome exists.
    await new Promise((r) => setTimeout(r, 300));
    const thrown = errors.find((e) => /must be used within|context/i.test(e));
    expect(thrown ?? "no context error").toBe("no context error");
    expect(
      screen.queryByText(/No bots yet|Message a bot/i),
    ).not.toBeNull();
  }, 20000);
});
