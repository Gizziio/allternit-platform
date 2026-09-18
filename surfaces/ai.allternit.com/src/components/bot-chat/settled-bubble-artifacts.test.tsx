import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettledBubble } from "./SettledBubble";

describe("SettledBubble artifact rendering", () => {
  it("renders plain bot messages without artifacts", () => {
    const { container } = render(
      <SettledBubble role="bot" text="Hello, how can I help you today?" />
    );
    expect(screen.getByText(/Hello, how can I help you today/i)).toBeDefined();
    expect(container.querySelector("[data-inline-artifact]")).toBeNull();
  });

  it("renders HTML artifact inline when present in bot message", () => {
    const message = `Here is your landing page:
\`\`\`html title="Hero Page"
<!DOCTYPE html>
<html>
  <body><h1>Welcome to Allternit</h1></body>
</html>
\`\`\`
Let me know if you need changes!`;

    const { container } = render(
      <SettledBubble role="bot" text={message} />
    );

    expect(screen.getByText(/Here is your landing page/i)).toBeDefined();
    expect(screen.getByText(/Let me know if you need changes/i)).toBeDefined();
    expect(screen.getByText(/Hero Page/i)).toBeDefined();
    expect(screen.getByText(/HTML/i)).toBeDefined();
    expect(container.querySelector("[data-inline-artifact]")).not.toBeNull();
  });

  it("renders SVG artifact inline when present in bot message", () => {
    const message = `Check out this diagram:
\`\`\`svg title="Architecture Diagram"
<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="blue" /></svg>
\`\`\``;

    const { container } = render(
      <SettledBubble role="bot" text={message} />
    );

    expect(screen.getByText(/Architecture Diagram/i)).toBeDefined();
    expect(screen.getByText(/SVG/i)).toBeDefined();
    expect(container.querySelector("[data-inline-artifact]")).not.toBeNull();
  });
});

describe("SettledBubble user message styling", () => {
  it("gives user bubbles a visible panel fill, not the page-elevated fill", () => {
    const { container } = render(<SettledBubble role="user" text="hello there" />);
    const bubble = container.querySelector(".rounded-br-sm") as HTMLElement;
    expect(bubble.className).toContain("bg-[var(--surface-panel)]");
    expect(bubble.className).toContain("border-[var(--border-subtle)]");
    expect(bubble.className).not.toContain("bg-[var(--bg-elevated)]");
  });

  it("renders user text verbatim, markdown characters included", () => {
    render(<SettledBubble role="user" text="use [alpha] and **beta**" />);
    expect(screen.getByText(/use \[alpha\] and \*\*beta\*\*/)).toBeDefined();
  });

  it("collapses a long user paste behind Show more", () => {
    const wall = Array.from({ length: 12 }, (_, i) => `line ${i} of a pasted wall`).join("\n");
    render(<SettledBubble role="user" text={wall} />);
    expect(screen.getByRole("button", { name: "Show more" })).toBeDefined();
  });

  it("keeps short user messages expanded", () => {
    render(<SettledBubble role="user" text="short" />);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("exposes a copy action on bot bubbles", () => {
    render(<SettledBubble role="bot" text="Hello" />);
    expect(screen.getByLabelText("Copy message")).toBeDefined();
    expect(screen.getByLabelText("Message actions")).toBeDefined();
  });
});
