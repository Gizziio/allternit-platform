// @ts-nocheck
import { describe, expect, test } from "bun:test"
import {
  parseSchedule,
  parseScheduleToType,
  describeSchedule,
  getNextRunTime,
  suggestSchedules,
  COMMON_SCHEDULES,
} from "../src/runtime/automation/cron/parser"
import { CronParser } from "../src/runtime/automation/cron/parser"
import {
  isValidTimezone,
  getNextOccurrenceInTimezone,
  searchTimezones,
  getTimezoneOffset,
  COMMON_TIMEZONES,
} from "../src/runtime/automation/cron/utils/timezone"
import {
  calculateDelay,
  withRetry,
  RetryableErrors,
} from "../src/runtime/automation/cron/utils/retry"
import {
  registerFunction,
  getFunction,
  listRegisteredFunctions,
  unregisterFunction,
} from "../src/runtime/automation/cron/executors/function-registry"

// NOTE: the parseSchedule / CronParser.isValid infinite-recursion bug for
// non-matching inputs was fixed in session/gizzi-fix-cronparser-20260904;
// the "regression" describe block below locks the null-return behavior in.

describe("CronParser.parseSchedule (natural language)", () => {
  test("every N minutes", () => {
    const p = parseSchedule("every 5 minutes")
    expect(p.type).toBe("cron")
    expect(p.expression).toBe("*/5 * * * *")
    expect(p.seconds).toBeUndefined()
  })

  test("bare '5 minutes' (no 'every' prefix)", () => {
    expect(parseSchedule("15 minutes").expression).toBe("*/15 * * * *")
  })

  test("every N seconds becomes an interval schedule", () => {
    const p = parseSchedule("every 30 seconds")
    expect(p.type).toBe("interval")
    expect(p.seconds).toBe(30)
    expect(p.expression.split(/\s+/)).toHaveLength(6)
  })

  test("every N hours / days / weeks", () => {
    expect(parseSchedule("every 2 hours").expression).toBe("0 */2 * * *")
    expect(parseSchedule("every 3 days").expression).toBe("0 0 */3 * *")
    expect(parseSchedule("every 2 weeks").expression).toBe("0 0 * * 0 */2")
  })

  test("hourly", () => {
    expect(parseSchedule("hourly").expression).toBe("0 * * * *")
  })

  test("daily variants", () => {
    expect(parseSchedule("daily").expression).toBe("0 0 * * *")
    expect(parseSchedule("daily at 9am").expression).toBe("0 9 * * *")
    expect(parseSchedule("daily at noon").expression).toBe("0 12 * * *")
    expect(parseSchedule("daily at midnight").expression).toBe("0 0 * * *")
    expect(parseSchedule("daily at 5:30pm").expression).toBe("30 17 * * *")
  })

  test("weekdays", () => {
    expect(parseSchedule("weekdays").expression).toBe("0 9 * * 1-5")
    expect(parseSchedule("weekdays at noon").expression).toBe("0 12 * * 1-5")
  })

  test("day of week with am/pm handling", () => {
    expect(parseSchedule("mondays at 8:30").expression).toBe("30 8 * * 1")
    expect(parseSchedule("fridays at 5pm").expression).toBe("0 17 * * 5")
    expect(parseSchedule("sundays").expression).toBe("0 9 * * 0")
  })

  test("12am/12pm edge cases", () => {
    expect(parseSchedule("daily at 12am").expression).toBe("0 0 * * *")
    expect(parseSchedule("daily at 12pm").expression).toBe("0 12 * * *")
  })

  test("monthly", () => {
    expect(parseSchedule("monthly").expression).toBe("0 0 1 * *")
    expect(parseSchedule("monthly on the 15th at 3pm").expression).toBe("0 15 15 * *")
  })

  test("yearly", () => {
    expect(parseSchedule("yearly").expression).toBe("0 0 1 1 *")
    expect(parseSchedule("annually").expression).toBe("0 0 1 1 *")
  })

  test("bare clock time with meridiem", () => {
    expect(parseSchedule("9:30pm").expression).toBe("30 21 * * *")
    expect(parseSchedule("at 6am").expression).toBe("0 6 * * *")
  })

  test("passthrough of a raw 5-part cron expression", () => {
    const p = parseSchedule("0 2 * * *")
    expect(p.type).toBe("cron")
    expect(p.expression).toBe("0 2 * * *")
    expect(p.original).toBe("0 2 * * *")
  })
})

