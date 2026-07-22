import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrganizationAccessPanel } from "./OrganizationAccessPanel";

const authState: { orgId: string | null; orgRole: string | null } = {
  orgId: null,
  orgRole: null,
};

vi.mock("@/lib/platform-auth-client", () => ({
  isPlatformAuthDisabled: () => false,
  PlatformOrganizationSwitcher: () => <button type="button">Choose organization</button>,
  usePlatformAuth: () => ({ ...authState }),
  usePlatformOrganization: () => ({
    isLoaded: true,
    organization: authState.orgId ? { id: authState.orgId, name: "Allternit", slug: "allternit" } : null,
    membership: authState.orgRole ? { role: authState.orgRole } : null,
  }),
  usePlatformUser: () => ({ isLoaded: true, isSignedIn: true, user: { id: "owner" } }),
}));

describe("OrganizationAccessPanel", () => {
  it("offers organization activation for a personal session", () => {
    authState.orgId = null;
    authState.orgRole = null;
    render(<OrganizationAccessPanel compact />);
    expect(screen.getByText("Select your enterprise organization")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose organization" })).toBeInTheDocument();
  });

  it("shows admin billing permissions for the active organization", () => {
    authState.orgId = "org_allternit";
    authState.orgRole = "org:admin";
    render(<OrganizationAccessPanel />);
    expect(screen.getByText("Allternit")).toBeInTheDocument();
    expect(screen.getByText("Billing access")).toBeInTheDocument();
    expect(screen.getByText("View & export")).toBeInTheDocument();
  });
});
