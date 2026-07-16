import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComputeBillingPanel } from "./ComputeBillingPanel";
import {
  createHostedRuntime,
  getHostedEntitlement,
  listHostedRuntimes,
} from "@/lib/hosted-compute";

const platformGetToken = vi.hoisted(() => vi.fn(async () => "clerk-token"));

vi.mock("@/lib/platform-auth-client", () => ({
  usePlatformAuth: () => ({ getToken: platformGetToken }),
  usePlatformUser: () => ({ isLoaded: true, isSignedIn: true, user: { id: "user_test" } }),
}));

vi.mock("@/lib/hosted-compute", () => ({
  createHostedRuntime: vi.fn(),
  destroyHostedRuntime: vi.fn(),
  getHostedEntitlement: vi.fn(),
  listHostedRuntimes: vi.fn(),
  startHostedRuntime: vi.fn(),
  stopHostedRuntime: vi.fn(),
}));

const entitlement = {
  planTierId: "pro",
  planDisplayName: "Pro",
  canCreateHostedRuntime: true,
  maxHostedRuntimes: 1,
  maxMemoryMb: 2048,
  maxHoursMonthly: 100,
  usedSecondsMonthly: 3600,
  remainingSecondsMonthly: 356400,
  estimatedCostUsdMonthly: 1.25,
  activeInstances: 0,
  idleTimeoutMinutes: 15,
  allowedRegions: ["lax", "ord"],
  upgradeUrl: "https://allternit.com/pricing",
  billingPortalUrl: "",
};

describe("ComputeBillingPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getHostedEntitlement).mockResolvedValue(entitlement);
    vi.mocked(listHostedRuntimes).mockResolvedValue([]);
    vi.mocked(createHostedRuntime).mockResolvedValue({} as never);
  });

  it("renders plan limits and creates a configured hosted runtime", async () => {
    render(<ComputeBillingPanel />);

    await waitFor(() => expect(getHostedEntitlement).toHaveBeenCalledWith("clerk-token"));
    await screen.findByText("Hosted enabled", {}, { timeout: 5_000 });

    fireEvent.click(screen.getByRole("button", { name: /create runtime/i }));
    const name = screen.getByLabelText("Name");
    fireEvent.change(name, { target: { value: "Production brain" } });
    fireEvent.change(screen.getByLabelText("Region"), { target: { value: "ord" } });
    fireEvent.change(screen.getByLabelText("Memory"), { target: { value: "2048" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(createHostedRuntime).toHaveBeenCalledWith("clerk-token", {
        name: "Production brain",
        region: "ord",
        memoryMb: 2048,
      });
    });
  });
});
