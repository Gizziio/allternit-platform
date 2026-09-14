import { describe, expect, it } from "vitest";

import {
  botSessionStatus,
  groupMessagesByDay,
  messageDayKey,
  nextRoutineLabel,
  splitCompactMessages,
  summarizeOlderMessages,
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

describe("nextRoutineLabel", () => {
  const now = Date.parse("2026-09-10T18:00:00.000Z");

  it("returns null when there are no enabled routines", () => {
    expect(nextRoutineLabel([], now)).toBeNull();
    expect(
      nextRoutineLabel(
        [{ title: "off", enabled: false, nextRunAt: now + 60_000 }],
        now,
      ),
    ).toBeNull();
  });

  it("picks the nearest enabled routine and formats the delta", () => {
    const label = nextRoutineLabel(
      [
        { title: "later", enabled: true, nextRunAt: now + 3 * 60 * 60 * 1000 },
        { title: "soon", enabled: true, nextRunAt: now + 2 * 60 * 60 * 1000 },
      ],
      now,
    );
    expect(label).toBe('next routine "soon" in 2.0h');
  });

  it("marks an overdue routine as due and formats minutes and days", () => {
    expect(
      nextRoutineLabel([{ title: "late", enabled: true, nextRunAt: now - 1000 }], now),
    ).toBe('routine "late" due');
    expect(
      nextRoutineLabel([{ title: "m", enabled: true, nextRunAt: now + 5 * 60_000 }], now),
    ).toBe('next routine "m" in 5m');
    expect(
      nextRoutineLabel(
        [{ title: "d", enabled: true, nextRunAt: now + 3 * 24 * 60 * 60 * 1000 }],
        now,
      ),
    ).toBe('next routine "d" in 3d');
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

describe("summarizeOlderMessages", () => {
  it("counts sides and names the span", () => {
    const now = Date.parse("2026-09-10T18:00:00.000Z");
    const text = summarizeOlderMessages([
      { role: "user", content: "hi", timestamp: "2026-09-01T12:00:00.000Z" },
      { role: "assistant", content: "hey", timestamp: "2026-09-02T12:00:00.000Z" },
    ]);
    expect(text).toContain("2 earlier messages");
    expect(text).toContain("1 from you");
    expect(text).toContain("1 replies");
    void now;
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
