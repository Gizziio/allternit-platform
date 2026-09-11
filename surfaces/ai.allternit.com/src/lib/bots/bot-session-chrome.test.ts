import { describe, expect, it } from "vitest";

import {
  botSessionStatus,
  groupMessagesByDay,
  messageDayKey,
  splitCompactMessages,
} from "./bot-session-chrome";

describe("botSessionStatus", () => {
  it("marks a send failure as waiting on you", () => {
    expect(
      botSessionStatus({ botName: "Teknium", isStreaming: false, sendError: "nope" })
    ).toEqual({ label: "waiting on you", tone: "error" });
  });

  it("marks a stream as working", () => {
    expect(botSessionStatus({ botName: "Teknium", isStreaming: true })).toEqual({
      label: "Teknium is working",
      tone: "running",
    });
  });

  it("marks an idle open session", () => {
    expect(botSessionStatus({ botName: "Teknium", isStreaming: false })).toEqual({
      label: "session open",
      tone: "idle",
    });
  });
});

describe("messageDayKey", () => {
  const now = Date.parse("2026-09-10T18:00:00.000Z");

  it("labels today and yesterday", () => {
    expect(messageDayKey("2026-09-10T12:00:00.000Z", now)).toBe("Today");
    expect(messageDayKey("2026-09-09T12:00:00.000Z", now)).toBe("Yesterday");
  });
});

describe("splitCompactMessages", () => {
  it("hides stretches older than 48h", () => {
    const now = Date.parse("2026-09-10T18:00:00.000Z");
    const { older, recent } = splitCompactMessages(
      [
        { timestamp: "2026-09-01T12:00:00.000Z" },
        { timestamp: "2026-09-10T17:00:00.000Z" },
      ],
      now
    );
    expect(older).toHaveLength(1);
    expect(recent).toHaveLength(1);
  });
});

describe("groupMessagesByDay", () => {
  it("clusters consecutive same-day messages", () => {
    const now = Date.parse("2026-09-10T18:00:00.000Z");
    const groups = groupMessagesByDay(
      [
        { timestamp: "2026-09-09T10:00:00.000Z" },
        { timestamp: "2026-09-09T11:00:00.000Z" },
        { timestamp: "2026-09-10T10:00:00.000Z" },
      ],
      now
    );
    expect(groups.map((g) => g.day)).toEqual(["Yesterday", "Today"]);
    expect(groups[0].messages).toHaveLength(2);
  });
});
