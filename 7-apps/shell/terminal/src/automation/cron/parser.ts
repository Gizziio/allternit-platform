// Simple cron expression parser
// Supports: * * * * * (minute hour day month dow)
// For now, uses a simple interval-based approximation

export namespace CronParser {
  export interface CronExpression {
    next(): Date
  }

  export function parseExpression(expression: string, options?: { currentDate?: Date }): CronExpression {
    const parts = expression.trim().split(/\s+/)
    
    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression: ${expression}. Expected 5 parts (minute hour day month dow)`)
    }

    const [minute, hour, day, month, dow] = parts
    const currentDate = options?.currentDate ?? new Date()

    return {
      next: () => calculateNext(minute, hour, day, month, dow, currentDate),
    }
  }

  function calculateNext(
    minuteExpr: string,
    hourExpr: string,
    dayExpr: string,
    monthExpr: string,
    dowExpr: string,
    fromDate: Date,
  ): Date {
    const next = new Date(fromDate)
    next.setMilliseconds(0)
    next.setSeconds(0)

    // Simple heuristic: find next occurrence
    // For complex expressions, default to next minute
    
    // Handle simple minute intervals like */5
    if (minuteExpr.startsWith("*/")) {
      const interval = parseInt(minuteExpr.slice(2), 10)
      if (!isNaN(interval) && interval > 0) {
        const currentMinute = next.getMinutes()
        const nextMinute = Math.ceil((currentMinute + 1) / interval) * interval
        if (nextMinute < 60) {
          next.setMinutes(nextMinute)
        } else {
          next.setMinutes(0)
          next.setHours(next.getHours() + 1)
        }
        return next
      }
    }

    // Handle specific minute
    if (minuteExpr !== "*") {
      const specificMinute = parseInt(minuteExpr, 10)
      if (!isNaN(specificMinute) && specificMinute >= 0 && specificMinute < 60) {
        if (next.getMinutes() >= specificMinute) {
          next.setHours(next.getHours() + 1)
        }
        next.setMinutes(specificMinute)
        return next
      }
    }

    // Handle specific hour
    if (hourExpr !== "*") {
      const specificHour = parseInt(hourExpr, 10)
      if (!isNaN(specificHour) && specificHour >= 0 && specificHour < 24) {
        if (next.getHours() > specificHour || (next.getHours() === specificHour && next.getMinutes() >= 0)) {
          next.setDate(next.getDate() + 1)
        }
        next.setHours(specificHour)
        next.setMinutes(minuteExpr === "*" ? 0 : parseInt(minuteExpr, 10) || 0)
        return next
      }
    }

    // Default: next minute
    next.setMinutes(next.getMinutes() + 1)
    return next
  }

  // Validate a cron expression
  export function isValid(expression: string): boolean {
    try {
      const parts = expression.trim().split(/\s+/)
      if (parts.length !== 5) return false
      
      // Basic validation - each part should be valid
      for (const part of parts) {
        if (part === "*") continue
        if (part.startsWith("*/")) {
          const num = parseInt(part.slice(2), 10)
          if (isNaN(num) || num <= 0) return false
          continue
        }
        if (part.includes(",")) {
          const values = part.split(",")
          for (const v of values) {
            if (isNaN(parseInt(v, 10))) return false
          }
          continue
        }
        if (isNaN(parseInt(part, 10))) return false
      }
      
      return true
    } catch {
      return false
    }
  }
}
