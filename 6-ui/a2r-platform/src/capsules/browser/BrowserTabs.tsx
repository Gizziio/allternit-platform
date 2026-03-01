import React, { useState } from "react";
import { BrowserPane } from "./BrowserPane";
type Tab = "process" | "files" | "browser";
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
        {tab === "browser" ? <BrowserPane /> : <div style={{ padding: 16, opacity: 0.8 }}>{tab} (placeholder)</div>}
      </div>
    </div>
  );
}
