import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PolicyEditor } from "./PolicyEditor";
import { PolicyGovernance } from "./PolicyGovernance";
import { PolicyVerdictChips } from "./PolicyVerdictChips";
import { POLICY_PRESETS, fetchPolicyAudit } from "./policy-audit";

vi.mock("./policy-audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./policy-audit")>();
  return {
    ...actual,
    fetchPolicyAudit: vi.fn(),
  };
});

const mockedFetch = vi.mocked(fetchPolicyAudit);

describe("PolicyGovernance gating", () => {
  beforeEach(() => {
    mockedFetch.mockResolvedValue([]);
  });

  it("renders nothing when sessionMode is not agent and isBot is falsy", () => {
    const { container } = render(
      <PolicyGovernance botId="bot-1" sessionMode="regular" isBot={false} />
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("policy-governance")).toBeNull();
  });

  it("renders the governance chrome for a bot session", async () => {
    render(<PolicyGovernance botId="bot-1" sessionMode="agent" isBot />);
    expect(await screen.findByTestId("policy-governance")).toBeInTheDocument();
  });

  it("renders when isBot is set even without sessionMode=agent", async () => {
    render(<PolicyGovernance botId="bot-1" isBot />);
    expect(await screen.findByTestId("policy-governance")).toBeInTheDocument();
  });
});

describe("PolicyVerdictChips", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it("renders allowed and denied chips; denied shows the rule id", async () => {
    mockedFetch.mockResolvedValue([
      {
        ts: "2026-09-10T22:00:00.000Z",
        decision: "allowed",
        tool: "aci.run",
        rule_id: "allow-runs",
      },
      {
        ts: "2026-09-10T22:01:00.000Z",
        decision: "denied",
        tool: "computer.shell",
        rule_id: "deny-destructive-shell",
      },
    ]);

    render(<PolicyVerdictChips botId="bot-1" />);

    expect(await screen.findByText("allowed")).toBeInTheDocument();
    expect(screen.getByText("denied")).toBeInTheDocument();
    expect(screen.getByText("· deny-destructive-shell")).toBeInTheDocument();
  });
});

describe("PolicyEditor", () => {
  it("flags missing id, tool, and action", () => {
    render(<PolicyEditor />);
    const issues = screen.getByTestId("policy-editor-issues");
    expect(issues.textContent).toContain("rule has no `id`");
    expect(issues.textContent).toContain("rule has no `tool` glob");
    expect(issues.textContent).toContain("rule has no `action`");
  });

  it("flags a bad action value applied from JSON", () => {
    render(<PolicyEditor />);
    fireEvent.click(screen.getByTestId("policy-editor-advanced"));
    fireEvent.change(screen.getByTestId("policy-editor-json"), {
      target: {
        value: JSON.stringify({
          rules: [{ id: "x", tool: "computer.shell", action: "explode" }],
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply JSON" }));
    expect(screen.getByTestId("policy-editor-issues").textContent).toContain(
      "unknown action `explode`"
    );
  });

  it("inserts a valid preset rule", async () => {
    render(<PolicyEditor />);
    fireEvent.click(
      screen.getByTestId(`policy-editor-preset-${POLICY_PRESETS[0].label}`)
    );
    await waitFor(() => {
      expect(screen.queryByTestId("policy-editor-issues")).toBeNull();
    });
    expect(screen.getByDisplayValue("deny-destructive-shell")).toBeInTheDocument();
    expect(screen.getByDisplayValue("computer.shell")).toBeInTheDocument();
  });
});
