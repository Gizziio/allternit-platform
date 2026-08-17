"use client";

import { useMemo } from "react";
import {
  SignApp,
  OfficeHostProvider,
  createBrowserHost,
  type OfficeHost,
} from "@allternit/allternit-office-suite";
import { createArtifact } from "@/services/artifacts-api";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return window.btoa(binary);
}

export function NativeSigningView(): React.ReactNode {
  const host = useMemo<OfficeHost>(
    () =>
      createBrowserHost({
        saveFile: async (bytes: Uint8Array, name: string) => {
          const baseName = name.replace(/\.pdf$/i, "");
          const dataUrl = `data:application/pdf;base64,${toBase64(bytes)}`;
          await createArtifact({
            workspaceId: "ws_allternit",
            title: `${baseName} — signed`,
            type: "document",
            status: "final",
            summary: `Signed PDF created with Allternit Sign.`,
            tags: ["signed", "pdf", "esign"],
            sections: [
              {
                heading: "Signed PDF",
                kind: "pdf",
                body: dataUrl,
                position: 0,
              },
            ],
          });
        },
      }),
    []
  );

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <OfficeHostProvider host={host}>
        <SignApp />
      </OfficeHostProvider>
    </div>
  );
}

export default NativeSigningView;
