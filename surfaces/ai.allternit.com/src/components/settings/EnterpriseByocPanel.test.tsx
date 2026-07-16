import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnterpriseByocPanel } from "./EnterpriseByocPanel";
import { getEnterpriseUsageSummary } from "@/lib/enterprise-usage";
import { listCloudCredentials } from "@/lib/design/cloud-credentials";

vi.mock("@/lib/platform-auth-client", () => ({
  usePlatformAuth: () => ({ orgId: "org_test", orgRole: "org:admin" }),
  usePlatformUser: () => ({ isLoaded: true, isSignedIn: true }),
  usePlatformOrganization: () => ({
    isLoaded: true,
    organization: { id: "org_test", name: "Allternit", slug: "allternit" },
    membership: { role: "org:admin" },
  }),
}));

vi.mock("@/components/settings/OrganizationAccessPanel", () => ({
  hasOrganizationAdminAccess: (role?: string | null) => role === "org:admin",
  OrganizationAccessPanel: () => <div>Organization access ready</div>,
}));

vi.mock("@/components/settings/CloudCredentialsPanel", () => ({
  CloudCredentialsPanel: () => <div>Connected cloud account controls</div>,
}));

vi.mock("@/lib/design/cloud-credentials", () => ({
  listCloudCredentials: vi.fn(),
}));

vi.mock("@/lib/enterprise-usage", () => ({
  getEnterpriseUsageSummary: vi.fn(),
}));

describe("EnterpriseByocPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "allternitSidecar", {
      configurable: true,
      value: {},
    });
    localStorage.setItem("allternit.active-runtime-id", "runtime_test");
    vi.mocked(listCloudCredentials).mockResolvedValue([
      { id: "credential_test", status: "active" },
    ] as never);
    vi.mocked(getEnterpriseUsageSummary).mockResolvedValue({
      organization_id: "org_test",
      period_start: "2026-07-01T00:00:00.000Z",
      period_end: "2026-08-01T00:00:00.000Z",
      line_items: [
        {
          description: "Enterprise environment runtime",
          resource_type: "environment_runtime",
          quantity: 120,
          unit: "minute",
          subtotal_cents: 500,
        },
      ],
      total_cents: 500,
      payment_terms: "Net 30",
      seller_legal_name: "Allternit, LLC",
      seller_address_lines: [],
    });
  });

  it("exposes working account and metered billing tabs for an organization admin", async () => {
    render(<EnterpriseByocPanel />);

    expect(screen.getByText("Admin billing access")).toBeInTheDocument();
    expect(await screen.findByText(/1 active provider connection/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cloud accounts/i }));
    expect(screen.getByText("Connected cloud account controls")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /usage & billing/i }));
    await waitFor(() => {
      expect(getEnterpriseUsageSummary).toHaveBeenCalledWith(
        "org_test",
        expect.any(String),
        expect.any(String),
      );
    });
    expect(await screen.findAllByText("$5.00")).toHaveLength(2);
  });
});
