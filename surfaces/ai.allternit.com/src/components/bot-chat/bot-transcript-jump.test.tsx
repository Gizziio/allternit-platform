import React from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BotTranscript } from "./BotTranscript";
import { applyEvent, initTranscript, userSendEvent } from "./chat-stream-adapter";
import type { BotChatTranscript } from "./types";

const T0 = new Date("2026-09-10T18:00:00Z").getTime();

function makeTranscript(messageCount: number): BotChatTranscript {
  let t = initTranscript();
  for (let i = 0; i < messageCount; i++) {
    t = applyEvent(
      t,
      userSendEvent(`message ${i}`, { id: `u${i}`, createdAt: T0 + i }),
    );
  }
  return t;
}

/** Give the jsdom scroller real geometry and a writable scrollTop. */
function mockScroller(el: HTMLElement, scrollHeight: number, clientHeight: number) {
  let scrollTop = 0;
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get: () => scrollHeight,
  });
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    get: () => clientHeight,
  });
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
  });
  return {
    get scrollTop() {
      return scrollTop;
    },
    setScrollTopForEvent(value: number) {
      scrollTop = value;
    },
  };
}

describe("BotTranscript jump to latest", () => {
  it("forces a scroll to the newest row when jumpKey changes", () => {
    const transcript = makeTranscript(3);
    const { container, rerender } = render(
      <BotTranscript transcript={transcript} className="overflow-y-auto" />,
    );
    const scroller = container.querySelector(".overflow-y-auto") as HTMLElement;
    const geom = mockScroller(scroller, 5000, 600);
    // Simulate the user reading scrolled-up history.
    geom.setScrollTopForEvent(400);

    rerender(
      <BotTranscript transcript={transcript} className="overflow-y-auto" jumpKey={1} />,
    );

    expect(geom.scrollTop).toBe(5000);
  });

  it("shows a Jump to latest pill when scrolled away and hides it after jumping", () => {
    const transcript = makeTranscript(3);
    const { container } = render(
      <BotTranscript transcript={transcript} className="overflow-y-auto" jumpKey={0} />,
    );
    const scroller = container.querySelector(".overflow-y-auto") as HTMLElement;
    const geom = mockScroller(scroller, 5000, 600);

    // Near bottom → no pill.
    geom.setScrollTopForEvent(4400);
    fireEvent.scroll(scroller);
    expect(screen.queryByRole("button", { name: /jump to latest/i })).toBeNull();

    // Scroll up → pill appears.
    geom.setScrollTopForEvent(1000);
    fireEvent.scroll(scroller);
    const pill = screen.getByRole("button", { name: /jump to latest/i });

    // Clicking the pill jumps to the newest message and dismisses itself.
    fireEvent.click(pill);
    expect(geom.scrollTop).toBe(5000);
    fireEvent.scroll(scroller);
    expect(screen.queryByRole("button", { name: /jump to latest/i })).toBeNull();
  });

  it("does not jump on unrelated rerenders", () => {
    const transcript = makeTranscript(3);
    const { container, rerender } = render(
      <BotTranscript transcript={transcript} className="overflow-y-auto" />,
    );
    const scroller = container.querySelector(".overflow-y-auto") as HTMLElement;
    const geom = mockScroller(scroller, 5000, 600);
    geom.setScrollTopForEvent(1000);

    rerender(
      <BotTranscript transcript={transcript} className="overflow-y-auto" />,
    );

    expect(geom.scrollTop).toBe(1000);
  });
});
