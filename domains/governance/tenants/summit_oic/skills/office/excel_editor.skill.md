# summit.office.excel_editor

## Purpose
Analyze and edit gradebooks or rosters using deterministic patches.

## PLAN
1) Read XLSX to JSON table: `office.xlsx_read(path)`
2) Analyze data against the objective (e.g., "Flag students below 70%")
3) Propose a Patch List:
```json
[
  { "sheet": "Grades", "cell": "D4", "value": "NEEDS_INTERVENTION" }
]
```

## EXECUTE
1) `office.xlsx_write(path, edits, output_path)`
2) Generate summary receipt.
