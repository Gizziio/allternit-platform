import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ApprovalCard } from "./ApprovalCard";
import { BotTranscript } from "./BotTranscript";
import type { ApprovalRequest } from "./types";

const ACCENT = "#3b82f6";

function pendingApproval(
  overrides: Partial<ApprovalRequest> = {},
): ApprovalRequest {
  return {
    id: "appr-1",
    botId: "bot-1",
    botName: "Gizzi",
    title: "Run terminal command",
    detail: "ls -la",
    options: [
      { id: "allow", label: "Allow", kind: "approve" },
      { id: "deny", label: "Deny", kind: "deny" },
      { id: "later", label: "Ask later", kind: "neutral" },
    ],
    status: "pending",
    ...overrides,
  };
}

describe("ApprovalCard", () => {
  it("tints pending (accent fill + stroke) and settles to a quiet grey label", () => {
    const { container, rerender } = render(
      <ApprovalCard
        approval={pendingApproval()}
        accentColor={ACCENT}
        onAnswer={() => {}}
      />,
    );

    const pendingCard = container.firstElementChild as HTMLElement;
    expect(pendingCard.getAttribute("role")).toBe("alertdialog");
    expect(pendingCard.style.backgroundColor).toContain("12%");
    expect(pendingCard.style.border).toContain("1.5px solid");
    expect(pendingCard.style.border).toContain("rgb(59, 130, 246)");
    expect(screen.getByText("Gizzi is waiting on you")).toBeInTheDocument();
    expect(screen.queryByText("Approved ✓")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Allow" })).toBeInTheDocument();

    rerender(
      <ApprovalCard
        approval={pendingApproval({ status: "approved" })}
        accentColor={ACCENT}
        onAnswer={() => {}}
      />,
    );
    const settledCard = container.firstElementChild as HTMLElement;
    expect(settledCard.getAttribute("role")).toBe("status");
    expect(settledCard.style.backgroundColor).toContain("--bg-elevated");
    expect(settledCard.style.border).toBe("1.5px solid transparent");
    expect(screen.getAllByText("Approved ✓").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Allow" })).not.toBeInTheDocument();

    rerender(
      <ApprovalCard
        approval={pendingApproval({ status: "denied" })}
        onAnswer={() => {}}
      />,
    );
    expect(screen.getAllByText("Denied").length).toBeGreaterThan(0);

    rerender(
      <ApprovalCard
        approval={pendingApproval({ status: "expired" })}
        onAnswer={() => {}}
      />,
    );
    expect(screen.getAllByText("Expired").length).toBeGreaterThan(0);
  });

  it("renders one capsule per option with approve/deny/neutral tinting", () => {
    render(
      <ApprovalCard
        approval={pendingApproval()}
        accentColor={ACCENT}
        onAnswer={() => {}}
      />,
    );

    const allow = screen.getByRole("button", { name: "Allow" });
    const deny = screen.getByRole("button", { name: "Deny" });
    const later = screen.getByRole("button", { name: "Ask later" });

    expect(allow).toBeInTheDocument();
    expect(deny).toBeInTheDocument();
    expect(later).toBeInTheDocument();

    expect(allow.style.backgroundColor).toBe("rgb(59, 130, 246)");
    expect(allow.style.color).toBe("rgb(255, 255, 255)");
    expect(deny.style.backgroundColor).toContain("--bg-elevated");
    expect(later.className).toContain("border");
  });

  it("renders Always allow only when grantKey is present", () => {
    const { rerender } = render(
      <ApprovalCard approval={pendingApproval()} onAnswer={() => {}} />,
    );
    expect(screen.queryByText("Always allow this tool")).not.toBeInTheDocument();

    rerender(
      <ApprovalCard
        approval={pendingApproval({ grantKey: "tool:shell" })}
        onAnswer={() => {}}
      />,
    );
    expect(screen.getByText("Always allow this tool")).toBeInTheDocument();
  });

  it("fires onAnswer and onGrant", () => {
    const onAnswer = vi.fn();
    const onGrant = vi.fn();
    render(
      <ApprovalCard
        approval={pendingApproval({ grantKey: "tool:shell" })}
        onAnswer={onAnswer}
        onGrant={onGrant}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Allow" }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith("allow");

    fireEvent.click(screen.getByText("Always allow this tool"));
    expect(onGrant).toHaveBeenCalledTimes(1);
    expect(onGrant).toHaveBeenCalledWith("tool:shell");
  });
});

describe("BotTranscript approval pass-through", () => {
  it("forwards onApprovalAnswer / onApprovalGrant from the list to ApprovalCard", () => {
    const onApprovalAnswer = vi.fn();
    const onApprovalGrant = vi.fn();
    const approval = pendingApproval({ grantKey: "tool:shell" });

    render(
      <BotTranscript
        transcript={{
          rows: [
            {
              id: "row-appr-1",
              kind: "approval",
              createdAt: Date.now(),
              approval,
            },
          ],
          activeTurn: null,
        }}
        onApprovalAnswer={onApprovalAnswer}
        onApprovalGrant={onApprovalGrant}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Allow" }));
    expect(onApprovalAnswer).toHaveBeenCalledWith("appr-1", "allow");

    fireEvent.click(screen.getByText("Always allow this tool"));
    expect(onApprovalGrant).toHaveBeenCalledWith("appr-1", "tool:shell");
  });
});