describe("CronParser.parseScheduleToType", () => {
  test("interval schedule from seconds", () => {
    expect(parseScheduleToType("every 45 seconds")).toEqual({
      type: "interval",
      seconds: 45,
    })
  })

  test("cron schedule from expression or language", () => {
    expect(parseScheduleToType("0 9 * * *")).toEqual({
      type: "cron",
      expression: "0 9 * * *",
    })
    expect(parseScheduleToType("hourly")).toEqual({
      type: "cron",
      expression: "0 * * * *",
    })
  })
})

describe("CronParser.isValid", () => {
  test("accepts cron expressions", () => {
    expect(CronParser.isValid("0 9 * * *")).toBe(true)
    expect(CronParser.isValid("*/15 * * * *")).toBe(true)
  })

  test("accepts natural language", () => {
    expect(CronParser.isValid("every 5 minutes")).toBe(true)
    expect(CronParser.isValid("daily at 9am")).toBe(true)
  })
})

describe("describeSchedule", () => {
  test("intervals", () => {
    expect(describeSchedule({ type: "interval", seconds: 45 })).toBe("Every 45 seconds")
    expect(describeSchedule({ type: "interval", seconds: 300 })).toBe("Every 5 minutes")
    expect(describeSchedule({ type: "interval", seconds: 90 })).toBe("Every 1m 30s")
    expect(describeSchedule({ type: "interval", seconds: 1 })).toBe("Every 1 second")
  })

  test("common cron patterns", () => {
    expect(describeSchedule({ type: "cron", expression: "0 0 * * *" })).toBe("Daily at midnight")
    expect(describeSchedule({ type: "cron", expression: "0 * * * *" })).toBe("Every hour")
    expect(describeSchedule({ type: "cron", expression: "*/15 * * * *" })).toBe("Every 15 minutes")
    expect(describeSchedule({ type: "cron", expression: "0 */6 * * *" })).toBe("Every 6 hours")
    expect(describeSchedule({ type: "cron", expression: "0 9 * * 1-5" })).toBe("Weekdays at 9:00 AM")
    expect(describeSchedule({ type: "cron", expression: "0 18 * * 1-5" })).toBe("Weekdays at 6:00 PM")
    expect(describeSchedule({ type: "cron", expression: "30 8 * * 1" })).toBe("Mon at 8:30 AM")
  })

  test("fallback for 6-part expressions", () => {
    expect(describeSchedule({ type: "cron", expression: "*/10 * * * * *" })).toBe(
      "Cron: */10 * * * * *",
    )
  })
})

