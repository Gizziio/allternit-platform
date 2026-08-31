import React from "react";
import { ComputeBillingPanel } from "@/components/settings/ComputeBillingPanel";

export function ComputePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
          Compute
        </h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">
          Configure local compute, managed hosting, and enterprise BYOC resources.
        </p>
      </div>

      <ComputeBillingPanel />
    </div>
  );
}
