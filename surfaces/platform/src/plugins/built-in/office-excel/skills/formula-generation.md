# Skill: Formula Generation

## Trigger
Use this skill when generating or explaining Excel formulas.

## Zero-Error Rules (from tfriedel/claude-office-skills)
1. **Never hardcode calculated values** — use cell references so the spreadsheet stays dynamic
2. Place all assumptions in separate input cells, reference them in formulas
3. Check for division-by-zero: wrap divisions in `IFERROR` or `IF(denominator<>0, ...)`
4. Test sample references before writing to the full range
5. After writing formulas, validate: run a check that no cell shows `#REF!`, `#DIV/0!`, `#VALUE!`, `#N/A`, `#NAME?`

## High-Value Formula Patterns

### Safe Division
```
=IFERROR(A2/B2, 0)
=IF(B2<>0, A2/B2, "N/A")
```

### Cross-Sheet Reference
```
=Sheet2!B5
='Revenue Model'!$C$10   (absolute reference to another sheet)
```

### XLOOKUP (modern, prefer over VLOOKUP)
```
=XLOOKUP(lookup_value, lookup_array, return_array, "Not found", 0)
```

### Dynamic Array Formulas (Excel 365)
```
=FILTER(A2:D100, B2:B100="Active")
=SORT(A2:A50, 1, 1)
=UNIQUE(A2:A100)
=SEQUENCE(10, 1, 2024, 1)   (years 2024–2033)
```

### Financial Formulas
```
=NPV(discount_rate, cash_flow_range)
=IRR(cash_flow_range)
=PMT(rate/12, nper*12, -pv)
=XNPV(rate, values, dates)
=XIRR(values, dates)
```

### Conditional Aggregation
```
=SUMIF(range, criteria, sum_range)
=SUMIFS(sum_range, criteria_range1, criteria1, criteria_range2, criteria2)
=COUNTIFS(range1, criteria1, range2, criteria2)
=AVERAGEIFS(avg_range, criteria_range, criteria)
```

### Text Operations
```
=TEXTJOIN(", ", TRUE, A2:A10)   (join with delimiter, skip blanks)
=TEXT(A1, "$#,##0.0")            (format as text)
=TRIM(CLEAN(A1))                 (clean whitespace and non-printable chars)
```

## Named Range Best Practice
Create named ranges for assumptions:
```javascript
const namedItem = sheet.names.add("DiscountRate", "=Assumptions!$B$5");
// Then use =DiscountRate in formulas for readability
```

## Error Detection Code Pattern
```javascript
// After writing formulas, check for errors
const usedRange = sheet.getUsedRange();
usedRange.load("values");
await context.sync();
const errors = ["#REF!", "#DIV/0!", "#VALUE!", "#N/A", "#NAME?", "#NUM!", "#NULL!"];
const found = usedRange.values.flat().filter(v => errors.includes(String(v)));
return { success: found.length === 0, errors: found };
```