describe("getNextRunTime", () => {
  // All inputs fixed — no wall-clock dependence.
  test("interval schedule adds seconds to from", () => {
    const from = new Date(2026, 8, 4, 10, 0, 0)
    const next = getNextRunTime({ type: "interval", seconds: 90 }, undefined, from)
    expect(next.getTime()).toBe(from.getTime() + 90_000)
  })

  test("*/N minute pattern lands on the next interval boundary", () => {
    const from = new Date(2026, 8, 4, 10, 7, 30)
    const next = getNextRunTime({ type: "cron", expression: "*/15 * * * *" }, undefined, from)
    expect(next.getHours()).toBe(10)
    expect(next.getMinutes()).toBe(15)
    expect(next.getSeconds()).toBe(0)
  })

  test("daily 9am same day when before 9am", () => {
    const from = new Date(2026, 8, 4, 8, 0, 0)
    const next = getNextRunTime({ type: "cron", expression: "0 9 * * *" }, undefined, from)
    expect(next.getDate()).toBe(from.getDate())
    expect(next.getHours()).toBe(9)
    expect(next.getMinutes()).toBe(0)
  })

  test("daily 9am rolls to next day when at/after 9am", () => {
    const from = new Date(2026, 8, 4, 9, 0, 0)
    const next = getNextRunTime({ type: "cron", expression: "0 9 * * *" }, undefined, from)
    expect(next.getTime()).toBeGreaterThan(from.getTime())
    expect(next.getDate()).toBe(from.getDate() + 1)
    expect(next.getHours()).toBe(9)
  })

  test("weekday schedule skips Friday 10am to Monday 9am", () => {
    const from = new Date(2026, 8, 4, 10, 0, 0) // 2026-09-04 is a Friday
    expect(from.getDay()).toBe(5)
    const next = getNextRunTime({ type: "cron", expression: "0 9 * * 1-5" }, undefined, from)
    expect(next.getDay()).toBe(1) // Monday
    expect(next.getDate()).toBe(7)
    expect(next.getHours()).toBe(9)
  })

  test("specific day-of-week schedules a week out when the day passed", () => {
    const from = new Date(2026, 8, 1, 12, 0, 0) // 2026-09-01 is a Tuesday
    expect(from.getDay()).toBe(2)
    const next = getNextRunTime({ type: "cron", expression: "30 8 * * 1" }, undefined, from)
    expect(next.getDay()).toBe(1) // Monday
    expect(next.getDate()).toBe(7)
    expect(next.getHours()).toBe(8)
    expect(next.getMinutes()).toBe(30)
  })

  test("every-3-days schedule advances by 3 days", () => {
    const from = new Date(2026, 8, 4, 10, 0, 0)
    const next = getNextRunTime({ type: "cron", expression: "0 0 */3 * *" }, undefined, from)
    expect(next.getDate()).toBe(7)
    expect(next.getHours()).toBe(0)
  })
})

describe("suggestSchedules", () => {
  test("empty query returns all common schedules", () => {
    const all = suggestSchedules("")
    expect(all).toHaveLength(COMMON_SCHEDULES.length)
    expect(all[0]).toHaveProperty("label")
    expect(all[0]).toHaveProperty("value")
  })

  test("parseable query returns a single suggestion", () => {
    const s = suggestSchedules("every 5 minutes")
    expect(s).toHaveLength(1)
    expect(s[0].value).toBe("*/5 * * * *")
  })

  test("label substring filter matches common schedules", () => {
    const s = suggestSchedules("monthly")
    expect(s.length).toBeGreaterThan(0)
    expect(s.every((x) => x.label.toLowerCase().includes("monthly"))).toBe(true)
  })
})

describe("timezone utils", () => {
  test("isValidTimezone", () => {
    expect(isValidTimezone("UTC")).toBe(true)
    expect(isValidTimezone("America/New_York")).toBe(true)
    expect(isValidTimezone("Not/AZone")).toBe(false)
  })

  test("COMMON_TIMEZONES entries are all valid IANA zones", () => {
    for (const tz of COMMON_TIMEZONES) {
      expect(isValidTimezone(tz.value)).toBe(true)
    }
  })

  test("getTimezoneOffset UTC is zero", () => {
    expect(getTimezoneOffset("UTC")).toBe(0)
  })

  test("getNextOccurrenceInTimezone finds next day 9am in UTC", () => {
    const from = new Date(Date.UTC(2026, 8, 4, 10, 0, 0))
    const next = getNextOccurrenceInTimezone("0 9 * * *", "UTC", from)
    expect(next.toISOString()).toBe("2026-09-05T09:00:00.000Z")
  })

  test("getNextOccurrenceInTimezone respects */N minute steps", () => {
    const from = new Date(Date.UTC(2026, 8, 4, 10, 7, 0))
    const next = getNextOccurrenceInTimezone("*/20 * * * *", "UTC", from)
    expect(next.toISOString()).toBe("2026-09-04T10:20:00.000Z")
  })

  test("getNextOccurrenceInTimezone matches day-of-week ranges", () => {
    // 2026-09-05 is a Saturday; next weekday 9am is Monday 2026-09-07.
    const from = new Date(Date.UTC(2026, 8, 5, 10, 0, 0))
    expect(from.getUTCDay()).toBe(6)
    const next = getNextOccurrenceInTimezone("0 9 * * 1-5", "UTC", from)
    expect(next.toISOString()).toBe("2026-09-07T09:00:00.000Z")
  })

  test("getNextOccurrenceInTimezone throws on non-5-part expression", () => {
    expect(() => getNextOccurrenceInTimezone("*/10 * * * * *", "UTC", new Date())).toThrow()
  })

  test("searchTimezones finds zones and caps at 10", () => {
    const hits = searchTimezones("york")
    expect(hits.some((t) => t.value === "America/New_York")).toBe(true)
    expect(searchTimezones("").length).toBeLessThanOrEqual(10)
  })
})

