import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BotComposer } from "./BotComposer";

describe("BotComposer", () => {
  it("sends on Enter and clears the draft", () => {
    const onSend = vi.fn();
    render(<BotComposer onSend={onSend} />);

    const input = screen.getByRole("textbox", { name: "Message input" });
    fireEvent.change(input, { target: { value: "hello there" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("hello there");
    expect(input).toHaveValue("");
  });

  it("renders chips from props and tap-sends the prompt", () => {
    const onSend = vi.fn();
    render(
      <BotComposer
        onSend={onSend}
        suggestions={[
          { id: "logs", label: "Check logs", prompt: "Please check the logs" },
          { id: "status", label: "Status" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Check logs" }));
    expect(onSend).toHaveBeenCalledWith("Please check the logs");

    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    expect(onSend).toHaveBeenCalledWith("Status");
  });

  it("opens the slash HUD, filters by title, and a prompt command fills input without sending", () => {
    const onSend = vi.fn();
    render(
      <BotComposer
        onSend={onSend}
        commands={[
          {
            id: "standup",
            title: "Daily standup",
            description: "Summarize standup",
            action: "prompt",
            prompt: "Write the daily standup",
          },
          {
            id: "weekly",
            title: "Weekly review",
            description: "Review the week",
            action: "prompt",
            prompt: "Write the weekly review",
          },
        ]}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Message input" });
    fireEvent.change(input, { target: { value: "/" } });
    expect(screen.getByText("Routines")).toBeInTheDocument();
    expect(screen.getByText("Daily standup")).toBeInTheDocument();
    expect(screen.getByText("Weekly review")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "/week" } });
    expect(screen.queryByText("Daily standup")).not.toBeInTheDocument();
    expect(screen.getByText("Weekly review")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Weekly review"));
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue("Write the weekly review");
    expect(screen.queryByText("Routines")).not.toBeInTheDocument();
  });

  it("disables dictation when SpeechRecognition is undefined and does not throw", () => {
    expect(window.SpeechRecognition).toBeUndefined();
    expect(
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition,
    ).toBeUndefined();

    expect(() => render(<BotComposer onSend={() => {}} />)).not.toThrow();

    const mic = screen.getByRole("button", { name: "Dictate" });
    expect(mic).toBeDisabled();
    expect(mic).toHaveAttribute(
      "title",
      "Dictation isn't available in this browser",
    );
  });

  it("caps growth at 5 rows via data-max-rows", () => {
    // Growth is textarea behavior (rows=1, data-max-rows=5); jsdom does not
    // layout, so we assert the cap attribute rather than computed height.
    render(<BotComposer onSend={() => {}} />);
    const input = screen.getByRole("textbox", { name: "Message input" });
    expect(input).toHaveAttribute("rows", "1");
    expect(input).toHaveAttribute("data-max-rows", "5");
  });
});
