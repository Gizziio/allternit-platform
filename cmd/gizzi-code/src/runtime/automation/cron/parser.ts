/**
 * Natural Language Schedule Parser
 * 
 * Converts human-readable schedule descriptions to cron expressions or intervals.
 * Inspired by Supabase Cron's natural language support.
 * 
 * Examples:
 * - "every 5 minutes" becomes star/5 star star star star
 * - "every hour" becomes 0 star star star star
 * - "daily at 9am" becomes 0 9 star star star
 * - "weekdays at noon" becomes 0 12 star star 1-5
 * - "mondays at 8:30" becomes 30 8 star star 1
 * - "on the 1st of every month" becomes 0 0 1 star star
 * - "every 30 seconds" becomes interval: 30
 */

import type { ParsedSchedule, Schedule } from "./types";

// ═══════════════════════════════════════════════════════════════════════════════
// Time Patterns
// ═══════════════════════════════════════════════════════════════════════════════

const TIME_PATTERNS: Array<{
  pattern: RegExp;
  handler: (match: RegExpMatchArray) => ParsedSchedule | null;
}> = [
  // Every N seconds
  {
    pattern: /^(?:every\s+)?(\d+)\s*(?:seconds?|secs?)$/i,
    handler: (m) => ({
      original: m[0],
      type: "interval",
      expression: `*/${m[1]} * * * * *`,
      seconds: parseInt(m[1], 10),
      description: `Every ${m[1]} seconds`,
    }),
  },
  
  // Every N minutes
  {
    pattern: /^(?:every\s+)?(\d+)\s*(?:minutes?|mins?)$/i,
    handler: (m) => ({
      original: m[0],
      type: "cron",
      expression: `*/${m[1]} * * * *`,
      description: `Every ${m[1]} minutes`,
    }),
  },
  
  // Every N hours
  {
    pattern: /^(?:every\s+)?(\d+)\s*(?:hours?|hrs?)$/i,
    handler: (m) => ({
      original: m[0],
      type: "cron",
      expression: `0 */${m[1]} * * *`,
      description: `Every ${m[1]} hours`,
    }),
  },
  
  // Every N days
  {
    pattern: /^(?:every\s+)?(\d+)\s*days?$/i,
    handler: (m) => ({
      original: m[0],
      type: "cron",
      expression: `0 0 */${m[1]} * *`,
      description: `Every ${m[1]} days`,
    }),
  },
  
  // Every N weeks
  {
    pattern: /^(?:every\s+)?(\d+)\s*weeks?$/i,
    handler: (m) => ({
      original: m[0],
      type: "cron",
      expression: `0 0 * * 0 */${m[1]}`,
      description: `Every ${m[1]} weeks`,
    }),
  },
  
  // Hourly
  {
    pattern: /^(?:every\s+)?hour(?:ly)?$/i,
    handler: () => ({
      original: "hourly",
      type: "cron",
      expression: "0 * * * *",
      description: "Every hour",
    }),
  },
  
  // Daily at specific time
  {
    pattern: /^daily(?:\s+at\s+(noon|midnight|\d+(?::\d+)?(?:\s*[ap]m?)?))?$/i,
    handler: (m) => {
      let hour = 0;
      let minute = 0;
      
      if (m[1]) {
        const timeSpec = m[1].toLowerCase().trim();
        
        if (timeSpec === "noon") {
          hour = 12;
          minute = 0;
        } else if (timeSpec === "midnight") {
          hour = 0;
          minute = 0;
        } else {
          // Parse time like "9", "9am", "9:30", "9:30am"
          const timeMatch = timeSpec.match(/^(\d+)(?::(\d+))?\s*(am?|pm?)?$/i);
          if (timeMatch) {
            hour = parseInt(timeMatch[1], 10);
            minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
            const ampm = timeMatch[3]?.toLowerCase();
            if (ampm?.startsWith("p") && hour !== 12) hour += 12;
            if (ampm?.startsWith("a") && hour === 12) hour = 0;
          }
        }
      }
      
      return {
        original: m[0],
        type: "cron",
        expression: `${minute} ${hour} * * *`,
        description: `Daily at ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
      };
    },
  },
  
  // Weekdays at time
  {
    pattern: /^(?:weekdays?|business\s+days?)(?:\s+at\s+(noon|midnight|\d+(?::\d+)?(?:\s*[ap]m?)?))?$/i,
    handler: (m) => {
      let hour = 9;
      let minute = 0;
      
      if (m[1]) {
        const timeSpec = m[1].toLowerCase().trim();
        
        if (timeSpec === "noon") {
          hour = 12;
          minute = 0;
        } else if (timeSpec === "midnight") {
          hour = 0;
          minute = 0;
        } else {
          // Parse time like "9", "9am", "9:30", "9:30am"
          const timeMatch = timeSpec.match(/^(\d+)(?::(\d+))?\s*(am?|pm?)?$/i);
          if (timeMatch) {
            hour = parseInt(timeMatch[1], 10);
            minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
            const ampm = timeMatch[3]?.toLowerCase();
            if (ampm?.startsWith("p") && hour !== 12) hour += 12;
            if (ampm?.startsWith("a") && hour === 12) hour = 0;
          }
        }
      }
      
      return {
        original: m[0],
        type: "cron",
        expression: `${minute} ${hour} * * 1-5`,
        description: `Weekdays at ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
      };
    },
  },
  
  // Specific day of week at time
  {
    pattern: /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?(?:\s+at\s+(\d+)(?::(\d+))?\s*(am?|pm?)?)?$/i,
    handler: (m) => {
      const dayMap: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6,
      };
      const dayName = m[1].toLowerCase();
      let hour = m[2] ? parseInt(m[2], 10) : 9;
      const minute = m[3] ? parseInt(m[3], 10) : 0;
      const ampm = m[4]?.toLowerCase();
      
      if (ampm === "pm" && hour !== 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;
      
      return {
        original: m[0],
        type: "cron",
        expression: `${minute} ${hour} * * ${dayMap[dayName]}`,
        description: `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}s at ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
      };
    },
  },
  
  // Monthly on specific day
  {
    pattern: /^(?:monthly|every\s+month)(?:\s+on\s+the\s+(\d+)(?:st|nd|rd|th)?)?(?:\s+at\s+(\d+)(?::(\d+))?\s*(am?|pm?)?)?$/i,
    handler: (m) => {
      const day = m[1] ? parseInt(m[1], 10) : 1;
      let hour = m[2] ? parseInt(m[2], 10) : 0;
      const minute = m[3] ? parseInt(m[3], 10) : 0;
      const ampm = m[4]?.toLowerCase();
      
      if (ampm === "pm" && hour !== 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;
      
      return {
        original: m[0],
        type: "cron",
        expression: `${minute} ${hour} ${day} * *`,
        description: `Monthly on the ${day}${getOrdinal(day)} at ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
      };
    },
  },
  
  // Yearly/Annually
  {
    pattern: /^(?:yearly|annually)$/i,
    handler: () => ({
      original: "yearly",
      type: "cron",
      expression: "0 0 1 1 *",
      description: "Yearly on January 1st",
    }),
  },
  
  // At specific time (assume daily)
  {
    pattern: /^(?:at\s+)?(\d+)(?::(\d+))?\s*(am?|pm?)$/i,
    handler: (m) => {
      let hour = parseInt(m[1], 10);
      const minute = m[2] ? parseInt(m[2], 10) : 0;
      const ampm = m[3].toLowerCase();
      
      if (ampm === "pm" && hour !== 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;
      
      return {
        original: m[0],
        type: "cron",
        expression: `${minute} ${hour} * * *`,
        description: `Daily at ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
      };
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export namespace CronParser {
  export function isValid(expression: string): boolean {
    const parts = expression.trim().split(/\s+/);
    if (parts.length === 5 || parts.length === 6) {
      // Basic validation - check for valid cron syntax
      const validPattern = /^[\d*,/-?#LW]+$|^(\*|\?)$/;
      if (parts.every((part) => validPattern.test(part))) {
        return true;
      }
    }
    
    // Also check if it's a valid natural language schedule
    return parseSchedule(expression) !== null;
  }
}

function isValidCron(expression: string): boolean {
  return CronParser.isValid(expression);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Parser Function
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse a natural language schedule description into a structured schedule
 */
export function parseSchedule(input: string): ParsedSchedule | null {
  const normalized = input.toLowerCase().trim();
  
  // Try natural language patterns first
  for (const { pattern, handler } of TIME_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      const result = handler(match);
      if (result) return result;
    }
  }
  
  // Check if it's already a valid cron expression
  if (isValidCron(input)) {
    const parts = input.trim().split(/\s+/);
    return {
      original: input,
      type: parts.length === 6 ? "interval" : "cron",
      expression: input.trim(),
      seconds: parts.length === 6 ? parseInt(parts[0].replace("*/", ""), 10) : undefined,
      description: `Cron: ${input}`,
    };
  }
  
  return null;
}

/**
 * Parse schedule to internal Schedule type
 */
export function parseScheduleToType(input: string): Schedule | null {
  const parsed = parseSchedule(input);
  if (!parsed) return null;
  
  if (parsed.type === "interval" && parsed.seconds) {
    return {
      type: "interval",
      seconds: parsed.seconds,
    };
  }
  
  return {
    type: "cron",
    expression: parsed.expression,
  };
}

/**
 * Convert a Schedule to a human-readable description
 */
export function describeSchedule(schedule: Schedule): string {
  if (schedule.type === "interval") {
    const mins = Math.floor(schedule.seconds / 60);
    const secs = schedule.seconds % 60;
    if (mins > 0 && secs > 0) return `Every ${mins}m ${secs}s`;
    if (mins > 0) return `Every ${mins} minute${mins > 1 ? "s" : ""}`;
    return `Every ${secs} second${secs > 1 ? "s" : ""}`;
  }
  
  // Parse cron expression for description
  const parts = schedule.expression.split(/\s+/);
  if (parts.length === 5) {
    const [min, hour, day, month, dow] = parts;
    
    // Common patterns
    if (min === "0" && hour === "0" && day === "*" && month === "*" && dow === "*") {
      return "Daily at midnight";
    }
    if (min === "0" && hour === "*" && day === "*" && month === "*" && dow === "*") {
      return "Every hour";
    }
    if (min === "0" && hour === "*" && day === "*" && month === "*" && dow === "*") {
      return "Every hour";
    }
    if (min.startsWith("*/") && hour === "*" && day === "*" && month === "*" && dow === "*") {
      return `Every ${min.slice(2)} minutes`;
    }
    if (min === "0" && hour.startsWith("*/") && day === "*" && month === "*" && dow === "*") {
      return `Every ${hour.slice(2)} hours`;
    }
    if (min === "0" && hour === "9" && day === "*" && month === "*" && dow === "1-5") {
      return "Weekdays at 9:00 AM";
    }
    
    // Time description
    let desc = "";
    if (hour !== "*" && min !== "*") {
      const h = parseInt(hour, 10);
      const m = parseInt(min, 10);
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      desc = `at ${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
    }
    
    // Day description
    if (dow === "1-5") {
      desc = `Weekdays ${desc}`.trim();
    } else if (dow === "0,6") {
      desc = `Weekends ${desc}`.trim();
    } else if (dow !== "*") {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dowList = dow.split(",").map((d) => days[parseInt(d, 10)]).join(", ");
      desc = `${dowList} ${desc}`.trim();
    } else if (day !== "*") {
      desc = `monthly on day ${day} ${desc}`.trim();
    } else {
      desc = `Daily ${desc}`.trim();
    }
    
    return desc;
  }
  
  return `Cron: ${schedule.expression}`;
}

/**
 * Get the next run time for a given schedule
 */
export function getNextRunTime(schedule: Schedule, timezone?: string, from = new Date()): Date {
  // For interval schedules
  if (schedule.type === "interval") {
    const next = new Date(from.getTime() + schedule.seconds * 1000);
    return next;
  }
  
  // For cron schedules, we'll use a simple implementation
  // In production, use a library like cron-parser
  const parts = schedule.expression.split(/\s+/);
  if (parts.length !== 5) return new Date(from.getTime() + 60000); // Default: 1 minute
  
  const [minExpr, hourExpr, dayExpr, monthExpr, dowExpr] = parts;
  const next = new Date(from);
  next.setSeconds(0, 0);
  
  // Handle simple */N minute patterns
  if (minExpr.startsWith("*/")) {
    const interval = parseInt(minExpr.slice(2), 10);
    const currentMin = next.getMinutes();
    const nextMin = Math.ceil((currentMin + 1) / interval) * interval;
    if (nextMin >= 60) {
      next.setHours(next.getHours() + 1, nextMin - 60);
    } else {
      next.setMinutes(nextMin);
    }
    return next;
  }
  
  // Handle specific minute with interval hour (e.g., "0 */6 * * *")
  if (minExpr !== "*" && hourExpr.startsWith("*/")) {
    const targetMin = parseInt(minExpr, 10);
    const hourInterval = parseInt(hourExpr.slice(2), 10);
    if (!isNaN(targetMin) && !isNaN(hourInterval)) {
      next.setMinutes(targetMin, 0, 0);
      const currentHour = next.getHours();
      let targetHour = Math.ceil((currentHour + 1) / hourInterval) * hourInterval;
      if (targetHour >= 24) {
        targetHour = 0;
        next.setDate(next.getDate() + 1);
      }
      next.setHours(targetHour);
      if (next <= from) {
        // If still in the past, advance by the interval
        next.setHours(next.getHours() + hourInterval);
        if (next.getHours() >= 24 || next.getHours() < targetMin) {
          next.setDate(next.getDate() + 1);
          next.setHours(targetHour);
        }
      }
      return next;
    }
  }

  // Handle specific minute/hour
  if (minExpr !== "*" && hourExpr !== "*") {
    const targetMin = parseInt(minExpr, 10);
    const targetHour = parseInt(hourExpr, 10);
    
    if (!isNaN(targetMin) && !isNaN(targetHour)) {
      next.setMinutes(targetMin, 0, 0);
      next.setHours(targetHour);
      
      if (next <= from) {
        // Move to next occurrence
        if (dowExpr === "1-5") {
          // Weekdays
          const currentDow = next.getDay();
          let daysToAdd = 1;
          if (currentDow === 5) daysToAdd = 3; // Friday -> Monday
          else if (currentDow === 6) daysToAdd = 2; // Saturday -> Monday
          next.setDate(next.getDate() + daysToAdd);
        } else if (dowExpr === "*" && dayExpr === "*") {
          // Daily
          next.setDate(next.getDate() + 1);
        } else if (dayExpr.startsWith("*/")) {
          // Every N days
          const interval = parseInt(dayExpr.slice(2), 10);
          next.setDate(next.getDate() + interval);
        } else if (dowExpr !== "*") {
          // Specific day of week
          const targetDow = parseInt(dowExpr, 10);
          const currentDow = next.getDay();
          let daysToAdd = targetDow - currentDow;
          if (daysToAdd <= 0) daysToAdd += 7;
          next.setDate(next.getDate() + daysToAdd);
        } else {
          next.setDate(next.getDate() + 1);
        }
      }
      
      return next;
    }
  }
  
  // Fallback: next minute
  next.setMinutes(next.getMinutes() + 1);
  return next;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI Helper: Interactive Schedule Builder
// ═══════════════════════════════════════════════════════════════════════════════

export const COMMON_SCHEDULES = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 2 hours", value: "0 */2 * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every 12 hours", value: "0 */12 * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Daily at 6 AM", value: "0 6 * * *" },
  { label: "Daily at 9 AM", value: "0 9 * * *" },
  { label: "Daily at noon", value: "0 12 * * *" },
  { label: "Daily at 6 PM", value: "0 18 * * *" },
  { label: "Weekdays at 9 AM", value: "0 9 * * 1-5" },
  { label: "Weekdays at noon", value: "0 12 * * 1-5" },
  { label: "Weekdays at 6 PM", value: "0 18 * * 1-5" },
  { label: "Mondays at 9 AM", value: "0 9 * * 1" },
  { label: "Fridays at 5 PM", value: "0 17 * * 5" },
  { label: "Weekly on Sunday", value: "0 0 * * 0" },
  { label: "Monthly on the 1st", value: "0 0 1 * *" },
  { label: "Monthly on the 15th", value: "0 0 15 * *" },
];

export function suggestSchedules(query: string): Array<{ label: string; value: string; description: string }> {
  const normalized = query.toLowerCase().trim();
  
  // Return all common schedules if query is empty
  if (!normalized) {
    return COMMON_SCHEDULES.map((s) => ({
      ...s,
      description: `Cron: ${s.value}`,
    }));
  }
  
  // Parse and suggest
  const parsed = parseSchedule(query);
  if (parsed) {
    return [{
      label: parsed.description,
      value: parsed.expression,
      description: parsed.type === "interval" ? `Interval: ${parsed.seconds}s` : `Cron: ${parsed.expression}`,
    }];
  }
  
  // Filter common schedules
  return COMMON_SCHEDULES
    .filter((s) => s.label.toLowerCase().includes(normalized))
    .map((s) => ({
      ...s,
      description: `Cron: ${s.value}`,
    }));
}
