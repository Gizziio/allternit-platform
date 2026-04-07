# Cookbook: Build a DCF Model from Scratch

## Prerequisites
- An Excel workbook is open
- Run `excel:analyze` on any existing data first to understand the starting point
- Have assumptions ready: revenue base, growth rates, WACC, terminal growth rate

---

## Step 1: Create Sheet Structure

**Command**: `excel:model` → "build a DCF model"

The plugin creates 7 sheets with color-coded tabs:
| Sheet | Tab Color | Purpose |
|---|---|---|
| Cover | Dark sand | Title, date, disclaimer |
| Assumptions | Blue | All hardcoded inputs |
| IS | Green | Income Statement |
| BS | Green | Balance Sheet |
| CFS | Green | Cash Flow Statement |
| Output | Sand | Summary, Enterprise Value |
| Sensitivity | Sand-dark | WACC × Terminal Growth table |

**Verify**: All 7 tabs exist before proceeding.

---

## Step 2: Populate Assumptions Sheet

Navigate to the Assumptions sheet. All values here must be in **blue font** (`#0070C0`).

| Assumption | Default | Notes |
|---|---|---|
| Revenue (Year 0) | $100M | Actual trailing year |
| Revenue Growth — Y1 | 15% | Mgmt guidance |
| Revenue Growth — Y2 | 12% | |
| Revenue Growth — Y3–5 | 10% | |
| EBITDA Margin | 25% | Historical avg |
| D&A % Revenue | 3% | |
| CapEx % Revenue | 5% | |
| NWC % Revenue | 8% | |
| Tax Rate | 21% | US statutory |
| WACC | 10% | Calculated separately |
| Terminal Growth Rate | 2.5% | ~GDP growth |

```javascript
// Apply blue font to all input cells
assumptionsSheet.getRange("B2:B20").format.font.color = "#0070C0";
```

---

## Step 3: Revenue Projection (IS Sheet)

**Command**: `excel:formula` → "project revenue for 5 years using growth rates from Assumptions"

Formula pattern for Year 1 (column C, Year 0 in column B):
```
=B5*(1+Assumptions!$B$3)
```
- `B5` = prior year revenue
- `Assumptions!$B$3` = Y1 growth rate
- Green font for cross-sheet links: `#00B050`

Build the full P&L:
```
Revenue
- COGS  (=Revenue × (1 - EBITDA Margin))
= Gross Profit
- OpEx
= EBITDA
- D&A
= EBIT
- Interest
= EBT
- Taxes (=EBT × Tax Rate)
= Net Income
```

---

## Step 4: Free Cash Flow Bridge (CFS Sheet)

**Command**: `excel:formula` → "calculate FCF from EBITDA"

FCF formula:
```
FCF = EBITDA × (1 - Tax Rate) - CapEx + D&A - ΔNWC
```

Or in cells:
```
= EBITDA - Taxes on EBIT - CapEx - Change in NWC
```

Link each line to IS/Assumptions with green font cross-sheet references.

---

## Step 5: DCF Calculation (Output Sheet)

**Command**: `excel:formula` → "calculate present value of FCFs using WACC"

```javascript
// PV of each FCF year
const dcfFormulas = [
  "=CFS!C_FCF/(1+Assumptions!WACC)^1",
  "=CFS!D_FCF/(1+Assumptions!WACC)^2",
  "=CFS!E_FCF/(1+Assumptions!WACC)^3",
  "=CFS!F_FCF/(1+Assumptions!WACC)^4",
  "=CFS!G_FCF/(1+Assumptions!WACC)^5",
];

// Terminal Value (Gordon Growth)
// =FCF_Y5*(1+TermGrowth)/(WACC-TermGrowth)/(1+WACC)^5
const terminalValueFormula =
  "=CFS!G_FCF*(1+Assumptions!TermGrowth)/(Assumptions!WACC-Assumptions!TermGrowth)/(1+Assumptions!WACC)^5";

// Enterprise Value = Sum of PV(FCFs) + PV(TV)
const evFormula = "=SUM(PV_FCF_Range)+PV_TerminalValue";
```

---

## Step 6: Sensitivity Table (Sensitivity Sheet)

**Command**: `excel:formula` → "build a 2-way sensitivity table for Enterprise Value varying WACC and terminal growth"

Set up data table with:
- Row axis: WACC (8%, 9%, 10%, 11%, 12%)
- Column axis: Terminal Growth (1.5%, 2.0%, 2.5%, 3.0%, 3.5%)
- Formula in top-left corner: link to Output!EnterpriseValue

Use Excel's Data > What-If Analysis > Data Table with the two input cells pointing to WACC and TermGrowth cells in Assumptions.

Apply color scale conditional formatting (red → yellow → green) to the output range.

---

## Step 7: Validation Checklist

Run after every structural change:
- [ ] Assumptions sheet: all inputs in blue font
- [ ] IS, BS, CFS: all cross-sheet links in green font
- [ ] Balance sheet: Assets = Liabilities + Equity (check row shows 0)
- [ ] CFS: Ending cash balance ties to BS cash line
- [ ] No `#REF!`, `#DIV/0!`, `#N/A` errors anywhere
- [ ] Output: Enterprise Value populates from DCF sum

**Command**: `excel:analyze` → "check this workbook for formula errors"
