# Skill: Data Validation

## Trigger
Use this skill when adding dropdowns, restricting input, creating dependent lists, or flagging invalid entries.

## Add a Dropdown List (Static Values)
```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("B2:B100");

  range.dataValidation.rule = {
    list: {
      inCellDropdown: true,
      source: "Active,Inactive,Pending,Archived"
    }
  };

  // Input message shown when cell is selected
  range.dataValidation.prompt = {
    showPrompt: true,
    title: "Status",
    message: "Choose a status from the dropdown."
  };

  // Error alert on invalid entry
  range.dataValidation.errorAlert = {
    showAlert: true,
    style: Excel.DataValidationAlertStyle.stop,
    title: "Invalid Entry",
    message: "Please select a value from the list."
  };

  await context.sync();
});
```

## Dropdown from a Named Range
```javascript
// Reference a range on the same or another sheet
range.dataValidation.rule = {
  list: {
    inCellDropdown: true,
    source: "=Lists!$A$2:$A$20"   // cross-sheet reference
  }
};
await context.sync();
```

## Dependent (Cascading) Dropdowns
```javascript
// Pattern: Category → Sub-category
// 1. Category dropdown in column A
sheetRange.getRange("A2:A100").dataValidation.rule = {
  list: { inCellDropdown: true, source: "=CategoryList!$A$2:$A$10" }
};

// 2. Sub-category uses INDIRECT to reference a named range matching category
sheetRange.getRange("B2:B100").dataValidation.rule = {
  list: { inCellDropdown: true, source: "=INDIRECT(A2)" }
};
// Each category value (e.g. "Hardware") must have a corresponding named range
// called "Hardware" pointing to its sub-list
await context.sync();
```

## Number Validation
```javascript
// Only whole numbers between 1 and 100
range.dataValidation.rule = {
  wholeNumber: {
    formula1: "1",
    formula2: "100",
    operator: Excel.DataValidationOperator.between
  }
};

// Decimal: greater than 0
range.dataValidation.rule = {
  decimal: {
    formula1: "0",
    operator: Excel.DataValidationOperator.greaterThan
  }
};
await context.sync();
```

## Date Validation
```javascript
// Dates must be on or after today
range.dataValidation.rule = {
  date: {
    formula1: "=TODAY()",
    operator: Excel.DataValidationOperator.greaterThanOrEqualTo
  }
};
await context.sync();
```

## Text Length Validation
```javascript
// Limit text to max 50 characters
range.dataValidation.rule = {
  textLength: {
    formula1: "50",
    operator: Excel.DataValidationOperator.lessThanOrEqualTo
  }
};
await context.sync();
```

## Custom Formula Validation
```javascript
// Only uppercase: formula must return TRUE
range.dataValidation.rule = {
  custom: {
    formula: "=EXACT(B2,UPPER(B2))"
  }
};

// Prevent duplicate values in a column
range.dataValidation.rule = {
  custom: {
    formula: "=COUNTIF($B$2:$B$100,B2)=1"
  }
};
await context.sync();
```

## Find Invalid Cells
```javascript
// Locate cells that currently violate their validation rules
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const usedRange = sheet.getUsedRange();
  usedRange.load("address");

  // Excel JS does not expose a direct "getInvalidCells" API.
  // Read values and validation rules together, then check client-side.
  const valRange = sheet.getRange("B2:B50");
  valRange.load("values,dataValidation");
  await context.sync();

  // Alternatively, use the built-in Circle Invalid Data feature (UI only, not API-accessible)
  return { note: "Use Excel's Data > Circle Invalid Data for visual highlighting" };
});
```

## Clear Validation
```javascript
const range = sheet.getRange("B2:B100");
range.dataValidation.clear();
await context.sync();
```

## Alert Style Reference
| Style | Behaviour |
|---|---|
| `Excel.DataValidationAlertStyle.stop` | Blocks invalid entry entirely |
| `Excel.DataValidationAlertStyle.warning` | Warns but allows override |
| `Excel.DataValidationAlertStyle.information` | Informs but always allows |

## Operator Reference
```
between | notBetween | equalTo | notEqualTo
greaterThan | lessThan | greaterThanOrEqualTo | lessThanOrEqualTo
```

## Safety Rules
- Always set `errorAlert.showAlert = true` for stop-style rules; silent validation is confusing
- Use `getItemOrNullObject` before clearing validation on a range that may not have rules set
- Cross-sheet `source` references must include the sheet name with `$` anchors: `=Sheet2!$A$1:$A$10`
- `INDIRECT()` in dependent dropdowns only works when the category cell value exactly matches the named range name (including case)
