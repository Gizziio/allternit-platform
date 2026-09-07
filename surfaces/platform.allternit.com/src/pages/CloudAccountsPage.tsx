import React from "react";
import { CloudCredentialsPanel } from "@/components/settings/CloudCredentialsPanel";

export function CloudAccountsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
          Cloud accounts
        </h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">
          Connect your own AWS, Google Cloud, or Azure accounts for BYOC sandboxing.
        </p>
      </div>

      <CloudCredentialsPanel />
    </div>
  );
}

export default CloudAccountsPage;
