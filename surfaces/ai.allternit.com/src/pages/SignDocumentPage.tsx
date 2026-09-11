"use client";

import { NativeSigningView } from "@/views/office/NativeSigningView";
import { OfficePageChrome } from "@/shell/OfficePageChrome";

export default function SignDocumentPage(): React.ReactNode {
  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden">
      <OfficePageChrome />
      <div className="min-h-0 flex-1">
        <NativeSigningView />
      </div>
    </main>
  );
}
