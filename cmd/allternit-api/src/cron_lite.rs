//! Minimal 5-field cron parser (`minute hour day-of-month month day-of-week`).
//!
//! Supports the common variants needed by scheduled deployments: `*`,
//! `*/step`, single values, `a-b` ranges, `a-b/step` ranges, and
//! comma-separated lists of any of the above. Day-of-week accepts both `0`
//! and `7` for Sunday. This intentionally does not implement named months/
//! weekdays (`JAN`, `MON`, ...) or the `L`/`W`/`#` extensions.

use chrono::{DateTime, Datelike, Duration, Timelike, Utc};
use std::collections::BTreeSet;

/// How far into the future to search for a matching run time before giving
/// up on a cron expression that (for example) requests Feb 30th.
const SEARCH_WINDOW_DAYS: i64 = 4 * 366;

fn parse_field(field: &str, min: u32, max: u32) -> Result<BTreeSet<u32>, String> {
    let mut out = BTreeSet::new();
    for part in field.split(',') {
        let (range_part, step) = match part.split_once('/') {
            Some((r, s)) => (
                r,
                Some(
                    s.parse::<u32>()
                        .map_err(|_| format!("invalid step '{s}' in cron field '{field}'"))?,
                ),
            ),
            None => (part, None),
        };
        let (start, end) = if range_part == "*" {
            (min, max)
        } else if let Some((a, b)) = range_part.split_once('-') {
            let a: u32 = a
                .parse()
                .map_err(|_| format!("invalid range start '{a}' in cron field '{field}'"))?;
            let b: u32 = b
                .parse()
                .map_err(|_| format!("invalid range end '{b}' in cron field '{field}'"))?;
            (a, b)
        } else {
            let v: u32 = range_part
                .parse()
                .map_err(|_| format!("invalid value '{range_part}' in cron field '{field}'"))?;
            (v, v)
        };
        if start < min || end > max || start > end {
            return Err(format!("value out of range in cron field '{field}'"));
        }
        let step = step.unwrap_or(1).max(1);
        let mut v = start;
        while v <= end {
            out.insert(v);
            v += step;
        }
    }
    if out.is_empty() {
        return Err(format!("cron field '{field}' matched no values"));
    }
    Ok(out)
}

/// Compute the next time (strictly after `after`) that `expr` matches.
pub fn next_run_after(expr: &str, after: DateTime<Utc>) -> Result<DateTime<Utc>, String> {
    let fields: Vec<&str> = expr.split_whitespace().collect();
    if fields.len() != 5 {
        return Err("cron expression must have 5 fields: minute hour day month weekday".into());
    }
    let minutes = parse_field(fields[0], 0, 59)?;
    let hours = parse_field(fields[1], 0, 23)?;
    let doms = parse_field(fields[2], 1, 31)?;
    let months = parse_field(fields[3], 1, 12)?;
    let dows = parse_field(fields[4], 0, 7)?;
    let dom_restricted = fields[2] != "*";
    let dow_restricted = fields[4] != "*";

    let mut candidate = after
        .with_second(0)
        .and_then(|d| d.with_nanosecond(0))
        .ok_or_else(|| "invalid base time".to_string())?
        + Duration::minutes(1);
    let limit = candidate + Duration::days(SEARCH_WINDOW_DAYS);

    while candidate < limit {
        let dow = candidate.weekday().num_days_from_sunday();
        let dow_matches = dows.contains(&dow) || (dow == 0 && dows.contains(&7));
        let dom_matches = doms.contains(&candidate.day());
        let day_ok = match (dom_restricted, dow_restricted) {
            (true, true) => dom_matches || dow_matches,
            (true, false) => dom_matches,
            (false, true) => dow_matches,
            (false, false) => true,
        };
        if day_ok
            && months.contains(&candidate.month())
            && hours.contains(&candidate.hour())
            && minutes.contains(&candidate.minute())
        {
            return Ok(candidate);
        }
        candidate += Duration::minutes(1);
    }
    Err("no matching run time found within the search window".into())
}

/// Validate a cron expression without computing a run time.
pub fn validate(expr: &str) -> Result<(), String> {
    next_run_after(expr, Utc::now()).map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn at(y: i32, mo: u32, d: u32, h: u32, mi: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(y, mo, d, h, mi, 0).unwrap()
    }

    #[test]
    fn every_minute() {
        let after = at(2026, 1, 1, 12, 30);
        let next = next_run_after("* * * * *", after).unwrap();
        assert_eq!(next, at(2026, 1, 1, 12, 31));
    }

    #[test]
    fn hourly_on_the_hour() {
        let after = at(2026, 1, 1, 12, 30);
        let next = next_run_after("0 * * * *", after).unwrap();
        assert_eq!(next, at(2026, 1, 1, 13, 0));
    }

    #[test]
    fn daily_at_specific_time_rolls_to_next_day() {
        let after = at(2026, 1, 1, 12, 30);
        let next = next_run_after("30 9 * * *", after).unwrap();
        assert_eq!(next, at(2026, 1, 2, 9, 30));
    }

    #[test]
    fn step_expression() {
        let after = at(2026, 1, 1, 0, 0);
        let next = next_run_after("*/15 * * * *", after).unwrap();
        assert_eq!(next, at(2026, 1, 1, 0, 15));
    }

    #[test]
    fn weekday_field_matches_monday() {
        // 2026-01-05 is a Monday.
        let after = at(2026, 1, 1, 0, 0);
        let next = next_run_after("0 9 * * 1", after).unwrap();
        assert_eq!(next, at(2026, 1, 5, 9, 0));
    }

    #[test]
    fn dom_and_dow_are_unioned_when_both_restricted() {
        // Should match either the 15th of the month or a Monday, whichever
        // comes first — matching standard cron semantics.
        let after = at(2026, 1, 1, 0, 0);
        let next = next_run_after("0 0 15 * 1", after).unwrap();
        assert!(next.day() == 15 || next.weekday().num_days_from_sunday() == 1);
    }

    #[test]
    fn rejects_wrong_field_count() {
        assert!(next_run_after("* * * *", Utc::now()).is_err());
    }

    #[test]
    fn rejects_out_of_range_value() {
        assert!(next_run_after("60 * * * *", Utc::now()).is_err());
    }

    #[test]
    fn rejects_impossible_date() {
        // February never has 30 days.
        assert!(next_run_after("0 0 30 2 *", Utc::now()).is_err());
    }

    #[test]
    fn validate_succeeds_for_valid_and_fails_for_invalid() {
        assert!(validate("* * * * *").is_ok());
        assert!(validate("0 0 * * 0").is_ok());
        assert!(validate("bad").is_err());
        assert!(validate("0 0 31 2 *").is_err());
    }

    #[test]
    fn range_with_step_and_list() {
        // 2026-01-01 00:00 is a Thursday. Match Monday-Friday, every 2 hours
        // starting at 9, on the 1st or 15th, in Jan-Mar. Next after 2026-01-01
        // 00:00 should be 2026-01-01 09:00.
        let after = at(2026, 1, 1, 0, 0);
        let next = next_run_after("0 9-17/2 1,15 1-3 1-5", after).unwrap();
        assert_eq!(next, at(2026, 1, 1, 9, 0));
    }
}
