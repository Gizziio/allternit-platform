import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ScreenControlAsk } from "./ScreenControlAsk";

vi.mock("@phosphor-icons/react", () => {
  const Icon = () => <span data-icon="p" />;
  return { Desktop: Icon, ShieldWarning: Icon };
});

describe("ScreenControlAsk", () => {
  it("offers Allow once, Always allow, and Deny without implying the computer is killed", () => {
    const onDecide = vi.fn();
    render(<ScreenControlAsk botName="Scout 2" onDecide={onDecide} />);
    expect(screen.getByText(/Computer Cloud stays running/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Allow once" }));
    expect(onDecide).toHaveBeenCalledWith("allow-once");
  });
});
