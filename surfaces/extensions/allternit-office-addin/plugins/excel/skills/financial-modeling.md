# Skill: Financial Modeling

## Trigger
Use this skill when building or extending financial models (DCF, comps, LBO, 3-statement, P&L, budget).

## Source
Adapted from `tfriedel/claude-office-skills` (MIT) and `anthropics/financial-services-plugins` (Apache 2.0).

## Model Structure Conventions

### Sheet Organization
Standard financial model sheet order:
1. **Cover** — title, date, disclaimer
2. **Assumptions** — all hardcoded inputs (blue font)
3. **Income Statement** (IS)
4. **Balance Sheet** (BS)
5. **Cash Flow Statement** (CFS)
6. **Supporting Schedules** (Debt, Working Capital, PP&E, etc.)
7. **Output / Summary** — key metrics and charts
8. **Sensitivity** — data tables with scenario analysis

### Color Coding (industry standard)
```javascript
const COLORS = {
  input:    "#0070C0", // Blue  — hardcoded values, user inputs
  formula:  "#000000", // Black — all formulas
  link:     "#00B050", // Green — cross-sheet links within workbook
  external: "#FF0000", // Red   — external file links
  warning:  "#FFFF00", // Yellow background — key assumptions
};
```

### Number Formatting by Data Type
```javascript
const FORMATS = {
  currency:    "$#,##0",
  currencyMM:  "$#,##0.0,,",           // in $mm
  percentage:  "0.0%",
  multiple:    "0.0x",
  integer:     "#,##0",
  yearLabel:   "@",                     // text format for years
  zeroAsDash:  '_($* #,##0_);_($* (#,##0);_($* "-"_);_(@_)',
  negative:    "(#,##0)",              // parentheses for negatives
};
```

## Model Build Pattern (Step-by-Step)

### Step 1: Assumptions Sheet
```javascript
// All hardcoded values go here
const assumptionsSheet = workbook.worksheets.add("Assumptions");
const inputs = [
  ["Assumption", "Value", "Units", "Source"],
  ["Revenue Growth Rate", 0.12, "%", "Management"],
  ["EBITDA Margin", 0.25, "%", "Historical avg"],
  ["Tax Rate", 0.25, "%", "Statutory"],
  ["Discount Rate (WACC)", 0.10, "%", "Calculated"],
  ["Terminal Growth Rate", 0.025, "%", "GDP growth"]
];
const range = assumptionsSheet.getRange(`A1:D${inputs.length}`);
range.values = inputs;
range.getRow(0).format.font.bold = true;
// Blue font for input values
assumptionsSheet.getRange("B2:B100").format.font.color = "#0070C0";
```

### Step 2: Income Statement
```javascript
// Headers row with year labels as text
const years = ["Item", "2022A", "2023A", "2024E", "2025E", "2026E"];
// Rows reference Assumptions sheet with green links
const isRows = [
  ["Revenue",      "=Historical!B5", "=Historical!C5", "=C3*(1+Assumptions!$B$2)", ...],
  ["COGS",         ...],
  ["Gross Profit", "=B4-B5", ...],  // black formula
];
```

### Step 3: Validation Check Row
Always add a balance check row at the bottom:
```javascript
// Assets = Liabilities + Equity check
const checkRow = bsSheet.getRange(`A${lastRow}`);
checkRow.values = [["Balance Check (should be 0)"]];
const checkFormula = bsSheet.getRange(`B${lastRow}`);
checkFormula.formulas = [["=B_TotalAssets - B_TotalLiabilitiesEquity"]];
// Conditional format: red if non-zero
const cf = checkFormula.conditionalFormats.add(Excel.ConditionalFormatType.cellValue);
cf.cellValue.format.font.color = "#FF0000";
cf.cellValue.rule = { formula1: "0", operator: Excel.ConditionalCellValueOperator.notEqual };
```

## DCF Calculation Pattern
```javascript
// Terminal Value = FCF_terminal * (1 + g) / (WACC - g)
// PV of Terminal Value = TV / (1 + WACC)^n
// Enterprise Value = Sum(PV of FCFs) + PV of TV
const dcfFormulas = [
  ["=FCF_Year1/(1+WACC)^1"],
  ["=FCF_Year2/(1+WACC)^2"],
  ["=FCF_Year3/(1+WACC)^3"],
  ["=FCF_Year4/(1+WACC)^4"],
  ["=FCF_Year5/(1+WACC)^5"],
  ["=FCF_Year5*(1+TermGrowth)/(WACC-TermGrowth)/(1+WACC)^5"],  // PV of Terminal Value
];
```

## Error Prevention Checklist
After building a model, verify:
- [ ] No `#REF!`, `#DIV/0!`, `#VALUE!`, `#N/A` errors anywhere
- [ ] Balance sheet balances (Assets = L + E)
- [ ] Cash flow statement ties to balance sheet change in cash
- [ ] Income statement net income ties to retained earnings movement
- [ ] All assumptions are in blue font
- [ ] All cross-sheet links are in green font
