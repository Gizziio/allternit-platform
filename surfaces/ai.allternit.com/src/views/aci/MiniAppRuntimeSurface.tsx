"use client";

import { ArrowSquareOut, Cpu, Wrench } from "@phosphor-icons/react";
import React from "react";
import { openInBrowser } from "@/lib/openInBrowser";
import { isElectronShell } from "@/lib/platform";
import type {
  InstalledMiniApp,
  MiniAppPresentationContract,
} from "./mini-app.types";
import { resolveMiniAppPresentation } from "./mini-app-presentation";

export function MiniAppRuntimeSurface({
  app,
  presentation = resolveMiniAppPresentation(app),
  nativeContent,
  title = `${app.name} interface`,
  className = "h-full",
}: {
  app: InstalledMiniApp;
  presentation?: MiniAppPresentationContract;
  nativeContent?: React.ReactNode;
  title?: string;
  className?: string;
}) {
  const useNative = presentation.mode === "native" || !presentation.uiUrl;

  if (useNative) {
    return (
      <div className={className}>
        {nativeContent || (
          <NativeCapabilities app={app} presentation={presentation} />
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-[var(--bg-secondary)] ${className}`}
    >
      {isElectronShell() ? (
        <webview
          src={presentation.uiUrl}
          className="size-full border-0 bg-white"
          allowpopups
          partition={
            presentation.electronPartition || `persist:allternit-${app.id}`
          }
        />
      ) : (
        <iframe
          src={presentation.uiUrl}
          title={title}
          className="size-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
        />
      )}
    </div>
  );
}

function NativeCapabilities({
  app,
  presentation,
}: {
  app: InstalledMiniApp;
  presentation: MiniAppPresentationContract;
}) {
  const capabilities = app.capabilities?.length
    ? app.capabilities
    : [
        app.harness?.transport
          ? `${app.harness.transport.toUpperCase()} integration`
          : "Managed miniapp",
      ];

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--surface-hover)]">
            <Cpu size={20} />
          </div>
          <div>
            <h2 className="font-semibold">{app.name}</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Native Allternit capabilities
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-2">
          {capabilities.map((capability) => (
            <div
              key={capability}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2.5 text-sm"
            >
              <Wrench size={15} className="text-[var(--accent-primary)]" />
              {capability}
            </div>
          ))}
        </div>
        {app.url && presentation.fallback === "external-browser" && (
          <button
            type="button"
            onClick={() => openInBrowser(app.url)}
            className="mt-5 inline-flex items-center gap-2 text-sm text-[var(--accent-primary)]"
          >
            Open externally <ArrowSquareOut size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