describe("retry utils", () => {
  const base = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    exponential: true,
  }

  test("calculateDelay exponential backoff within jitter bounds", () => {
    for (let i = 0; i < 25; i++) {
      const d = calculateDelay(1, base)
      // base 1000, jitter ±25%
      expect(d).toBeGreaterThanOrEqual(750)
      expect(d).toBeLessThanOrEqual(1250)
    }
  })

  test("calculateDelay linear backoff scales with attempt", () => {
    for (let i = 0; i < 25; i++) {
      const d = calculateDelay(3, { ...base, exponential: false })
      // base 1000*3, jitter ±25%
      expect(d).toBeGreaterThanOrEqual(2250)
      expect(d).toBeLessThanOrEqual(3750)
    }
  })

  test("calculateDelay clamps to maxDelayMs", () => {
    for (let i = 0; i < 25; i++) {
      const d = calculateDelay(10, base)
      expect(d).toBeGreaterThanOrEqual(45000) // 60000 * 0.75
      expect(d).toBeLessThanOrEqual(60000)
    }
  })

  test("withRetry returns immediately on success", async () => {
    let calls = 0
    const result = await withRetry(async () => {
      calls++
      return "ok"
    })
    expect(result).toBe("ok")
    expect(calls).toBe(1)
  })

  test("withRetry retries transient failures then succeeds", async () => {
    let calls = 0
    const result = await withRetry(
      async () => {
        calls++
        if (calls < 3) throw new Error("boom " + calls)
        return "recovered"
      },
      { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 2, backoffMultiplier: 2 },
    )
    expect(result).toBe("recovered")
    expect(calls).toBe(3)
  })

  test("withRetry aborts immediately on non-retryable error", async () => {
    let calls = 0
    const err = new Error("permanent")
    await expect(
      withRetry(
        async () => {
          calls++
          throw err
        },
        { maxAttempts: 5, initialDelayMs: 1, maxDelayMs: 2, isRetryable: () => false },
      ),
    ).rejects.toBe(err)
    expect(calls).toBe(1)
  })

  test("withRetry throws last error after exhausting attempts", async () => {
    let calls = 0
    await expect(
      withRetry(
        async () => {
          calls++
          throw new Error("always fails")
        },
        { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 2 },
      ),
    ).rejects.toThrow("always fails")
    expect(calls).toBe(3)
  })

  test("withRetry invokes onRetry callback", async () => {
    const retried: number[] = []
    await withRetry(
      async () => {
        throw new Error("x")
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1,
        maxDelayMs: 2,
        onRetry: (attempt) => retried.push(attempt),
      },
    ).catch(() => {})
    expect(retried).toEqual([1, 2])
  })

  test("RetryableErrors classifiers", () => {
    expect(RetryableErrors.isNetworkError(new Error("read ECONNRESET"))).toBe(true)
    expect(RetryableErrors.isNetworkError(new Error("validation failed"))).toBe(false)
    expect(RetryableErrors.isServerError(new Error("HTTP 503"))).toBe(true)
    expect(RetryableErrors.isRateLimitError(new Error("429 too many requests"))).toBe(true)
    expect(RetryableErrors.isClientError(new Error("401 Unauthorized"))).toBe(true)
    expect(RetryableErrors.standard(new Error("404 Not Found"))).toBe(false)
    expect(RetryableErrors.standard(new Error("ETIMEDOUT"))).toBe(true)
    const combined = RetryableErrors.any(
      RetryableErrors.isRateLimitError,
      RetryableErrors.isServerError,
    )
    expect(combined(new Error("quota exceeded"))).toBe(true)
    expect(combined(new Error("nope"))).toBe(false)
  })
})

