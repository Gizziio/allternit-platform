import Foundation

/// Day-of-week helpers for cron schedule expressions — a Foundation-only port
/// of `parseCronDays`/`applyCronDays` from the web implementation
/// (surfaces/ai.allternit.com/src/views/cowork/DayOfWeekSelector.tsx), so the
/// logic compiles standalone (swiftc harness; no XCTest target exists in the
/// app). Day numbers follow the cron convention: 0 = Sunday ... 6 = Saturday.
enum CronDays {
    /// Parse the day-of-week field (index 4 of a 5-field cron expression)
    /// into selected day numbers. `*` selects all seven days, `?` selects
    /// none; supports comma lists and `1-5` ranges. Fewer than 5 fields is
    /// treated as `*` (same as the web).
    static func parseCronDays(_ expression: String) -> [Int] {
        let parts = fields(of: expression)
        let field = parts.count >= 5 ? parts[4] : "*"

        if field == "*" || field == "?" {
            return field == "*" ? [0, 1, 2, 3, 4, 5, 6] : []
        }

        var days = Set<Int>()
        for chunk in field.split(separator: ",") {
            let chunk = String(chunk)
            if chunk.contains("-") {
                let ends = chunk.split(separator: "-", omittingEmptySubsequences: false)
                if ends.count >= 2, !ends[0].isEmpty, !ends[1].isEmpty,
                   let start = parseIntPrefix(String(ends[0])),
                   let end = parseIntPrefix(String(ends[1])) {
                    var day = max(0, start)
                    while day <= min(6, end) {
                        days.insert(day)
                        day += 1
                    }
                }
            } else if let day = parseIntPrefix(chunk), day >= 0, day <= 6 {
                days.insert(day)
            }
        }

        return days.sorted()
    }

    /// Rewrite the day-of-week field with the selected days: empty → `?`,
    /// all seven → `*`, otherwise the days joined by commas. A malformed
    /// expression (fewer than 5 fields) falls back to `0 9 * * *` before the
    /// day-of-week field is written.
    static func applyCronDays(_ expression: String, days: [Int]) -> String {
        var parts = fields(of: expression)
        if parts.count < 5 {
            // Mirror the web's `parts.length = 5` + per-field defaults: pad
            // to 5 fields, defaulting minute/hour/day/month. The day-of-week
            // field (index 4) is always overwritten below.
            let fallback = ["0", "9", "*", "*", "*"]
            for index in 0..<5 {
                if index < parts.count {
                    if parts[index].isEmpty { parts[index] = fallback[index] }
                } else {
                    parts.append(fallback[index])
                }
            }
        }

        if days.isEmpty {
            parts[4] = "?"
        } else if days.count == 7 {
            parts[4] = "*"
        } else {
            parts[4] = days.map(String.init).joined(separator: ",")
        }

        return parts.joined(separator: " ")
    }

    /// Split on runs of whitespace, matching the web's `trim().split(/\s+/)`.
    private static func fields(of expression: String) -> [String] {
        expression
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .split(whereSeparator: { $0.isWhitespace })
            .map(String.init)
    }

    /// `parseInt(_, 10)` semantics: an optional leading sign followed by as
    /// many leading digits as present, else nil (`Number.isNaN` on the web).
    private static func parseIntPrefix(_ text: String) -> Int? {
        var index = text.startIndex
        var sign = 1
        if index < text.endIndex, text[index] == "-" {
            sign = -1
            index = text.index(after: index)
        } else if index < text.endIndex, text[index] == "+" {
            index = text.index(after: index)
        }

        var value = 0
        var sawDigit = false
        while index < text.endIndex, text[index] >= "0", text[index] <= "9" {
            value = value * 10 + (Int(text[index].asciiValue!) - 48)
            sawDigit = true
            index = text.index(after: index)
        }
        return sawDigit ? sign * value : nil
    }
}
