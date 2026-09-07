import React from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { DesktopCloudAdminView } from "./DesktopCloudAdminView";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <div className="h-screen w-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--ui-text-fg)]">
        <DesktopCloudAdminView />
      </div>
    </React.StrictMode>
  );
}
