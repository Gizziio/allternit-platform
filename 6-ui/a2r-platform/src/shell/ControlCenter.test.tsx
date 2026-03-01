import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ControlCenter } from "./ControlCenter";

const mockGetAllowlist = vi.fn();
const mockGetEnvironments = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: React.PropsWithChildren<{ href: string }>) => <a href={href}>{children}</a>,
}));

vi.mock("@/design/GlassSurface", () => ({
  GlassSurface: ({
    children,
    className,
    style,
  }: React.PropsWithChildren<{ className?: string; style?: React.CSSProperties }>) => (
    <div className={className} style={style}>
      {children}
    </div>
  ),
}));

vi.mock("@/capsules/browser/policyService", () => ({
  getPolicyStore: () => ({
    getAllowlist: mockGetAllowlist,
    addToAllowlist: vi.fn(),
    removeFromAllowlist: vi.fn(),
  }),
}));

vi.mock("@/capsules/browser/environmentService", () => ({
  getEnvironmentManager: () => ({
    getEnvironments: mockGetEnvironments,
  }),
}));

vi.mock("@/capsules/browser/observabilityService", () => ({
  getObservabilityService: () => ({
    log: vi.fn(),
  }),
}));

vi.mock("@/views/nodes", () => ({
  NodesView: () => <div>Nodes view</div>,
}));

vi.mock("@/views/runtime/RuntimeConfigurationPanel", () => ({
  ConnectedRuntimeConfigurationPanel: ({
    showManagementLinks,
  }: {
    showManagementLinks?: boolean;
  }) => (
    <div data-testid="runtime-configuration-panel">
      {showManagementLinks ? "management links enabled" : "management links disabled"}
    </div>
  ),
}));

describe("ControlCenter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllowlist.mockResolvedValue([]);
    mockGetEnvironments.mockResolvedValue([]);
  });

  it("renders the live runtime configuration panel inside the runtime section", async () => {
    render(<ControlCenter isOpen onClose={vi.fn()} onOpenView={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Runtime Environment" }));

    expect(await screen.findByTestId("runtime-configuration-panel")).toBeInTheDocument();
    expect(screen.getByText("management links enabled")).toBeInTheDocument();
    expect(screen.getByText(/Shared agent mode lives in/i)).toBeInTheDocument();
  });
});
