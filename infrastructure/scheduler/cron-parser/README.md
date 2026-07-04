# allternit-cron-parser

Natural-language schedule parser. Converts human-readable descriptions into
cron expressions or interval seconds.

## Examples

| Input | Output |
|-------|--------|
| `"every 5 minutes"` | `*/5 * * * *` |
| `"every hour"` | `0 * * * *` |
| `"daily at 9am"` | `0 9 * * *` |
| `"weekdays at noon"` | `0 12 * * 1-5` |
| `"mondays at 8:30"` | `30 8 * * 1` |
| `"on the 1st of every month"` | `0 0 1 * *` |

## Usage

```rust
use allternit_cron_parser::parse;

let schedule = parse("every 5 minutes").unwrap();
assert_eq!(schedule.expression, "*/5 * * * *");
```

## Features

- Cron expression parsing from natural language
- Interval parsing (`"every 30 seconds"`)
- Validates resulting cron expressions
- `serde` support for `ParsedSchedule`

## License

MIT
