import React, { useState } from "react";
import { BrowserPane } from "./BrowserPane";
type Tab = "process" | "files" | "browser";

function UnsupportedTabPanel({ tab }: { tab: Exclude<Tab, "browser"> }) {
  const labels: Record<Exclude<Tab, "browser">, string> = {
    process: "Process inspection",
    files: "File browsing",
  };

  return (
    <div style={{ padding: 16, color: "rgba(255,255,255,0.78)" }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{labels[tab]} unavailable</div>
      <div style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 520, opacity: 0.82 }}>
        This browser capsule currently exposes only the live browser pane. Additional tabs remain hidden until they
        are backed by a real runtime integration.
      </div>
    </div>
  );
}

export function BrowserTabs() {
  const [tab, setTab] = useState<Tab>("browser");
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, padding: 10, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        {(["process","files","browser"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)",
            background: tab===t ? "rgba(0,0,0,0.06)" : "transparent"
          }}>{t}</button>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        {tab === "browser" ? <BrowserPane /> : <UnsupportedTabPanel tab={tab} />}
      </div>
    </div>
  );
}
