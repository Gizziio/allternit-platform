/**
 * Timezone Utilities for Cron Scheduling
 * 
 * Production-ready timezone support using moment-timezone.
 */

import moment from "moment-timezone";
import { Log } from "@/shared/util/log";

const log = Log.create({ service: "cron-timezone" });

/** Valid IANA timezone identifier */
export type Timezone = string;

/** System default timezone */
export const SYSTEM_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Common timezones for UI selection */
export const COMMON_TIMEZONES = [
  { label: "UTC", value: "UTC" },
  { label: "Eastern Time (ET)", value: "America/New_York" },
  { label: "Central Time (CT)", value: "America/Chicago" },
  { label: "Mountain Time (MT)", value: "America/Denver" },
  { label: "Pacific Time (PT)", value: "America/Los_Angeles" },
  { label: "London (GMT)", value: "Europe/London" },
  { label: "Paris (CET)", value: "Europe/Paris" },
  { label: "Berlin (CET)", value: "Europe/Berlin" },
  { label: "Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Sydney (AEST)", value: "Australia/Sydney" },
  { label: "Singapore (SGT)", value: "Asia/Singapore" },
  { label: "Mumbai (IST)", value: "Asia/Kolkata" },
];

/**
 * Validate if a timezone string is valid
 */
export function isValidTimezone(timezone: string): boolean {
  return moment.tz.names().includes(timezone);
}

/**
 * Get current time in specified timezone
 */
export function nowInTimezone(timezone: Timezone = SYSTEM_TIMEZONE): Date {
  return moment.tz(timezone).toDate();
}

/**
 * Convert a date to a specific timezone
 */
export function convertToTimezone(date: Date, timezone: Timezone): Date {
  return moment(date).tz(timezone).toDate();
}

/**
 * Get timezone offset in minutes from UTC
 */
export function getTimezoneOffset(timezone: Timezone): number {
  return moment.tz(timezone).utcOffset();
}

/**
 * Format date for display in timezone
 */
export function formatInTimezone(
  date: Date,
  timezone: Timezone,
  format = "YYYY-MM-DD HH:mm:ss z"
): string {
  return moment(date).tz(timezone).format(format);
}

/**
 * Get the next occurrence of a cron time in a specific timezone
 * 
 * This handles the complexity of timezone transitions (DST, etc.)
 */
export function getNextOccurrenceInTimezone(
  cronExpression: string,
  timezone: Timezone,
  fromDate: Date = new Date()
): Date {
  // For now, use moment-timezone to handle the timezone conversion
  // and then calculate next run
  const fromMoment = moment(fromDate).tz(timezone);
  
  // Parse the cron expression
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }
  
  const [minExpr, hourExpr, dayExpr, monthExpr, dowExpr] = parts;
  
  // Start from the next minute
  let nextMoment = fromMoment.clone().add(1, "minute").startOf("minute");
  let iterations = 0;
  const maxIterations = 366 * 24 * 60; // Max 1 year of minutes
  
  while (iterations < maxIterations) {
    iterations++;
    
    // Check if this time matches the cron expression
    if (matchesCron(nextMoment, minExpr, hourExpr, dayExpr, monthExpr, dowExpr)) {
      // Convert back to system time for storage
      return nextMoment.toDate();
    }
    
    nextMoment.add(1, "minute");
  }
  
  throw new Error(`Could not find next occurrence within 1 year for: ${cronExpression}`);
}

/**
 * Check if a moment matches a cron expression
 */
function matchesCron(
  m: moment.Moment,
  minExpr: string,
  hourExpr: string,
  dayExpr: string,
  monthExpr: string,
  dowExpr: string
): boolean {
  return (
    matchesField(m.minute(), minExpr, 0, 59) &&
    matchesField(m.hour(), hourExpr, 0, 23) &&
    matchesField(m.date(), dayExpr, 1, 31) &&
    matchesField(m.month() + 1, monthExpr, 1, 12) &&
    matchesDOW(m.day(), dowExpr)
  );
}

/**
 * Check if a value matches a cron field expression
 */
function matchesField(value: number, expr: string, min: number, max: number): boolean {
  // Handle wildcard
  if (expr === "*") return true;
  
  // Handle step values (*/5)
  if (expr.startsWith("*/")) {
    const step = parseInt(expr.slice(2), 10);
    return value % step === 0;
  }
  
  // Handle ranges (1-5)
  if (expr.includes("-")) {
    const [start, end] = expr.split("-").map((n) => parseInt(n, 10));
    return value >= start && value <= end;
  }
  
  // Handle lists (1,3,5)
  if (expr.includes(",")) {
    const values = expr.split(",").map((n) => parseInt(n, 10));
    return values.includes(value);
  }
  
  // Handle single value
  return value === parseInt(expr, 10);
}

/**
 * Check if day of week matches
 */
function matchesDOW(dayOfWeek: number, expr: string): boolean {
  // JavaScript day(): 0 = Sunday, 1 = Monday, ...
  // Cron day: 0 = Sunday, 1 = Monday, ...
  
  // Handle wildcard
  if (expr === "*") return true;
  
  // Handle ranges like 1-5 (Monday-Friday)
  if (expr.includes("-")) {
    const [start, end] = expr.split("-").map((n) => parseInt(n, 10));
    return dayOfWeek >= start && dayOfWeek <= end;
  }
  
  // Handle specific day
  return dayOfWeek === parseInt(expr, 10);
}

/**
 * Calculate the next run time considering timezone
 */
export function calculateNextRun(
  cronExpression: string,
  timezone: Timezone = SYSTEM_TIMEZONE,
  fromDate: Date = new Date()
): Date {
  try {
    return getNextOccurrenceInTimezone(cronExpression, timezone, fromDate);
  } catch (error) {
    log.error("Failed to calculate next run", {
      cronExpression,
      timezone,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * List all available timezones
 */
export function listTimezones(): string[] {
  return moment.tz.names();
}

/**
 * Search timezones by name
 */
export function searchTimezones(query: string): Array<{ label: string; value: string }> {
  const normalized = query.toLowerCase();
  return moment
    .tz.names()
    .filter((tz) => tz.toLowerCase().includes(normalized))
    .map((tz) => ({
      label: tz,
      value: tz,
    }))
    .slice(0, 10);
}

/**
 * Get timezone abbreviation
 */
export function getTimezoneAbbreviation(timezone: Timezone): string {
  return moment.tz(timezone).format("z");
}

/**
 * Check if timezone observes DST
 */
export function observesDST(timezone: Timezone): boolean {
  return moment.tz(timezone).isDST();
}