describe("function registry", () => {
  const unique = (label: string) => `test-fn-${label}-${Math.random().toString(36).slice(2)}`

  test("register and get a function", () => {
    const name = unique("get")
    const fn = () => 42
    registerFunction(name, fn)
    expect(getFunction(name)).toBe(fn)
    expect(getFunction(unique("missing"))).toBeUndefined()
  })

  test("duplicate registration throws", () => {
    const name = unique("dup")
    registerFunction(name, () => {})
    expect(() => registerFunction(name, () => {})).toThrow(/already registered/)
  })

  test("listRegisteredFunctions includes registered names", () => {
    const name = unique("list")
    registerFunction(name, () => {})
    expect(listRegisteredFunctions()).toContain(name)
  })

  test("unregisterFunction removes only the named entry", () => {
    const name = unique("unreg")
    registerFunction(name, () => {})
    expect(unregisterFunction(name)).toBe(true)
    expect(getFunction(name)).toBeUndefined()
    expect(unregisterFunction(name)).toBe(false)
  })
})

describe("regression: parseSchedule/isValid recursion fix", () => {
  test("parseSchedule returns null for garbage input (previously stack overflow)", () => {
    expect(parseSchedule("not a schedule at all !!!")).toBeNull()
    expect(parseSchedule("")).toBeNull()
    expect(parseSchedule("every")).toBeNull()
    expect(parseSchedule("1 2 3")).toBeNull()
    expect(parseSchedule("99 99 99 99 99 99 99")).toBeNull()
  })

  test("CronParser.isValid returns false for garbage input (previously stack overflow)", () => {
    expect(CronParser.isValid("not a schedule at all !!!")).toBe(false)
    expect(CronParser.isValid("")).toBe(false)
    expect(CronParser.isValid("every")).toBe(false)
  })

  test("CronParser.isValid still true for cron and natural-language inputs", () => {
    expect(CronParser.isValid("*/5 * * * *")).toBe(true)
    expect(CronParser.isValid("0 9 * * 1-5")).toBe(true)
    expect(CronParser.isValid("every 5 minutes")).toBe(true)
    expect(CronParser.isValid("daily at 9am")).toBe(true)
  })

  test("parseScheduleToType returns null for garbage input", () => {
    expect(parseScheduleToType("total garbage input here")).toBeNull()
  })

  test("getNextOccurrenceInTimezone honors DOW lists (1,3,5)", () => {
    // 2026-09-04 is a Friday (dayOfWeek 5). From Friday 10:00 UTC, the next
    // Mon/Wed/Fri 9am occurrence must be same-day if before 9am, else next listed day.
    const fromFriday = new Date("2026-09-04T08:00:00Z") // Friday 8am UTC
    const next = getNextOccurrenceInTimezone("0 9 * * 1,3,5", "UTC", fromFriday)
    expect(next.toISOString()).toBe("2026-09-04T09:00:00.000Z") // Friday 9am
    const fromFridayNoon = new Date("2026-09-04T12:00:00Z")
    const next2 = getNextOccurrenceInTimezone("0 9 * * 1,3,5", "UTC", fromFridayNoon)
    expect(next2.toISOString()).toBe("2026-09-07T09:00:00.000Z") // Monday 9am
    const fromTuesday = new Date("2026-09-01T12:00:00Z") // Tuesday
    const next3 = getNextOccurrenceInTimezone("0 9 * * 1,3,5", "UTC", fromTuesday)
    expect(next3.toISOString()).toBe("2026-09-02T09:00:00.000Z") // Wednesday 9am
  })
})
