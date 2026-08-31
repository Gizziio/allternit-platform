import React from "react";
import { OrganizationAccessPanel } from "@/components/settings/OrganizationAccessPanel";

export function OrganizationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
          Organizations
        </h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">
          Manage your active organization, membership role, and access controls.
        </p>
      </div>

      <OrganizationAccessPanel />
    </div>
  );
}
