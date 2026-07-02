"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type HtmlTab = "preview" | "source";

export function HtmlPreview({ html }: { html: string }) {
  const [tab, setTab] = useState<HtmlTab>("preview");

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-solid border-[var(--ui-border-muted)] px-2 shrink-0">
        <button type="button" 
          onClick={() => setTab("preview")}
          className={cn(
            "px-3.5 py-1.5 text-[12px] font-medium cursor-pointer border-none bg-none transition-all duration-150 border-b-[1.5px] border-solid",
            tab === "preview" ? "text-[rgba(212,176,140,0.9)] border-[rgba(212,176,140,0.7)]" : "text-[rgba(255,255,255,0.35)] border-transparent"
          )}
        >
          Preview
        </button>
        <button type="button" 
          onClick={() => setTab("source")}
          className={cn(
            "px-3.5 py-1.5 text-[12px] font-medium cursor-pointer border-none bg-none transition-all duration-150 border-b-[1.5px] border-solid",
            tab === "source" ? "text-[rgba(212,176,140,0.9)] border-[rgba(212,176,140,0.7)]" : "text-[rgba(255,255,255,0.35)] border-transparent"
          )}
        >
          Source
        </button>
      </div>

      {/* Preview iframe */}
      {tab === "preview" && (
        <iframe
          srcDoc={html}
          sandbox="allow-scripts allow-same-origin allow-forms"
          className="flex-1 border-none w-full bg-white min-h-[400px]"
          title="HTML preview"
        />
      )}

      {/* Source view */}
      {tab === "source" && (
        <div className="flex-1 overflow-auto">
          <pre className="p-[16px_20px] text-[12px] text-[#abb2bf] white-space-pre-wrap leading-relaxed font-mono m-0">
            {html}
          </pre>
        </div>
      )}
    </div>
  );
}
