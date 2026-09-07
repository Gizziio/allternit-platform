"use client";

import React, { useMemo, useState } from "react";
import * as QRCodeModule from "react-qr-code";
import { Check, Copy, DeviceMobile } from "@phosphor-icons/react";
import { fabricSessionPwaUrl } from "@/lib/fabric-session-pwa";

const QRCode =
  (QRCodeModule as any).default?.QRCode ??
  (QRCodeModule as any).default ??
  QRCodeModule;

interface FabricSessionQrCardProps {
  runtimeId?: string | null;
}

export function FabricSessionQrCard({ runtimeId }: FabricSessionQrCardProps): React.ReactNode {
  const qrUrl = useMemo(() => fabricSessionPwaUrl(runtimeId ?? undefined), [runtimeId]);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard can be blocked in the desktop shell */
    }
  };

  return (
    <section className="rounded-2xl border border-solid border-[var(--border-default)] bg-white p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="shrink-0 rounded-xl bg-white p-3 shadow-sm ring-1 ring-[var(--border-subtle)]">
          <QRCode value={qrUrl} size={168} level="M" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <DeviceMobile size={16} />
            Open on your phone
          </div>
          <p className="m-0 mt-1 text-[13px] text-[var(--text-secondary)]">
            Scan this code to open the Fabric Session app. It is a standalone
            PWA — add it to your home screen after it loads. This desktop stays
            the node.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-solid border-[var(--border-default)] bg-[#F7F7F7] p-2.5">
            <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--text-secondary)]">
              {qrUrl}
            </code>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border-none px-2.5 py-1 text-[11px] font-bold"
              style={{
                background: copied ? "#16a34a" : "white",
                color: copied ? "white" : "var(--text-primary)",
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <a
            href={qrUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex text-[12px] font-medium text-[var(--text-primary)] underline underline-offset-2"
          >
            {new URL(qrUrl).host}
          </a>
        </div>
      </div>
    </section>
  );
}
